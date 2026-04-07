/**
 * SharedBatchScoringService
 *
 * Unified OpenAI-powered batch scoring for ALL TalentScope engines.
 *
 * Key design decisions:
 *  - **Batch processing**: evaluates N profiles in a single API call (up to MAX_BATCH)
 *    to minimise latency and token overhead versus N separate calls.
 *  - **Dynamic system prompt**: each engine injects its own recruiter persona /
 *    scoring rubric so results stay relevant to the platform (GitHub, LinkedIn, etc.).
 *  - **Graceful degradation**: if OpenAI is unavailable or the key is missing,
 *    every profile receives a neutral score (0) with an explanatory reason.
 *  - **Retry with exponential back-off**: retries up to MAX_RETRIES times on
 *    transient errors (rate limits, network failures).
 *
 * Usage:
 *   const scorer = new SharedBatchScoringService(openaiKey, systemPrompt);
 *   const results = await scorer.scoreBatch(profiles);
 *   // results[i].score  → 0-100
 *   // results[i].reasoning → explanation string
 */

import OpenAI from 'openai';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A minimal profile representation consumed by the scoring service. */
export interface ScoringProfile {
    /** Unique per-batch identifier; the service echoes it back so results can be zipped. */
    id: string;
    /** Free-text blob: name, title, bio, skills, location, etc. Each engine decides what to include. */
    profileText: string;
}

export interface ScoringResult {
    id: string;
    /** 0–100 talent/fit score. */
    score: number;
    /** Human-readable explanation produced by the LLM. */
    reasoning: string;
}

export interface BatchScoringOptions {
    /**
     * Maximum profiles per API call.
     * Larger batches save latency but increase token usage per call.
     * Default: 10.
     */
    maxBatchSize?: number;
    /**
     * OpenAI model to use. Default: "gpt-4o-mini" (fast, cost-efficient).
     */
    model?: string;
    /**
     * Maximum retry attempts on transient errors. Default: 3.
     */
    maxRetries?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MODEL      = 'gpt-4o-mini';
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_MS       = 1500;

// ─── Implementation ───────────────────────────────────────────────────────────

export class SharedBatchScoringService {
    private openai: OpenAI;
    private systemPrompt: string;
    private model: string;
    private maxBatchSize: number;
    private maxRetries: number;

    /**
     * @param openaiApiKey  Your VITE_OPENAI_API_KEY (or server-side key).
     * @param systemPrompt  The recruiter persona / scoring rubric injected as the
     *                      system message. Each engine provides its own prompt.
     * @param opts          Optional tuning — batch size, model, retries.
     */
    constructor(
        openaiApiKey: string,
        systemPrompt: string,
        opts: BatchScoringOptions = {},
    ) {
        if (!openaiApiKey) {
            console.warn('[SCORING] No OpenAI API key — all scores will be 0.');
        }

        this.openai = new OpenAI({
            apiKey: openaiApiKey,
            dangerouslyAllowBrowser: true, // Client-side; move to edge function for production
        });

        this.systemPrompt  = systemPrompt;
        this.model         = opts.model         ?? DEFAULT_MODEL;
        this.maxBatchSize  = opts.maxBatchSize  ?? DEFAULT_BATCH_SIZE;
        this.maxRetries    = opts.maxRetries    ?? DEFAULT_MAX_RETRIES;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Score an array of profiles.
     *
     * LAYER 3 — Parallel Batch Scoring:
     * Splits profiles into chunks of `maxBatchSize` (default 10) and fires ALL
     * chunks simultaneously via Promise.all.  50 profiles = 5 parallel API calls
     * ≈ 10 s total instead of 50 s sequential.
     *
     * Preserves original insertion order in the returned array.
     */
    async scoreBatch(profiles: ScoringProfile[]): Promise<ScoringResult[]> {
        if (profiles.length === 0) return [];

        const chunks = this.chunk(profiles, this.maxBatchSize);

        // ── Fire all chunks in parallel ───────────────────────────────────────
        const chunkResultSets = await Promise.all(
            chunks.map(chunk => this.scoreChunk(chunk)),
        );

        return chunkResultSets.flat();
    }

    /**
     * Convenience: score a single profile.
     */
    async scoreOne(profile: ScoringProfile): Promise<ScoringResult> {
        const [result] = await this.scoreBatch([profile]);
        return result;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private chunk<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Build the user prompt for a chunk.
     *
     * ANCHORING SYSTEM (Layer 3):
     *  • Base score = 85 if the candidate meets the core requirements from the
     *    system prompt (e.g. uses Flutter, has shipped products).
     *  • Add for exceptional signals: real users / metrics (+10), open-source
     *    leadership (+7), measurable business impact (+5).
     *  • Subtract for red flags: purely junior/theoretical (-15), no shipped
     *    product (-10), very narrow scope (-5).
     *  • PASSING THRESHOLD: 80.  Below 80 = not qualified, do NOT advance.
     */
    private buildUserPrompt(profiles: ScoringProfile[]): string {
        const profileList = profiles
            .map((p, idx) => `### Candidate ${idx + 1} (id: ${p.id})\n${p.profileText}`)
            .join('\n\n---\n\n');

        return `
Evaluate the ${profiles.length} candidate profile(s) below using the ANCHORING SCORING SYSTEM:

**ANCHORING RULES**
1. START at 85 if the candidate clearly meets the base skill requirements described in the system prompt.
2. ADD points for exceptional evidence:
   • Shipped product with real users or download metrics  → +10
   • Open-source project with 50+ stars or active maintainer → +7
   • Quantified business/product impact (revenue, retention, scale) → +5
3. SUBTRACT points for red flags:
   • Only bootcamp certs / tutorial projects, zero production work → -15
   • No shipped product used by actual people → -10
   • Very narrow task scope, no ownership or initiative → -5
4. MINIMUM PASSING SCORE = 80.  If a candidate does NOT meet the base requirements, score freely from 0–79.
5. BORDERLINE RESCUE RULE: If you would score a candidate between 74–79 ("Dudoso / Borderline"),
   but they show at least ONE of these clear positive signals:
     • A shipped mobile/web product (even personal) with visible adoption
     • An open-source project with any stars or active contributors
     • Demonstrable industry experience in the target tech stack (even if incomplete)
   → Assign score 81 instead and include "Borderline — requiere revisión manual" in the reasoning.
   This ensures Nyo can review them rather than them being silently discarded.

${profileList}

Return ONLY a valid JSON array with exactly ${profiles.length} objects in the SAME ORDER as the candidates above.
Each object must contain exactly these three fields:
{
  "id": "<the id field from the candidate header>",
  "score": <integer 0-100>,
  "reasoning": "<one concise sentence explaining the score>"
}

Do not include any text outside the JSON array.
`.trim();
    }

    /** Score one chunk with retry logic. */
    private async scoreChunk(profiles: ScoringProfile[]): Promise<ScoringResult[]> {
        // Short-circuit when no API key is available
        if (!this.openai.apiKey) {
            return this.neutralResults(profiles, 'No OpenAI API key configured.');
        }

        const userPrompt = this.buildUserPrompt(profiles);
        let attempt = 0;

        while (attempt < this.maxRetries) {
            attempt++;
            try {
                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.2, // Low temperature → consistent scores
                });

                const raw = completion.choices[0]?.message?.content ?? '[]';
                return this.parseResponse(raw, profiles);
            } catch (err: any) {
                const isRateLimit = err?.status === 429;
                const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);

                if (attempt < this.maxRetries) {
                    console.warn(
                        `[SCORING] Attempt ${attempt} failed (${err.message}). ` +
                        `Retrying in ${delay}ms…`
                    );
                    await new Promise(res => setTimeout(res, delay));
                } else {
                    console.error(`[SCORING] All ${this.maxRetries} retries exhausted:`, err);
                    return this.neutralResults(profiles, `API error after ${this.maxRetries} attempts: ${err.message}`);
                }
            }
        }

        return this.neutralResults(profiles, 'Unexpected exit from retry loop.');
    }

    /**
     * Parse and validate the LLM response.
     * Falls back to neutral results if the response is malformed.
     *
     * The API is asked for `json_object` format; we accept both an array at the root
     * and an object wrapping an array under a `results` or `candidates` key.
     */
    private parseResponse(raw: string, profiles: ScoringProfile[]): ScoringResult[] {
        try {
            let parsed = JSON.parse(raw);

            // Unwrap if the model returned { results: [...] } or { candidates: [...] }
            if (!Array.isArray(parsed)) {
                parsed = parsed.results ?? parsed.candidates ?? parsed.data ?? [];
            }

            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('Response is not a non-empty array.');
            }

            // Map by id for safe look-up
            const byId = new Map<string, { score: number; reasoning: string }>();
            for (const item of parsed) {
                if (typeof item.id !== 'undefined' && typeof item.score === 'number') {
                    byId.set(String(item.id), {
                        score:     Math.min(100, Math.max(0, Math.round(item.score))),
                        reasoning: String(item.reasoning ?? 'No reasoning provided.'),
                    });
                }
            }

            return profiles.map(p => ({
                id:        p.id,
                score:     byId.get(p.id)?.score     ?? 0,
                reasoning: byId.get(p.id)?.reasoning ?? 'Could not parse model response.',
            }));
        } catch (err: any) {
            console.error('[SCORING] Failed to parse LLM response:', err.message, '\nRaw:', raw);
            return this.neutralResults(profiles, 'Failed to parse model response.');
        }
    }

    private neutralResults(profiles: ScoringProfile[], reason: string): ScoringResult[] {
        return profiles.map(p => ({ id: p.id, score: 0, reasoning: reason }));
    }
}

// ─── Re-usable system prompts ─────────────────────────────────────────────────
// Each engine can import and use one of these pre-built prompts, or supply its own.

export const SYSTEM_PROMPTS = {
    /**
     * Symmetry product-engineer rubric.
     * BASE REQUIREMENT for Anchoring System: candidate uses React/Next.js or
     * Node.js/TypeScript AND has shipped at least one end-to-end product.
     * Start at 85 if both conditions are met; score freely 0-79 otherwise.
     */
    SYMMETRY_PRODUCT_ENGINEER: `
You are an ELITE Tech Recruiter for Symmetry — a health & wellness app (400k+ monthly downloads).
We hire Product Engineers (3–8 yrs experience) who build end-to-end features:
React/Next.js, Node.js, TypeScript, REST APIs. They must understand product impact and business metrics.

BASE REQUIREMENT (Anchoring anchor = 85):
  The candidate uses our core stack (React/Next.js, Node.js, TypeScript) AND has shipped
  at least one complete product used by real users.

BONUS signals:
  • Features with measurable metrics or business impact
  • Startup / early-stage / freelance / agile experience
  • AI tooling (ChatGPT, Claude, Cursor, Copilot)
  • Mobile (React Native, Flutter) or cloud infra

AUTO-FAIL (score ≤ 39 if any apply):
  • Only bootcamp/online certs, zero real production projects
  • Very narrow task scope, no product/business context
  • No shipped products used by real users
  • Passive executor only, no ownership or initiative
`.trim(),

    /**
     * GitHub developer scoring.
     * BASE REQUIREMENT for Anchoring System: candidate has ≥ 3 original
     * (non-fork) public repos with meaningful code (not just tutorials).
     */
    GITHUB_DEVELOPER: `
You are an expert engineering recruiter evaluating GitHub developer profiles.

BASE REQUIREMENT (Anchoring anchor = 85):
  The candidate has at least 3 original (non-fork) public repositories with
  real, non-trivial code — not just tutorials, clones, or hello-world projects.

BONUS signals:
  • Stars, forks, or watchers on original repos (community validation)
  • Tests, CI/CD, documentation present (code quality)
  • Active community contributions: PRs, issues, reviews
  • Relevant tech stack for product engineering

AUTO-FAIL (score ≤ 39 if any apply):
  • Only forked repos, no original work
  • Profile clearly inactive (no activity in 12+ months)
  • All repos are tutorial/course exercises
`.trim(),

    /**
     * Marketplace/freelance platform scoring.
     * BASE REQUIREMENT for Anchoring System: candidate has ≥ 5 completed jobs
     * and a job success rate ≥ 85%.
     */
    MARKETPLACE_FREELANCER: `
You are a senior recruiter evaluating freelance marketplace profiles.

BASE REQUIREMENT (Anchoring anchor = 85):
  The candidate has completed at least 5 jobs with a job success rate of 85% or
  higher — demonstrating real client delivery capability.

BONUS signals:
  • Top Rated, Rising Talent, or Expert-Vetted badge
  • Verified 1000+ hours billed
  • Specialised skills that match the role requirement
  • Recent activity (within last 90 days)

AUTO-FAIL (score ≤ 39 if any apply):
  • No completed jobs or reviews
  • Inactive profile (no activity in 6+ months)
  • Skills clearly don't match the role
`.trim(),

    /**
     * Community platform scoring (Discord, Reddit, Slack, forums).
     * BASE REQUIREMENT for Anchoring System: candidate has made ≥ 20 technical
     * contributions (answers, code snippets, PR reviews) in the community.
     */
    COMMUNITY_DEVELOPER: `
You are a community talent scout evaluating developer community profiles.

BASE REQUIREMENT (Anchoring anchor = 85):
  The candidate has made at least 20 substantive technical contributions
  (answers with code, detailed explanations, PR reviews) in the community.

BONUS signals:
  • Consistent high-quality answers with accepted/upvoted responses
  • Shared working code repos or demos
  • Community role: moderator, trusted user, badge holder
  • Active in the last 30 days

AUTO-FAIL (score ≤ 39 if any apply):
  • Very low contribution count or only lurking
  • No demonstrated coding ability
  • Account clearly abandoned
`.trim(),
} as const;

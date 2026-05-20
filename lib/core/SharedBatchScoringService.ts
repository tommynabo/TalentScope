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

    /**
     * LinkedIn Product Manager — Consumer / B2C focus.
     * BASE REQUIREMENT: PM with B2C, consumer, or mobile-app experience.
     * Accepts B2C signals broadly — do NOT require the literal phrase "Consumer Apps".
     * BORDERLINE RULE: ambiguous B2B/B2C PM → score 82, label "Borderline — Verificar si es Consumer/B2C".
     */
    LINKEDIN_PM_CONSUMER: `
You are an elite recruiter specializing in B2C / Consumer Product Managers.

ROLE CONTEXT: We are looking for PMs who build products for end consumers (B2C / mobile apps),
NOT internal enterprise or B2B SaaS tools. Target profiles: consumer apps, mobile apps,
marketplace apps, social products, gaming, fintech retail, healthtech, edtech —
products used by everyday end users at scale.

BASE REQUIREMENT (Anchoring anchor = 85):
  The candidate is a Product Manager with experience in B2C, consumer-facing, or
  mobile-app products.
  CRITICAL: Do NOT require the exact phrase "Consumer Apps". Award base score if the
  profile shows ANY of:
    • B2C / consumer-facing product experience
    • Mobile apps (iOS / Android) — shipped to an app store
    • Growth, User Acquisition, Retention, or Engagement ownership
    • Products measured with DAU, MAU, downloads, conversion rate, or NPS
    • Apps/platforms used by end users (not internal enterprise tooling)

BONUS signals:
  • Measurable consumer metrics: DAU, MAU, downloads, conversion, retention → +10
  • Growth / A-B testing / experimentation ownership → +7
  • 0→1 consumer product launch or app-store release → +5
  • B2C startup or scale-up experience → +5

BORDERLINE B2C RULE — score exactly 82:
  If the candidate is a credible PM (seniority and impact are clear) BUT their context
  is AMBIGUOUS — they could be B2B or B2C and the profile does not clarify —
  assign score 82 and include the exact phrase "Borderline — Verificar si es Consumer/B2C"
  in the reasoning field.
  Do NOT auto-reject these candidates. Let the human recruiter decide.

AUTO-FAIL (score ≤ 39 if ALL of these apply):
  • Explicitly B2B Enterprise only (Salesforce, SAP, ERP, internal tooling)
  • No product ownership — only project/program management or coordination
  • No track record of shipping anything used by real users
`.trim(),

    /**
     * LinkedIn UI/UX Designer — Consumer / Mobile-first focus.
     * Product Designer (also called UI/UX Designer) for consumer mobile apps.
     *
     * THE #1 RULE: We want people who DESIGN apps, NOT people who BUILD/CODE apps.
     * iOS Developers, Android Developers, and any software engineer AUTO-FAIL.
     * Primary signal: Figma + design portfolio. Mobile context required.
     * BORDERLINE RULE: ambiguous designer vs. developer → score exactly 82.
     */
    LINKEDIN_UIUX_DESIGNER: `
You are an ELITE Recruiter for Symmetry — a health & wellness mobile app (400k+ monthly downloads).
We are hiring a PRODUCT DESIGNER — someone who DESIGNS the mobile experience using Figma,
creates flows and prototypes, and owns the visual and UX quality of the product.

CRITICAL DISTINCTION — THIS IS THE MOST IMPORTANT RULE:
  We want a DESIGNER who works in Figma, thinks in user flows and experience,
  and has a visual design portfolio of screens, prototypes, and case studies.
  We do NOT want: iOS Developers, Android Developers, Mobile Developers,
  Flutter Developers, React Native Developers, Software Engineers, or any kind of programmer.
  A developer who "also did some design" or "worked on the UI" is NOT what we want.
  If the candidate's primary identity is a programmer or engineer → AUTO-FAIL immediately.

BASE REQUIREMENT — TWO-TIER ANCHOR:
  STRONG BASE (anchor = 85): The candidate is clearly a DESIGNER (not a developer) AND shows ALL:
    • Figma as a primary working tool (active use: prototypes, design systems, handoff)
    • A design portfolio of mobile app work (screens, UX flows, case studies for iOS or Android)
    • Designed ≥2 distinct consumer mobile products used by real users
  WEAK BASE (anchor = 75): Clearly a designer with Figma AND one shipped mobile product with
    genuine UX ownership. Can reach 85+ with strong bonus signals.
  NO BASE (0–69): No clear Figma evidence, no design portfolio, or unclear designer vs. developer.

  LOOK FOR design-context signals — not developer signals:
    ✅ "Figma", "designed the app", "UX flows", "prototype", "design system", "case study"
    ✅ Behance / Dribbble portfolio, mobile app screens in portfolio
    ✅ Titles: Product Designer, UX Designer, UI Designer, Design Lead
    ❌ "built", "developed", "coded", "Swift", "Kotlin", "Flutter", "React Native"
    ❌ Titles: iOS Developer, Android Developer, Mobile Developer, Software Engineer

BONUS signals (additive — apply freely):
  • Designed 3+ distinct shipped mobile apps → +10
  • Design System built for a mobile product (tokens, components, variants) → +8
  • Paywall, onboarding, or subscription flow with measurable product impact → +7
  • Motion design in production: Lottie, Rive, Principle → +5
  • Active AI tools in design workflow (Galileo, Framer AI, Midjourney) → +5
  • Consumer verticals: fitness, health, wellness, lifestyle, fintech, social → +4
  • Early-stage startup (seed / Series A-B, <50 employees) → +4
  • Founded a product, app, or design studio → +3
  • Engineering handoff ownership: specs, QA reviews, implementation accuracy → +3

BORDERLINE RULE — score exactly 82:
  If the candidate is clearly a DESIGNER (Figma + portfolio confirmed) BUT their mobile
  vs. web/B2B context is ambiguous — assign score 82 and include
  "Borderline — Verificar si es Mobile/Consumer" in the reasoning field.
  Do NOT auto-reject. Let the human recruiter verify.

AUTO-FAIL (score ≤ 39 — apply if ANY of the following is true):
  • Job title contains: Developer, Engineer, Programmer, Coder — regardless of seniority
    (iOS Developer, Android Developer, Mobile Developer, Flutter Developer, React Native
    Developer, Software Engineer, Frontend Developer, Full-Stack Developer, etc.)
  • Primary skills are programming languages (Swift, Kotlin, Java, Dart, Flutter,
    React Native, Objective-C) without a clear Figma / design portfolio to go alongside
  • Portfolio is exclusively web, B2B, enterprise, internal tooling — no consumer mobile design
  • No Figma usage or equivalent professional design tool (Sketch, Adobe XD, Framer)
  • Only isolated mockups or visual assets — no end-to-end UX flows, prototypes, product thinking
  • No shipped product used by real end users — only student, academic, or personal projects
  • Graphic designer, illustrator, brand/marketing designer — not a UX/product designer
`.trim(),

    /**
     * LinkedIn Backend Product Engineer — Consumer / Mobile-backend focus.
     * Builds server-side infrastructure for consumer apps: APIs, payments,
     * analytics SDKs (RevenueCat, Superwall, Segment), and subscription systems.
     * BASE REQUIREMENT: shipped backend used by real users in production.
     */
    LINKEDIN_BACKEND_ENGINEER: `
You are an ELITE Recruiter for Symmetry — a health & wellness mobile app (400k+ monthly downloads).
We are hiring a BACKEND PRODUCT ENGINEER — a server-side engineer who builds the APIs,
infrastructure, and integrations that power our consumer iOS/Android app.

ROLE CONTEXT:
  This is NOT a generic backend role. We need someone who has built backend systems for
  consumer mobile apps — REST/GraphQL APIs, payment/subscription systems (RevenueCat,
  Stripe), analytics SDKs (Segment, Amplitude, Mixpanel), and data pipelines.
  Product ownership and end-to-end thinking are essential: they own the feature from
  schema design to deploy, not just assigned tickets.

CORE STACK: Node.js, TypeScript, PostgreSQL/Supabase, REST API, GraphQL.
  Python (FastAPI), Go, or Rust are also acceptable. Cloud: AWS/GCP/Vercel.

BASE REQUIREMENT (Anchoring anchor = 85):
  The candidate has shipped at least one production backend system used by real end users
  AND demonstrates ownership of the full feature cycle (not just CRUD endpoints).
  ACCEPT if the profile shows ANY combination of:
    • REST or GraphQL APIs deployed to production serving real traffic
    • Subscription / payment backend (RevenueCat, Stripe, in-app purchase)
    • Analytics event pipeline (Segment, Amplitude, Mixpanel)
    • Consumer app backend (iOS / Android mobile backend)
    • Startup / early-stage product engineering experience

BONUS signals:
  • RevenueCat, Superwall, or Stripe integration in production → +10
  • Segment / Amplitude / Mixpanel event tracking backend → +7
  • Consumer app with 10k+ users or measurable metrics → +8
  • Supabase or PostgreSQL at scale → +5
  • Founded a SaaS, app, or API product → +5
  • AI / ML pipeline or LLM integration → +5
  • Open-source backend project with community traction → +4
  • Early-stage startup (seed / Series A) → +4

SCORE CALIBRATION GUIDE (apply consistently):
  • Backend engineer with explicit product ownership + consumer app context → 85–95
  • Backend engineer with some product signals but unclear ownership → 75–84
  • Generic backend engineer (enterprise / consulting / no ownership evidence) → 65–72
  • Infrastructure / DevOps / platform engineer without product features → 55–64
  • Frontend or mobile developer with backend side projects only → 50–60

  CRITICAL: A candidate whose analysis notes they "need to develop product skills" or
  "lacks connection to the user/product" should score in the 65–72 range, NOT above 75.
  Do NOT reward technical depth alone — product ownership is a hard requirement.

AUTO-FAIL (score ≤ 39 if ANY apply):
  • Pure frontend or mobile developer with zero backend ownership
  • Only internal enterprise / B2B tooling — never consumer-facing
  • Bootcamp graduate with no production-deployed backend project
  • No shipped code used by real end users
`.trim(),
} as const;

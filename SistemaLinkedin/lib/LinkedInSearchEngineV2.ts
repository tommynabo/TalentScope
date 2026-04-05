/**
 * LinkedInSearchEngine  (refactored — extends BaseSearchEngine)
 *
 * RESPONSIBILITY:
 *  Fetch raw LinkedIn profiles via Apify / local SearchService and return them
 *  as normalised RawCandidate objects.  Everything else (dedup, language filter,
 *  AI scoring, persistence) is handled by BaseSearchEngine.
 *
 * REMOVED DUPLICATION:
 *  ❌ inline deduplication logic         → SharedDeduplicationService
 *  ❌ isLikelySpanishSpeaker copy        → SharedLanguageFilter
 *  ❌ direct OpenAI call to calculateSymmetryScore → SharedBatchScoringService
 *  ❌ UnbreakableExecutor boilerplate     → BaseSearchEngine.execute()
 */

import {
    BaseSearchEngine,
    RawCandidate,
    BaseSearchOptions,
    LogCallback,
} from '../../lib/core/BaseSearchEngine';
import { ScoringResult, SYSTEM_PROMPTS } from '../../lib/core/SharedBatchScoringService';
import { LoadOptions } from '../../lib/core/SharedDeduplicationService';
import { Candidate, SearchFilterCriteria } from '../../types/database';
import { SearchService } from '../../lib/search';
import { CandidateService, CampaignService } from '../../lib/services';
import { normalizeLinkedInUrl } from '../../lib/normalization';
import { calculateFlutterDeveloperScore } from '../../lib/scoring';

// ─── LinkedIn-specific candidate shape ───────────────────────────────────────

export interface LinkedInRawCandidate extends RawCandidate {
    linkedin_url: string | null;
    filters?: SearchFilterCriteria;
    /** Original Candidate object carried through the pipeline for persistence. */
    _original?: Candidate;
    /* base fields are: _id, name, title, description, location, email, profileUrl */
}

// ─── Engine Options ───────────────────────────────────────────────────────────

export interface LinkedInSearchOptions extends BaseSearchOptions {
    language: string;
    maxAge: number;
    filters?: SearchFilterCriteria;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class LinkedInSearchEngine extends BaseSearchEngine<LinkedInRawCandidate> {

    protected get engineName()   { return 'LINKEDIN'; }
    protected get platformLabel(){ return 'LinkedIn'; }

    // ── Expose platform-specific start method (backward-compatible API) ──────

    public async startSearch(
        query: string,
        maxResults: number,
        options: LinkedInSearchOptions,
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void,
    ): Promise<void> {
        onLog(`[LINKEDIN] 🚀 Motor de búsqueda iniciado.`);
        onLog(`[LINKEDIN] 🎯 Objetivo: ${maxResults} candidatos para "${query}"`);

        await this.execute(
            query,
            { ...options, maxResults },
            onLog,
            async (rawCandidates) => {
                // Convert internal type back to the Candidate type the UI expects
                onComplete(rawCandidates.map(c => this.toCandidate(c)));
            },
        );
    }

    // ── Dedup: uses the global `candidates` table ────────────────────────────

    protected getDeduplicationLoadOptions(_opt: BaseSearchOptions): LoadOptions {
        return {
            table:     'candidates',
            urlColumn: 'linkedin_url',
            usernameColumn: null,
        };
    }

    protected getSystemPrompt(): string {
        return SYSTEM_PROMPTS.SYMMETRY_PRODUCT_ENGINEER;
    }

    protected toPlatformKey(_c: LinkedInRawCandidate): null { return null; }

    // ── fetchRawCandidates ───────────────────────────────────────────────────

    /**
     * Pulls profiles via SearchService (local/mock) or Apify when keys are set.
     * Returns profiles in the normalised LinkedInRawCandidate shape.
     */
    protected async fetchRawCandidates(
        query: string,
        options: LinkedInSearchOptions & BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<LinkedInRawCandidate[]> {
        const maxResults = options.maxResults ?? 20;
        const raw = await SearchService.searchCandidates(query, maxResults * 4);

        onLog(`[LINKEDIN] 📦 ${raw.length} perfiles obtenidos de SearchService.`);

        return raw.map((c, idx) => ({
            _id:         c.id ?? `li_${idx}_${Date.now()}`,
            name:        c.full_name ?? '',
            title:       c.job_title ?? null,
            description: c.ai_analysis ?? null,
            location:    c.location ?? null,
            email:       c.email ?? null,
            profileUrl:  c.linkedin_url ?? null,
            linkedin_url: c.linkedin_url ?? null,
            filters:     options.filters,
            // carry original candidate fields through for persistence
            _original:   c,
        } as LinkedInRawCandidate));
    }

    // ── save ─────────────────────────────────────────────────────────────────

    protected async save(
        candidates: LinkedInRawCandidate[],
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<LinkedInRawCandidate[]> {
        if (!options.campaignId) {
            onLog(`[LINKEDIN] ⚠️ Sin campaignId — saltando guardado en BD.`);
            return [];
        }

        const saved: LinkedInRawCandidate[] = [];
        for (const c of candidates) {
            try {
                const dbRecord = await CandidateService.create(this.toCandidate(c));
                await CampaignService.addCandidateToCampaign(options.campaignId, dbRecord.id);
                saved.push({ ...c, _id: dbRecord.id });
            } catch (err: any) {
                onLog(`[LINKEDIN] ❌ Error guardando "${c.name}": ${err.message}`);
            }
        }

        onLog(`[LINKEDIN] ✅ ${saved.length}/${candidates.length} candidatos guardados.`);
        return saved;
    }

    // ── Merge AI score back onto the candidate ────────────────────────────────

    protected mergeScoreIntoCandidate(
        candidate: LinkedInRawCandidate,
        result: ScoringResult,
    ): LinkedInRawCandidate {
        return {
            ...candidate,
            _score:     result.score,
            _reasoning: result.reasoning,
        };
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private toCandidate(c: LinkedInRawCandidate): Candidate {
        const score = (c as any)._score ?? c._original?.symmetry_score ?? 0;
        const base  = c._original ?? {} as Candidate;
        return {
            ...base,
            full_name:      c.name,
            email:          c.email ?? null,
            linkedin_url:   c.linkedin_url
                                ? normalizeLinkedInUrl(c.linkedin_url)
                                : null,
            job_title:      c.title ?? null,
            location:       c.location ?? null,
            symmetry_score: score,
            ai_analysis:    (c as any)._reasoning ?? base.ai_analysis ?? null,
            created_at:     base.created_at ?? new Date().toISOString(),
            updated_at:     new Date().toISOString(),
        } as Candidate;
    }
}

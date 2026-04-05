/**
 * MarketplaceSearchEngine  (refactored — extends BaseSearchEngine)
 *
 * RESPONSIBILITY:
 *  Scrape freelance marketplace profiles (Upwork, Fiverr, etc.) via Apify
 *  and return them as normalised RawCandidate objects.  All cross-cutting
 *  concerns (dedup, language filter, batch AI scoring, persistence) are
 *  handled by BaseSearchEngine.
 *
 * REMOVED DUPLICATION:
 *  ❌ MarketplaceDeduplicationService copy  → SharedDeduplicationService
 *  ❌ LanguageDetectionService copy         → SharedLanguageFilter
 *  ❌ Direct OpenAI enrichment call         → SharedBatchScoringService
 *  ❌ UnbreakableExecutor boilerplate       → BaseSearchEngine.execute()
 */

import {
    BaseSearchEngine,
    RawCandidate,
    BaseSearchOptions,
    LogCallback,
} from '../../lib/core/BaseSearchEngine';
import { ScoringProfile, ScoringResult, SYSTEM_PROMPTS } from '../../lib/core/SharedBatchScoringService';
import { LoadOptions } from '../../lib/core/SharedDeduplicationService';
import { ScrapedCandidate, ScrapingFilter, FreelancePlatform } from '../types/marketplace';
import { MarketplaceSearchService } from './marketplaceSearchService';
import { MarketplaceScoringService } from './marketplaceScoringService';
import { supabase } from '../../lib/supabase';

// ─── Marketplace-specific candidate shape ─────────────────────────────────────

export interface MarketplaceRawCandidate extends RawCandidate {
    platform: FreelancePlatform;
    platformUsername: string;
    hourlyRate?: number;
    jobSuccessRate?: number;
    certifications?: string[];
    badges?: string[];
    skills?: string[];
    yearsExperience?: number;
    totalJobs?: number;
    totalHours?: number;
    talentScore?: number;
    /** Underlying ScrapedCandidate, carried for persistence. */
    _scraped: ScrapedCandidate;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface MarketplaceSearchOptions extends BaseSearchOptions {
    filter?: ScrapingFilter;
    platform?: FreelancePlatform;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class MarketplaceSearchEngine extends BaseSearchEngine<MarketplaceRawCandidate> {

    private searchService: MarketplaceSearchService;

    constructor() {
        super();
        const apifyKey = import.meta.env.VITE_APIFY_API_KEY ?? '';
        this.searchService = new MarketplaceSearchService(apifyKey);
    }

    protected get engineName()    { return 'MARKETPLACE'; }
    protected get platformLabel() { return 'Marketplace (Upwork/Fiverr)'; }

    // ── Backward-compatible entry point ───────────────────────────────────────

    public async startMarketplaceSearch(
        query: string,
        maxResults: number,
        options: MarketplaceSearchOptions,
        onLog: LogCallback,
        onComplete: (candidates: ScrapedCandidate[]) => void,
    ): Promise<void> {
        await this.execute(
            query,
            { ...options, maxResults },
            onLog,
            async (rawCandidates) => {
                onComplete(rawCandidates.map(c => c._scraped));
            },
        );
    }

    // ── Configuration hooks ───────────────────────────────────────────────────

    protected getDeduplicationLoadOptions(options: BaseSearchOptions): LoadOptions {
        return {
            table:          'marketplace_candidates' as any,
            urlColumn:      'profile_url',
            usernameColumn: 'platform_username',
            campaignId:     options.campaignId,
        };
    }

    protected getSystemPrompt(): string {
        return SYSTEM_PROMPTS.MARKETPLACE_FREELANCER;
    }

    protected toPlatformKey(c: MarketplaceRawCandidate): string {
        return `marketplace:${c.platformUsername.toLowerCase()}`;
    }

    // ── fetchRawCandidates ────────────────────────────────────────────────────

    protected async fetchRawCandidates(
        query: string,
        options: MarketplaceSearchOptions & BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<MarketplaceRawCandidate[]> {
        // LAYER 1: Request 100 results in a single Apify run instead of
        // iterating small pages.  This minimises actor cold-start overhead
        // (each run charges a cold-start fee) and saturates the response in
        // one shot.  We still over-fetch by 2× so the heuristic + language
        // filters in Layers 2-3 have enough candidates to choose from.
        const RAW_TARGET = Math.max(100, (options.maxResults ?? 20) * 2);
        const filter: ScrapingFilter = {
            ...(options.filter ?? {}),
            keyword:    query,
            maxResults: RAW_TARGET,
        };

        onLog(`[MARKETPLACE] 🚀 [Capa 1] Solicitando ${RAW_TARGET} perfiles en un único run de Apify para "${query}"...`);

        let scraped: ScrapedCandidate[] = [];
        try {
            const platform = options.platform ?? FreelancePlatform.Upwork;
            if (platform === FreelancePlatform.Fiverr) {
                scraped = await this.searchService.scrapeFiverr(filter);
            } else if (platform === FreelancePlatform.LinkedIn) {
                scraped = await this.searchService.scrapeLinkedIn(filter);
            } else {
                scraped = await this.searchService.scrapeUpwork(filter);
            }
        } catch (err: any) {
            onLog(`[MARKETPLACE] ❌ Apify falló: ${err.message}`);
            return [];
        }

        onLog(`[MARKETPLACE] 📦 ${scraped.length} perfiles obtenidos (objetivo: ${RAW_TARGET}).`);

        return scraped.map((s, idx) => ({
            _id:             s.id ?? `mp_${idx}_${Date.now()}`,
            name:            s.name,
            title:           s.title ?? null,
            description:     s.bio ?? null,
            location:        s.country ?? null,
            email:           s.email ?? null,
            profileUrl:      s.profileUrl ?? null,
            platform:        s.platform,
            platformUsername: s.platformUsername,
            hourlyRate:      s.hourlyRate,
            jobSuccessRate:  s.jobSuccessRate,
            certifications:  s.certifications ?? [],
            badges:          s.badges ?? [],
            skills:          s.skills ?? [],
            yearsExperience: s.yearsExperience,
            totalJobs:       s.totalJobs,
            totalHours:      s.totalHours,
            talentScore:     s.talentScore,
            _scraped:        s,
        }));
    }

    // ── Scoring profile: include marketplace-specific signals ─────────────────

    protected buildScoringProfile(c: MarketplaceRawCandidate): ScoringProfile {
        return {
            id: c._id,
            profileText: [
                `Platform: ${c.platform}`,
                `Name: ${c.name}`,
                `Title: ${c.title ?? 'N/A'}`,
                `Location: ${c.location ?? 'N/A'}`,
                `Hourly Rate: $${c.hourlyRate ?? 0}/hr`,
                `Job Success Rate: ${c.jobSuccessRate ?? 0}%`,
                `Total Jobs: ${c.totalJobs ?? 0}`,
                `Total Hours: ${c.totalHours ?? 0}`,
                `Badges: ${(c.badges ?? []).join(', ') || 'None'}`,
                `Skills: ${(c.skills ?? []).join(', ') || 'N/A'}`,
                c.description ? `Bio: ${c.description}` : '',
            ].filter(Boolean).join('\n'),
        };
    }

    protected mergeScoreIntoCandidate(
        candidate: MarketplaceRawCandidate,
        result: ScoringResult,
    ): MarketplaceRawCandidate {
        const updatedScraped: ScrapedCandidate = {
            ...candidate._scraped,
            talentScore: result.score,
        };
        return {
            ...candidate,
            talentScore: result.score,
            _score:      result.score,
            _reasoning:  result.reasoning,
            _scraped:    updatedScraped,
        };
    }

    // ── Custom pre-filter: use platform's own heuristic score as a gate ──────

    protected preFilterOne(c: MarketplaceRawCandidate): boolean {
        // The MarketplaceScoringService provides a fast heuristic score
        // (no AI) that can discard obviously poor profiles before the costly
        // batch OpenAI call.
        const filter: ScrapingFilter = {};
        const { score } = MarketplaceScoringService.calculateTalentScore(c._scraped, filter);
        return score >= 30; // Heuristic gate: discard very poor profiles early
    }

    // ── save ─────────────────────────────────────────────────────────────────

    protected async save(
        candidates: MarketplaceRawCandidate[],
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<MarketplaceRawCandidate[]> {
        if (!options.campaignId) {
            onLog(`[MARKETPLACE] ⚠️ Sin campaignId — saltando guardado.`);
            return candidates;
        }

        const rows = candidates.map(c => ({
            campaign_id:      options.campaignId,
            name:             c.name,
            platform:         c.platform,
            platform_username: c.platformUsername,
            profile_url:      c.profileUrl,
            title:            c.title,
            country:          c.location,
            hourly_rate:      c.hourlyRate ?? null,
            job_success_rate: c.jobSuccessRate ?? null,
            talent_score:     c.talentScore ?? 0,
            skills:           c.skills ?? [],
            badges:           c.badges ?? [],
            email:            c.email ?? null,
            bio:              c.description ?? null,
            ai_reasoning:     (c as any)._reasoning ?? null,
            scraped_at:       new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('marketplace_candidates' as any)
            .upsert(rows, { onConflict: 'profile_url' });

        if (error) {
            onLog(`[MARKETPLACE] ❌ Upsert falló: ${error.message}`);
            return candidates;
        }

        onLog(`[MARKETPLACE] ✅ ${rows.length} candidatos guardados.`);
        return candidates;
    }
}

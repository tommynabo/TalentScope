/**
 * GitHubSearchEngine  (refactored — extends BaseSearchEngine)
 *
 * RESPONSIBILITY:
 *  Query the GitHub Search API (paginated, with Hispanic location injection)
 *  and return enriched raw candidates.  All cross-cutting concerns (dedup,
 *  language filter, batch AI scoring, UnbreakableExecutor) are delegated to
 *  BaseSearchEngine.
 *
 * REMOVED DUPLICATION:
 *  ❌ inline dedup / existingUsernames set  → SharedDeduplicationService
 *  ❌ githubSpanishLanguageFilter copy      → SharedLanguageFilter
 *  ❌ direct calculateSymmetryScore call    → SharedBatchScoringService
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
import { GitHubCandidate, GitHubMetrics, GitHubFilterCriteria } from '../../types/database';
import { githubService } from '../../SistemaGithub/lib/githubService';
import { githubContactService } from '../../SistemaGithub/lib/githubContactService';
import { GitHubCandidatePersistence } from '../../SistemaGithub/lib/githubCandidatePersistence';
import { generateCandidateAnalysis } from '../../lib/openai';
import { PRESET_PRODUCT_ENGINEERS } from '../../lib/githubPresets';

// ─── GitHub-specific candidate shape ─────────────────────────────────────────

export interface GitHubRawCandidate extends RawCandidate {
    github_username: string;
    github_url: string;
    avatar_url?: string | null;
    followers?: number;
    public_repos?: number;
    originalRepos?: any[];
    allRepos?: any[];
    /** Contact data filled in only for candidates that pass the score threshold. */
    contactEmail?: string | null;
    contactLinkedin?: string | null;
    contactWebsite?: string | null;
    aiAnalysis?: any;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface GitHubSearchOptions extends BaseSearchOptions {
    githubFilters?: GitHubFilterCriteria;
}

// ─── Hispanic location rotation (same logic as original engine) ───────────────

const HISPANIC_LOCATIONS = ['spain', 'mexico', 'colombia', 'argentina', 'chile'];
const MAX_PAGES = 20;
const PER_PAGE  = 50;
const CHUNK_SIZE = 5;
const ORIGINALITY_THRESHOLD = 40; // % — skip profiles with too many forks

// ─── Implementation ───────────────────────────────────────────────────────────

export class GitHubSearchEngine extends BaseSearchEngine<GitHubRawCandidate> {

    protected get engineName()    { return 'GITHUB'; }
    protected get platformLabel() { return 'GitHub API'; }

    // ── Backward-compatible public entry point ────────────────────────────────

    public async startGitHubSearch(
        query: string,
        maxResults: number,
        options: GitHubSearchOptions,
        onLog: LogCallback,
        onComplete: (candidates: GitHubCandidate[]) => void,
    ): Promise<void> {
        await this.execute(
            query,
            { ...options, maxResults },
            onLog,
            async (rawCandidates) => {
                onComplete(rawCandidates.map(c => this.toGitHubCandidate(c)));
            },
        );
    }

    // ── Configuration hooks ───────────────────────────────────────────────────

    protected getDeduplicationLoadOptions(options: BaseSearchOptions): LoadOptions {
        return {
            table:          'github_candidates' as any,
            urlColumn:      'github_url',
            usernameColumn: 'github_username',
            platformPrefix: 'github',
            campaignId:     options.campaignId,
        };
    }

    protected getSystemPrompt(): string {
        return SYSTEM_PROMPTS.GITHUB_DEVELOPER;
    }

    protected toPlatformKey(c: GitHubRawCandidate): string {
        return `github:${c.github_username.toLowerCase()}`;
    }

    // ── fetchRawCandidates ────────────────────────────────────────────────────

    /**
     * Queries the GitHub Search Users API in paginated batches.
     * Injects a rotating Hispanic location to bias towards Spanish-speaking devs.
     * Applies a fast originality pre-check (skip fork-heavy profiles) before
     * fetching full profile data — reducing API quota usage.
     */
    protected async fetchRawCandidates(
        baseQuery: string,
        options: GitHubSearchOptions & BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<GitHubRawCandidate[]> {
        const maxResults = options.maxResults ?? 20;
        const raw: GitHubRawCandidate[] = [];
        let page = 1;

        while (raw.length < maxResults && page <= MAX_PAGES) {
            if (this.userIntendedStop) break;

            // Inject a rotating Hispanic location when none is specified
            const location   = HISPANIC_LOCATIONS[(page - 1) % HISPANIC_LOCATIONS.length];
            let   finalQuery = baseQuery;
            if (!finalQuery.includes('location:')) finalQuery += ` location:${location}`;
            if (!finalQuery.includes('type:user'))  finalQuery += ' type:user';

            onLog(`[GITHUB] 📄 Página ${page}: "${finalQuery}"`);

            let users: any[];
            try {
                // @ts-ignore — octokit typing
                const res = await githubService.octokit.rest.search.users({
                    q: finalQuery,
                    per_page: PER_PAGE,
                    page,
                    sort: 'followers',
                    order: 'desc',
                });
                users = res.data.items ?? [];
            } catch (err: any) {
                onLog(`[GITHUB] ❌ Error API página ${page}: ${err.message}`);
                break;
            }

            if (users.length === 0) break;

            // Process in concurrent chunks
            for (let i = 0; i < users.length; i += CHUNK_SIZE) {
                if (raw.length >= maxResults || this.userIntendedStop) break;

                const chunk = users.slice(i, i + CHUNK_SIZE);
                const results = await Promise.all(
                    chunk.map(u => this.buildRawCandidate(u.login, onLog))
                );

                for (const c of results) {
                    if (c && raw.length < maxResults) raw.push(c);
                }
            }

            page++;
        }

        return raw;
    }

    /** Fetch full profile + repos for one username. Returns null to discard. */
    private async buildRawCandidate(
        username: string,
        onLog: LogCallback,
    ): Promise<GitHubRawCandidate | null> {
        try {
            // 1. Check repo originality FIRST — cheapest API call
            // @ts-ignore
            const reposRes = await githubService.octokit.rest.repos.listForUser({
                username, per_page: 15, sort: 'updated',
            });
            const repos         = reposRes.data as any[];
            const originalRepos = repos.filter(r => !r.fork);
            const originality   = repos.length > 0 ? (originalRepos.length / repos.length) * 100 : 0;

            if (originality < ORIGINALITY_THRESHOLD) {
                onLog(`[GITHUB] ⏭️ @${username}: Demasiados forks (${originality.toFixed(0)}% original).`);
                return null;
            }

            // 2. Full profile
            // @ts-ignore
            const userRes = await githubService.octokit.rest.users.getByUsername({ username });
            const user    = userRes.data as any;

            return {
                _id:          `gh_${username}`,
                name:         user.name ?? username,
                title:        null,
                description:  user.bio ?? null,
                location:     user.location ?? null,
                email:        user.email ?? null,
                profileUrl:   user.html_url,
                github_username: username,
                github_url:   user.html_url,
                avatar_url:   user.avatar_url ?? null,
                followers:    user.followers  ?? 0,
                public_repos: user.public_repos ?? 0,
                originalRepos,
                allRepos:     repos,
            };
        } catch (err: any) {
            onLog(`[GITHUB] ⚠️ @${username}: ${err.message}`);
            return null;
        }
    }

    // ── Build scoring profile (include GitHub signals) ────────────────────────

    protected buildScoringProfile(c: GitHubRawCandidate): ScoringProfile {
        const topRepos = (c.originalRepos ?? [])
            .slice(0, 5)
            .map((r: any) => `${r.name}: ${r.description ?? 'no description'}`)
            .join('; ');

        return {
            id: c._id,
            profileText: [
                `GitHub: @${c.github_username}`,
                `Name: ${c.name}`,
                c.location    ? `Location: ${c.location}`      : '',
                c.description ? `Bio: ${c.description}`         : '',
                topRepos      ? `Top repos: ${topRepos}`        : '',
                `Followers: ${c.followers ?? 0}`,
                `Original repos: ${(c.originalRepos ?? []).length}`,
            ].filter(Boolean).join('\n'),
        };
    }

    // ── Merge score; fetch contact only when candidate qualifies ──────────────

    protected mergeScoreIntoCandidate(
        candidate: GitHubRawCandidate,
        result: ScoringResult,
    ): GitHubRawCandidate {
        return { ...candidate, _score: result.score, _reasoning: result.reasoning };
    }

    // ── save ─────────────────────────────────────────────────────────────────

    protected async save(
        candidates: GitHubRawCandidate[],
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<GitHubRawCandidate[]> {
        if (!options.campaignId || !options.userId) {
            onLog(`[GITHUB] ⚠️ Sin campaignId/userId — saltando guardado.`);
            return candidates;
        }

        // Enrich with contact info (only for qualified candidates that reached save())
        onLog(`[GITHUB] 🔎 Buscando contactos para ${candidates.length} candidatos aprobados...`);
        const enriched = await Promise.all(
            candidates.map(async c => {
                try {
                    const contact = await githubContactService.findContactInfoFast(
                        c.github_username,
                        c.originalRepos?.slice(0, 5) ?? [],
                        { name: c.name, bio: c.description, location: c.location, email: c.email },
                    );
                    const aiAnalysis = await generateCandidateAnalysis({
                        name: c.name,
                        username: c.github_username,
                        bio: c.description,
                        languages: Array.from(new Set((c.allRepos ?? []).map((r: any) => r.language).filter(Boolean))),
                        topRepos: c.originalRepos?.slice(0, 5) ?? [],
                        roleKeyword: (options as GitHubSearchOptions).githubFilters?.role_keyword,
                        icpDescription: (options as GitHubSearchOptions).githubFilters?.icp_description,
                    });
                    return { ...c, contactEmail: contact.email, contactLinkedin: contact.linkedin, contactWebsite: contact.website, aiAnalysis };
                } catch {
                    return c;
                }
            })
        );

        const metrics: GitHubMetrics[] = enriched.map(c => this.toGitHubMetrics(c));
        await GitHubCandidatePersistence.saveCandidates(options.campaignId, metrics, options.userId);
        onLog(`[GITHUB] ✅ ${enriched.length} candidatos guardados.`);
        return enriched;
    }

    // ── Private converters ────────────────────────────────────────────────────

    private toGitHubCandidate(c: GitHubRawCandidate): GitHubCandidate {
        return {
            id:             c._id,
            full_name:      c.name,
            email:          c.contactEmail ?? c.email ?? null,
            linkedin_url:   c.contactLinkedin ?? null,
            github_url:     c.github_url,
            avatar_url:     c.avatar_url ?? null,
            location:       c.location ?? null,
            symmetry_score: (c as any)._score ?? 0,
            created_at:     new Date().toISOString(),
            updated_at:     new Date().toISOString(),
            github_metrics: this.toGitHubMetrics(c),
        } as GitHubCandidate;
    }

    private toGitHubMetrics(c: GitHubRawCandidate): GitHubMetrics {
        const score    = (c as any)._score ?? 0;
        const topLang  = (c.allRepos ?? []).find((r: any) => r.language)?.language ?? 'Unknown';
        const stars    = (c.originalRepos ?? []).reduce((s, r) => s + (r.stargazers_count ?? 0), 0);

        return {
            github_username:        c.github_username,
            github_url:             c.github_url,
            github_id:              0,
            public_repos:           c.public_repos ?? 0,
            followers:              c.followers     ?? 0,
            following:              0,
            created_at:             new Date().toISOString(),
            updated_at:             new Date().toISOString(),
            total_commits:          (c.public_repos ?? 0) * 10,
            most_used_language:     topLang,
            total_stars_received:   stars,
            average_repo_stars:     (c.originalRepos?.length ?? 0) > 0 ? stars / (c.originalRepos!.length) : 0,
            original_repos_count:   c.originalRepos?.length ?? 0,
            fork_repos_count:       (c.allRepos?.length ?? 0) - (c.originalRepos?.length ?? 0),
            originality_ratio:      c.public_repos ? ((c.originalRepos?.length ?? 0) / c.public_repos) * 100 : 0,
            mentioned_email:        c.contactEmail ?? c.email ?? null,
            linkedin_url:           c.contactLinkedin ?? null,
            personal_website:       c.contactWebsite ?? null,
            github_score:           score,
        } as GitHubMetrics;
    }
}

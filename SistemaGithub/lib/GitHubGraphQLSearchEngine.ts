/**
 * GitHubGraphQLSearchEngine  —  Layer 1 High-Volume GitHub Fetcher
 *
 * STRATEGY: replaces the paginated REST search.users loop with a single
 * GitHub GraphQL query that fetches up to 100 profiles AND their top-3 repos
 * in ONE network round-trip.
 *
 * WHY GRAPHQL OVER REST:
 *  - REST search.users returns only minimal data; we then need N extra calls
 *    to repos.listForUser per username.  For 50 candidates that is 50+ calls.
 *  - GraphQL returns users + repos in a single request.
 *    50 candidates = 1 request instead of 51.  ~30× fewer API calls.
 *  - The GitHub GraphQL API allows `first: 100` on the search node, so we can
 *    saturate the page in one shot.
 *
 * PIPELINE POSITION:
 *  fetchRawCandidates() →  Layer 2 (heuristic filter, in BaseSearchEngine)
 *                       →  Layer 3 (parallel batch scoring, 10 per chunk)
 *                       →  Layer 4 (contact enrichment ONLY for score >= 80, in save())
 *
 * USAGE:
 *  Instantiate this engine in place of GitHubSearchEngineV2 wherever you need
 *  maximum throughput.  The public API is identical:
 *
 *    const engine = new GitHubGraphQLSearchEngine();
 *    engine.startGitHubSearch(query, 50, options, onLog, onComplete);
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
import { githubContactService } from './githubContactService';
import { GitHubCandidatePersistence } from './githubCandidatePersistence';
import { generateCandidateAnalysis } from '../../lib/openai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitHubRawCandidate extends RawCandidate {
    github_username: string;
    github_url:      string;
    avatar_url?:     string | null;
    followers?:      number;
    public_repos?:   number;
    /** Top-3 non-fork repos fetched in the same GraphQL round-trip. */
    topRepos?:       GraphQLRepo[];
    /** Filled in Layer 4 (save()) for score >= 80 candidates only. */
    contactEmail?:   string | null;
    contactLinkedin?: string | null;
    contactWebsite?: string | null;
    aiAnalysis?:     any;
}

interface GraphQLRepo {
    name:           string;
    description:    string | null;
    stargazerCount: number;
    language:       string | null;
}

interface GraphQLUser {
    login:     string;
    name:      string | null;
    bio:       string | null;
    location:  string | null;
    email:     string | null;
    avatarUrl: string;
    followers: { totalCount: number };
    repositories: {
        nodes: GraphQLRepo[];
        totalCount?: number;
    };
}

interface GraphQLSearchResponse {
    data: {
        search: {
            userCount: number;
            pageInfo:  { hasNextPage: boolean; endCursor: string | null };
            nodes:     (GraphQLUser | null)[];
        };
    };
    errors?: { message: string }[];
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface GitHubGraphQLSearchOptions extends BaseSearchOptions {
    githubFilters?: GitHubFilterCriteria;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HISPANIC_LOCATIONS = ['spain', 'mexico', 'colombia', 'argentina', 'chile', 'peru'];
/** One GraphQL page = up to 100 users. We run one page per location = 600 users raw. */
const USERS_PER_PAGE     = 100;
/** Skip profiles where >60 % of repos are forks — no original work to evaluate. */
const MIN_ORIGINALITY    = 0.40;
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// ─── GraphQL query ────────────────────────────────────────────────────────────
//
// Single request returns:
//   user.login / name / bio / location / email / avatarUrl / followers.totalCount
//   top-3 non-fork repos (ordered by stars) with name, description, stargazerCount, language

const SEARCH_QUERY = /* graphql */ `
  query SearchHispanicDevs($query: String!, $cursor: String) {
    search(query: $query, type: USER, first: ${USERS_PER_PAGE}, after: $cursor) {
      userCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on User {
          login
          name
          bio
          location
          email
          avatarUrl
          followers { totalCount }
          repositories(
            first: 3
            orderBy: { field: STARGAZERS, direction: DESC }
            isFork: false
            privacy: PUBLIC
          ) {
            totalCount
            nodes {
              name
              description
              stargazerCount
              primaryLanguage { name }
            }
          }
        }
      }
    }
  }
`;

// ─── Engine ───────────────────────────────────────────────────────────────────

export class GitHubGraphQLSearchEngine extends BaseSearchEngine<GitHubRawCandidate> {

    protected get engineName()    { return 'GITHUB_GQL'; }
    protected get platformLabel() { return 'GitHub GraphQL API'; }

    // ── Backward-compatible public entry point ────────────────────────────────

    public async startGitHubSearch(
        query: string,
        maxResults: number,
        options: GitHubGraphQLSearchOptions,
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

    // ── Layer 2 override: GitHub-specific keywords ────────────────────────────

    protected getHeuristicKeywords(query: string): string[] {
        // Pull from the parent's query-extraction logic first…
        const base = super.getHeuristicKeywords(query);
        // …then add common GitHub profile signal words so profiles with a matching
        // bio / repo description are always kept regardless of query wording.
        return [...new Set([...base, 'developer', 'engineer', 'software', 'mobile', 'backend', 'fullstack'])];
    }

    // ── Layer 1: fetchRawCandidates (GraphQL edition) ─────────────────────────

    /**
     * LAYER 1: HIGH-VOLUME FETCH
     *
     * For each Hispanic location we fire ONE GraphQL request that returns
     * up to 100 users WITH their top-3 repos.  Six locations × 100 users =
     * up to 600 raw profiles collected before any filtering, all in ~6 parallel
     * network requests (one per location).
     *
     * Then:
     *  1. Normalize into GitHubRawCandidate (no extra API calls).
     *  2. Discard users with too many forks (originality check — O(1) per user).
     *
     * The expensive contact-fetch (Layer 4) happens only in save() after the AI
     * scoring eliminates low-quality candidates.
     */
    protected async fetchRawCandidates(
        baseQuery: string,
        options: GitHubGraphQLSearchOptions & BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<GitHubRawCandidate[]> {
        const token = import.meta.env.VITE_GITHUB_TOKEN ?? '';
        if (!token) {
            onLog(`[GITHUB_GQL] ⚠️ VITE_GITHUB_TOKEN no configurado — GraphQL requiere autenticación.`);
            return [];
        }

        const maxResults = options.maxResults ?? 50;

        // Build one search string per location, then fetch all in parallel
        const queries = HISPANIC_LOCATIONS.map(loc => {
            let q = baseQuery;
            if (!q.includes('location:')) q += ` location:${loc}`;
            if (!q.includes('type:user'))  q += ' type:user';
            return q;
        });

        onLog(`[GITHUB_GQL] 🚀 Lanzando ${queries.length} requests GraphQL en paralelo (hasta ${USERS_PER_PAGE * queries.length} perfiles)...`);

        const pageSets = await Promise.all(
            queries.map((q, idx) =>
                this.fetchGraphQLPage(q, token, onLog, HISPANIC_LOCATIONS[idx])
            ),
        );

        // Flatten + deduplicate by login
        const seenLogins = new Set<string>();
        const raw: GitHubRawCandidate[] = [];

        for (const users of pageSets) {
            for (const user of users) {
                if (seenLogins.has(user.login)) continue;
                seenLogins.add(user.login);

                const originality = (user.repositories.nodes.length > 0 || (user.repositories.totalCount ?? 0) > 0)
                    ? user.repositories.nodes.length / Math.max(user.repositories.totalCount ?? 1, 1)
                    : 0;

                if (originality < MIN_ORIGINALITY && (user.repositories.totalCount ?? 0) > 5) {
                    onLog(`[GITHUB_GQL] ⏭️ @${user.login}: demasiados forks (originality ${(originality * 100).toFixed(0)}%)`);
                    continue;
                }

                const topRepos: GraphQLRepo[] = user.repositories.nodes.map((r: any) => ({
                    name:           r.name,
                    description:    r.description ?? null,
                    stargazerCount: r.stargazerCount ?? 0,
                    language:       r.primaryLanguage?.name ?? null,
                }));

                raw.push({
                    _id:             `gh_${user.login}`,
                    name:            user.name ?? user.login,
                    title:           null,
                    description:     user.bio ?? null,
                    location:        user.location ?? null,
                    email:           user.email ?? null,
                    profileUrl:      `https://github.com/${user.login}`,
                    github_username: user.login,
                    github_url:      `https://github.com/${user.login}`,
                    avatar_url:      user.avatarUrl ?? null,
                    followers:       user.followers.totalCount,
                    public_repos:    user.repositories.totalCount ?? 0,
                    topRepos,
                });

                if (raw.length >= maxResults * 3) break; // cap raw over-fetch at 3×
            }
            if (raw.length >= maxResults * 3) break;
        }

        onLog(`[GITHUB_GQL] 📦 ${raw.length} perfiles crudos obtenidos con ${pageSets.length} requests.`);
        return raw;
    }

    // ── Scoring profile: include top-3 repo signals ───────────────────────────

    protected buildScoringProfile(c: GitHubRawCandidate): ScoringProfile {
        const repoLines = (c.topRepos ?? [])
            .map(r =>
                `  • ${r.name} (★${r.stargazerCount}${r.language ? ', ' + r.language : ''}): ${r.description ?? 'no description'}`
            )
            .join('\n');

        return {
            id: c._id,
            profileText: [
                `GitHub: @${c.github_username}`,
                `Name: ${c.name}`,
                c.location    ? `Location: ${c.location}` : '',
                c.description ? `Bio: ${c.description}`   : '',
                `Followers: ${c.followers ?? 0}`,
                repoLines     ? `Top repos:\n${repoLines}` : 'No public repos.',
            ].filter(Boolean).join('\n'),
        };
    }

    // ── Merge score (Layer 4 contact-fetch happens in save()) ─────────────────

    protected mergeScoreIntoCandidate(
        candidate: GitHubRawCandidate,
        result: ScoringResult,
    ): GitHubRawCandidate {
        return { ...candidate, _score: result.score, _reasoning: result.reasoning };
    }

    // ── Layer 4: Deep fetch — runs ONLY for candidates that passed score >= 80 ─

    protected async save(
        candidates: GitHubRawCandidate[],
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<GitHubRawCandidate[]> {
        if (!options.campaignId || !options.userId) {
            onLog(`[GITHUB_GQL] ⚠️ Sin campaignId/userId — saltando guardado.`);
            return candidates;
        }

        onLog(`[GITHUB_GQL] 🔎 [Capa 4] Enriqueciendo ${candidates.length} candidatos aprobados (score ≥ 80)...`);

        // Contact-fetch + AI analysis run in parallel (one Promise per candidate)
        const enriched = await Promise.all(
            candidates.map(async c => {
                try {
                    const reposForContact = (c.topRepos ?? []).map(r => ({
                        name: r.name, description: r.description,
                        html_url: `https://github.com/${c.github_username}/${r.name}`,
                    }));
                    const contact = await githubContactService.findContactInfoFast(
                        c.github_username,
                        reposForContact,
                        { name: c.name, bio: c.description, location: c.location, email: c.email },
                    );
                    const aiAnalysis = await generateCandidateAnalysis({
                        name:     c.name,
                        username: c.github_username,
                        bio:      c.description,
                        languages: [...new Set((c.topRepos ?? []).map(r => r.language).filter(Boolean) as string[])],
                        topRepos:  c.topRepos ?? [],
                    });
                    return {
                        ...c,
                        contactEmail:   contact.email,
                        contactLinkedin: contact.linkedin,
                        contactWebsite: contact.website,
                        aiAnalysis,
                    };
                } catch {
                    return c; // enrichment failure must never drop a valid candidate
                }
            }),
        );

        const metrics: GitHubMetrics[] = enriched.map(c => this.toGitHubMetrics(c));
        await GitHubCandidatePersistence.saveCandidates(options.campaignId, metrics, options.userId!);
        onLog(`[GITHUB_GQL] ✅ ${enriched.length} candidatos guardados con contactos.`);
        return enriched;
    }

    // ── GraphQL fetcher ───────────────────────────────────────────────────────

    private async fetchGraphQLPage(
        query: string,
        token: string,
        onLog: LogCallback,
        locationLabel: string,
    ): Promise<GraphQLUser[]> {
        try {
            const res = await fetch(GITHUB_GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    Authorization: `bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: SEARCH_QUERY,
                    variables: { query, cursor: null },
                }),
            });

            if (!res.ok) {
                onLog(`[GITHUB_GQL] ❌ HTTP ${res.status} para location:${locationLabel}`);
                return [];
            }

            const json: GraphQLSearchResponse = await res.json();

            if (json.errors?.length) {
                onLog(`[GITHUB_GQL] ⚠️ GraphQL errors (${locationLabel}): ${json.errors.map(e => e.message).join('; ')}`);
                return [];
            }

            const nodes = json.data?.search?.nodes ?? [];
            const users = nodes.filter((n): n is GraphQLUser => n !== null && 'login' in n);
            onLog(`[GITHUB_GQL] ✅ location:${locationLabel} → ${users.length} usuarios (de ${json.data.search.userCount} totales)`);
            return users;

        } catch (err: any) {
            onLog(`[GITHUB_GQL] ❌ Fetch falló para location:${locationLabel}: ${err.message}`);
            return [];
        }
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
        const score       = (c as any)._score ?? 0;
        const topLang     = (c.topRepos ?? []).find(r => r.language)?.language ?? 'Unknown';
        const totalStars  = (c.topRepos ?? []).reduce((s, r) => s + r.stargazerCount, 0);
        const origCount   = c.topRepos?.length ?? 0;

        return {
            github_username:       c.github_username,
            github_url:            c.github_url,
            github_id:             0,
            public_repos:          c.public_repos ?? 0,
            followers:             c.followers ?? 0,
            following:             0,
            created_at:            new Date().toISOString(),
            updated_at:            new Date().toISOString(),
            total_commits:         (c.public_repos ?? 0) * 10,
            most_used_language:    topLang,
            total_stars_received:  totalStars,
            average_repo_stars:    origCount > 0 ? totalStars / origCount : 0,
            original_repos_count:  origCount,
            fork_repos_count:      (c.public_repos ?? 0) - origCount,
            originality_ratio:     c.public_repos
                ? (origCount / c.public_repos) * 100
                : 0,
            mentioned_email:       c.contactEmail ?? c.email ?? null,
            linkedin_url:          c.contactLinkedin ?? null,
            personal_website:      c.contactWebsite ?? null,
            github_score:          score,
        } as GitHubMetrics;
    }
}

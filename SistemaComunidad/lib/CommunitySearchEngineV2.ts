/**
 * CommunitySearchEngine  (refactored — extends BaseSearchEngine)
 *
 * RESPONSIBILITY:
 *  Search for developers across community platforms (GitHub Users API,
 *  Reddit RSS) and return normalised RawCandidate objects.  All
 *  cross-cutting concerns (dedup, language filter, batch AI scoring,
 *  UnbreakableExecutor) are handled by BaseSearchEngine.
 *
 * REMOVED DUPLICATION:
 *  ❌ communityDeduplicationService copy   → SharedDeduplicationService
 *  ❌ communityLanguageFilter copy         → SharedLanguageFilter
 *  ❌ communityScoringService + direct AI  → SharedBatchScoringService
 *  ❌ UnbreakableExecutor boilerplate      → BaseSearchEngine.execute()
 */

import {
    BaseSearchEngine,
    RawCandidate,
    BaseSearchOptions,
    LogCallback,
} from '../../lib/core/BaseSearchEngine';
import { ScoringProfile, ScoringResult, SYSTEM_PROMPTS } from '../../lib/core/SharedBatchScoringService';
import { LoadOptions } from '../../lib/core/SharedDeduplicationService';
import {
    CommunityCandidate,
    CommunityFilterCriteria,
    CommunityPlatform,
    CommunitySearchProgress,
} from '../types/community';
import { CommunityScoringService } from './communityScoringService';
import { CommunityCandidatePersistence } from './communityCandidatePersistence';
import { PRESET_DISCORD_FLUTTER_DEVS } from './communityPresets';

// ─── Community-specific candidate shape ───────────────────────────────────────

export interface CommunityRawCandidate extends RawCandidate {
    platform: CommunityPlatform;
    username: string;
    displayName: string;
    profileUrl: string;
    avatarUrl?: string | null;
    bio?: string | null;
    messageCount: number;
    helpfulnessScore: number;
    questionsAnswered: number;
    sharedCodeSnippets: number;
    projectLinks: string[];
    repoLinks: string[];
    skills: string[];
    communityRoles: string[];
    reputationScore: number;
    talentScore: number;
    githubUsername?: string | null;
    /** Carried for persistence */
    _community: CommunityCandidate;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CommunitySearchOptions extends BaseSearchOptions {
    filters?: CommunityFilterCriteria;
    onProgress?: (progress: CommunitySearchProgress) => void;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class CommunitySearchEngine extends BaseSearchEngine<CommunityRawCandidate> {

    protected get engineName()    { return 'COMMUNITY'; }
    protected get platformLabel() { return 'Communities (GitHub Users, Reddit)'; }

    // ── Backward-compatible entry point ───────────────────────────────────────

    public async startCommunitySearch(
        query: string,
        maxResults: number,
        options: CommunitySearchOptions,
        onLog: LogCallback,
        onProgress: (progress: CommunitySearchProgress) => void,
        onComplete: (candidates: CommunityCandidate[]) => void,
    ): Promise<void> {
        await this.execute(
            query,
            { ...options, maxResults, onProgress } as CommunitySearchOptions & BaseSearchOptions,
            onLog,
            async (rawCandidates) => {
                onComplete(rawCandidates.map(c => c._community));
            },
        );
    }

    // ── Configuration hooks ───────────────────────────────────────────────────

    protected getDeduplicationLoadOptions(options: BaseSearchOptions): LoadOptions {
        return {
            table:          'community_candidates' as any,
            urlColumn:      'profile_url',
            usernameColumn: 'username',
            campaignId:     options.campaignId,
        };
    }

    protected getSystemPrompt(): string {
        return SYSTEM_PROMPTS.COMMUNITY_DEVELOPER;
    }

    protected toPlatformKey(c: CommunityRawCandidate): string {
        return `${c.platform.toLowerCase()}:${c.username.toLowerCase()}`;
    }

    // ── fetchRawCandidates ────────────────────────────────────────────────────

    /**
     * Queries GitHub Search Users API as the primary source.
     * Falls back to Reddit RSS as a secondary source.
     * Both sources return profiles adapted into CommunityRawCandidate.
     */
    protected async fetchRawCandidates(
        query: string,
        options: CommunitySearchOptions & BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<CommunityRawCandidate[]> {
        const filter   = options.filters ?? PRESET_DISCORD_FLUTTER_DEVS;
        const maxFetch = (options.maxResults ?? 20) * 3; // over-fetch before filtering
        const all: CommunityRawCandidate[] = [];

        // ── GitHub Users API ──────────────────────────────────────────────────
        try {
            const githubCandidates = await this.fetchFromGitHubUsers(query, maxFetch, filter, onLog);
            all.push(...githubCandidates);
            onLog(`[COMMUNITY] GitHub: ${githubCandidates.length} candidatos obtenidos.`);
        } catch (err: any) {
            onLog(`[COMMUNITY] ⚠️ GitHub source falló: ${err.message}`);
        }

        if (this.userIntendedStop) return all;

        // ── Reddit RSS (secondary) ────────────────────────────────────────────
        if (all.length < maxFetch) {
            try {
                const redditCandidates = await this.fetchFromReddit(filter, onLog);
                all.push(...redditCandidates);
                onLog(`[COMMUNITY] Reddit: ${redditCandidates.length} candidatos obtenidos.`);
            } catch (err: any) {
                onLog(`[COMMUNITY] ⚠️ Reddit source falló: ${err.message}`);
            }
        }

        return all;
    }

    /** Fetch developers from GitHub Search Users API. */
    private async fetchFromGitHubUsers(
        query: string,
        maxResults: number,
        filter: CommunityFilterCriteria,
        onLog: LogCallback,
    ): Promise<CommunityRawCandidate[]> {
        const candidates: CommunityRawCandidate[] = [];
        const keywords = filter.keywords?.join(' ') ?? query;

        // Build GitHub search query
        const ghQuery = encodeURIComponent(
            `${keywords} type:user location:spain OR location:mexico OR location:colombia`
        );

        const url = `https://api.github.com/search/users?q=${ghQuery}&per_page=50&sort=followers`;

        const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
        };
        const token = import.meta.env.VITE_GITHUB_TOKEN;
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);

        const data = await res.json();
        const users: any[] = data.items ?? [];

        for (const u of users.slice(0, maxResults)) {
            const candidate: CommunityCandidate = {
                id:             `gh_users_${u.login}`,
                username:       u.login,
                displayName:    u.login,
                platform:       CommunityPlatform.GitHubDiscussions,
                profileUrl:     u.html_url,
                avatarUrl:      u.avatar_url,
                bio:            undefined,
                messageCount:   0,
                helpfulnessScore: 0,
                questionsAnswered: 0,
                sharedCodeSnippets: 0,
                projectLinks:   [],
                repoLinks:      [u.html_url],
                skills:         filter.keywords ?? [],
                communityRoles: [],
                reputationScore: u.score ?? 0,
                talentScore:    0,
                scrapedAt:      new Date().toISOString(),
            };

            const { score } = CommunityScoringService.calculateTalentScore(candidate, filter);
            candidate.talentScore = score;

            candidates.push(this.toCommunityRawCandidate(candidate));
        }

        return candidates;
    }

    /** Fetch developers from Reddit RSS feeds (CORS-safe). */
    private async fetchFromReddit(
        filter: CommunityFilterCriteria,
        onLog: LogCallback,
    ): Promise<CommunityRawCandidate[]> {
        const candidates: CommunityRawCandidate[] = [];

        for (const subreddit of filter.subreddits ?? ['FlutterDev', 'reactjs']) {
            if (this.userIntendedStop) break;

            try {
                const res = await fetch(`/api/community-search?source=reddit&subreddit=${subreddit}`);
                if (!res.ok) continue;

                const posts: any[] = await res.json();

                for (const post of posts.slice(0, 10)) {
                    const candidate: CommunityCandidate = {
                        id:             `reddit_${subreddit}_${post.author ?? Date.now()}`,
                        username:       post.author ?? 'unknown',
                        displayName:    post.author ?? 'unknown',
                        platform:       CommunityPlatform.Reddit,
                        profileUrl:     `https://reddit.com/u/${post.author}`,
                        bio:            post.selftext?.slice(0, 300) ?? null,
                        messageCount:   post.num_comments ?? 0,
                        helpfulnessScore: Math.min(100, (post.score ?? 0) / 10),
                        questionsAnswered: 0,
                        sharedCodeSnippets: 0,
                        projectLinks:   [],
                        repoLinks:      [],
                        skills:         filter.keywords ?? [],
                        communityRoles: [],
                        reputationScore: post.score ?? 0,
                        talentScore:    0,
                        scrapedAt:      new Date().toISOString(),
                    };

                    const { score } = CommunityScoringService.calculateTalentScore(candidate, filter);
                    candidate.talentScore = score;
                    candidates.push(this.toCommunityRawCandidate(candidate));
                }
            } catch (err: any) {
                onLog(`[COMMUNITY] Reddit /r/${subreddit}: ${err.message}`);
            }
        }

        return candidates;
    }

    // ── Cross-cutting overrides ───────────────────────────────────────────────

    protected buildScoringProfile(c: CommunityRawCandidate): ScoringProfile {
        return {
            id: c._id,
            profileText: [
                `Platform: ${c.platform}`,
                `Username: ${c.username}`,
                c.description ? `Bio: ${c.description}` : '',
                c.location    ? `Location: ${c.location}` : '',
                `Messages: ${c.messageCount}`,
                `Helpfulness: ${c.helpfulnessScore}/100`,
                `Questions answered: ${c.questionsAnswered}`,
                `Code snippets shared: ${c.sharedCodeSnippets}`,
                `Skills: ${c.skills.join(', ')}`,
                `Roles: ${c.communityRoles.join(', ') || 'none'}`,
                `Projects shared: ${c.projectLinks.length + c.repoLinks.length}`,
            ].filter(Boolean).join('\n'),
        };
    }

    protected mergeScoreIntoCandidate(
        candidate: CommunityRawCandidate,
        result: ScoringResult,
    ): CommunityRawCandidate {
        const updated: CommunityCandidate = {
            ...candidate._community,
            talentScore: result.score,
            aiSummary:   [result.reasoning],
        };
        return {
            ...candidate,
            talentScore: result.score,
            _score:      result.score,
            _reasoning:  result.reasoning,
            _community:  updated,
        };
    }

    // ── save ─────────────────────────────────────────────────────────────────

    protected async save(
        candidates: CommunityRawCandidate[],
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<CommunityRawCandidate[]> {
        if (!options.campaignId || !options.userId) {
            onLog(`[COMMUNITY] ⚠️ Sin campaignId/userId — saltando guardado.`);
            return candidates;
        }

        const ok = await CommunityCandidatePersistence.saveCandidates(
            options.campaignId,
            candidates.map(c => c._community),
            options.userId,
        );

        onLog(`[COMMUNITY] ✅ ${ok ? candidates.length : 0} guardados.`);
        return candidates;
    }

    // ── Private helper ────────────────────────────────────────────────────────

    private toCommunityRawCandidate(c: CommunityCandidate): CommunityRawCandidate {
        return {
            _id:             c.id,
            name:            c.displayName || c.username,
            title:           null,
            description:     c.bio ?? null,
            location:        null, // enriched later
            email:           c.email ?? null,
            profileUrl:      c.profileUrl,
            platform:        c.platform,
            username:        c.username,
            displayName:     c.displayName,
            avatarUrl:       c.avatarUrl ?? null,
            bio:             c.bio ?? null,
            messageCount:    c.messageCount,
            helpfulnessScore: c.helpfulnessScore,
            questionsAnswered: c.questionsAnswered,
            sharedCodeSnippets: c.sharedCodeSnippets,
            projectLinks:    c.projectLinks,
            repoLinks:       c.repoLinks,
            skills:          c.skills,
            communityRoles:  c.communityRoles,
            reputationScore: c.reputationScore,
            talentScore:     c.talentScore,
            githubUsername:  c.githubUsername ?? null,
            _community:      c,
        };
    }
}

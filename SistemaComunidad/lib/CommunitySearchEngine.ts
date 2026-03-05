import { CommunityCandidate, CommunityFilterCriteria, CommunityPlatform, CommunitySearchProgress } from '../types/community';
import { UnbreakableExecutor, initializeUnbreakableMarker } from '../../lib/UnbreakableExecution';
import { CommunityScoringService } from './communityScoringService';
import { communityDedupService } from './communityDeduplicationService';
import { isLikelySpanishSpeaker } from './communityLanguageFilter';
import { PRESET_DISCORD_FLUTTER_DEVS } from './communityPresets';

export type LogCallback = (message: string) => void;

/**
 * CommunitySearchEngine
 * 
 * Orchestrates community member search across Discord, Skool, Reddit,
 * and GitHub Discussions. Uses UnbreakableExecutor from shared lib
 * to survive tab switches and browser pauses.
 * 
 * All external API calls go through /api/community-search proxy
 * to avoid browser CORS restrictions.
 */
export class CommunitySearchEngine {
    private isRunning = false;
    private userIntendedStop = false;
    private abortController: AbortController | null = null;
    private unbreakableExecutor: UnbreakableExecutor | null = null;

    constructor() {
        initializeUnbreakableMarker();
    }

    public stop() {
        this.userIntendedStop = true;
        this.isRunning = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        if (this.unbreakableExecutor) {
            this.unbreakableExecutor.stop('User clicked stop button');
        }
    }

    public getIsRunning(): boolean {
        return this.isRunning;
    }

    public async startCommunitySearch(
        query: string,
        maxResults: number,
        options: {
            filters?: CommunityFilterCriteria;
            campaignId?: string;
            userId?: string;
        },
        onLog: LogCallback,
        onProgress: (progress: CommunitySearchProgress) => void,
        onComplete: (candidates: CommunityCandidate[]) => void
    ) {
        this.isRunning = true;
        this.userIntendedStop = false;
        this.abortController = new AbortController();

        const campaignId = options.campaignId || `community_${Date.now()}`;
        this.unbreakableExecutor = new UnbreakableExecutor(campaignId);

        try {
            this.unbreakableExecutor.run(
                async () => {
                    await this.executeCommunitySearch(
                        query, maxResults, options, onLog, onProgress, onComplete
                    );
                },
                (state) => {
                    onLog(`[EXECUTOR] Current state: ${state}`);
                }
            ).catch((err) => {
                if (!this.userIntendedStop) {
                    onLog(`[ERROR] ${err.message}`);
                }
                this.isRunning = false;
            });
        } catch (err: any) {
            onLog(`[ERROR] ${err.message}`);
            this.isRunning = false;
        }
    }

    // ─── Core search execution ──────────────────────────────────────────────

    private async executeCommunitySearch(
        query: string,
        maxResults: number,
        options: {
            filters?: CommunityFilterCriteria;
            campaignId?: string;
            userId?: string;
        },
        onLog: LogCallback,
        onProgress: (progress: CommunitySearchProgress) => void,
        onComplete: (candidates: CommunityCandidate[]) => void
    ): Promise<void> {
        try {
            const filters = options.filters || PRESET_DISCORD_FLUTTER_DEVS;
            const platforms = filters.platforms;

            onLog('🔍 Iniciando búsqueda en comunidades...');
            onLog(`📌 Plataformas: ${platforms.join(', ')}`);
            onLog(`🔑 Keywords: ${filters.keywords.join(', ')}`);
            onLog(`📊 Max results: ${maxResults}`);

            let allCandidates: CommunityCandidate[] = [];

            // Search each platform
            for (const platform of platforms) {
                if (this.userIntendedStop) {
                    onLog('⛔ Search stopped by user');
                    break;
                }

                onLog(`\n═══ Searching ${platform} ═══`);

                const platformCandidates = await this.searchPlatform(
                    platform, query, filters, maxResults, onLog, onProgress
                );

                onLog(`✅ ${platform}: Found ${platformCandidates.length} members`);
                allCandidates = [...allCandidates, ...platformCandidates];
            }

            // Deduplicate across platforms
            onLog(`\n🔄 Deduplicating ${allCandidates.length} candidates across platforms...`);
            const beforeDedup = allCandidates.length;
            allCandidates = communityDedupService.deduplicateArray(allCandidates);
            const removed = beforeDedup - allCandidates.length;
            if (removed > 0) {
                onLog(`🗑️ Removed ${removed} duplicates (cross-platform)`);
            }

            // Apply Spanish language filter if required
            if (filters.requireSpanishSpeaker) {
                const minConfidence = filters.minSpanishConfidence || 25;
                onLog(`\n🌍 Applying Spanish language filter (confidence >= ${minConfidence})...`);
                const beforeFilter = allCandidates.length;
                allCandidates = allCandidates.filter(c => isLikelySpanishSpeaker({
                    displayName: c.displayName,
                    username: c.username,
                    bio: c.bio,
                    location: null,
                    detectedLanguage: c.detectedLanguage,
                }, minConfidence));
                onLog(`🌍 Language filter: ${beforeFilter} → ${allCandidates.length} candidates`);
            }

            // Score and rank
            onLog(`\n📊 Scoring ${allCandidates.length} candidates...`);
            allCandidates = CommunityScoringService.scoreAndRank(allCandidates, filters);

            // Apply score threshold
            const scoreThreshold = filters.minActivityScore || 0;
            if (scoreThreshold > 0) {
                const beforeScore = allCandidates.length;
                allCandidates = allCandidates.filter(c => c.talentScore >= scoreThreshold);
                onLog(`📊 Score filter (>=${scoreThreshold}): ${beforeScore} → ${allCandidates.length}`);
            }

            // Limit results
            if (allCandidates.length > maxResults) {
                allCandidates = allCandidates.slice(0, maxResults);
                onLog(`📋 Limited to top ${maxResults} candidates`);
            }

            onLog(`\n✅ Búsqueda completada: ${allCandidates.length} candidatos encontrados`);

            // Log quality summary
            const excellent = allCandidates.filter(c => c.talentScore >= 80).length;
            const good = allCandidates.filter(c => c.talentScore >= 60 && c.talentScore < 80).length;
            const avgScore = allCandidates.length > 0
                ? Math.round(allCandidates.reduce((sum, c) => sum + c.talentScore, 0) / allCandidates.length)
                : 0;
            onLog(`📈 Calidad: ${excellent} excelentes (>=80), ${good} buenos (>=60), promedio: ${avgScore}`);

            onComplete(allCandidates);
        } catch (error: any) {
            onLog(`[ERROR] ${error.message}`);
            onComplete([]);
        } finally {
            this.isRunning = false;
        }
    }

    // ─── Platform-specific search ──────────────────────────────────────────

    private async searchPlatform(
        platform: CommunityPlatform,
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        onProgress: (progress: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        const progress: CommunitySearchProgress = {
            platform,
            communityName: this.getPlatformName(platform),
            membersScanned: 0,
            qualityFound: 0,
            duplicatesSkipped: 0,
            status: 'scanning',
        };

        onProgress(progress);

        switch (platform) {
            case CommunityPlatform.Discord:
                return this.searchDiscord(query, filters, maxResults, onLog, progress, onProgress);
            case CommunityPlatform.Reddit:
                return this.searchReddit(query, filters, maxResults, onLog, progress, onProgress);
            case CommunityPlatform.Skool:
                return this.searchSkool(query, filters, maxResults, onLog, progress, onProgress);
            case CommunityPlatform.GitHubDiscussions:
                return this.searchGitHubDiscussions(query, filters, maxResults, onLog, progress, onProgress);
            default:
                onLog(`⚠️ Unknown platform: ${platform}`);
                return [];
        }
    }

    // ─── Discord Search ─────────────────────────────────────────────────────

    private async searchDiscord(
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        progress: CommunitySearchProgress,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        onLog('🎮 Scanning Discord communities...');

        const serverIds = filters.discordServerIds || [];
        if (serverIds.length === 0) {
            onLog('⚠️ No Discord server IDs configured. Add server IDs in campaign filters.');
            onLog('💡 Tip: Right-click server → Copy Server ID (Developer Mode required)');
        }

        const candidates: CommunityCandidate[] = [];

        for (const serverId of serverIds) {
            if (this.userIntendedStop) break;
            onLog(`📡 Scanning server: ${serverId}`);
            progress.membersScanned += 0;
            onProgress(progress);
            await this.delay(500);
        }

        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);

        return candidates;
    }

    // ─── Reddit Search (via /api/community-search proxy) ────────────────────

    private async searchReddit(
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        progress: CommunitySearchProgress,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        onLog('🔴 Scanning Reddit communities...');

        const subreddits = filters.subreddits || [];
        if (subreddits.length === 0) {
            onLog('⚠️ No subreddits configured. Add subreddits in campaign filters.');
            onLog('💡 Tip: Add subreddit names without r/ (e.g., "Flutter", "SaaS")');
            return [];
        }

        const candidatesMap = new Map<string, CommunityCandidate>();

        for (const subreddit of subreddits) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning r/${subreddit}...`);

            try {
                // Use server-side proxy to avoid CORS
                const proxyUrl = `/api/community-search?platform=reddit&subreddit=${encodeURIComponent(subreddit)}&query=${encodeURIComponent(query)}&limit=100`;
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    const errBody = await response.text();
                    onLog(`⚠️ Error r/${subreddit}: HTTP ${response.status} — ${errBody.slice(0, 200)}`);
                    continue;
                }

                const data = await response.json();
                const posts = data.posts || [];
                onLog(`📦 r/${subreddit}: ${posts.length} posts encontrados`);

                for (const post of posts) {
                    const author = post.author;
                    if (!author || author === '[deleted]' || author.toLowerCase().includes('bot') || author === 'AutoModerator') continue;

                    if (!candidatesMap.has(author)) {
                        candidatesMap.set(author, {
                            id: `reddit_${author}_${Date.now()}`,
                            platform: CommunityPlatform.Reddit,
                            username: author,
                            displayName: author,
                            profileUrl: `https://www.reddit.com/user/${author}`,
                            avatarUrl: `https://ui-avatars.com/api/?name=${author}&background=EA580C&color=FFF`,
                            bio: `Active contributor in r/${subreddit}`,
                            messageCount: 1,
                            helpfulnessScore: post.score || 0,
                            questionsAnswered: post.num_comments || 0,
                            sharedCodeSnippets: 0,
                            projectLinks: [],
                            repoLinks: [],
                            skills: filters.keywords || [],
                            communityRoles: [],
                            reputationScore: post.score || 0,
                            talentScore: 0,
                            scrapedAt: new Date().toISOString(),
                            communityName: `r/${subreddit}`,
                        });
                    } else {
                        const existing = candidatesMap.get(author)!;
                        existing.messageCount = (existing.messageCount || 0) + 1;
                        existing.helpfulnessScore = (existing.helpfulnessScore || 0) + (post.score || 0);
                        existing.questionsAnswered = (existing.questionsAnswered || 0) + (post.num_comments || 0);
                        existing.reputationScore = (existing.reputationScore || 0) + (post.score || 0);
                        if (!existing.bio?.includes(subreddit)) {
                            existing.bio += `, r/${subreddit}`;
                        }
                    }
                    progress.membersScanned++;
                }

                onProgress(progress);
                await this.delay(500);
            } catch (err: any) {
                onLog(`⚠️ Error r/${subreddit}: ${err.message}`);
            }
        }

        const candidates = Array.from(candidatesMap.values());
        onLog(`🔴 Reddit total: ${candidates.length} usuarios únicos`);
        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);

        return candidates;
    }

    // ─── Skool Search ───────────────────────────────────────────────────────

    private async searchSkool(
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        progress: CommunitySearchProgress,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        onLog('🎓 Scanning Skool communities...');

        const communityUrls = filters.skoolCommunityUrls || [];
        if (communityUrls.length === 0) {
            onLog('⚠️ No Skool community URLs configured.');
            onLog('💡 Tip: Add Skool community URLs (e.g., "https://www.skool.com/community-name")');
        }

        const candidates: CommunityCandidate[] = [];

        for (const url of communityUrls) {
            if (this.userIntendedStop) break;
            onLog(`📡 Scanning: ${url}`);
            progress.membersScanned += 0;
            onProgress(progress);
            await this.delay(500);
        }

        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);

        return candidates;
    }

    // ─── GitHub Discussions Search (via /api/community-search proxy) ────────

    private async searchGitHubDiscussions(
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        progress: CommunitySearchProgress,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        onLog('💻 Scanning GitHub Issues/Discussions...');

        const repos = filters.githubRepos || [];
        if (repos.length === 0) {
            onLog('⚠️ No GitHub repos configured for Discussions search.');
            onLog('💡 Tip: Add repo names (e.g., "flutter/flutter", "vercel/next.js")');
            return [];
        }

        const candidatesMap = new Map<string, CommunityCandidate>();

        for (const repo of repos) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning ${repo} activity...`);

            try {
                // Use server-side proxy to avoid CORS
                const proxyUrl = `/api/community-search?platform=github&repo=${encodeURIComponent(repo)}&limit=100`;
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    const errBody = await response.text();
                    onLog(`⚠️ Error ${repo}: HTTP ${response.status} — ${errBody.slice(0, 200)}`);
                    continue;
                }

                const data = await response.json();
                const issues = data.issues || [];
                onLog(`📦 ${repo}: ${issues.length} issues/discussions encontrados`);

                for (const issue of issues) {
                    const author = issue.author;
                    if (!author || author.includes('[bot]') || author === 'dependabot[bot]') continue;

                    if (!candidatesMap.has(author)) {
                        candidatesMap.set(author, {
                            id: `github_${author}_${Date.now()}`,
                            platform: CommunityPlatform.GitHubDiscussions,
                            username: author,
                            displayName: author,
                            profileUrl: issue.user_html_url || `https://github.com/${author}`,
                            avatarUrl: issue.avatar_url || `https://ui-avatars.com/api/?name=${author}&background=0D1117&color=FFF`,
                            bio: `Active contributor in ${repo}`,
                            messageCount: 1,
                            helpfulnessScore: issue.reactions_total || 0,
                            questionsAnswered: issue.comments || 0,
                            sharedCodeSnippets: 0,
                            projectLinks: [issue.html_url],
                            repoLinks: [`https://github.com/${repo}`],
                            skills: filters.keywords || [],
                            communityRoles: [],
                            reputationScore: (issue.reactions_total || 0) + (issue.comments || 0),
                            talentScore: 0,
                            githubUrl: issue.user_html_url || `https://github.com/${author}`,
                            githubUsername: author,
                            scrapedAt: new Date().toISOString(),
                            communityName: repo,
                        });
                    } else {
                        const existing = candidatesMap.get(author)!;
                        existing.messageCount = (existing.messageCount || 0) + 1;
                        existing.helpfulnessScore = (existing.helpfulnessScore || 0) + (issue.reactions_total || 0);
                        existing.questionsAnswered = (existing.questionsAnswered || 0) + (issue.comments || 0);
                        existing.reputationScore = (existing.reputationScore || 0) + (issue.reactions_total || 0) + (issue.comments || 0);
                        if (!existing.bio?.includes(repo)) {
                            existing.bio += `, ${repo}`;
                            existing.repoLinks.push(`https://github.com/${repo}`);
                        }
                    }
                    progress.membersScanned++;
                }

                onProgress(progress);
                await this.delay(500);
            } catch (err: any) {
                onLog(`⚠️ Error ${repo}: ${err.message}`);
            }
        }

        const candidates = Array.from(candidatesMap.values());
        onLog(`💻 GitHub total: ${candidates.length} contributors únicos`);
        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);

        return candidates;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private getPlatformName(platform: CommunityPlatform): string {
        switch (platform) {
            case CommunityPlatform.Discord: return 'Discord';
            case CommunityPlatform.Reddit: return 'Reddit';
            case CommunityPlatform.Skool: return 'Skool';
            case CommunityPlatform.GitHubDiscussions: return 'GitHub Discussions';
            default: return 'Unknown';
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const communitySearchEngine = new CommunitySearchEngine();

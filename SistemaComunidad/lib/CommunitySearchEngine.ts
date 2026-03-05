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
 * Design: Same pattern as SistemaGithub/lib/GitHubSearchEngine.ts
 * but adapted for community platforms.
 */
export class CommunitySearchEngine {
    private isRunning = false;
    private userIntendedStop = false;
    private abortController: AbortController | null = null;
    private unbreakableExecutor: UnbreakableExecutor | null = null;

    constructor() {
        initializeUnbreakableMarker();
    }

    /**
     * Stop the current search
     */
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

    /**
     * Check if search is currently running
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Start community search with provided filters
     */
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
                    onLog(`[ERROR] ❌ ${err.message}`);
                }
                this.isRunning = false;
            });
        } catch (err: any) {
            onLog(`[ERROR] ❌ ${err.message}`);
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
                onLog(`\n🌍 Applying Spanish language filter (confidence ≥ ${minConfidence})...`);
                const beforeFilter = allCandidates.length;
                allCandidates = allCandidates.filter(c => isLikelySpanishSpeaker({
                    displayName: c.displayName,
                    username: c.username,
                    bio: c.bio,
                    location: null, // Community profiles rarely have location
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
                onLog(`📊 Score filter (≥${scoreThreshold}): ${beforeScore} → ${allCandidates.length}`);
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
            onLog(`📈 Calidad: ${excellent} excelentes (≥80), ${good} buenos (≥60), promedio: ${avgScore}`);

            onComplete(allCandidates);
        } catch (error: any) {
            onLog(`[ERROR] ❌ ${error.message}`);
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

        // NOTE: Real implementation would use Discord API or Apify actor
        // Structure is ready for integration with:
        // - Discord Bot API (requires bot in server)
        // - Apify Discord scraping actors
        // - Direct REST API with token

        const serverIds = filters.discordServerIds || [];
        if (serverIds.length === 0) {
            onLog('⚠️ No Discord server IDs configured. Add server IDs in campaign filters.');
            onLog('💡 Tip: Right-click server → Copy Server ID (Developer Mode required)');
        }

        const candidates: CommunityCandidate[] = [];

        for (const serverId of serverIds) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning server: ${serverId}`);

            // TODO: Integrate with Discord API
            // Structure for when API is connected:
            // const members = await discordApi.searchMessages(serverId, query, filters);
            // Process members, extract signals, create CommunityCandidate objects

            progress.membersScanned += 0;
            onProgress(progress);

            // Simulate scanning delay
            await this.delay(500);
        }

        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);

        return candidates;
    }

    // ─── Reddit Search ──────────────────────────────────────────────────────

    private async searchReddit(
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        progress: CommunitySearchProgress,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        onLog('🔴 Scanning Reddit communities...');

        // NOTE: Real implementation would use Reddit API or Apify actor
        // Structure is ready for integration with:
        // - Reddit JSON API (append .json to any page)
        // - Reddit OAuth API (for more data)
        // - Apify Reddit scraping actors

        const subreddits = filters.subreddits || [];
        if (subreddits.length === 0) {
            onLog('⚠️ No subreddits configured. Add subreddits in campaign filters.');
            onLog('💡 Tip: Add subreddit names without r/ (e.g., "Flutter", "SaaS")');
        }

        const candidates: CommunityCandidate[] = [];

        for (const subreddit of subreddits) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning r/${subreddit}...`);

            // TODO: Integrate with Reddit API
            // Structure:
            // const posts = await fetch(`https://www.reddit.com/r/${subreddit}/search.json?q=${query}`);
            // Extract active users, their post history, karma, etc.

            progress.membersScanned += 0;
            onProgress(progress);

            await this.delay(500);
        }

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

        // NOTE: Skool has no public API — requires scraping
        // Structure is ready for integration with:
        // - Apify Skool scraping actors
        // - Custom Playwright scraper
        // - Manual CSV import

        const communityUrls = filters.skoolCommunityUrls || [];
        if (communityUrls.length === 0) {
            onLog('⚠️ No Skool community URLs configured.');
            onLog('💡 Tip: Add Skool community URLs (e.g., "https://www.skool.com/community-name")');
        }

        const candidates: CommunityCandidate[] = [];

        for (const url of communityUrls) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning: ${url}`);

            // TODO: Integrate with Skool scraping
            progress.membersScanned += 0;
            onProgress(progress);

            await this.delay(500);
        }

        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);

        return candidates;
    }

    // ─── GitHub Discussions Search ──────────────────────────────────────────

    private async searchGitHubDiscussions(
        query: string,
        filters: CommunityFilterCriteria,
        maxResults: number,
        onLog: LogCallback,
        progress: CommunitySearchProgress,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        onLog('💻 Scanning GitHub Discussions...');

        // NOTE: GitHub Discussions uses GraphQL API
        // Structure is ready for integration with:
        // - GitHub GraphQL API (Discussions endpoint)
        // - GitHub REST API (for user profiles)

        const repos = filters.githubRepos || [];
        if (repos.length === 0) {
            onLog('⚠️ No GitHub repos configured for Discussions search.');
            onLog('💡 Tip: Add repo names (e.g., "flutter/flutter", "vercel/next.js")');
        }

        const candidates: CommunityCandidate[] = [];

        for (const repo of repos) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning ${repo} Discussions...`);

            // TODO: Integrate with GitHub GraphQL API
            // Query example:
            // query { repository(owner:"flutter", name:"flutter") {
            //   discussions(first:100, orderBy:{field:CREATED_AT, direction:DESC}) {
            //     nodes { author { login, avatarUrl }, bodyText, comments { totalCount } }
            //   }
            // }}

            progress.membersScanned += 0;
            onProgress(progress);

            await this.delay(500);
        }

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

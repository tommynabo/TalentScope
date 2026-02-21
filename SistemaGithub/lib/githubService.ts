import { Octokit } from '@octokit/rest';
import { Candidate, GitHubFilterCriteria, GitHubMetrics, GitHubScoreBreakdown } from '../../types/database';
import { v4 as uuidv4 } from 'uuid';
import { githubContactService } from '../../SistemaGithub/lib/githubContactService';
import { githubDeduplicationService } from '../../SistemaGithub/lib/githubDeduplication';
import { GitHubCandidatePersistence } from '../../SistemaGithub/lib/githubCandidatePersistence';
import { analyzeSpanishLanguageProficiency } from '../../SistemaGithub/lib/githubSpanishLanguageFilter';

export type GitHubLogCallback = (message: string) => void;

const GENERIC_REPO_KEYWORDS = [
    'todo', 'calculator', 'weather', 'clone', 'tutorial', 'test',
    'demo', 'sample', 'example', 'hello', 'app-example',
    'hello-world', 'learning', 'practice', 'course'
];

const APP_STORE_KEYWORDS = [
    'play.google.com',
    'apps.apple.com',
    'play store',
    'app store',
    'google play',
    'itunes',
    'appstore'
];

export class GitHubService {
    private octokit: Octokit | null = null;
    private rateLimit = { remaining: 5000, reset: 0 };

    constructor(token?: string) {
        if (token) {
            this.octokit = new Octokit({ auth: token });
        }
    }

    /**
     * Main search function - Busca usuarios de GitHub con criterios específicos
     * Ahora persiste automáticamente en Supabase
     */
    async searchDevelopers(
        criteria: GitHubFilterCriteria,
        maxResults: number = 50,
        onLog: GitHubLogCallback,
        campaignId?: string,
        userId?: string
    ): Promise<GitHubMetrics[]> {
        try {
            onLog('🔍 Starting GitHub developer search...');
            onLog(`📋 Token configured: ${this.octokit ? 'YES ✅' : 'NO (public API)'}`);

            if (!this.octokit) {
                onLog('⚠️ No GitHub token. Using public API (60 req/hour limit). Results may be limited.');
                this.octokit = new Octokit();
            }

            // Load existing candidates for deduplication (PER CAMPAIGN)
            onLog('🔄 Loading duplicate filter...');
            let existingUsernames: Set<string>;
            let existingEmails: Set<string>;
            let existingLinkedin: Set<string>;

            if (campaignId && userId) {
                // Try Supabase first, fallback to localStorage
                const dedupeData = await githubDeduplicationService.fetchExistingGitHubCandidates(campaignId, userId);
                existingUsernames = dedupeData.existingUsernames;
                existingEmails = dedupeData.existingEmails;
                existingLinkedin = dedupeData.existingLinkedin;

                // If Supabase returned empty, try localStorage
                if (existingUsernames.size === 0 && existingEmails.size === 0) {
                    const localStorageKey = `github_candidates_${campaignId}`;
                    try {
                        const stored = localStorage.getItem(localStorageKey);
                        if (stored) {
                            const candidates = JSON.parse(stored) as GitHubMetrics[];
                            existingUsernames = new Set(candidates.map(c => c.github_username.toLowerCase()));
                            existingEmails = new Set(
                                candidates
                                    .filter(c => c.mentioned_email)
                                    .map(c => c.mentioned_email!.toLowerCase())
                            );
                            existingLinkedin = new Set(
                                candidates
                                    .filter(c => c.linkedin_url)
                                    .map(c => c.linkedin_url!.toLowerCase())
                            );
                            onLog(`✅ Loaded ${existingUsernames.size} existing fromStorage (${candidates.length} candidates)`);
                        } else {
                            onLog(`✅ Loaded 0 existing usernames from campaign (fresh search)`);
                        }
                    } catch (err) {
                        onLog(`⚠️ Could not load from localStorage for dedup`);
                    }
                } else {
                    onLog(`✅ Loaded ${existingUsernames.size} existing usernames, ${existingEmails.size} emails, ${existingLinkedin.size} LinkedIn from campaign`);
                }
            } else {
                existingUsernames = new Set();
                existingEmails = new Set();
                existingLinkedin = new Set();
                onLog('⚠️ No campaign context - deduplication against current batch only');
            }

            const currentBatchUsernames = new Set<string>();

            // Build search query
            const query = this.buildSearchQuery(criteria);
            onLog(`📝 Search query: ${query}`);
            onLog(`🎯 Target: ${maxResults} qualified developers`);

            // === LOOP PAGINADO ===
            const candidates: GitHubMetrics[] = [];
            let page = 1;
            const maxPages = 10; // Límite para evitar demasiadas llamadas API
            let totalUsersAnalyzed = 0;
            let totalUsersSkipped = 0;

            while (candidates.length < maxResults && page <= maxPages) {
                onLog(`\n📄 Fetching page ${page}...`);

                let response;
                try {
                    response = await this.octokit.rest.search.users({
                        q: query,
                        per_page: 30, // Max results per page
                        page: page,
                        sort: 'followers',
                        order: 'desc'
                    });
                } catch (apiError: any) {
                    onLog(`❌ API Error on page ${page}: ${apiError.message}`);
                    if (apiError.status === 403) {
                        onLog('⚠️ 403: Rate limited. Stopping search.');
                    }
                    break;
                }

                if (!response.data.items || response.data.items.length === 0) {
                    onLog(`✅ No more results available (searched ${page - 1} pages)`);
                    break;
                }

                onLog(`✅ Page ${page}: Found ${response.data.items.length} users`);

                // Analyze each user on this page
                for (const user of response.data.items) {
                    if (candidates.length >= maxResults) {
                        onLog(`✅ Reached target of ${maxResults} candidates. Stopping search.`);
                        break;
                    }

                    totalUsersAnalyzed++;

                    // ⚡ FAST PRE-CHECK: Skip known duplicates BEFORE any API calls
                    const lowerLogin = user.login.toLowerCase();
                    if (existingUsernames.has(lowerLogin) || currentBatchUsernames.has(lowerLogin)) {
                        onLog(`  ⏭️ @${user.login} → duplicate (skipped instantly)`);
                        totalUsersSkipped++;
                        continue;
                    }

                    try {
                        onLog(`  📊 [${candidates.length + 1}/${maxResults}] Analyzing @${user.login}...`);
                        const metrics = await this.analyzeUser(user.login, criteria, onLog);

                        if (metrics) {
                            // Final dedup check (email/linkedin)
                            if (githubDeduplicationService.isDuplicate(
                                metrics,
                                existingUsernames,
                                existingEmails,
                                existingLinkedin,
                                currentBatchUsernames
                            )) {
                                onLog(`    ⏭️ Skipped - duplicate (email/linkedin match)`);
                                totalUsersSkipped++;
                            } else {
                                candidates.push(metrics);
                                currentBatchUsernames.add(lowerLogin);
                                existingUsernames.add(lowerLogin);
                                onLog(`    ✅ Added @${user.login} (Score: ${metrics.github_score})`);
                            }
                        } else {
                            onLog(`    ⏭️ Skipped - doesn't match quality criteria`);
                            totalUsersSkipped++;
                        }
                    } catch (err: any) {
                        onLog(`    ⚠️ Error analyzing @${user.login}: ${err.message}`);
                        totalUsersSkipped++;
                    }
                }

                // Check if we need more results
                if (candidates.length < maxResults) {
                    const needed = maxResults - candidates.length;
                    onLog(`\n📊 Progress: ${candidates.length}/${maxResults} (need ${needed} more)`);
                    page++;
                } else {
                    break;
                }
            }

            // SAVE TO SUPABASE if campaign context available
            if (campaignId && userId && candidates.length > 0) {
                onLog(`\n💾 Saving ${candidates.length} candidates to Supabase...`);
                const saved = await GitHubCandidatePersistence.saveCandidates(
                    campaignId,
                    candidates,
                    userId
                );
                if (saved) {
                    onLog(`✅ Successfully saved ${candidates.length} candidates to database`);
                } else {
                    onLog(`⚠️ Warning: Could not save to database, using localStorage instead`);
                }
            } else if (candidates.length > 0) {
                onLog(`⚠️ No campaign context - results NOT persisted to database`);
            }

            onLog(`\n🎉 Search complete!`);
            onLog(`✅ Found: ${candidates.length} qualified developers`);
            onLog(`📊 Analyzed: ${totalUsersAnalyzed} users, Skipped: ${totalUsersSkipped}`);

            return candidates;

        } catch (error: any) {
            onLog(`❌ Search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Deep analysis of individual user
     */
    private async analyzeUser(
        username: string,
        criteria: GitHubFilterCriteria,
        onLog: GitHubLogCallback
    ): Promise<GitHubMetrics | null> {
        try {
            // 1. Get user profile
            const userResponse = await this.octokit!.rest.users.getByUsername({ username });
            const user = userResponse.data;

            // 1.5. Verify it's an individual user (not organization/company)
            if (user.type !== 'User') {
                onLog(`  ⏭️ Not an individual user (type: ${user.type}). Skipping.`);
                return null;
            }

            onLog(`  📌 Profile: ${user.name || 'N/A'} | ${user.followers} followers`);

            // 2. Check follower requirement (FAST - no API call needed)
            if (user.followers < criteria.min_followers) {
                onLog(`  ⏭️ Followers (${user.followers}) below minimum (${criteria.min_followers})`);
                return null;
            }

            // 3. Get repositories
            const reposResponse = await this.octokit!.rest.repos.listForUser({
                username,
                per_page: 100,
                type: 'all'
            });

            const repos = reposResponse.data;
            onLog(`  📚 Found ${repos.length} total repositories`);

            // 4. Filter and analyze repos
            const originalRepos = repos.filter(r => !r.fork);
            const originality = repos.length > 0 ? (originalRepos.length / repos.length) * 100 : 0;

            onLog(`  ✨ Originality: ${originalRepos.length}/${repos.length} (${originality.toFixed(0)}%)`);

            // 5. ⚡ FAST: Detect languages from repo metadata (NO extra API calls)
            const languages = this.detectLanguages(originalRepos.length > 0 ? originalRepos : repos);

            // 5.1 ⚡ FAST: Check language match EARLY (before expensive calls)
            if (criteria.languages.length > 0) {
                const hasMatchingLanguage = languages.some(lang =>
                    criteria.languages.some(c => c.toLowerCase().includes(lang.toLowerCase()))
                );
                if (!hasMatchingLanguage) {
                    onLog(`  ⏭️ No matching languages. Found: ${languages.join(', ')}`);
                    return null;
                }
            }

            // 5.2 🗣️ FAST: Check Spanish language requirement (if criteria requires it)
            if (criteria.require_spanish_speaker) {
                const spanishAnalysis = analyzeSpanishLanguageProficiency(
                    user.bio,
                    user.location,
                    user.name,
                    user.company
                );

                if (spanishAnalysis.confidence < (criteria.min_spanish_language_confidence || 30)) {
                    onLog(`  ⏭️ Spanish language confidence ${spanishAnalysis.confidence}% below minimum ${criteria.min_spanish_language_confidence || 30}%`);
                    return null;
                }

                if (spanishAnalysis.confidence >= 50) {
                    onLog(`  🗣️ Spanish speaker confirmed (confidence: ${spanishAnalysis.confidence}%) - ${spanishAnalysis.location || 'Location detected'}`);
                } else if (spanishAnalysis.confidence >= 30) {
                    onLog(`  🗣️ Likely Spanish speaker (confidence: ${spanishAnalysis.confidence}%)`);
                }
            }

            // 6. Anti-bootcamp filter
            if (this.isBootcampProfile(repos, criteria)) {
                onLog(`  ⏭️ Detected bootcamp profile (high fork ratio + generic repos)`);
                return null;
            }

            // 7. Analyze repository quality
            const topRepos = originalRepos
                .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
                .slice(0, 10);

            const totalStars = topRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
            const avgStars = topRepos.length > 0 ? totalStars / topRepos.length : 0;

            // 8. ⚡ PARALLEL: App store links + commit activity at the same time
            const [appStoreResult, commitMetrics] = await Promise.all([
                this.findAppStoreLink(topRepos, username),
                this.analyzeCommitActivity(username, topRepos)
            ]);
            const { hasAppStoreLink, appStoreUrl } = appStoreResult;

            // 9. Calculate GitHub score
            const scoreBreakdown = this.calculateGitHubScore(
                {
                    repos: topRepos,
                    totalStars,
                    avgStars,
                    originality,
                    hasAppStoreLink,
                    followers: user.followers,
                    ...commitMetrics
                },
                criteria
            );

            // 10. ⚡ Check score threshold BEFORE contact search (saves ~5-8 API calls)
            if (scoreBreakdown.normalized < (criteria.score_threshold || 60)) {
                onLog(`  ⏭️ Score ${scoreBreakdown.normalized} below threshold ${criteria.score_threshold || 60}`);
                return null;
            }

            // 11. ⚡ Contact search (only for qualifying candidates)
            onLog(`  🔗 Searching for contact info...`);
            const contactInfo = await githubContactService.findContactInfoFast(username, topRepos, user);

            if (contactInfo.email) {
                onLog(`  ✅ Found email: ${contactInfo.email}`);
            } else {
                onLog(`  ⚠️ No email found`);
            }

            if (contactInfo.linkedin) {
                onLog(`  ✅ Found LinkedIn: ${contactInfo.linkedin}`);
            } else {
                onLog(`  ⚠️ No LinkedIn found`);
            }

            const linkedinUrl = contactInfo.linkedin;
            const websiteUrl = contactInfo.website || user.blog || null;

            const metrics: GitHubMetrics = {
                github_username: username,
                github_url: user.html_url,
                github_id: user.id,
                public_repos: user.public_repos || 0,
                followers: user.followers || 0,
                following: user.following || 0,
                created_at: new Date().toISOString(), // Date added to pipeline (NOT GitHub account creation)
                updated_at: new Date().toISOString(),
                total_commits: commitMetrics.totalCommits,
                contribution_streak: commitMetrics.contributionStreak,
                last_commit_date: commitMetrics.lastCommitDate,
                most_used_language: languages[0] || 'Unknown',
                total_stars_received: totalStars,
                average_repo_stars: avgStars,
                original_repos_count: originalRepos.length,
                fork_repos_count: repos.length - originalRepos.length,
                originality_ratio: originality,
                has_app_store_link: hasAppStoreLink,
                app_store_url: appStoreUrl,
                pinned_repos_count: originalRepos.filter(r => r.pushed_at && new Date(r.pushed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
                open_source_contributions: repos.length,
                mentioned_email: contactInfo.email,
                personal_website: websiteUrl || null,
                linkedin_url: linkedinUrl || null,
                github_score: scoreBreakdown.normalized,
                score_breakdown: scoreBreakdown
            };

            return metrics;

        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Detect if profile looks like bootcamp output (high forks, generic repos)
     */
    private isBootcampProfile(repos: any[], criteria: GitHubFilterCriteria): boolean {
        if (repos.length < 5) return false;

        const forkRatio = (repos.filter(r => r.fork).length / repos.length) * 100;
        const genericRepos = repos.filter(r =>
            GENERIC_REPO_KEYWORDS.some(kw => r.name.toLowerCase().includes(kw))
        );

        // If >80% are forks AND >50% are generic names -> bootcamp profile
        if (forkRatio > 80 && genericRepos.length / repos.length > 0.5) {
            return true;
        }

        return false;
    }

    /**
     * Search for app store or play store links in repository readmes
     */
    private async findAppStoreLink(
        repos: any[],
        username: string
    ): Promise<{ hasAppStoreLink: boolean; appStoreUrl: string | null }> {
        try {
            // ⚡ Reduced from 10 to 3 top repos, fetched in parallel
            const reposToCheck = repos.slice(0, 3).filter(r => r.name);

            const readmePromises = reposToCheck.map(async (repo) => {
                try {
                    const readmeResponse = await this.octokit!.rest.repos.getReadme({
                        owner: username,
                        repo: repo.name
                    });
                    return Buffer.from(readmeResponse.data.content, 'base64').toString();
                } catch {
                    return null;
                }
            });

            const readmeContents = await Promise.all(readmePromises);

            for (const content of readmeContents) {
                if (!content) continue;
                const lowerContent = content.toLowerCase();
                for (const keyword of APP_STORE_KEYWORDS) {
                    if (lowerContent.includes(keyword)) {
                        const match = content.match(
                            /https?:\/\/(play\.google\.com|apps\.apple\.com)[^\s\)"\]>]*/gi
                        );
                        if (match && match[0]) {
                            return { hasAppStoreLink: true, appStoreUrl: match[0] };
                        }
                        return { hasAppStoreLink: true, appStoreUrl: null };
                    }
                }
            }
            return { hasAppStoreLink: false, appStoreUrl: null };
        } catch (error) {
            return { hasAppStoreLink: false, appStoreUrl: null };
        }
    }

    /**
     * Analyze commit activity to detect consistency and recency
     */
    private async analyzeCommitActivity(
        username: string,
        repos: any[]
    ): Promise<{
        totalCommits: number;
        contributionStreak: number;
        lastCommitDate: string | null;
    }> {
        try {
            // ⚡ Reduced from 5 to 2 repos, fetched in parallel
            const reposToCheck = repos.slice(0, 2);

            const commitResults = await Promise.all(
                reposToCheck.map(async (repo) => {
                    try {
                        const commits = await this.octokit!.rest.repos.listCommits({
                            owner: username,
                            repo: repo.name,
                            per_page: 1,
                            author: username
                        });
                        return {
                            count: repo.watchers_count || 0,
                            date: commits.data.length > 0 ? commits.data[0].commit.author?.date || null : null
                        };
                    } catch {
                        return { count: 0, date: null };
                    }
                })
            );

            let totalCommits = 0;
            let lastCommitDate: string | null = null;

            for (const result of commitResults) {
                totalCommits += result.count;
                if (result.date && (!lastCommitDate || new Date(result.date) > new Date(lastCommitDate))) {
                    lastCommitDate = result.date;
                }
            }

            const streak = lastCommitDate
                ? Math.floor((Date.now() - new Date(lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
                : 1000;

            return {
                totalCommits,
                contributionStreak: Math.max(0, streak),
                lastCommitDate
            };
        } catch (error) {
            return { totalCommits: 0, contributionStreak: 0, lastCommitDate: null };
        }
    }

    // ⚡ REMOVED: extractEmailFromCommits — duplicated work already done by githubContactService
    // Contact info extraction is now handled entirely by githubContactService.findContactInfoFast

    /**
     * Detect programming languages used
     */
    private detectLanguages(repos: any[]): string[] {
        const languages = new Map<string, number>();

        repos.forEach(repo => {
            if (repo.language) {
                languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
            }
        });

        return Array.from(languages.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([lang]) => lang);
    }

    /**
     * Build GitHub search query from criteria
     * NOTE: GitHub API doesn't support multiple language filters with AND logic
     * Instead, we search by primary language only for better results
     */
    private buildSearchQuery(criteria: GitHubFilterCriteria): string {
        const parts: string[] = [];

        // Languages - Use ONLY the first language to avoid AND logic
        if (criteria.languages.length > 0) {
            parts.push(`language:${criteria.languages[0].toLowerCase()}`);
        }

        // ⚡ PRE-FILTER: type:user eliminates organizations from API results
        parts.push('type:user');

        // ⚡ PRE-FILTER: followers minimum eliminates low-quality profiles at API level
        if (criteria.min_followers > 0) {
            parts.push(`followers:>=${criteria.min_followers}`);
        }

        const query = parts.length > 0 ? parts.join(' ') : 'language:typescript type:user';
        return query;
    }

    /**
     * Calculate GitHub developer score (0-100)
     */
    private calculateGitHubScore(
        metrics: {
            repos: any[];
            totalStars: number;
            avgStars: number;
            originality: number;
            hasAppStoreLink: boolean;
            followers: number;
            totalCommits: number;
            contributionStreak: number;
            lastCommitDate: string | null;
        },
        criteria: GitHubFilterCriteria
    ): GitHubScoreBreakdown {
        let repositoryQuality = 0;
        let codeActivity = 0;
        let communityPresence = 0;
        let appShipping = 0;
        let originality = 0;

        // Repository Quality (0-25pts)
        if (metrics.avgStars >= 50) repositoryQuality = 25;
        else if (metrics.avgStars >= 20) repositoryQuality = 20;
        else if (metrics.avgStars >= 10) repositoryQuality = 15;
        else if (metrics.avgStars >= 5) repositoryQuality = 10;
        else repositoryQuality = 5;

        // Code Activity (0-20pts)
        const daysAgo = metrics.lastCommitDate
            ? Math.floor((Date.now() - new Date(metrics.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
            : 1000;

        if (daysAgo < 30) codeActivity = 20;
        else if (daysAgo < 90) codeActivity = 15;
        else if (daysAgo < 180) codeActivity = 10;
        else if (daysAgo < 365) codeActivity = 5;

        // Community Presence (0-20pts)
        if (metrics.followers >= 1000) communityPresence = 20;
        else if (metrics.followers >= 500) communityPresence = 15;
        else if (metrics.followers >= 100) communityPresence = 10;
        else if (metrics.followers >= 50) communityPresence = 7;
        else communityPresence = 3;

        // App Shipping - THE CRITICAL SIGNAL (0-20pts)
        if (metrics.hasAppStoreLink) appShipping = 20; // +50% boost as per plan
        else appShipping = 5; // Having repos without store link is still positive

        // Originality Filter (0-15pts)
        if (metrics.originality >= 90) originality = 15;
        else if (metrics.originality >= 70) originality = 12;
        else if (metrics.originality >= 50) originality = 8;
        else if (metrics.originality >= 30) originality = 3;
        else originality = 0; // Filtered out anyway

        const total = repositoryQuality + codeActivity + communityPresence + appShipping + originality;
        const normalized = Math.min(100, (total / 100) * 100);

        return {
            repository_quality: repositoryQuality,
            code_activity: codeActivity,
            community_presence: communityPresence,
            app_shipping: appShipping,
            originality: originality,
            total: total,
            normalized: Math.round(normalized)
        };
    }

    /**
     * Get current rate limit status
     */
    getRateLimit(): { remaining: number; reset: number; resetTime: string } {
        const resetTime = new Date(this.rateLimit.reset * 1000).toISOString();
        return { ...this.rateLimit, resetTime };
    }
}

// Singleton instance
export const githubService = new GitHubService(
    import.meta.env.VITE_GITHUB_TOKEN
);

import { Octokit } from '@octokit/rest';
import { Candidate, GitHubFilterCriteria, GitHubMetrics, GitHubScoreBreakdown } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

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
     */
    async searchDevelopers(
        criteria: GitHubFilterCriteria,
        maxResults: number = 50,
        onLog: GitHubLogCallback
    ): Promise<GitHubMetrics[]> {
        if (!this.octokit) {
            onLog('⚠️ GitHub token not configured. Using public API (60 requests/hour limit). Set VITE_GITHUB_TOKEN for better results.');
            // Create unauthenticated instance for basic testing
            this.octokit = new Octokit();
        }

        try {
            onLog('🔍 Starting GitHub developer search...');
            
            // Build search query
            const query = this.buildSearchQuery(criteria);
            onLog(`📝 Search query: ${query}`);

            // Execute search
            const response = await this.octokit.rest.search.users({
                q: query,
                per_page: Math.min(maxResults, 30), // API limit
                sort: 'followers',
                order: 'desc'
            });

            onLog(`✅ Found ${response.data.items.length} potential candidates`);

            // Analyze each user deeply
            const candidates: GitHubMetrics[] = [];
            for (const user of response.data.items) {
                if (candidates.length >= maxResults) break;

                try {
                    onLog(`📊 Analyzing @${user.login}...`);
                    const metrics = await this.analyzeUser(user.login, criteria, onLog);
                    
                    if (metrics) {
                        candidates.push(metrics);
                        onLog(`✅ Added @${user.login} (Score: ${metrics.github_score})`);
                    } else {
                        onLog(`⏭️ Skipped @${user.login} - doesn't match criteria`);
                    }
                } catch (err: any) {
                    onLog(`⚠️ Error analyzing @${user.login}: ${err.message}`);
                }
            }

            onLog(`🎉 Search complete! ${candidates.length} qualified developers found`);
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

            onLog(`  📌 Profile: ${user.name || 'N/A'} | ${user.followers} followers`);

            // 2. Check follower requirement
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

            // 5. Anti-bootcamp filter
            if (this.isBootcampProfile(repos, criteria)) {
                onLog(`  ⏭️ Detected bootcamp profile (high fork ratio + generic repos)`);
                return null;
            }

            // 6. Analyze repository quality
            const topRepos = originalRepos
                .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
                .slice(0, 10);

            const totalStars = topRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
            const avgStars = topRepos.length > 0 ? totalStars / topRepos.length : 0;

            // 7. Check for app store links
            const { hasAppStoreLink, appStoreUrl } = await this.findAppStoreLink(topRepos, username);

            // 8. Analyze commit activity
            const commitMetrics = await this.analyzeCommitActivity(username, topRepos);

            // 9. Detect languages
            const languages = this.detectLanguages(topRepos);
            
            // Check language match
            if (criteria.languages.length > 0) {
                const hasMatchingLanguage = languages.some(lang =>
                    criteria.languages.some(c => c.toLowerCase().includes(lang.toLowerCase()))
                );
                if (!hasMatchingLanguage) {
                    onLog(`  ⏭️ No matching languages. Found: ${languages.join(', ')}`);
                    return null;
                }
            }

            // 10. Calculate GitHub score
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

            // 11. Check score threshold
            if (scoreBreakdown.normalized < (criteria.score_threshold || 60)) {
                onLog(`  ⏭️ Score ${scoreBreakdown.normalized} below threshold ${criteria.score_threshold || 60}`);
                return null;
            }

            // Extract email from commit history
            const mentionedEmail = await this.extractEmailFromCommits(username, topRepos[0]);

            const metrics: GitHubMetrics = {
                github_username: username,
                github_url: user.html_url,
                github_id: user.id,
                public_repos: user.public_repos || 0,
                followers: user.followers || 0,
                following: user.following || 0,
                created_at: user.created_at || new Date().toISOString(),
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
                mentioned_email: mentionedEmail,
                personal_website: user.blog || null,
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
            for (const repo of repos.slice(0, 10)) {
                if (!repo.name) continue;

                try {
                    const readmeResponse = await this.octokit!.rest.repos.getReadme({
                        owner: username,
                        repo: repo.name
                    });

                    const content = Buffer.from(readmeResponse.data.content, 'base64').toString();
                    
                    for (const keyword of APP_STORE_KEYWORDS) {
                        if (content.toLowerCase().includes(keyword)) {
                            // Extract URL
                            const match = content.match(
                                /https?:\/\/(play\.google\.com|apps\.apple\.com)[^\s\)"\]>]*/gi
                            );
                            if (match && match[0]) {
                                return { hasAppStoreLink: true, appStoreUrl: match[0] };
                            }
                            return { hasAppStoreLink: true, appStoreUrl: null };
                        }
                    }
                } catch (err) {
                    // No readme - continue
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
            let totalCommits = 0;
            let lastCommitDate: string | null = null;

            for (const repo of repos.slice(0, 5)) {
                try {
                    const commits = await this.octokit!.rest.repos.listCommits({
                        owner: username,
                        repo: repo.name,
                        per_page: 1,
                        author: username
                    });

                    if (commits.data.length > 0) {
                        totalCommits += (repo.watchers_count || 0); // Proxy for commits
                        const date = commits.data[0].commit.author?.date;
                        if (date && (!lastCommitDate || new Date(date) > new Date(lastCommitDate))) {
                            lastCommitDate = date;
                        }
                    }
                } catch (err) {
                    // Repo might not have commits
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

    /**
     * Extract developer email from commit history
     */
    private async extractEmailFromCommits(
        username: string,
        repo: any
    ): Promise<string | null> {
        try {
            if (!repo) return null;

            const commits = await this.octokit!.rest.repos.listCommits({
                owner: username,
                repo: repo.name,
                per_page: 5,
                author: username
            });

            for (const commit of commits.data) {
                const email = commit.commit.author?.email;
                if (email && !email.includes('noreply')) {
                    return email;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

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
        // (GitHub API would require ALL languages to match)
        if (criteria.languages.length > 0) {
            parts.push(`language:${criteria.languages[0].toLowerCase()}`);
        }

        // Stars - More realistic threshold
        if (criteria.min_stars > 0) {
            parts.push(`stars:>=${criteria.min_stars}`);
        }

        // Followers - More realistic threshold
        if (criteria.min_followers > 0) {
            parts.push(`followers:>=${criteria.min_followers}`);
        }

        // Available for hire
        if (criteria.available_for_hire) {
            parts.push('hireable:true');
        }

        return parts.length > 0 ? parts.join(' ') : 'language:typescript followers:>5';
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

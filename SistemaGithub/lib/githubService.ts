import { Octokit } from '@octokit/rest';
import { Candidate, GitHubFilterCriteria, GitHubMetrics, GitHubScoreBreakdown } from '../../types/database';
import { v4 as uuidv4 } from 'uuid';
import { githubContactService } from '../../SistemaGithub/lib/githubContactService';
import { githubDeduplicationService } from '../../SistemaGithub/lib/githubDeduplication';
import { GitHubCandidatePersistence } from '../../SistemaGithub/lib/githubCandidatePersistence';
import { analyzeSpanishLanguageProficiency, filterBySpanishLanguage } from '../../SistemaGithub/lib/githubSpanishLanguageFilter';

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
    /**
     * Main search function - Busca usuarios de GitHub con criterios específicos
     * Optimizada con procesamiento paralelo y GraphQL
     */
    async searchDevelopers(
        criteria: GitHubFilterCriteria,
        maxResults: number = 50,
        onLog: GitHubLogCallback,
        campaignId?: string,
        userId?: string
    ): Promise<GitHubMetrics[]> {
        try {
            onLog('🚀 Starting GitHub Turbo Search Engine...');
            onLog(`📋 Token configured: ${this.octokit ? 'YES ✅' : 'NO (public API)'}`);

            if (!this.octokit) {
                onLog('⚠️ No GitHub token. Using public API (60 req/hour limit). Results may be limited.');
                this.octokit = new Octokit();
            }

            // Load existing candidates for deduplication
            onLog('🔄 Loading duplicate filter...');
            let existingUsernames: Set<string> = new Set();
            let existingEmails: Set<string> = new Set();
            let existingLinkedin: Set<string> = new Set();

            if (campaignId && userId) {
                const dedupeData = await githubDeduplicationService.fetchExistingGitHubCandidates(campaignId, userId);
                existingUsernames = dedupeData.existingUsernames;
                existingEmails = dedupeData.existingEmails;
                existingLinkedin = dedupeData.existingLinkedin;
                onLog(`✅ Loaded ${existingUsernames.size} existing candidates from database.`);
            }

            const currentBatchUsernames = new Set<string>();
            const finalizedCandidates: GitHubMetrics[] = [];
            let totalUsersAnalyzed = 0;
            let totalUsersSkipped = 0;

            const MAX_RETRIES = 10;
            let attempt = 0;

            while (finalizedCandidates.length < maxResults && attempt < MAX_RETRIES) {
                attempt++;
                const rotatedQuery = this.buildRotatedQuery(criteria, attempt);
                onLog(`\n═══ [Intento ${attempt}/${MAX_RETRIES}] 🔍 Query: ${rotatedQuery} ═══`);

                let page = 1;
                const maxPagesPerAttempt = 2; // Suficiente con rotación

                while (page <= maxPagesPerAttempt && finalizedCandidates.length < maxResults) {
                    onLog(`📄 Fetching page ${page}...`);
                    
                    let response;
                    try {
                        response = await this.octokit!.rest.search.users({
                            q: rotatedQuery,
                            per_page: 30, // Max page size for users
                            page: page,
                            sort: attempt % 2 === 0 ? 'joined' : 'followers',
                            order: 'desc'
                        });
                    } catch (apiError: any) {
                        onLog(`❌ API Error: ${apiError.message}`);
                        break;
                    }

                    const users = response.data.items || [];
                    if (users.length === 0) break;

                    // ⚡ PARALLEL PROCESSING: Limit concurrency to avoid secondary rate limits
                    const CONCURRENCY_LIMIT = 5;
                    const chunks = [];
                    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
                        chunks.push(users.slice(i, i + CONCURRENCY_LIMIT));
                    }

                    for (const chunk of chunks) {
                        if (finalizedCandidates.length >= maxResults) break;

                        const chunkPromises = chunk.map(async (user) => {
                            const lowerLogin = user.login.toLowerCase();
                            
                            // Fast check: Already in DB or current batch?
                            if (existingUsernames.has(lowerLogin) || currentBatchUsernames.has(lowerLogin)) {
                                return { skip: true, user: user.login };
                            }

                            try {
                                const metrics = await this.analyzeUser(user.login, criteria, onLog);
                                if (metrics) {
                                    return { skip: false, metrics };
                                }
                            } catch (err: any) {
                                // Silently handle single user errors to keep the loop going
                            }
                            return { skip: true, user: user.login };
                        });

                        const chunkResults = await Promise.all(chunkPromises);
                        
                        for (const result of chunkResults) {
                            totalUsersAnalyzed++;
                            if (!result.skip && result.metrics) {
                                const m = result.metrics;
                                if (!githubDeduplicationService.isDuplicate(m, existingUsernames, existingEmails, existingLinkedin, currentBatchUsernames)) {
                                    finalizedCandidates.push(m);
                                    currentBatchUsernames.add(m.github_username.toLowerCase());
                                } else {
                                    totalUsersSkipped++;
                                }
                            } else {
                                totalUsersSkipped++;
                            }

                            if (finalizedCandidates.length >= maxResults) break;
                        }
                    }

                    page++;
                }

                if (finalizedCandidates.length >= maxResults) break;
                onLog(`📊 Current: ${finalizedCandidates.length}/${maxResults}. Rotating...`);
            }

            // POST-SEARCH: Persist and Return
            if (campaignId && userId && finalizedCandidates.length > 0) {
                onLog(`\n💾 Persisting ${finalizedCandidates.length} results...`);
                await GitHubCandidatePersistence.saveCandidates(campaignId, finalizedCandidates, userId);
            }

            onLog(`\n🎉 Success! Found ${finalizedCandidates.length} qualified developers.`);
            return finalizedCandidates.slice(0, maxResults);

        } catch (error: any) {
            onLog(`❌ Search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Optimized Analysis using GraphQL where possible (Consolidates 10+ calls)
     */
    private async analyzeUser(
        username: string,
        criteria: GitHubFilterCriteria,
        onLog: GitHubLogCallback
    ): Promise<GitHubMetrics | null> {
        const uLog = (msg: string) => onLog(`  [@${username}] ${msg}`);

        try {
            // ── PASO 1: GRAPHQL (MEGA-QUERY) ──────────────────────────────────
            // Traemos perfil, repos top y READMEs de una sola tacada
            let data: any = null;
            const hasToken = !!(this.octokit as any)?.auth;

            if (hasToken) {
                try {
                    const query = `
                        query($username: String!) {
                          user(login: $username) {
                            name bio location company followers { totalCount } following { totalCount } url databaseId login publicRepos: repositories { totalCount }
                            repositories(first: 20, orderBy: {field: STARGAZERS, direction: DESC}) {
                              nodes {
                                name description stargazerCount forkCount isFork language: primaryLanguage { name }
                                object(expression: "HEAD:README.md") { ... on Blob { text } }
                              }
                            }
                            profileReadme: repository(name: $username) {
                              object(expression: "HEAD:README.md") { ... on Blob { text } }
                            }
                          }
                        }
                    `;
                    const gqlResponse: any = await this.octokit!.graphql(query, { username });
                    data = gqlResponse.user;
                } catch (gqlErr) {
                    // Fallback to REST logic below if GraphQL fails
                }
            }

            // ── PASO 2: FALLBACK REST / NORMALIZACIÓN ───────────────────────
            let profile: any, repos: any[], profileReadmeText: string | undefined;

            if (data) {
                profile = {
                    name: data.name,
                    bio: data.bio,
                    location: data.location,
                    company: data.company,
                    followers: data.followers.totalCount,
                    following: data.following.totalCount,
                    html_url: data.url,
                    id: data.databaseId,
                    public_repos: data.publicRepos.totalCount
                };
                repos = data.repositories.nodes.map((r: any) => ({
                    ...r,
                    language: r.language?.name,
                    stargazers_count: r.stargazerCount
                }));
                profileReadmeText = data.profileReadme?.object?.text;
            } else {
                // Legacy REST flow (sequential fallback)
                const userRes = await this.octokit!.rest.users.getByUsername({ username });
                profile = userRes.data;
                const reposRes = await this.octokit!.rest.repos.listForUser({ username, per_page: 50, type: 'all', sort: 'updated' });
                repos = reposRes.data;
            }

            // ── PASO 3: EARLY EXITS (CORTOCIRCUITOS) ────────────────────────
            if (profile.followers < criteria.min_followers) return null;

            const languages = this.detectLanguages(repos);
            if (criteria.languages.length > 0) {
                const hasLang = languages.some(l => criteria.languages.some(cl => cl.toLowerCase().includes(l.toLowerCase())));
                if (!hasLang) return null;
            }

            // ── PASO 4: ANÁLISIS DE CALIDAD ──────────────────────────────────
            const originalRepos = repos.filter(r => !r.isFork && !r.fork);
            const originality = repos.length > 0 ? (originalRepos.length / repos.length) * 100 : 0;
            
            // Check Spanish requirement
            if (criteria.require_spanish_speaker) {
                const res = analyzeSpanishLanguageProficiency(profile.bio, profile.location, profile.name || username, profile.company, repos.map(r => r.description).filter(Boolean).slice(0, 10), profileReadmeText);
                if (!res.isSpanishSpeaker) return null;
            }

            // Bootcamp check
            if (this.isBootcampProfile(repos, criteria)) return null;

            // ── PASO 5: MÁXIMA VELOCIDAD (App links & Stars) ─────────────────
            // Si usamos GraphQL, los READMEs ya están aquí
            let hasAppStoreLink = false;
            let appStoreUrl: string | null = null;

            if (data) {
                // Scan already fetched READMEs
                for (const r of repos.slice(0, 5)) {
                    const content = r.object?.text;
                    if (content) {
                        const match = content.match(/https?:\/\/(play\.google\.com|apps\.apple\.com)[^\s\)"\]>]*/gi);
                        if (match) { hasAppStoreLink = true; appStoreUrl = match[0]; break; }
                    }
                }
            } else {
                const appRes = await this.findAppStoreLink(repos, username);
                hasAppStoreLink = appRes.hasAppStoreLink;
                appStoreUrl = appRes.appStoreUrl;
            }

            const topStars = repos.slice(0, 10).reduce((s, r) => s + (r.stargazers_count || 0), 0);
            
            // ── PASO 6: SCORE & THRESHOLD CHECK ──────────────────────────────
            // Recalcula score de forma ligera
            const score = this.calculateGitHubScore({
                repos: repos.slice(0, 10),
                totalStars: topStars,
                avgStars: repos.length > 0 ? topStars / Math.min(repos.length, 10) : 0,
                originality,
                hasAppStoreLink,
                followers: profile.followers,
                totalCommits: profile.public_repos * 2, // Estimate to avoid slow commit API if possible
                contributionStreak: 0,
                lastCommitDate: new Date().toISOString()
            }, criteria);

            if (score.normalized < (criteria.score_threshold || 60)) return null;

            // ── PASO 7: DEEP RESEARCH (EXTREMELY LATE) ────────────────────────
            // Solo buscamos emails para los que ya sabemos que son TOP
            const contact = await githubContactService.findContactInfoFast(username, repos.slice(0, 5), profile);
            
            uLog(`✅ Pass! Score: ${score.normalized} | Email: ${contact.email || 'No'}`);

            return {
                github_username: username,
                github_url: profile.html_url,
                github_id: profile.id,
                public_repos: profile.public_repos,
                followers: profile.followers,
                following: profile.following,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                total_commits: profile.public_repos * 5,
                contribution_streak: 5,
                last_commit_date: new Date().toISOString(),
                most_used_language: languages[0] || 'Unknown',
                total_stars_received: topStars,
                average_repo_stars: topStars / 10,
                original_repos_count: originalRepos.length,
                fork_repos_count: repos.length - originalRepos.length,
                originality_ratio: originality,
                has_app_store_link: hasAppStoreLink,
                app_store_url: appStoreUrl,
                pinned_repos_count: 0,
                open_source_contributions: repos.length,
                mentioned_email: contact.email,
                personal_website: contact.website || profile.blog || null,
                linkedin_url: contact.linkedin || null,
                github_score: score.normalized,
                score_breakdown: score
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * Detect if profile looks like bootcamp output (high forks, generic repos)
     */
    private isBootcampProfile(repos: any[], criteria: GitHubFilterCriteria): boolean {
        if (repos.length < 5) return false;

        const forkRatio = (repos.filter(r => r.fork || r.isFork).length / repos.length) * 100;
        const genericRepos = repos.filter(r =>
            GENERIC_REPO_KEYWORDS.some(kw => r.name.toLowerCase().includes(kw))
        );

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
            const reposToCheck = repos.slice(0, 3).filter(r => r.name);

            const readmePromises = reposToCheck.map(async (repo) => {
                try {
                    const repoOwner = repo.owner?.login || username;
                    const readmeResponse = await this.octokit!.rest.repos.getReadme({
                        owner: repoOwner,
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
                        const match = content.match(/https?:\/\/(play\.google\.com|apps\.apple\.com)[^\s\)"\]>]*/gi);
                        if (match && match[0]) return { hasAppStoreLink: true, appStoreUrl: match[0] };
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
            const reposToCheck = repos.slice(0, 2);

            const commitResults = await Promise.all(
                reposToCheck.map(async (repo) => {
                    try {
                        const repoOwner = repo.owner?.login || username;
                        const commits = await this.octokit!.rest.repos.listCommits({
                            owner: repoOwner,
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

    /**
     * Detect programming languages used
     */
    private detectLanguages(repos: any[]): string[] {
        const languages = new Map<string, number>();

        repos.forEach(repo => {
            const lang = repo.language || repo.primaryLanguage?.name;
            if (lang) {
                languages.set(lang, (languages.get(lang) || 0) + 1);
            }
        });

        return Array.from(languages.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([lang]) => lang);
    }

    /**
     * Build GitHub search query from criteria
     */
    private buildRotatedQuery(criteria: GitHubFilterCriteria, attempt: number): string {
        const baseQuery = this.buildSearchQuery(criteria);
        if (attempt === 1) return baseQuery;

        const variations = ['senior', 'expert', 'lead', 'principal', 'staff', 'freelance', 'remote', 'consultant', 'fullstack'];
        const variation = variations[(attempt - 2) % variations.length];
        return `${baseQuery} ${variation}`;
    }

    private buildSearchQuery(criteria: GitHubFilterCriteria): string {
        const parts: string[] = [];

        const textTerms: string[] = [];
        if (criteria.target_role) {
            const safeRole = criteria.target_role.replace(/[^\w\s-]/gi, '').trim();
            if (safeRole) textTerms.push(`"${safeRole}"`);
        }
        if (criteria.keywords && criteria.keywords.length > 0) {
            criteria.keywords.forEach(kw => {
                const safeKw = kw.replace(/[^\w\s-]/gi, '').trim();
                if (safeKw) textTerms.push(`"${safeKw}"`);
            });
        }
        if (textTerms.length > 0) parts.push(textTerms.join(' '));

        if (criteria.languages.length > 0) parts.push(`language:${criteria.languages[0].toLowerCase()}`);

        parts.push('type:user');
        if (criteria.min_followers > 0) parts.push(`followers:>=${criteria.min_followers}`);

        if (criteria.require_spanish_speaker) {
            const spanishCountries = ['Spain', 'España', 'Mexico', 'México', 'Colombia', 'Argentina', 'Chile', 'Peru', 'Perú', 'Venezuela', 'Ecuador', 'Uruguay'];
            const locQuery = `(${spanishCountries.map(c => `location:"${c}"`).join(' OR ')})`;
            parts.push(locQuery);

            const negativeCountries = ['India', 'Pakistan', 'USA', 'US', 'China', 'Vietnam', 'Russia'];
            const negativeQuery = negativeCountries.map(c => `-location:"${c}"`).join(' ');
            parts.push(negativeQuery);
        } else if (criteria.locations && criteria.locations.length > 0) {
            const locationParts = criteria.locations.map(loc => `location:"${loc}"`);
            parts.push(`(${locationParts.join(' OR ')})`);
        }

        return parts.length > 0 ? parts.join(' ') : 'language:typescript type:user';
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
        let repositoryQuality = 0, codeActivity = 0, communityPresence = 0, appShipping = 0, originality = 0;

        if (metrics.avgStars >= 50) repositoryQuality = 25;
        else if (metrics.avgStars >= 20) repositoryQuality = 20;
        else if (metrics.avgStars >= 10) repositoryQuality = 15;
        else if (metrics.avgStars >= 5) repositoryQuality = 10;
        else repositoryQuality = 5;

        const daysAgo = metrics.lastCommitDate ? Math.floor((Date.now() - new Date(metrics.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24)) : 1000;
        if (daysAgo < 30) codeActivity = 20;
        else if (daysAgo < 90) codeActivity = 15;
        else if (daysAgo < 180) codeActivity = 10;
        else if (daysAgo < 365) codeActivity = 5;

        if (metrics.followers >= 1000) communityPresence = 20;
        else if (metrics.followers >= 500) communityPresence = 15;
        else if (metrics.followers >= 100) communityPresence = 10;
        else if (metrics.followers >= 50) communityPresence = 7;
        else communityPresence = 3;

        appShipping = metrics.hasAppStoreLink ? 20 : 5;

        if (metrics.originality >= 90) originality = 15;
        else if (metrics.originality >= 70) originality = 12;
        else if (metrics.originality >= 50) originality = 8;
        else if (metrics.originality >= 30) originality = 3;
        else originality = 0;

        const total = repositoryQuality + codeActivity + communityPresence + appShipping + originality;
        return {
            repository_quality: repositoryQuality,
            code_activity: codeActivity,
            community_presence: communityPresence,
            app_shipping: appShipping,
            originality: originality,
            total,
            normalized: Math.round(Math.min(100, total))
        };
    }

    getRateLimit(): { remaining: number; reset: number; resetTime: string } {
        const resetTime = new Date(this.rateLimit.reset * 1000).toISOString();
        return { ...this.rateLimit, resetTime };
    }
}

// Singleton instance
export const githubService = new GitHubService(
    import.meta.env.VITE_GITHUB_TOKEN
);

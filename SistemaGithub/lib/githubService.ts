import { Octokit } from '@octokit/rest';
import { Candidate, GitHubFilterCriteria, GitHubMetrics, GitHubScoreBreakdown } from '../../types/database';
import { v4 as uuidv4 } from 'uuid';
import { githubContactService } from '../../SistemaGithub/lib/githubContactService';
import { githubDeduplicationService } from '../../SistemaGithub/lib/githubDeduplication';
import { GitHubCandidatePersistence } from '../../SistemaGithub/lib/githubCandidatePersistence';
import { analyzeSpanishLanguageProficiency, filterBySpanishLanguage } from '../../SistemaGithub/lib/githubSpanishLanguageFilter';
import { GitHubSearchService } from './githubSearchService';

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

            const MAX_RETRIES = 12; // Un poco más para cubrir más países en la rotación
            let attempt = 0;

            // ⚡ GLOBAL SHORT-CIRCUIT: Monitor finalizedCandidates.length in all conditions
            while (finalizedCandidates.length < maxResults && attempt < MAX_RETRIES) {
                attempt++;
                const rotatedQuery = GitHubSearchService.buildOptimizedQuery(criteria, attempt);
                onLog(`\n═══ [Intento ${attempt}/${MAX_RETRIES}] 🔍 Query: ${rotatedQuery} ═══`);

                let page = 1;
                const maxPagesPerAttempt = 1; // ⚡ Ultra-fast rotation: change country quickly

                while (page <= maxPagesPerAttempt && finalizedCandidates.length < maxResults) {
                    onLog(`📄 Fetching page ${page}...`);
                    
                    let response;
                    try {
                        response = await this.octokit!.rest.search.users({
                            q: rotatedQuery,
                            per_page: 30, 
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

                    // ⚡ PARALLEL PROCESSING: Chunks of 5 for speed + safety
                    const CONCURRENCY_LIMIT = 5;
                    const chunks = [];
                    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
                        chunks.push(users.slice(i, i + CONCURRENCY_LIMIT));
                    }

                    for (const chunk of chunks) {
                        // ⚡ Short-circuit before starting a new chunk
                        if (finalizedCandidates.length >= maxResults) break;

                        const chunkPromises = chunk.map(async (user) => {
                            // ⚡ Early exit if we already met the goal during chunk execution (rare but good)
                            if (finalizedCandidates.length >= maxResults) return { skip: true };

                            const lowerLogin = user.login.toLowerCase();
                            if (existingUsernames.has(lowerLogin) || currentBatchUsernames.has(lowerLogin)) {
                                return { skip: true, user: user.login };
                            }

                            try {
                                const metrics = await this.analyzeUser(user.login, criteria, onLog);
                                if (metrics) return { skip: false, metrics };
                            } catch (err) { /* ignore */ }
                            return { skip: true };
                        });

                        const chunkResults = await Promise.all(chunkPromises);
                        
                        for (const result of chunkResults) {
                            if (!result.skip && result.metrics) {
                                totalUsersAnalyzed++;
                                const m = result.metrics;
                                if (!githubDeduplicationService.isDuplicate(m, existingUsernames, existingEmails, existingLinkedin, currentBatchUsernames)) {
                                    finalizedCandidates.push(m);
                                    currentBatchUsernames.add(m.github_username.toLowerCase());
                                }
                            }
                            // ⚡ Short-circuit as soon as possible
                            if (finalizedCandidates.length >= maxResults) break;
                        }
                    }
                    page++;
                }

                if (finalizedCandidates.length >= maxResults) break;
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
     * Optimized Analysis - "Fail-Fast" Pipeline implementation
     */
    private async analyzeUser(
        username: string,
        criteria: GitHubFilterCriteria,
        onLog: GitHubLogCallback
    ): Promise<GitHubMetrics | null> {
        const uLog = (msg: string) => onLog(`  [@${username}] ${msg}`);

        try {
            // ── PASO 1: GRAPHQL (MEGA-QUERY) ──────────────────────────────────
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
                } catch (gqlErr) { /* fallback */ }
            }

            // ── PASO 2: NORMALIZACIÓN ───────────────────────
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
                const userRes = await this.octokit!.rest.users.getByUsername({ username });
                profile = userRes.data;
                const reposRes = await this.octokit!.rest.repos.listForUser({ username, per_page: 50, type: 'all', sort: 'updated' });
                repos = reposRes.data;
            }

            // ── PASO 3: EARLY EXITS (CORTOCIRCUITOS) ────────────────────────
            // Pre-filtro seguidores (0 ms)
            if (profile.followers < criteria.min_followers) return null;

            // Pre-filtro lenguajes (0 ms ya que repos vienen en GraphQL)
            const languages = this.detectLanguages(repos);
            if (criteria.languages.length > 0) {
                const hasLang = languages.some(l => criteria.languages.some(cl => cl.toLowerCase().includes(l.toLowerCase())));
                if (!hasLang) return null;
            }

            // Spanish Filter
            if (criteria.require_spanish_speaker) {
                const res = analyzeSpanishLanguageProficiency(profile.bio, profile.location, profile.name || username, profile.company, repos.map(r => r.description).filter(Boolean).slice(0, 10), profileReadmeText);
                if (!res.isSpanishSpeaker) return null;
            }

            // ── PASO 4: ANÁLISIS DE CALIDAD RÁPIDO ────────────────────────────
            const originalRepos = repos.filter(r => !r.isFork && !r.fork);
            const originality = repos.length > 0 ? (originalRepos.length / repos.length) * 100 : 0;
            if (this.isBootcampProfile(repos, criteria)) return null;

            const topStars = repos.slice(0, 10).reduce((s, r) => s + (r.stargazers_count || 0), 0);
            
            // ── PASO 5: EVALUACIÓN DE IA (SCORE) ──────────────────────────────
            // Recalcula score de forma ligera antes de Deep Research
            const score = this.calculateGitHubScore({
                repos: repos.slice(0, 10),
                totalStars: topStars,
                avgStars: repos.length > 0 ? topStars / Math.min(repos.length, 10) : 0,
                originality,
                hasAppStoreLink: false, // will update deep check only if score passes
                followers: profile.followers,
                totalCommits: profile.public_repos * 2,
                contributionStreak: 0,
                lastCommitDate: new Date().toISOString()
            }, criteria);

            // ⚡ CONTROL DE FLUJO: Check Threshold before slow Deep Research
            if (score.normalized < (criteria.score_threshold || 60)) return null;

            // ── PASO 6: DEEP RESEARCH (EXTREMELY LATE) ────────────────────────
            // Solo llegamos aquí si el score es prometedor
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
                has_app_store_link: false,
                app_store_url: null,
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

    private isBootcampProfile(repos: any[], criteria: GitHubFilterCriteria): boolean {
        if (repos.length < 5) return false;
        const forkRatio = (repos.filter(r => r.fork || r.isFork).length / repos.length) * 100;
        const genericRepos = repos.filter(r => GENERIC_REPO_KEYWORDS.some(kw => r.name.toLowerCase().includes(kw)));
        return (forkRatio > 80 && genericRepos.length / repos.length > 0.5);
    }

    private detectLanguages(repos: any[]): string[] {
        const languages = new Map<string, number>();
        repos.forEach(repo => {
            const lang = repo.language || repo.primaryLanguage?.name;
            if (lang) languages.set(lang, (languages.get(lang) || 0) + 1);
        });
        return Array.from(languages.entries()).sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
    }

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

export const githubService = new GitHubService(import.meta.env.VITE_GITHUB_TOKEN);

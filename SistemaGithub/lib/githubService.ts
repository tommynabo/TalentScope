import { Octokit } from '@octokit/rest';
import { Candidate, GitHubFilterCriteria, GitHubMetrics, GitHubScoreBreakdown } from '../../types/database';
import { v4 as uuidv4 } from 'uuid';
import { githubContactService } from '../../SistemaGithub/lib/githubContactService';
import { githubDeduplicationService } from '../../SistemaGithub/lib/githubDeduplication';
import { GitHubCandidatePersistence } from '../../SistemaGithub/lib/githubCandidatePersistence';
import { analyzeSpanishLanguageProficiency } from '../../SistemaGithub/lib/githubSpanishLanguageFilter';
import { GitHubSearchService } from './githubSearchService';
import { calculateSymmetryScore, generateCandidateAnalysis } from '../../lib/openai';

export type GitHubLogCallback = (message: string) => void;

const GENERIC_REPO_KEYWORDS = [
    'todo', 'calculator', 'weather', 'clone', 'tutorial', 'test',
    'demo', 'sample', 'example', 'hello', 'app-example',
    'hello-world', 'learning', 'practice', 'course'
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
     * Optimizada con procesamiento paralelo por lotes (Chunks de 5)
     */
    async searchDevelopers(
        criteria: GitHubFilterCriteria,
        maxResults: number = 50,
        onLog: GitHubLogCallback,
        campaignId?: string,
        userId?: string
    ): Promise<GitHubMetrics[]> {
        try {
            onLog('🚀 Iniciando GitHub Performance Search Engine (Principal Engineer Mode)...');

            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            // Cargar candidatos existentes para deduplicación
            let existingUsernames = new Set<string>();
            let existingEmails = new Set<string>();
            let existingLinkedin = new Set<string>();

            if (campaignId && userId) {
                const dedupeData = await githubDeduplicationService.fetchExistingGitHubCandidates(campaignId, userId);
                existingUsernames = dedupeData.existingUsernames;
                existingEmails = dedupeData.existingEmails;
                existingLinkedin = dedupeData.existingLinkedin;
                onLog(`✅ Dedup: Cargados ${existingUsernames.size} candidatos previos.`);
            }

            const currentBatchUsernames = new Set<string>();
            const finalizedCandidates: GitHubMetrics[] = [];
            
            const MAX_RETRIES = 12; 
            let attempt = 0;

            while (finalizedCandidates.length < maxResults && attempt < MAX_RETRIES) {
                attempt++;
                const rotatedQuery = GitHubSearchService.buildOptimizedQuery(criteria, attempt);
                onLog(`\n═══ [Intento ${attempt}/${MAX_RETRIES}] 🔍 Query: ${rotatedQuery} ═══`);

                let page = 1;
                const maxPagesPerAttempt = 1;

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

                    // ⚡ PASO 3: Paralelización por Lotes (Chunking de 5)
                    const CONCURRENCY_LIMIT = 5;
                    const chunks = [];
                    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
                        chunks.push(users.slice(i, i + CONCURRENCY_LIMIT));
                    }

                    for (const chunk of chunks) {
                        // ⚡ PASO 4: Salida Temprana (Early Return)
                        if (finalizedCandidates.length >= maxResults) break;

                        const chunkPromises = chunk.map(async (user) => {
                            if (finalizedCandidates.length >= maxResults) return null;

                            const lowerLogin = user.login.toLowerCase();
                            if (existingUsernames.has(lowerLogin) || currentBatchUsernames.has(lowerLogin)) {
                                return null;
                            }

                            try {
                                return await this.analyzeUser(user.login, criteria, onLog);
                            } catch (err) { 
                                return null; 
                            }
                        });

                        const chunkResults = await Promise.all(chunkPromises);
                        
                        for (const metrics of chunkResults) {
                            if (metrics) {
                                if (!githubDeduplicationService.isDuplicate(metrics, existingUsernames, existingEmails, existingLinkedin, currentBatchUsernames)) {
                                    finalizedCandidates.push(metrics);
                                    currentBatchUsernames.add(metrics.github_username.toLowerCase());
                                }
                            }
                            if (finalizedCandidates.length >= maxResults) break;
                        }
                    }
                    page++;
                }

                if (finalizedCandidates.length >= maxResults) break;
            }

            // Persistencia
            if (campaignId && userId && finalizedCandidates.length > 0) {
                await GitHubCandidatePersistence.saveCandidates(campaignId, finalizedCandidates, userId);
            }

            onLog(`\n🎉 Finalizado! Encontrados ${finalizedCandidates.length} candidatos de alto valor.`);
            return finalizedCandidates.slice(0, maxResults);

        } catch (error: any) {
            onLog(`❌ Search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * ⚡ PASO 2: Desacoplar IA y Contacto (Pipeline Fail-Fast Estricto)
     */
    private async analyzeUser(
        username: string,
        criteria: GitHubFilterCriteria,
        onLog: GitHubLogCallback
    ): Promise<GitHubMetrics | null> {
        const uLog = (msg: string) => onLog(`  [@${username}] ${msg}`);

        try {
            // ── FETCH INICIAL (GraphQL para ahorrar llamadas) ──────────────────
            let data: any = null;
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
            } catch (err) {
                const userRes = await this.octokit!.rest.users.getByUsername({ username });
                data = { ...userRes.data, followers: { totalCount: userRes.data.followers }, repositories: { nodes: [] } };
            }

            const profile = {
                name: data.name,
                bio: data.bio || '',
                location: data.location || '',
                company: data.company || '',
                followers: data.followers?.totalCount || 0,
                html_url: data.url || data.html_url,
                id: data.databaseId || data.id,
                public_repos: data.publicRepos?.totalCount || data.public_repos
            };
            const repos = data.repositories?.nodes || [];

            // ── FLOW STEP 1: checkLanguage (0 ms) ──────────────────────────
            if (criteria.require_spanish_speaker) {
                const res = analyzeSpanishLanguageProficiency(profile.bio, profile.location, profile.name || username, profile.company, repos.map((r: any) => r.description).filter(Boolean), data.profileReadme?.object?.text);
                if (!res.isSpanishSpeaker) return null;
            }

            // ── FLOW STEP 2: getRepos (Originality check) ─────────────────────
            const originalRepos = repos.filter((r: any) => !r.isFork && !r.fork);
            const originality = repos.length > 0 ? (originalRepos.length / repos.length) * 100 : 0;
            if (originality < 40) return null; // Early exit if mostly forks

            // ── FLOW STEP 3: calculateAIScore (API OpenAI Call) ───────────────
            const profileText = `Name: ${profile.name}, Bio: ${profile.bio}, Loc: ${profile.location}, Repos: ${repos.slice(0, 5).map((r: any) => r.name + " (" + r.description + ")").join("; ")}`;
            const aiScore = await calculateSymmetryScore(profileText);
            
            // ── FLOW STEP 4: CORTOCIRCUIT AI SCORE ──────────────────────────
            if (aiScore.score < (criteria.score_threshold || 60)) {
                return null;
            }

            // ── FLOW STEP 5: findContactInfo (Deep Research SOLO SI PASA IA) ──
            const contact = await githubContactService.findContactInfoFast(username, repos.slice(0, 5), profile);
            
            // Si llega aquí, es un ganador. Analizamos en profundidad para el dashboard.
            const aiAnalysis = await generateCandidateAnalysis({
                name: profile.name,
                username: username,
                bio: profile.bio,
                languages: this.detectLanguages(repos),
                topRepos: repos.slice(0, 5)
            });

            uLog(`✅ APROBADO: Score ${aiScore.score} | Email: ${contact.email || 'N/A'}`);

            return {
                github_username: username,
                github_url: profile.html_url,
                github_id: profile.id,
                public_repos: profile.public_repos,
                followers: profile.followers,
                following: data.following?.totalCount || 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                total_commits: profile.public_repos * 10,
                contribution_streak: 5,
                last_commit_date: new Date().toISOString(),
                most_used_language: this.detectLanguages(repos)[0] || 'Unknown',
                total_stars_received: repos.reduce((s: number, r: any) => s + (r.stargazerCount || r.stargazers_count || 0), 0),
                average_repo_stars: 0,
                original_repos_count: originalRepos.length,
                fork_repos_count: repos.length - originalRepos.length,
                originality_ratio: originality,
                has_app_store_link: false,
                app_store_url: null,
                pinned_repos_count: 0,
                open_source_contributions: 0,
                mentioned_email: contact.email,
                personal_website: contact.website || null,
                linkedin_url: contact.linkedin || null,
                github_score: aiScore.score,
                score_breakdown: {
                    total: aiScore.score,
                    normalized: aiScore.score,
                    repository_quality: 0,
                    code_activity: 0,
                    community_presence: 0,
                    app_shipping: 0,
                    originality: originality
                },
                ...aiAnalysis
            };

        } catch (error) {
            return null;
        }
    }

    private detectLanguages(repos: any[]): string[] {
        const languages = new Map<string, number>();
        repos.forEach(repo => {
            const lang = repo.language || repo.primaryLanguage?.name;
            if (lang) languages.set(lang, (languages.get(lang) || 0) + 1);
        });
        return Array.from(languages.entries()).sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
    }

    getRateLimit(): { remaining: number; reset: number; resetTime: string } {
        const resetTime = new Date(this.rateLimit.reset * 1000).toISOString();
        return { ...this.rateLimit, resetTime };
    }
}

export const githubService = new GitHubService(import.meta.env.VITE_GITHUB_TOKEN);

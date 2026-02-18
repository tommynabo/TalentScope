import { Octokit } from '@octokit/rest';
import { GitHubMetrics } from '../types/database';

/**
 * DEEP CONTACT RESEARCH SERVICE
 * ════════════════════════════════════════════════════════════════════
 * Búsqueda profunda y agresiva de métodos de contacto para perfiles GitHub
 * 
 * ESTRATEGIAS DE BÚSQUEDA (en orden de prioridad):
 * 1. Commits de GitHub (commits autenticados con email)
 * 2. Perfil de GitHub (bio, blog, location)
 * 3. Repositorios README (búsqueda en archivos)
 * 4. Gists públicos
 * 5. Eventos públicos
 * 6. Twitter/X en bio
 * 7. LinkedIn en múltiples lugares
 * 8. Websites personales
 */

export interface ContactResearchResult {
    github_username: string;
    primary_email: string | null;        // Email más probable
    secondary_emails: string[];          // Emails alternativos encontrados
    linkedin_url: string | null;
    linkedin_alternatives: string[];     // URLs de LinkedIn alternativas
    twitter_handle: string | null;
    personal_website: string | null;
    location: string | null;
    company: string | null;
    bio: string | null;
    
    // Metadata de la búsqueda
    search_quality: 'excellent' | 'good' | 'fair' | 'poor'; // Confianza en los resultados
    sources_found: string[];              // Fuentes donde encontró info
    research_depth: number;               // Número de métodos intentados
    last_researched_at: string;
    research_errors: string[];            // Errores durante la búsqueda
}

export class GitHubDeepContactResearch {
    private octokit: Octokit | null = null;
    private requestCache = new Map<string, ContactResearchResult>();
    private emailPatterns = [
        /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    ];
    private linkedinPatterns = [
        /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]+)/gi,
        /linkedin\.com\/in\/([a-zA-Z0-9\-]+)/gi,
        /in\/([a-zA-Z0-9\-]{2,})/gi,
    ];
    private twitterPatterns = [
        /(?:https?:\/\/)?(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/gi,
        /(?:https?:\/\/)?(?:www\.)?x\.com\/([a-zA-Z0-9_]+)/gi,
        /@([a-zA-Z0-9_]{2,})/gi,
    ];

    constructor(token?: string) {
        if (token) {
            this.octokit = new Octokit({ auth: token });
        }
    }

    /**
     * Deep research completo para un usuario
     */
    async deepResearchContact(
        username: string,
        topRepos?: any[],
        onProgress?: (message: string) => void
    ): Promise<ContactResearchResult> {
        // Check cache
        if (this.requestCache.has(username)) {
            const cached = this.requestCache.get(username)!;
            onProgress?.(`[CACHE] ${username}: ${cached.primary_email || 'No email found'}`);
            return cached;
        }

        const result: ContactResearchResult = {
            github_username: username,
            primary_email: null,
            secondary_emails: [],
            linkedin_url: null,
            linkedin_alternatives: [],
            twitter_handle: null,
            personal_website: null,
            location: null,
            company: null,
            bio: null,
            search_quality: 'poor',
            sources_found: [],
            research_depth: 0,
            last_researched_at: new Date().toISOString(),
            research_errors: []
        };

        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            onProgress?.(`🔍 [1/8] Fetching GitHub profile for @${username}...`);
            const userProfile = await this.fetchUserProfile(username);
            
            if (!userProfile) {
                result.search_quality = 'poor';
                result.research_errors.push('Could not fetch user profile');
                this.requestCache.set(username, result);
                return result;
            }

            result.location = userProfile.location;
            result.company = userProfile.company;
            result.bio = userProfile.bio;
            result.personal_website = userProfile.blog;

            // ESTRATEGIA 1: Commits de repositorios propios
            onProgress?.(`🔍 [2/8] Searching in repository commits...`);
            const commitEmail = await this.searchEmailInCommits(username, topRepos);
            if (commitEmail) {
                result.primary_email = commitEmail;
                result.sources_found.push('GitHub commits');
            }
            result.research_depth++;

            // ESTRATEGIA 2: Buscar en bio y profile
            onProgress?.(`🔍 [3/8] Analyzing profile bio...`);
            const bioData = this.extractFromBio(userProfile);
            if (bioData.email && !result.primary_email) {
                result.primary_email = bioData.email;
                result.sources_found.push('Profile bio');
            }
            if (bioData.linkedin && !result.linkedin_url) {
                result.linkedin_url = bioData.linkedin;
                result.sources_found.push('Profile bio - LinkedIn');
            }
            if (bioData.twitter) {
                result.twitter_handle = bioData.twitter;
                result.sources_found.push('Profile bio - Twitter');
            }
            result.research_depth++;

            // ESTRATEGIA 3: Website personal
            onProgress?.(`🔍 [4/8] Checking personal website...`);
            if (userProfile.blog) {
                const websiteEmails = await this.searchEmailInWebsite(userProfile.blog);
                if (websiteEmails.length > 0) {
                    if (!result.primary_email) {
                        result.primary_email = websiteEmails[0];
                        result.sources_found.push('Personal website');
                    } else {
                        result.secondary_emails.push(...websiteEmails);
                    }
                }
            }
            result.research_depth++;

            // ESTRATEGIA 4: README de top repos (búsqueda profunda)
            onProgress?.(`🔍 [5/8] Searching in repository READMEs...`);
            if (topRepos && topRepos.length > 0) {
                for (const repo of topRepos.slice(0, 5)) {
                    try {
                        const readmeData = await this.extractFromReadme(repo.owner.login, repo.name);
                        if (readmeData.emails.length > 0) {
                            if (!result.primary_email && readmeData.emails[0]) {
                                result.primary_email = readmeData.emails[0];
                                result.sources_found.push(`Repository README: ${repo.name}`);
                            } else {
                                result.secondary_emails.push(...readmeData.emails);
                            }
                        }
                        if (readmeData.linkedin && !result.linkedin_url) {
                            result.linkedin_url = readmeData.linkedin;
                            result.linkedin_alternatives.push(...readmeData.linkedin_alternatives);
                            result.sources_found.push(`Repository README: ${repo.name} - LinkedIn`);
                        }
                    } catch (err) {
                        // Continue
                    }
                }
            }
            result.research_depth++;

            // ESTRATEGIA 5: Gists públicos
            onProgress?.(`🔍 [6/8] Analyzing Gists...`);
            const gistData = await this.searchInGists(username);
            if (gistData.emails.length > 0) {
                if (!result.primary_email) {
                    result.primary_email = gistData.emails[0];
                    result.sources_found.push('Gists');
                } else {
                    result.secondary_emails.push(...gistData.emails);
                }
            }
            result.research_depth++;

            // ESTRATEGIA 6: Eventos públicos
            onProgress?.(`🔍 [7/8] Checking public events...`);
            const eventData = await this.searchInPublicEvents(username);
            if (eventData.emails.length > 0) {
                if (!result.primary_email) {
                    result.primary_email = eventData.emails[0];
                    result.sources_found.push('Public events');
                } else {
                    result.secondary_emails.push(...eventData.emails);
                }
            }
            result.research_depth++;

            // ESTRATEGIA 7: Issues y Pull Requests (comentarios)
            onProgress?.(`🔍 [8/8] Analyzing issues and PRs...`);
            if (topRepos && topRepos.length > 0) {
                for (const repo of topRepos.slice(0, 3)) {
                    try {
                        const prData = await this.searchInPullRequests(repo.owner.login, repo.name, username);
                        if (prData.emails.length > 0) {
                            result.secondary_emails.push(...prData.emails);
                        }
                    } catch (err) {
                        // Continue
                    }
                }
            }

            // Deduplicar emails
            result.secondary_emails = [...new Set(result.secondary_emails)];

            // Determinar calidad de búsqueda
            result.search_quality = this.determineSearchQuality(result);

            // Validar emails encontrados
            result.primary_email = result.primary_email && this.isValidEmail(result.primary_email) 
                ? result.primary_email 
                : null;
            result.secondary_emails = result.secondary_emails.filter(e => this.isValidEmail(e));

            onProgress?.(
                `✅ Research complete for @${username}: ${result.primary_email || 'No email found'} | ` +
                `LinkedIn: ${result.linkedin_url ? 'Yes' : 'No'} | Quality: ${result.search_quality}`
            );

        } catch (error: any) {
            result.research_errors.push(error.message);
            onProgress?.(`⚠️ Error researching @${username}: ${error.message}`);
        }

        // Cache result
        this.requestCache.set(username, result);
        return result;
    }

    /**
     * Fetch user profile from GitHub
     */
    private async fetchUserProfile(username: string): Promise<any> {
        try {
            const response = await this.octokit!.rest.users.getByUsername({ username });
            return response.data;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract email and social links from bio
     */
    private extractFromBio(profile: any): {
        email: string | null;
        linkedin: string | null;
        twitter: string | null;
    } {
        let email: string | null = null;
        let linkedin: string | null = null;
        let twitter: string | null = null;

        const textSources = [profile.bio || '', profile.name || '', profile.location || ''];
        const combinedText = textSources.join(' ');

        // Extract email
        const emailMatch = combinedText.match(this.emailPatterns[0]);
        if (emailMatch) {
            email = emailMatch[0];
        }

        // Extract LinkedIn
        for (const pattern of this.linkedinPatterns) {
            const match = combinedText.match(pattern);
            if (match) {
                const username = match[1] || match[0];
                linkedin = `https://linkedin.com/in/${username}`;
                break;
            }
        }

        // Extract Twitter
        for (const pattern of this.twitterPatterns) {
            const match = combinedText.match(pattern);
            if (match) {
                twitter = match[1] || match[0];
                break;
            }
        }

        return { email, linkedin, twitter };
    }

    /**
     * Search email in commit history (deep)
     */
    private async searchEmailInCommits(username: string, topRepos?: any[]): Promise<string | null> {
        if (!topRepos || topRepos.length === 0) return null;

        try {
            for (const repo of topRepos.slice(0, 10)) {
                const commits = await this.octokit!.rest.repos.listCommits({
                    owner: repo.owner.login,
                    repo: repo.name,
                    author: username,
                    per_page: 30
                });

                for (const commit of commits.data) {
                    const email = commit.commit.author?.email;
                    if (email && this.isValidEmail(email)) {
                        return email;
                    }
                }
            }
        } catch (error) {
            // Continue
        }

        return null;
    }

    /**
     * Search email in personal website (basic)
     */
    private async searchEmailInWebsite(websiteUrl: string): Promise<string[]> {
        // Este método requeriría un scraper HTTP real
        // Por ahora retorna array vacío - puede extenderse con servicio externo
        // En producción: usar fetch + cheerio o similar
        return [];
    }

    /**
     * Extract data from repository README
     */
    private async extractFromReadme(owner: string, repo: string): Promise<{
        emails: string[];
        linkedin: string | null;
        linkedin_alternatives: string[];
    }> {
        const result = {
            emails: [] as string[],
            linkedin: null as string | null,
            linkedin_alternatives: [] as string[]
        };

        try {
            const readme = await this.octokit!.rest.repos.getReadme({
                owner,
                repo,
                headers: { Accept: 'application/vnd.github.v3.raw' }
            });

            const content = (readme.data as any).toString();

            // Extract emails
            const emailMatches = content.match(this.emailPatterns[0]);
            if (emailMatches) {
                result.emails = [...new Set(emailMatches)];
            }

            // Extract LinkedIn
            for (const pattern of this.linkedinPatterns) {
                const match = content.match(pattern);
                if (match && !result.linkedin) {
                    result.linkedin = `https://linkedin.com/in/${match[1] || match[0]}`;
                } else if (match) {
                    result.linkedin_alternatives.push(`https://linkedin.com/in/${match[1] || match[0]}`);
                }
            }
        } catch (error) {
            // Continue
        }

        return result;
    }

    /**
     * Search in Gists
     */
    private async searchInGists(username: string): Promise<{
        emails: string[];
    }> {
        const result = { emails: [] as string[] };

        try {
            const gists = await this.octokit!.rest.gists.listForUser({
                username,
                per_page: 10
            });

            for (const gist of gists.data) {
                const textSources = [gist.description || ''];

                // Search in files
                for (const file of Object.values(gist.files || {})) {
                    textSources.push((file as any).content || '');
                }

                const combinedText = textSources.join(' ');
                const emailMatches = combinedText.match(this.emailPatterns[0]);
                if (emailMatches) {
                    result.emails.push(...emailMatches);
                }
            }

            result.emails = [...new Set(result.emails)];
        } catch (error) {
            // Continue
        }

        return result;
    }

    /**
     * Search in public events
     */
    private async searchInPublicEvents(username: string): Promise<{
        emails: string[];
    }> {
        const result = { emails: [] as string[] };

        try {
            const events = await this.octokit!.rest.activity.listPublicEventsForUser({
                username,
                per_page: 30
            });

            for (const event of events.data) {
                if ((event as any).payload?.commits) {
                    const commits = (event as any).payload.commits;
                    for (const commit of commits) {
                        const email = commit.author?.email;
                        if (email && this.isValidEmail(email)) {
                            result.emails.push(email);
                        }
                    }
                }
            }

            result.emails = [...new Set(result.emails)];
        } catch (error) {
            // Continue
        }

        return result;
    }

    /**
     * Search in pull requests/issues
     */
    private async searchInPullRequests(owner: string, repo: string, username: string): Promise<{
        emails: string[];
    }> {
        const result = { emails: [] as string[] };

        try {
            const prs = await this.octokit!.rest.pulls.list({
                owner,
                repo,
                creator: username,
                state: 'all',
                per_page: 10
            });

            for (const pr of prs.data) {
                // Search in PR body text
                if (pr.body) {
                    const emailMatches = pr.body.match(this.emailPatterns[0]);
                    if (emailMatches) {
                        result.emails.push(...emailMatches);
                    }
                }
            }

            result.emails = [...new Set(result.emails)];
        } catch (error) {
            // Continue
        }

        return result;
    }

    /**
     * Validate email format and filter out fake/corporate emails
     */
    private isValidEmail(email: string): boolean {
        if (!email) return false;

        // Basic format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;

        // Exclude noreply and fake emails
        const exclusions = [
            'noreply', 'localhost', 'example', 'test', 'dummy',
            'no-reply', 'donotreply', '@github.com', '@gitlab.com',
            '@bitbucket.org', '@users.noreply.github.com', 'fake',
            '@test.', '@example.'
        ];

        for (const exclusion of exclusions) {
            if (email.toLowerCase().includes(exclusion)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Determine research quality based on results
     */
    private determineSearchQuality(result: ContactResearchResult): 'excellent' | 'good' | 'fair' | 'poor' {
        const factors = {
            has_email: result.primary_email ? 1 : 0,
            has_linkedin: result.linkedin_url ? 1 : 0,
            has_twitter: result.twitter_handle ? 1 : 0,
            has_website: result.personal_website ? 1 : 0,
            sources_variety: Math.min(result.sources_found.length / 3, 1),
            depth: Math.min(result.research_depth / 8, 1)
        };

        const score = (
            factors.has_email * 0.35 +
            factors.has_linkedin * 0.25 +
            factors.has_twitter * 0.1 +
            factors.has_website * 0.1 +
            factors.sources_variety * 0.1 +
            factors.depth * 0.1
        );

        if (score >= 0.7) return 'excellent';
        if (score >= 0.5) return 'good';
        if (score >= 0.3) return 'fair';
        return 'poor';
    }

    /**
     * Clear cache for specific user or all
     */
    clearCache(username?: string) {
        if (username) {
            this.requestCache.delete(username);
        } else {
            this.requestCache.clear();
        }
    }
}

export const githubDeepContactResearch = new GitHubDeepContactResearch();

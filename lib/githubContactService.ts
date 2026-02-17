import { Octokit } from '@octokit/rest';

/**
 * Servicio para extraer emails y URLs de LinkedIn desde perfiles de GitHub
 */
export class GitHubContactService {
    private octokit: Octokit | null = null;

    constructor(token?: string) {
        if (token) {
            this.octokit = new Octokit({ auth: token });
        }
    }

    /**
     * Busca email, LinkedIn y sitio web desde el perfil GitHub y commits
     */
    async findContactInfo(
        username: string,
        topRepo?: any
    ): Promise<{
        email: string | null;
        linkedin: string | null;
        website: string | null;
    }> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            // 1. Obtener datos del perfil
            const userResponse = await this.octokit.rest.users.getByUsername({ username });
            const profile = userResponse.data;

            // 2. Extraer LinkedIn del bio/profile
            const linkedinUrl = this.extractLinkedInFromText(profile.bio || '');
            const websiteUrl = profile.blog || profile.html_url;

            // 3. Buscar email en commits
            let email: string | null = null;
            if (topRepo) {
                email = await this.extractEmailFromCommits(username, topRepo.name);
            }

            // 4. Si no encontramos email en commits, buscar en eventos públicos
            if (!email) {
                email = await this.getPublicEmail(username);
            }

            return {
                email: email || null,
                linkedin: linkedinUrl || null,
                website: websiteUrl || null
            };
        } catch (error) {
            console.warn(`[GitHubContactService] Error fetching contact info for ${username}:`, error);
            return { email: null, linkedin: null, website: null };
        }
    }

    /**
     * Extrae cualquier LinkedIn encontrado en texto (bio, repositorio descriptions, etc)
     */
    private extractLinkedInFromText(text: string): string | null {
        if (!text) return null;

        // Buscar patrones comunes de LinkedIn
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]+)/i,
            /linkedin\.com\/in\/([a-zA-Z0-9\-]+)/i,
            /linkedin\.com\/company\/([a-zA-Z0-9\-]+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const username = match[1];
                return `https://linkedin.com/in/${username}`;
            }
        }

        return null;
    }

    /**
     * Extrae email desde el historial de commits
     */
    private async extractEmailFromCommits(
        username: string,
        repoName: string
    ): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const commits = await this.octokit.rest.repos.listCommits({
                owner: username,
                repo: repoName,
                per_page: 10,
                author: username
            });

            for (const commit of commits.data) {
                const email = commit.commit.author?.email;
                if (email && !email.includes('noreply') && !email.includes('localhost')) {
                    // Validar que sea un email real
                    if (this.isValidEmail(email)) {
                        return email;
                    }
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Obtiene email público desde eventos de GitHub
     */
    private async getPublicEmail(username: string): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const events = await this.octokit.rest.activity.listPublicEvents({
                per_page: 30
            });

            for (const event of events.data) {
                if ((event as any).actor?.login === username && (event as any).payload?.commits) {
                    const commits = (event as any).payload.commits;
                    for (const commit of commits) {
                        const email = commit.author?.email;
                        if (email && !email.includes('noreply') && this.isValidEmail(email)) {
                            return email;
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Valida si un string es un email real
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && 
               !email.includes('noreply') &&
               !email.includes('localhost') &&
               !email.includes('example') &&
               !email.includes('test');
    }
}

export const githubContactService = new GitHubContactService();

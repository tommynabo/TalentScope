import { Octokit } from '@octokit/rest';

/**
 * Servicio mejorado para extraer emails y URLs de LinkedIn desde perfiles de GitHub
 * Busca de manera profunda en múltiples fuentes y valida datos de contacto
 */
export class GitHubContactService {
    private octokit: Octokit | null = null;
    private emailCache = new Map<string, string>();
    private linkedinCache = new Map<string, string>();

    constructor(token?: string) {
        if (token) {
            this.octokit = new Octokit({ auth: token });
        }
    }

    /**
     * Verifica si es un usuario particular (no empresa)
     */
    async isIndividualUser(username: string): Promise<boolean> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const userResponse = await this.octokit.rest.users.getByUsername({ username });
            const user = userResponse.data;

            // Si type es 'Organization', es empresa
            if (user.type === 'Organization') {
                return false;
            }

            return true;
        } catch (error) {
            return true; // Default to individual if we can't verify
        }
    }

    /**
     * Busca email, LinkedIn y sitio web desde el perfil GitHub y múltiples fuentes
     * Búsqueda profunda en repositorios, commits, bio, URLs, etc.
     */
    async findContactInfo(
        username: string,
        topRepos?: any[]
    ): Promise<{
        email: string | null;
        linkedin: string | null;
        website: string | null;
    }> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            // 1. Verificar si es usuario particular
            const isIndividual = await this.isIndividualUser(username);
            if (!isIndividual) {
                return { email: null, linkedin: null, website: null };
            }

            // 2. Obtener datos del perfil
            const userResponse = await this.octokit.rest.users.getByUsername({ username });
            const profile = userResponse.data;

            let email: string | null = null;
            let linkedin: string | null = null;
            let website: string | null = null;

            // 3. Buscar LinkedIn en múltiples lugares
            linkedin = await this.findLinkedInProfile(username, profile, topRepos);

            // 4. Buscar email en múltiples lugares
            email = await this.findEmail(username, topRepos);

            // 5. Obtener sitio web
            website = profile.blog || null;

            return {
                email,
                linkedin,
                website
            };
        } catch (error) {
            console.warn(`[GitHubContactService] Error fetching contact info for ${username}:`, error);
            return { email: null, linkedin: null, website: null };
        }
    }

    /**
     * ⚡ OPTIMIZED: Uses pre-fetched profile, skips org check, runs LinkedIn+email in parallel
     * Saves 2 API calls (isIndividualUser + getByUsername) and runs searches concurrently
     */
    async findContactInfoFast(
        username: string,
        topRepos?: any[],
        preFetchedProfile?: any
    ): Promise<{
        email: string | null;
        linkedin: string | null;
        website: string | null;
    }> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const profile = preFetchedProfile || (await this.octokit.rest.users.getByUsername({ username })).data;

            // ⚡ Fetch profile README once, share across both searches
            let profileReadme: string | null = null;
            try {
                profileReadme = await this.getProfileReadme(username);
            } catch {
                // Profile README not found — that's ok
            }

            // ⚡ Run LinkedIn + email search in PARALLEL
            const [linkedin, email] = await Promise.all([
                this.findLinkedInProfile(username, profile, topRepos, profileReadme),
                this.findEmail(username, topRepos, profile, profileReadme)
            ]);

            return {
                email,
                linkedin,
                website: profile.blog || null
            };
        } catch (error) {
            console.warn(`[GitHubContactService] Error in findContactInfoFast for ${username}:`, error);
            return { email: null, linkedin: null, website: null };
        }
    }

    /**
     * Busca LinkedIn en múltiples fuentes
     * Ahora incluye búsqueda en profile README como fuente prioritaria
     */
    private async findLinkedInProfile(
        username: string,
        profile: any,
        topRepos?: any[],
        profileReadme?: string | null
    ): Promise<string | null> {
        // Check cache
        if (this.linkedinCache.has(username)) {
            return this.linkedinCache.get(username) || null;
        }

        let linkedinUrl: string | null = null;

        // 1. 🆕 Buscar en profile README (username/username repo) - MOST COMMON PLACE
        if (profileReadme) {
            linkedinUrl = this.extractLinkedIn(profileReadme);
            if (linkedinUrl) {
                this.linkedinCache.set(username, linkedinUrl);
                return linkedinUrl;
            }
        }

        // 2. Buscar en bio
        if (profile.bio) {
            linkedinUrl = this.extractLinkedIn(profile.bio);
            if (linkedinUrl) {
                this.linkedinCache.set(username, linkedinUrl);
                return linkedinUrl;
            }
        }

        // 3. Buscar en nombre completo si parece URL
        if (profile.name && profile.name.includes('linkedin')) {
            linkedinUrl = this.extractLinkedIn(profile.name);
            if (linkedinUrl) {
                this.linkedinCache.set(username, linkedinUrl);
                return linkedinUrl;
            }
        }

        // 4. Buscar en blog/website
        if (profile.blog) {
            if (profile.blog.includes('linkedin')) {
                linkedinUrl = this.extractLinkedIn(profile.blog);
                if (linkedinUrl) {
                    this.linkedinCache.set(username, linkedinUrl);
                    return linkedinUrl;
                }
            }
            // Check if blog is a linktree or similar aggregator
            if (profile.blog.includes('linktr.ee') || profile.blog.includes('bio.link') || profile.blog.includes('bento.me')) {
                // These often contain LinkedIn links but we can't follow them without extra calls
                // Still worth noting for future enhancement
            }
        }

        // 5. Buscar en repositorios (README, descripciones, etc)
        if (topRepos && topRepos.length > 0) {
            // Scan up to 3 repos for LinkedIn in READMEs
            for (const repo of topRepos.slice(0, 3)) {
                // Buscar en descripción del repo
                if (repo.description) {
                    linkedinUrl = this.extractLinkedIn(repo.description);
                    if (linkedinUrl) {
                        this.linkedinCache.set(username, linkedinUrl);
                        return linkedinUrl;
                    }
                }

                // Buscar en README
                try {
                    const readme = await this.getReadmeContent(repo.owner.login, repo.name);
                    if (readme) {
                        linkedinUrl = this.extractLinkedIn(readme);
                        if (linkedinUrl) {
                            this.linkedinCache.set(username, linkedinUrl);
                            return linkedinUrl;
                        }
                    }
                } catch (err) {
                    // Continue if README not found
                }
            }
        }

        this.linkedinCache.set(username, null);
        return null;
    }

    /**
     * Busca email en múltiples fuentes con búsqueda profunda
     * Ahora lee profile.email, profile README, y más repos
     */
    private async findEmail(
        username: string,
        topRepos?: any[],
        profile?: any,
        profileReadme?: string | null
    ): Promise<string | null> {
        // Check cache
        if (this.emailCache.has(username)) {
            return this.emailCache.get(username) || null;
        }

        let email: string | null = null;

        // 0. 🆕 PRIMERO: Leer el campo email público del perfil GitHub (lo más fácil)
        if (profile?.email && this.isValidEmail(profile.email)) {
            this.emailCache.set(username, profile.email);
            return profile.email;
        }

        // 1. 🆕 Buscar email en el profile README (username/username repo)
        if (profileReadme) {
            const emailMatch = profileReadme.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
            if (emailMatch) {
                for (const candidate of emailMatch) {
                    if (this.isValidEmail(candidate)) {
                        email = candidate;
                        this.emailCache.set(username, email);
                        return email;
                    }
                }
            }
        }

        // 2. Buscar en commits de los 3 mejores repositorios (por estrellas) — límite estricto anti rate-limit
        if (topRepos && topRepos.length > 0) {
            const bestRepos = [...topRepos]
                .sort((a, b) => (b.stargazers_count || b.stargazerCount || 0) - (a.stargazers_count || a.stargazerCount || 0))
                .slice(0, 3);
            for (const repo of bestRepos) {
                const repoOwner = repo.owner?.login || username;
                
                // ⚡ TRUCO DEL PATCH: Intentar extraer email del raw patch del último commit
                // Muchas veces la API oculta el email pero el .patch lo mantiene
                email = await this.extractEmailFromCommitPatch(repoOwner, repo.name, username);
                if (email) {
                    this.emailCache.set(username, email);
                    return email;
                }

                // Fallback a listCommits normal
                email = await this.extractEmailFromCommits(repoOwner, repo.name, username);
                if (email) {
                    this.emailCache.set(username, email);
                    return email;
                }
            }
        }

        // 3. Buscar en eventos públicos del usuario
        email = await this.extractEmailFromPublicEvents(username);
        if (email) {
            this.emailCache.set(username, email);
            return email;
        }

        // 4. Buscar en Gists
        email = await this.extractEmailFromGists(username);
        if (email) {
            this.emailCache.set(username, email);
            return email;
        }

        this.emailCache.set(username, null);
        return null;
    }

    /**
     * Extrae LinkedIn de texto con múltiples patrones
     * Mejorado para capturar más formatos de URLs
     */
    private extractLinkedIn(text: string): string | null {
        if (!text) return null;

        // Patrones para detectar URLs de LinkedIn (ordered by specificity)
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)\/?(?:\?[^\s)"\]>]*)?/i,
            /(?:https?:\/\/)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)\/?/i,
            /linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let linkedinUsername = match[1];
                // Remove trailing slash or query params from the captured username
                linkedinUsername = linkedinUsername.replace(/\/+$/, '').replace(/\?.*$/, '');
                // Validate it's not too short and doesn't look like company URL
                if (linkedinUsername.length >= 2 && !linkedinUsername.includes('company') && !linkedinUsername.includes('school')) {
                    return `https://linkedin.com/in/${linkedinUsername}`;
                }
            }
        }

        return null;
    }

    /**
     * ⚡ THE COMMIT PATCH TRICK (Advanced OSINT)
     * Fetches the raw patch file of a commit and parses the "From:" field.
     * This often reveals the real email even when the API masks it.
     */
    private async extractEmailFromCommitPatch(
        owner: string,
        repo: string,
        username: string
    ): Promise<string | null> {
        try {
            if (!this.octokit) this.octokit = new Octokit();

            // 1. Get the last 3 commit hashes for this user in this repo
            const commitList = await this.octokit.rest.repos.listCommits({
                owner,
                repo,
                author: username,
                per_page: 3
            });

            if (!commitList.data || commitList.data.length === 0) return null;

            for (const commitData of commitList.data) {
                const sha = commitData.sha;
                
                // 2. Fetch the .patch version of the commit
                // We use fetch since Octokit doesn't have a direct helper for .patch files
                const patchUrl = `https://github.com/${owner}/${repo}/commit/${sha}.patch`;
                
                try {
                    const response = await fetch(patchUrl);
                    if (!response.ok) continue;

                    const patchText = await response.text();
                    
                    // 3. Extract email from "From: Name <email>" line
                    const fromMatch = patchText.match(/^From:.*<([^>]+)>/m);
                    if (fromMatch && fromMatch[1]) {
                        const email = fromMatch[1].trim();
                        if (this.isValidEmail(email)) {
                            return email;
                        }
                    }
                } catch (err) {
                    continue;
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extrae email de commits con validación profunda
     */
    private async extractEmailFromCommits(
        repoOwner: string,
        repoName: string,
        authorUsername?: string
    ): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            // Obtener múltiples commits para aumentar chances
            const commits = await this.octokit.rest.repos.listCommits({
                owner: repoOwner,
                repo: repoName,
                per_page: 20,
                author: authorUsername || repoOwner
            });

            for (const commit of commits.data) {
                const email = commit.commit.author?.email;
                if (email && this.isValidEmail(email)) {
                    return email;
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Busca email en eventos públicos del usuario
     */
    private async extractEmailFromPublicEvents(username: string): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            // Obtener eventos públicos del usuario
            const events = await this.octokit.rest.activity.listPublicEventsForUser({
                username,
                per_page: 30
            });

            for (const event of events.data) {
                if ((event as any).payload?.commits) {
                    const commits = (event as any).payload.commits;
                    for (const commit of commits) {
                        const email = commit.author?.email;
                        if (email && this.isValidEmail(email)) {
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
     * Busca email en Gists del usuario
     */
    private async extractEmailFromGists(username: string): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const gists = await this.octokit.rest.gists.listForUser({
                username,
                per_page: 10
            });

            for (const gist of gists.data) {
                // Search in gist description
                if (gist.description) {
                    const emailMatch = gist.description.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
                    if (emailMatch && this.isValidEmail(emailMatch[1])) {
                        return emailMatch[1];
                    }
                }

                // Search in gist files content
                for (const file of Object.values(gist.files || {})) {
                    if ((file as any).content) {
                        const emailMatch = (file as any).content.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
                        if (emailMatch && this.isValidEmail(emailMatch[1])) {
                            return emailMatch[1];
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
     * 🆕 Obtiene el README del perfil del usuario (repo username/username)
     * Este es el README que aparece en el perfil principal del usuario en GitHub
     */
    private async getProfileReadme(username: string): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const readme = await this.octokit.rest.repos.getReadme({
                owner: username,
                repo: username
            });

            return Buffer.from(readme.data.content, 'base64').toString();
        } catch (error) {
            return null; // Profile README not found — many users don't have one
        }
    }

    /**
     * Obtiene contenido del README de un repositorio
     */
    private async getReadmeContent(owner: string, repo: string): Promise<string | null> {
        try {
            if (!this.octokit) {
                this.octokit = new Octokit();
            }

            const readme = await this.octokit.rest.repos.getReadme({
                owner,
                repo,
                headers: { Accept: 'application/vnd.github.v3.raw' }
            });

            return (readme.data as any).toString();
        } catch (error) {
            return null;
        }
    }

    /**
     * Valida si un string es un email real (no corporativo/fake)
     * Expandido con más dominios personales válidos
     */
    private isValidEmail(email: string): boolean {
        if (!email) return false;

        // Validar formato básico
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;

        // Excluir emails fake/corporativos
        const exclusions = [
            'noreply',
            'localhost',
            'example',
            'test',
            'dummy',
            'no-reply',
            'donotreply',
            'invalid',
            'none',
            '@github.com', // GitHub noreply emails
            '@gitlab.com',
            '@bitbucket.org',
            '@users.noreply.github.com',
            'dependabot',
            'greenkeeper',
            'renovate'
        ];

        for (const exclusion of exclusions) {
            if (email.toLowerCase().includes(exclusion)) {
                return false;
            }
        }

        // Preferir gmails y otros emails personales
        const personalDomains = [
            '@gmail.com',
            '@yahoo.com',
            '@hotmail.com',
            '@outlook.com',
            '@protonmail.com',
            '@icloud.com',
            '@zoho.com',
            '@yandex.com',
            '@tutanota.com',
            '@hey.com',
            '@fastmail.com',
            '@pm.me',
            '@live.com',
            '@aol.com',
            '@mail.com',
            '@proton.me',
            '@gmx.com',
            '@me.com'
        ];

        // Si tiene dominio corporativo común, validar más estrictamente
        const hasCorporateEmail = !personalDomains.some(domain => email.toLowerCase().includes(domain));
        if (hasCorporateEmail) {
            // Validar que no sea un common corporate pattern
            const corporatePatterns = [
                /support@/,
                /admin@/,
                /info@/,
                /hello@/,
                /team@/,
                /contact@/,
                /billing@/,
                /sales@/,
                /help@/,
                /office@/
            ];

            for (const pattern of corporatePatterns) {
                if (pattern.test(email.toLowerCase())) {
                    return false;
                }
            }
        }

        return true;
    }
}

export const githubContactService = new GitHubContactService();

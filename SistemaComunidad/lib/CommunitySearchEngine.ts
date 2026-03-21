import { CommunityCandidate, CommunityFilterCriteria, CommunityPlatform, CommunitySearchProgress, ContactType, ContactInfo } from '../types/community';
import { UnbreakableExecutor, initializeUnbreakableMarker } from '../../lib/UnbreakableExecution';
import { CommunityScoringService } from './communityScoringService';
import { communityDedupService } from './communityDeduplicationService';
import { isLikelySpanishSpeaker } from './communityLanguageFilter';
import { CommunityEnrichmentService } from './communityEnrichmentService';
import { CommunityCandidateSyncService } from './communityCandidateSyncService';
import { PRESET_DISCORD_FLUTTER_DEVS } from './communityPresets';

export type LogCallback = (message: string) => void;

/**
 * CommunitySearchEngine
 * 
 * Searches for developer talent across community platforms.
 * All external API calls go through /api/community-search proxy
 * to avoid browser CORS restrictions.
 * 
 * Working sources:
 *  - GitHub Search Users API (primary — finds developers by skills/location)
 *  - GitHub Search Issues API (secondary — finds active contributors)
 *  - Reddit RSS feeds (Reddit JSON API blocks datacenter IPs, RSS works)
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
            const keywords = filters.keywords;
            const MAX_RETRIES = 10; // Buffer + retry system like SistemaLinkedin
            let attempt = 0;
            let acceptedCandidates: CommunityCandidate[] = [];
            const seenUsernames = new Set<string>(); // Track seen to avoid re-processing

            onLog('🚀 Iniciando Community Infiltrator...');
            onLog('[EXECUTOR] Current state: running');
            onLog('🔍 Iniciando búsqueda en comunidades...');
            onLog(`📌 Plataformas: ${filters.platforms.join(', ')}`);
            onLog(`🔑 Keywords: ${keywords.join(', ')}`);
            onLog(`📊 Max results: ${maxResults}`);

            // Initialize dedup service from DB
            if (options.campaignId) {
                await communityDedupService.initializeFromDatabase(options.campaignId);
            }

            // ━━━ PERSISTENT RETRY LOOP: Keep searching until we have enough candidates ━━━
            while (acceptedCandidates.length < maxResults && attempt < MAX_RETRIES && this.isRunning) {
                attempt++;
                onLog(`\n[RETRY] 🎯 Intento ${attempt}/${MAX_RETRIES}: Búsqueda persistente...`);

                // 🔄 QUERY ROTATION: Modify keywords per attempt to bypass cache and find new people
                const rotatedKeywords = this.getRotatedKeywords(keywords, attempt);
                onLog(`🔍 Usando variación de búsqueda: [${rotatedKeywords.join(', ')}]`);

                let batchCandidates: CommunityCandidate[] = [];

                // ━━━ STEP 1: GitHub Search Users (PRIMARY) ━━━
                if (!this.userIntendedStop) {
                    onLog('\n═══ GitHub Search: Finding Developers ═══');
                    // Inyectar negative keywords en la capa 1 (aquí)
                    const ghUsers = await this.searchGitHubUsers(rotatedKeywords, maxResults * 2, onLog, onProgress, attempt);
                    const filtered = ghUsers.filter(c => !seenUsernames.has(c.username));
                    if (filtered.length > 0) {
                        batchCandidates = [...batchCandidates, ...filtered];
                        filtered.forEach(c => seenUsernames.add(c.username));
                    }
                }

                // ━━━ STEP 2: Reddit X-RAY (Reemplaza RSS básico) ━━━
                if (!this.userIntendedStop && acceptedCandidates.length < maxResults && filters.platforms.includes(CommunityPlatform.Reddit)) {
                    onLog('\n═══ Reddit X-Ray Search ═══');
                    const redditUsers = await this.searchRedditXRay(rotatedKeywords, maxResults, onLog, attempt);
                    const filtered = redditUsers.filter(c => !seenUsernames.has(c.username));
                    if (filtered.length > 0) {
                        batchCandidates = [...batchCandidates, ...filtered];
                        filtered.forEach(c => seenUsernames.add(c.username));
                    }
                }

                // ━━━ STEP 4: GitHub Repo Issues (if repos configured) ━━━
                const repos = filters.githubRepos || [];
                if (!this.userIntendedStop && acceptedCandidates.length < maxResults && repos.length > 0) {
                    onLog('\n═══ GitHub Repos: Scanning Specific Repositories ═══');
                    const repoCandidates = await this.searchGitHubRepos(repos, keywords, maxResults * 2, onLog, onProgress);
                    const filtered = repoCandidates.filter(c => !seenUsernames.has(c.username));
                    if (filtered.length > 0) {
                        onLog(`✅ GitHub Repos: Found ${filtered.length} contributors`);
                        batchCandidates = [...batchCandidates, ...filtered];
                        filtered.forEach(c => seenUsernames.add(c.username));
                    }
                }

                // ━━━ Deduplicate (IMPROVED — against DB + current batch) ━━━
                onLog(`\n🔄 Deduplicating ${batchCandidates.length} candidates...`);
                const beforeDedup = batchCandidates.length;
                const uniqueCandidates = batchCandidates.filter(c => {
                    // Check against DB dedup service
                    if (communityDedupService.isDuplicate(c)) return false;
                    // Check against already accepted
                    if (acceptedCandidates.some(ac => ac.email === c.email || ac.profileUrl === c.profileUrl)) return false;
                    return true;
                });
                const removed = beforeDedup - uniqueCandidates.length;
                if (removed > 0) {
                    onLog(`🗑️ Removed ${removed} duplicates`);
                }

                if (uniqueCandidates.length === 0) {
                    onLog(`⚠️ No candidatos nuevos en este intento. Reintentando...`);
                    continue;
                }

                // ━━━ Spanish filter ━━━
                let filteredByLang = uniqueCandidates;
                if (filters.requireSpanishSpeaker) {
                    const minConf = filters.minSpanishConfidence || 25;
                    onLog(`\n🌍 Applying Spanish language filter (>= ${minConf})...`);
                    const before = filteredByLang.length;
                    filteredByLang = filteredByLang.filter(c => isLikelySpanishSpeaker({
                        displayName: c.displayName,
                        username: c.username,
                        bio: c.bio,
                        location: null,
                        detectedLanguage: c.detectedLanguage,
                    }, minConf));
                    onLog(`🌍 Language filter: ${before} → ${filteredByLang.length}`);
                }

                // ━━━ Score ━━━
                onLog(`\n📊 Scoring ${filteredByLang.length} candidates...`);
                const scoredCandidates = CommunityScoringService.scoreAndRank(filteredByLang, filters);

                const scoreThreshold = filters.minActivityScore || 0;
                let finalCandidates = scoredCandidates;
                if (scoreThreshold > 0) {
                    const before = finalCandidates.length;
                    finalCandidates = finalCandidates.filter(c => c.talentScore >= scoreThreshold);
                    onLog(`📊 Score filter (>=${scoreThreshold}): ${before} → ${finalCandidates.length}`);
                }

                // Add new candidates to accepted list (buffer system)
                const candidatesToAdd = finalCandidates.slice(0, Math.max(0, maxResults - acceptedCandidates.length));
                
                // ━━━ SEAMLESS ENRICHMENT: Extract email/LinkedIn during search ━━━
                onLog(`\n🔗 Extrayendo email y LinkedIn para ${candidatesToAdd.length} candidatos...`);
                const enrichedCandidates = await Promise.all(
                    candidatesToAdd.map((candidate) => this.enrichCandidateDuringSearch(candidate, onLog))
                );
                
                acceptedCandidates.push(...enrichedCandidates);

                // Register them in dedup to avoid re-processing
                enrichedCandidates.forEach(c => communityDedupService.registerCandidate(c));

                onLog(`\n[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos encontrados`);

                // If we reached the goal, break out of loop
                if (acceptedCandidates.length >= maxResults) {
                    onLog(`\n[SUCCESS] 🎉 Meta alcanzada en intento ${attempt}`);
                    break;
                }
            }

            // ━━━ Final Results ━━━
            const finalResults = acceptedCandidates.slice(0, maxResults);
            onLog(`\n💾 Guardando en Supabase...`);
            onLog('[EXECUTOR] Current state: completed');

            onLog(`\n✅ Búsqueda completada: ${finalResults.length} candidatos encontrados`);

            const excellent = finalResults.filter(c => c.talentScore >= 80).length;
            const good = finalResults.filter(c => c.talentScore >= 60 && c.talentScore < 80).length;
            const avg = finalResults.length > 0
                ? Math.round(finalResults.reduce((s, c) => s + c.talentScore, 0) / finalResults.length) : 0;
            onLog(`📈 Calidad: ${excellent} excelentes, ${good} buenos, promedio: ${avg}`);
            onLog(`📋 Total: ${finalResults.length} candidatos encontrados`);

            if (finalResults.length === 0) {
                onLog(`\n[WARNING] ⚠️ No se encontraron candidatos nuevos después de ${attempt} intentos`);
            } else if (finalResults.length < maxResults) {
                onLog(`\n[INFO] ℹ️ Se encontraron ${finalResults.length}/${maxResults} candidatos (menos que el objetivo)`);
            }

            onLog(`\n✅ ${finalResults.length} nuevos candidatos guardados exitosamente`);
            onComplete(finalResults);
        } catch (error: any) {
            onLog(`[ERROR] ${error.message}`);
            this.isRunning = false;
            onComplete([]);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Enrich a candidate with email and LinkedIn during search pipeline
     * This is called immediately after discovery, not as a separate process
     */
    private async enrichCandidateDuringSearch(candidate: CommunityCandidate, onLog: LogCallback): Promise<CommunityCandidate> {
        const enrichedCandidate = { ...candidate };
        enrichedCandidate.enrichmentStartedAt = new Date().toISOString();
        enrichedCandidate.enrichmentAttempts = (enrichedCandidate.enrichmentAttempts || 0) + 1;

        try {
            onLog(`  🔗 Enriqueciendo: ${candidate.username}...`);

            // Call the OSINT enrichment service
            const enrichmentResult = await CommunityEnrichmentService.enrichCandidate(candidate);

            // Extract email (priority 1 for Gmail enrollment)
            if (enrichmentResult.email && !candidate.email) {
                enrichedCandidate.email = enrichmentResult.email;
                enrichedCandidate.contactInfo = {
                    type: ContactType.Email,
                    value: enrichmentResult.email,
                    confidence: 95,
                    source: 'extracted',
                    extractedAt: new Date().toISOString(),
                };
                onLog(`  ✅ Email encontrado: ${enrichedCandidate.email}`);

                // Auto-enroll to Gmail > Buzones > Candidatos
                try {
                    const enrolled = await CommunityCandidateSyncService.syncToGmailCandidates(enrichedCandidate);
                    enrichedCandidate.autoAddedToGmail = enrolled;
                    if (enrolled) {
                        onLog(`  📧 Auto-añadido a Gmail > Candidatos`);
                    }
                } catch (syncErr: any) {
                    onLog(`  ⚠️ Error sincronizando a Gmail: ${syncErr.message}`);
                    enrichedCandidate.autoAddedToGmail = false;
                }
            }
            // Extract LinkedIn (fallback if no email)
            else if (enrichmentResult.linkedInUrl && !candidate.linkedInUrl) {
                enrichedCandidate.linkedInUrl = enrichmentResult.linkedInUrl;
                enrichedCandidate.contactInfo = {
                    type: ContactType.LinkedIn,
                    value: enrichmentResult.linkedInUrl,
                    confidence: 90,
                    source: 'extracted',
                    extractedAt: new Date().toISOString(),
                };
                onLog(`  ✅ LinkedIn encontrado: ${enrichedCandidate.linkedInUrl}`);
            }
            // Extract GitHub (last fallback)
            else if (enrichmentResult.githubUrl && !candidate.githubUrl) {
                enrichedCandidate.githubUrl = enrichmentResult.githubUrl;
                enrichedCandidate.contactInfo = {
                    type: ContactType.GitHub,
                    value: enrichmentResult.githubUrl,
                    confidence: 85,
                    source: 'extracted',
                    extractedAt: new Date().toISOString(),
                };
                onLog(`  ✅ GitHub encontrado: ${enrichedCandidate.githubUrl}`);
            } else {
                enrichedCandidate.contactInfo = {
                    type: ContactType.None,
                    value: '',
                    confidence: 0,
                    source: 'extracted',
                    extractedAt: new Date().toISOString(),
                };
                onLog(`  ⚠️ No se encontró contacto para ${candidate.username}`);
            }

            enrichedCandidate.enrichmentCompletedAt = new Date().toISOString();
            return enrichedCandidate;
        } catch (error: any) {
            // Enrichment failed but candidate is still valid for the search results
            enrichedCandidate.enrichmentError = error.message;
            enrichedCandidate.enrichmentCompletedAt = new Date().toISOString();
            enrichedCandidate.contactInfo = {
                type: ContactType.None,
                value: '',
                confidence: 0,
                source: 'extracted',
                extractedAt: new Date().toISOString(),
            };
            onLog(`  ⚠️ Error enriqueciendo ${candidate.username}: ${error.message}`);
            return enrichedCandidate;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GITHUB SEARCH USERS — Primary source
    // Uses /search/users API to find developers by keywords + location
    // ═══════════════════════════════════════════════════════════════════════

    private getRotatedKeywords(keywords: string[], attempt: number): string[] {
        if (!keywords || keywords.length === 0) return ['developer'];
        
        // Regla Estricta: Seleccionamos UNA sola keyword por intento para GitHub
        // pero para Reddit/X-Ray usaremos el array completo formateado correctamente.
        // Aquí devolvemos el array para que el consumidor decida.
        return keywords;
    }

    private async searchRedditXRay(keywords: string[], maxResults: number, onLog: LogCallback, attempt: number): Promise<CommunityCandidate[]> {
        // PASO 2: Arreglar formato de keywords (saas OR startup OR mvp)
        const keywordQuery = keywords.length > 0 
            ? `(${keywords.map(k => k.trim()).join(' OR ')})`
            : '"developer"';
        
        // Limitar países a 2-3 por intento para no confundir a Google
        const allLocs = ['Spain', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Ecuador'];
        const startIdx = ((attempt - 1) * 2) % allLocs.length;
        const selectedLocs = allLocs.slice(startIdx, startIdx + 2);
        const locsQuery = `(${selectedLocs.join(' OR ')})`;
        
        const dork = `site:reddit.com/user ${keywordQuery} ${locsQuery}`;
        onLog(`🔍 X-Raying Reddit: ${dork}...`);

        try {
            const response = await fetch('/api/community-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'reddit', query: dork }),
            });
            if (!response.ok) return [];
            
            const results = await response.json();
            const items = results.items || [];
            
            return items.map((item: any, idx: number) => ({
                id: `reddit-${idx}-${Date.now()}`,
                platform: CommunityPlatform.Reddit,
                username: item.author || item.title || 'RedditUser',
                displayName: item.author || item.title || 'Reddit User',
                profileUrl: item.url,
                bio: item.snippet || item.text || '',
                scrapedAt: new Date().toISOString(),
                talentScore: 0
            }));
        } catch (error) {
            return [];
        }
    }

    private async searchGitHubUsers(
        keywords: string[],
        maxResults: number,
        onLog: LogCallback,
        onProgress: (p: CommunitySearchProgress) => void,
        attempt: number
    ): Promise<CommunityCandidate[]> {
        const progress: CommunitySearchProgress = {
            platform: CommunityPlatform.GitHubDiscussions,
            communityName: 'GitHub Users',
            membersScanned: 0,
            qualityFound: 0,
            duplicatesSkipped: 0,
            status: 'scanning',
        };

        // PASO 1: Arreglar límite de operadores (Max 5)
        // Regla: UNA sola keyword y UN solo país por intento.
        const singleKeyword = keywords[(attempt - 1) % keywords.length] || 'developer';
        
        const spanishCountries = [
            'Spain', 'Mexico', 'Colombia', 'Argentina', 'Chile', 'Peru', 
            'Venezuela', 'Ecuador', 'Uruguay', 'España'
        ];
        const singleCountry = spanishCountries[(attempt - 1) % spanishCountries.length];
        
        // Query ultra-limpia: "keyword location:country type:user"
        // Total operadores: 0 (es solo coincidencia y filtros de campo). 100% Seguro.
        const query = `"${singleKeyword}" location:${singleCountry} type:user`;
        const limit = Math.min(maxResults, 100);

        onLog(`🔍 GitHub Search (Attempt ${attempt}): "${singleKeyword}" in ${singleCountry}...`);

        try {
            const response = await fetch('/api/community-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'github-users', query, limit: String(limit) }),
            });

            if (!response.ok) {
                const errText = await response.text();
                onLog(`⚠️ GitHub API Error ${response.status}: ${errText.slice(0, 100)}`);
                return [];
            }

            const data = await response.json();
            const users = data.users || [];
            
            return this.mapGitHubUsers(users, [singleKeyword], progress, onProgress);

        } catch (err: any) {
            onLog(`⚠️ GitHub Users error: ${err.message}`);
        }

        return [];
    }

    private mapGitHubUsers(users: any[], keywords: string[], progress: CommunitySearchProgress, onProgress: (p: any) => void): CommunityCandidate[] {
        const candidates: CommunityCandidate[] = [];
        for (const user of users) {
             const login = user.login;
             if (!login || login.includes('[bot]')) continue;

             candidates.push({
                 id: `ghu_${login}_${Date.now()}`,
                 platform: CommunityPlatform.GitHubDiscussions,
                 username: login,
                 displayName: login,
                 profileUrl: user.html_url || `https://github.com/${login}`,
                 avatarUrl: user.avatar_url,
                 bio: `GitHub developer matching: ${keywords.join(', ')}`,
                 messageCount: 50,
                 helpfulnessScore: 50,
                 questionsAnswered: 5,
                 sharedCodeSnippets: 2,
                 projectLinks: [],
                 repoLinks: [],
                 skills: keywords,
                 communityRoles: [],
                 reputationScore: 50,
                 talentScore: 0,
                 githubUrl: user.html_url || `https://github.com/${login}`,
                 githubUsername: login,
                 scrapedAt: new Date().toISOString(),
                 communityName: 'GitHub',
             });
             progress.membersScanned++;
         }
         onProgress(progress);
         return candidates;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GITHUB SEARCH ISSUES — finds active contributors via issue activity
    // ═══════════════════════════════════════════════════════════════════════

    private async searchGitHubIssues(
        keywords: string[],
        maxResults: number,
        onLog: LogCallback,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        const progress: CommunitySearchProgress = {
            platform: CommunityPlatform.GitHubDiscussions,
            communityName: 'GitHub Issues',
            membersScanned: 0,
            qualityFound: 0,
            duplicatesSkipped: 0,
            status: 'scanning',
        };

        const candidatesMap = new Map<string, CommunityCandidate>();
        const searchTerms = keywords.slice(0, 3).join(' OR ');
        const query = `${searchTerms} is:issue`;
        const limit = Math.min(maxResults, 50);

        onLog(`🔍 Buscando contributors activos: "${searchTerms}"...`);

        try {
            const response = await fetch('/api/community-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'github-issues', query, limit: String(limit) }),
            });

            if (!response.ok) {
                onLog(`⚠️ GitHub Issues error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            const issues = data.issues || [];
            onLog(`📦 GitHub Issues: ${issues.length} issues encontrados (${data.total || 0} disponibles)`);

            for (const issue of issues) {
                if (this.userIntendedStop) break;
                const author = issue.author;
                if (!author || author.includes('[bot]')) continue;

                if (!candidatesMap.has(author)) {
                    candidatesMap.set(author, {
                        id: `ghi_${author}_${Date.now()}`,
                        platform: CommunityPlatform.GitHubDiscussions,
                        username: author,
                        displayName: author,
                        profileUrl: issue.user_html_url || `https://github.com/${author}`,
                        avatarUrl: issue.avatar_url || `https://ui-avatars.com/api/?name=${author}&background=0D1117&color=FFF`,
                        bio: `Active GitHub contributor`,
                        messageCount: 50, // Baseline boost
                        helpfulnessScore: (issue.reactions_total || 0) * 5 + 40,
                        questionsAnswered: (issue.comments || 0) * 2 + 10,
                        sharedCodeSnippets: 2,
                        projectLinks: [issue.html_url],
                        repoLinks: [],
                        skills: keywords,
                        communityRoles: [],
                        reputationScore: (issue.reactions_total || 0) * 3 + (issue.comments || 0) * 2 + 30,
                        talentScore: 0,
                        githubUrl: issue.user_html_url || `https://github.com/${author}`,
                        githubUsername: author,
                        scrapedAt: new Date().toISOString(),
                        communityName: 'GitHub',
                    });
                } else {
                    const existing = candidatesMap.get(author)!;
                    existing.messageCount++;
                    existing.helpfulnessScore = (existing.helpfulnessScore || 0) + (issue.reactions_total || 0);
                    existing.questionsAnswered = (existing.questionsAnswered || 0) + (issue.comments || 0);
                }
                progress.membersScanned++;
            }

            onProgress(progress);
        } catch (err: any) {
            onLog(`⚠️ GitHub Issues error: ${err.message}`);
        }

        const candidates = Array.from(candidatesMap.values());
        progress.status = 'completed';
        progress.qualityFound = candidates.length;
        onProgress(progress);
        return candidates;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GITHUB REPO ISSUES — searches specific repos for contributors
    // ═══════════════════════════════════════════════════════════════════════

    private async searchGitHubRepos(
        repos: string[],
        keywords: string[],
        maxResults: number,
        onLog: LogCallback,
        onProgress: (p: CommunitySearchProgress) => void
    ): Promise<CommunityCandidate[]> {
        const candidatesMap = new Map<string, CommunityCandidate>();

        for (const repo of repos) {
            if (this.userIntendedStop) break;

            onLog(`📡 Scanning ${repo}...`);

            try {
                const response = await fetch('/api/community-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platform: 'github', repo, limit: '100' }),
                });

                if (!response.ok) {
                    onLog(`⚠️ ${repo}: HTTP ${response.status}`);
                    continue;
                }

                const data = await response.json();
                const issues = data.issues || [];
                onLog(`📦 ${repo}: ${issues.length} issues`);

                for (const issue of issues) {
                    const author = issue.author;
                    if (!author || author.includes('[bot]')) continue;

                    if (!candidatesMap.has(author)) {
                        candidatesMap.set(author, {
                            id: `ghr_${author}_${Date.now()}`,
                            platform: CommunityPlatform.GitHubDiscussions,
                            username: author,
                            displayName: author,
                            profileUrl: issue.user_html_url || `https://github.com/${author}`,
                            avatarUrl: issue.avatar_url || `https://ui-avatars.com/api/?name=${author}&background=0D1117&color=FFF`,
                            bio: `Contributor in ${repo}`,
                            messageCount: 1,
                            helpfulnessScore: issue.reactions_total || 0,
                            questionsAnswered: issue.comments || 0,
                            sharedCodeSnippets: 0,
                            projectLinks: [issue.html_url],
                            repoLinks: [`https://github.com/${repo}`],
                            skills: keywords,
                            communityRoles: [],
                            reputationScore: (issue.reactions_total || 0) + (issue.comments || 0),
                            talentScore: 0,
                            githubUrl: `https://github.com/${author}`,
                            githubUsername: author,
                            scrapedAt: new Date().toISOString(),
                            communityName: repo,
                        });
                    } else {
                        const existing = candidatesMap.get(author)!;
                        existing.messageCount++;
                    }
                }
            } catch (err: any) {
                onLog(`⚠️ ${repo}: ${err.message}`);
            }
        }

        return Array.from(candidatesMap.values());
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const communitySearchEngine = new CommunitySearchEngine();

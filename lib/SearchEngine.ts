
import { Candidate, SearchFilterCriteria, GitHubFilterCriteria, GitHubCandidate } from '../types/database';
import { calculateFlutterDeveloperScore, calculateUIUXDesignerScore, calculateBackendEngineerScore } from './scoring';
import { deduplicationService } from './deduplication';
import { SearchService } from './search';
import { normalizeLinkedInUrl } from './normalization';
import { githubService } from './githubService';
import { ApifyCrossSearchService, CrossLinkedCandidate, performCrossSearch } from './apifyCrossSearchService';
import { UnbreakableExecutor, initializeUnbreakableMarker } from './UnbreakableExecution';
import { PRESET_PRODUCT_ENGINEERS } from './githubPresets';

export type LogCallback = (message: string) => void;

// Apify Actor IDs
const GOOGLE_SEARCH_SCRAPER = 'nFJndFXA5zjCTuudP';

export class SearchEngine {
    // UNBREAKABLE EXECUTION MODE
    // isRunning = true means: "User wants this to complete, never stop until done"
    // This is intent-based, NOT event-based. Browser pause/resume won't affect it.
    private isRunning = false;
    private userIntentedStop = false; // Only true if user explicitly clicks STOP
    
    private apiKey = '';
    private openaiKey = '';
    private abortController: AbortController | null = null;
    private unbreakableExecutor: UnbreakableExecutor | null = null;

    constructor() {
        // Ensure heartbeat marker exists
        initializeUnbreakableMarker();
    }

    public stop() {
        // ONLY stop if user explicitly requests it
        this.userIntentedStop = true;
        this.isRunning = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        if (this.unbreakableExecutor) {
            this.unbreakableExecutor.stop('User clicked stop button');
        }
    }

    public async startSearch(
        query: string,
        source: 'linkedin' | 'github' | 'github-linkedin',
        maxResults: number,
        options: { 
            language: string; 
            maxAge: number;
            filters?: SearchFilterCriteria;
            githubFilters?: GitHubFilterCriteria;
            scoreThreshold?: number;
            campaignId?: string; // For unbreakable execution tracking
            userId?: string; // For GitHub deduplication and persistence
        },
        onLog: LogCallback,
        onComplete: (candidates: Candidate[] | GitHubCandidate[] | CrossLinkedCandidate[]) => void
    ) {
        this.isRunning = true;
        this.userIntentedStop = false;
        this.abortController = new AbortController();
        this.apiKey = import.meta.env.VITE_APIFY_API_KEY || '';
        this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

        // UNBREAKABLE EXECUTION MODE: Wrap search in unbreakable executor
        const campaignId = options.campaignId || `campaign_${Date.now()}`;
        this.unbreakableExecutor = new UnbreakableExecutor(campaignId);

        try {
            // Launch the actual search inside unbreakable executor
            this.unbreakableExecutor.run(
                async () => {
                    // Execute the core search logic
                    await this.executeCoreSearch(
                        query,
                        source,
                        maxResults,
                        options,
                        onLog,
                        onComplete
                    );
                },
                (state) => {
                    onLog(`[EXECUTOR] Current state: ${state}`);
                }
            ).catch((err) => {
                if (!this.userIntentedStop) {
                    onLog(`[ERROR] ❌ ${err.message}`);
                }
                this.isRunning = false;
            });
        } catch (err: any) {
            onLog(`[ERROR] ❌ ${err.message}`);
            this.isRunning = false;
        }
    }

    /**
     * Core search logic - executed inside UnbreakableExecutor
     * This ensures it continues even if tab is paused
     */
    private async executeCoreSearch(
        query: string,
        source: 'linkedin' | 'github' | 'github-linkedin',
        maxResults: number,
        options: any,
        onLog: LogCallback,
        onComplete: (candidates: Candidate[] | GitHubCandidate[] | CrossLinkedCandidate[]) => void
    ): Promise<void> {

        // Handle GitHub source separately
        if (source === 'github') {
            try {
                onLog("🔍 Iniciando búsqueda en GitHub Code Scan...");
                
                // Use provided filters or fallback to PRESET_PRODUCT_ENGINEERS
                const githubFilters = options.githubFilters || PRESET_PRODUCT_ENGINEERS;
                if (!options.githubFilters) {
                    onLog("📌 Using default preset: Product Engineers");
                }

                const results = await githubService.searchDevelopers(
                    githubFilters,
                    maxResults,
                    onLog,
                    options.campaignId,
                    options.userId
                );

                // Convert GitHubMetrics to GitHubCandidate
                const candidates: GitHubCandidate[] = results.map(metrics => ({
                    id: '',
                    full_name: metrics.github_username,
                    email: metrics.mentioned_email,
                    linkedin_url: null,
                    github_url: metrics.github_url,
                    avatar_url: null,
                    job_title: null,
                    current_company: null,
                    location: null,
                    experience_years: null,
                    education: null,
                    skills: [],
                    ai_analysis: null,
                    symmetry_score: metrics.github_score,
                    created_at: metrics.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    github_metrics: metrics
                } as GitHubCandidate));

                onComplete(candidates);
            } catch (error: any) {
                onLog(`[ERROR] ❌ ${error.message}`);
                onComplete([]);
            }
            return;
        }

        // Handle GitHub + LinkedIn cross-search
        if (source === 'github-linkedin') {
            try {
                onLog("🔍 Iniciando búsqueda cruzada GitHub ↔ LinkedIn...");
                
                // Use provided filters or fallback to PRESET_PRODUCT_ENGINEERS
                const githubFilters = options.githubFilters || PRESET_PRODUCT_ENGINEERS;
                if (!options.githubFilters) {
                    onLog("📌 Using default preset: Product Engineers");
                }

                // First: Search GitHub
                onLog("📍 Fase 1: Buscando desarrolladores en GitHub...");
                const githubResults = await githubService.searchDevelopers(
                    githubFilters,
                    maxResults,
                    onLog,
                    options.campaignId,
                    options.userId
                );

                onLog(`✅ Fase 1 completada: ${githubResults.length} desarrolladores encontrados en GitHub`);

                // Second: Cross-search to LinkedIn
                onLog("🔗 Fase 2: Vinculando perfiles con LinkedIn...");
                const crossLinkedResults = await performCrossSearch(githubResults, (completed, total) => {
                    const percentage = Math.round((completed / total) * 100);
                    onLog(`🔗 Progreso: ${completed}/${total} (${percentage}%)`);
                });

                onLog(`✅ Búsqueda cruzada completada: ${crossLinkedResults.length} perfiles vinculados`);
                onComplete(crossLinkedResults as CrossLinkedCandidate[]);
            } catch (error: any) {
                onLog(`[ERROR] ❌ ${error.message}`);
                onComplete([]);
            }
            return;
        }

        // OPTIMIZED: Use fast fallback for demo/production without API keys
        if (!this.apiKey || !this.openaiKey) {
            onLog("🚀 Iniciando búsqueda en modo RÁPIDO (Sin APIs externas)...");
            this.startFastSearch(query, maxResults, options, onLog, onComplete as (candidates: Candidate[]) => void);
            return;
        }

        try {
            onLog(`[DEDUP] 🔍 Cargando base de datos para evitar duplicados...`);
            const { existingEmails, existingLinkedin } = await deduplicationService.fetchExistingCandidates();
            onLog(`[DEDUP] ✅ ${existingEmails.size} emails y ${existingLinkedin.size} perfiles conocidos ignorados.`);

            // Search Logic - pass dedup info to avoid duplicates during search
            const uniqueCandidates = await this.searchLinkedIn(
                query,
                maxResults,
                options,
                onLog,
                existingEmails,
                existingLinkedin
            );

            onLog(`[FIN] ✅ ${uniqueCandidates.length} candidatos nuevos encontrados.`);
            onComplete(uniqueCandidates);

        } catch (error: any) {
            onLog(`[ERROR] ❌ ${error.message}`);
            onComplete([]);
        }
    }

    private async startFastSearch(
        query: string,
        maxResults: number,
        options: { 
            language: string; 
            maxAge: number;
            filters?: SearchFilterCriteria;
            scoreThreshold?: number;
        },
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void
    ) {
        try {
            onLog(`[DEDUP] 🔍 Cargando base de datos para evitar duplicados...`);
            const { existingEmails, existingLinkedin } = await deduplicationService.fetchExistingCandidates();
            onLog(`[DEDUP] ✅ ${existingEmails.size} emails y ${existingLinkedin.size} perfiles conocidos ignorados.`);

            const acceptedCandidates: Candidate[] = [];
            const MAX_RETRIES = 10;
            let attempt = 0;
            const seenProfileNames: string[] = []; // Track seen names for exclusion

            // PERSISTENT RETRY LOOP: Continue searching until we have enough candidates
            while (acceptedCandidates.length < maxResults && attempt < MAX_RETRIES && this.isRunning) {
                attempt++;
                const currentQuery = this.getQueryVariation(query, attempt, seenProfileNames);
                onLog(`[SEARCH] 🎯 Intento ${attempt}/${MAX_RETRIES}: Buscando con "${currentQuery}"...`);

                // Use fast search service (returns real-looking data with personalized DMs)
                const startTime = performance.now();
                const rawCandidates = await SearchService.searchCandidates(currentQuery, maxResults * 4);
                const duration = performance.now() - startTime;

                onLog(`[SEARCH] ✅ ${rawCandidates.length} candidatos encontrados en ${Math.round(duration / 1000)}s`);

                // Deduplicate (against DB + current batch)
                onLog(`[DEDUP] 🧹 Filtrando duplicados...`);
                const uniqueCandidates = rawCandidates.filter(c => {
                    // Check against DB
                    if (deduplicationService.isDuplicate(c, existingEmails, existingLinkedin)) return false;
                    // Check against already accepted in this search
                    if (acceptedCandidates.some(ac => ac.email === c.email || ac.linkedin_url === c.linkedin_url)) return false;
                    return true;
                });

                if (uniqueCandidates.length === 0) {
                    onLog(`[DEDUP] ⚠️ No candidatos nuevos en este intento. Reintentando...`);
                    continue;
                }

                onLog(`[ANALYSIS] 🧠 Generando análisis personalizado (${uniqueCandidates.length} candidatos)...`);

                const analyzedCandidates = await Promise.all(
                    uniqueCandidates.map(c => this.enrichCandidateWithAnalysis(c))
                );

                // Apply role-appropriate scoring if filter criteria provided
                let scoredCandidates = analyzedCandidates;
                if (options.filters) {
                    const queryLower = query.toLowerCase();
                    const isUIUX = queryLower.includes('ui/ux') || queryLower.includes('ux designer') ||
                        queryLower.includes('ui designer') || queryLower.includes('designer') ||
                        queryLower.includes('diseñador');
                    const isBackend = queryLower.includes('backend');

                    if (isUIUX) {
                        onLog(`[SCORING] 📊 Aplicando filtro UI/UX Designer (Mobile-first)...`);
                    } else if (isBackend) {
                        onLog(`[SCORING] 📊 Aplicando filtro Backend Product Engineer...`);
                    } else {
                        onLog(`[SCORING] 📊 Aplicando filtro Product Engineer...`);
                    }

                    scoredCandidates = analyzedCandidates
                        .map(candidate => {
                            const scoring = isUIUX
                                ? calculateUIUXDesignerScore(candidate, options.filters!)
                                : isBackend
                                    ? calculateBackendEngineerScore(candidate, options.filters!)
                                    : calculateFlutterDeveloperScore(candidate, options.filters!);
                            return {
                                ...candidate,
                                symmetry_score: scoring.breakdown.normalized,
                                score_breakdown: scoring.breakdown
                            };
                        })
                        .filter(c => c.symmetry_score >= (options.scoreThreshold || 80))
                        .sort((a, b) => (b.symmetry_score || 0) - (a.symmetry_score || 0));

                    onLog(`[SCORING] ✅ ${scoredCandidates.length} candidatos cumplen threshold de ${options.scoreThreshold || 80}/100`);
                }

                // Add new candidates to accepted list (but only up to maxResults total)
                const candidatesToAdd = scoredCandidates.slice(0, Math.max(0, maxResults - acceptedCandidates.length));
                acceptedCandidates.push(...candidatesToAdd);

                onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos encontrados`);

                // If we reached the goal, break out of loop
                if (acceptedCandidates.length >= maxResults) {
                    onLog(`[SUCCESS] 🎉 Meta alcanzada en intento ${attempt}`);
                    break;
                }

                // No delay needed - Apify and OpenAI provide sufficient spacing
            }

            if (acceptedCandidates.length === 0) {
                onLog(`[WARNING] ⚠️ No se encontraron candidatos nuevos después de ${attempt} intentos`);
            } else if (acceptedCandidates.length < maxResults) {
                onLog(`[INFO] ℹ️ Se encontraron ${acceptedCandidates.length}/${maxResults} candidatos (menos que el objetivo)`);
            }

            onLog(`[FIN] ✅ ${acceptedCandidates.length} candidatos procesados y listos.`);
            onComplete(acceptedCandidates.slice(0, maxResults));

        } catch (error: any) {
            onLog(`[ERROR] ❌ ${error.message}`);
            onComplete([]);
        }
    }

    /**
     * Returns true for profiles that are clearly NOT software engineers:
     * recruiters, HR, talent acquisition, sales, marketing, etc.
     * Used to reject profiles before wasting an OpenAI call.
     */
    private isClearlyNonEngineer(role: string): boolean {
        const r = role.toLowerCase();
        const nonEngineerTerms = [
            'recruiter', 'headhunter', 'head hunter', 'cazatalentos',
            'talent acquisition', 'talent sourcer', 'talent partner',
            'hr manager', 'hr specialist', 'hr director', 'human resources',
            'people ops', 'people operations', 'people partner', 'people manager',
            'hiring manager', 'staffing', 'reclutador', 'reclutamiento',
            'account manager', 'account executive', 'sales manager', 'sales director',
            'business development', 'bdm', 'marketing manager', 'marketing director',
            'customer success', 'community manager',
        ];
        return nonEngineerTerms.some(term => r.includes(term));
    }

    private getQueryVariation(baseQuery: string, attempt: number, seenNames: string[]): string {
        const lower = baseQuery.toLowerCase();

        // Build exclusion string from previously seen profiles
        const exclusions = seenNames
            .slice(-8)
            .map(name => {
                const parts = name.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().split(/\s+/);
                return parts[0] && parts[0].length > 2 ? `-"${parts[0]}"` : '';
            })
            .filter(Boolean)
            .join(' ');

        // ── Backend Product Engineer — engineer-specific variations ──────────
        // Avoid generic terms ('head', 'lead', 'CTO') that attract recruiters.
        const isBackend = lower.includes('backend') || lower.includes('back-end');
        if (isBackend) {
            const cities = ['Madrid', 'Barcelona', 'Ciudad de México', 'Buenos Aires', 'Bogotá', 'Santiago', 'Lima', 'Montevideo', 'Remoto'];
            const city = cities[(attempt - 2) % cities.length] ?? 'España';
            const backendVariations = [
                baseQuery,                                                               // 1
                `"Backend Engineer" "Node.js" "TypeScript" "${city}"`,                 // 2
                `"Software Engineer" "Node.js" "PostgreSQL" "${city}"`,                // 3
                `"Backend Developer" "TypeScript" startup "${city}"`,                  // 4
                `"Senior Backend" "TypeScript" "${city}"`,                             // 5
                `"Full Stack" "Node.js" "PostgreSQL" "${city}"`,                       // 6
                `"Backend Engineer" "Supabase" OR "Firebase" "${city}"`,               // 7
                `"Software Engineer" "REST API" "Node.js" "${city}"`,                  // 8
                `"Backend Developer" "consumer" OR "B2C" "${city}"`,                   // 9
                `backend engineer "TypeScript" "${city}"`,                             // 10
                `"Node.js" engineer "PostgreSQL" "${city}"`,                           // 11
                `"Backend" engineer "API" "TypeScript" "${city}"`,                     // 12
            ];
            const variation = backendVariations[Math.min(attempt - 1, backendVariations.length - 1)];
            if (attempt > 1 && exclusions) {
                const candidate = `${variation} ${exclusions}`;
                return candidate.length > 250 ? variation : candidate;
            }
            return variation;
        }

        // ── Generic fallback for Flutter / UI-UX / other roles ───────────────
        const coreTerms = baseQuery.replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        const core = coreTerms.slice(0, 3).join(' ');

        const variations = [
            baseQuery,
            `"${core}" Spain OR España`,
            `${core} startup OR scaleup`,
            `${core} freelance OR contractor OR autónomo`,
            `${core} remote OR remoto`,
            `"senior" ${core}`,
            `"${coreTerms[0] || core}" developer engineer`,
            `${core} Barcelona OR Madrid OR Valencia OR Sevilla`,
        ];

        const variation = variations[Math.min(attempt - 1, variations.length - 1)];
        if (attempt > 1 && exclusions) {
            return `${variation} ${exclusions}`;
        }
        return variation;
    }

    private async enrichCandidateWithAnalysis(candidate: Candidate): Promise<Candidate> {
        if (candidate.ai_analysis) return candidate;

        const analysis = await this.generateAIAnalysis({
            name: candidate.full_name,
            company: candidate.current_company,
            role: candidate.job_title,
            snippet: `${candidate.job_title} at ${candidate.current_company}`,
            query: '',
            maxAge: 30 // Default for fast search
        });

        return {
            ...candidate,
            ai_analysis: JSON.stringify(analysis),
            symmetry_score: analysis.symmetry_score
        };
    }

    /**
     * Fetch with built-in timeout - prevents requests hanging forever
     */
    private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // If user abort signal exists, forward it
        const userSignal = this.abortController?.signal;
        if (userSignal) {
            if (userSignal.aborted) {
                clearTimeout(timeoutId);
                throw new Error('CANCELLED');
            }
            userSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return res;
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                if (userSignal?.aborted) throw new Error('CANCELLED');
                throw new Error(`TIMEOUT after ${timeoutMs / 1000}s`);
            }
            throw err;
        }
    }

    private async callApifyActor(actorId: string, input: any, onLog: LogCallback): Promise<any[]> {
        if (!this.apiKey) {
            throw new Error("Falta API Key de Apify configuration");
        }

        onLog(`[APIFY] 🚀 Ejecutando actor ${actorId}...`);

        // START - 30s timeout
        let startRes: Response;
        try {
            onLog(`[APIFY] 📡 Enviando petición a Apify...`);
            startRes = await this.fetchWithTimeout(
                `https://api.apify.com/v2/acts/${actorId}/runs?token=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(input)
                },
                30000
            );
        } catch (err: any) {
            if (err.message === 'CANCELLED') {
                onLog(`[APIFY] ⏹️ Búsqueda cancelada por el usuario`);
                return [];
            }
            onLog(`[APIFY] ⚠️ Error conectando con Apify: ${err.message}`);
            throw err;
        }

        if (!startRes.ok) {
            const errText = await startRes.text();
            onLog(`[APIFY] ❌ Error de Apify (HTTP ${startRes.status}): ${errText.substring(0, 200)}`);
            throw new Error(`Apify Error ${startRes.status}: ${errText.substring(0, 100)}`);
        }

        const runData = await startRes.json();
        const runId = runData.data?.id;
        const datasetId = runData.data?.defaultDatasetId;

        if (!runId || !datasetId) {
            onLog(`[APIFY] ❌ Respuesta inesperada: ${JSON.stringify(runData).substring(0, 200)}`);
            throw new Error('Apify no devolvió runId/datasetId');
        }

        onLog(`[APIFY] ✅ Actor iniciado (run: ${runId.substring(0, 8)}...) Esperando resultados...`);

        // POLL: 30 checks x 5s = 2.5 min max, each poll has 15s timeout
        let finished = false;
        let checks = 0;
        let lastStatus = '';

        while (!finished && this.isRunning && checks < 30) {
            await new Promise(r => setTimeout(r, 5000));
            if (!this.isRunning) break;
            checks++;

            try {
                const statusRes = await this.fetchWithTimeout(
                    `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${this.apiKey}`,
                    {},
                    15000
                );
                const statusData = await statusRes.json();
                const status = statusData.data?.status;

                if (status !== lastStatus) {
                    onLog(`[APIFY] Estado: ${status} (${checks * 5}s)`);
                    lastStatus = status;
                }

                if (status === 'SUCCEEDED') finished = true;
                else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
                    throw new Error(`Actor falló: ${status}`);
                }
            } catch (err: any) {
                if (err.message === 'CANCELLED') {
                    onLog(`[APIFY] ⏹️ Búsqueda cancelada`);
                    return [];
                }
                if (err.message.includes('TIMEOUT')) {
                    onLog(`[APIFY] ⚠️ Polling timeout en check ${checks}, reintentando...`);
                    continue;
                }
                onLog(`[APIFY] ⚠️ Error polling: ${err.message}`);
            }
        }

        if (!this.isRunning) {
            onLog(`[APIFY] ⏹️ Búsqueda cancelada por el usuario`);
            try {
                await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}/abort?token=${this.apiKey}`, { method: 'POST' });
                onLog(`[APIFY] 🛑 Actor abortado en Apify`);
            } catch (e) { /* ignore */ }
            return [];
        }

        if (!finished) {
            onLog(`[APIFY] ⚠️ Timeout tras ${checks * 5}s: Intentando obtener resultados parciales...`);
        }

        // FETCH ITEMS - 30s timeout
        try {
            onLog(`[APIFY] 📥 Descargando resultados...`);
            const itemsRes = await this.fetchWithTimeout(
                `https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.apiKey}`,
                {},
                30000
            );
            const items = await itemsRes.json();
            onLog(`[APIFY] ✅ ${Array.isArray(items) ? items.length : 0} resultados descargados`);
            return items;
        } catch (err: any) {
            if (err.message === 'CANCELLED') return [];
            onLog(`[APIFY] ❌ Error descargando resultados: ${err.message}`);
            return [];
        }
    }

    // ------------------------------------------------------------------
    // LINKEDIN STRATEGY (OPTIMIZED - FAST PIPELINE)
    // ------------------------------------------------------------------
    private async searchLinkedIn(
        query: string,
        maxResults: number,
        options: { language: string; maxAge: number },
        onLog: LogCallback,
        existingEmails: Set<string>,
        existingLinkedin: Set<string>
    ): Promise<Candidate[]> {
        const acceptedCandidates: Candidate[] = [];
        const MAX_RETRIES = 15; // Resilient: more attempts needed with higher quality threshold
        let attempt = 0;
        const seenProfileNames: string[] = [];
        const seenUrls = new Set<string>(); // Track URLs within this search session

        const startTime = performance.now();

        // RETRY LOOP: Continue searching until we have enough candidates
        while (acceptedCandidates.length < maxResults && attempt < MAX_RETRIES && this.isRunning) {
            attempt++;
            const currentQuery = this.getQueryVariation(query, attempt, seenProfileNames);
            const remaining = maxResults - acceptedCandidates.length;
            onLog(`[LINKEDIN] 🎯 Intento ${attempt}/${MAX_RETRIES}: Necesito ${remaining} más...`);
            onLog(`[LINKEDIN] 🔎 Query: ${currentQuery.substring(0, 120)}${currentQuery.length > 120 ? '...' : ''}`);

            try {
                const siteOperator = 'site:linkedin.com/in';
                const langKeywords = options.language === 'Spanish' ? '(España OR Spanish OR Español)' : '';
                // Negative operators: keep non-engineering profiles out of Google results.
                // This saves OpenAI calls and prevents false positives at the source.
                const nonEngineerExclusions = '-recruiter -headhunter -"talent acquisition" -"people partner" -staffing -reclutador';

                const searchInput = {
                    queries: `${siteOperator} ${currentQuery} ${langKeywords} ${nonEngineerExclusions}`,
                    maxPagesPerQuery: 1,
                    resultsPerPage: 150,
                    languageCode: options.language === 'Spanish' ? 'es' : 'en',
                    countryCode: options.language === 'Spanish' ? 'es' : 'us',
                };

                onLog(`[LINKEDIN] 📊 1 página × 20 resultados (modo rápido ~8s)...`);
                const results = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, searchInput, onLog);

                let allResults: any[] = [];
                results.forEach(r => {
                    if (r.organicResults) allResults = allResults.concat(r.organicResults);
                });

                // Filter to LinkedIn profile URLs only
                const profiles = allResults.filter((r: any) => r.url && r.url.includes('linkedin.com/in/'));

                // Track names for exclusion in future queries
                profiles.forEach((p: any) => {
                    const name = (p.title || '').split('-')[0].replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
                    if (name && name.length > 2 && !seenProfileNames.includes(name)) {
                        seenProfileNames.push(name);
                    }
                });

                if (profiles.length === 0) {
                    onLog(`[LINKEDIN] ⚠️ 0 perfiles LinkedIn en resultados. Reintentando...`);
                    continue;
                }

                // ═══ PRE-FILTER: Remove duplicates BEFORE calling OpenAI ═══
                // This is the biggest optimization - don't waste OpenAI calls on known profiles
                const newProfiles = profiles.filter((p: any) => {
                    const url = normalizeLinkedInUrl(p.url);
                    const normalizedForCheck = url.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '').trim();
                    
                    // Already in DB?
                    if (existingLinkedin.has(normalizedForCheck)) return false;
                    // Already seen in this search session?
                    if (seenUrls.has(normalizedForCheck)) return false;
                    
                    seenUrls.add(normalizedForCheck);
                    return true;
                });

                onLog(`[LINKEDIN] 📋 ${profiles.length} perfiles → ${newProfiles.length} nuevos (${profiles.length - newProfiles.length} duplicados descartados sin API)`);

                if (newProfiles.length === 0) {
                    onLog(`[LINKEDIN] ⚠️ Todos duplicados. Reintentando con query diferente...`);
                    continue;
                }

                // ═══ BATCH AI ANALYSIS: Process 8 profiles in parallel ═══
                const BATCH_SIZE = 8;
                let processedCount = 0;

                for (let i = 0; i < newProfiles.length && acceptedCandidates.length < maxResults; i += BATCH_SIZE) {
                    if (!this.isRunning) break;

                    const batch = newProfiles.slice(i, i + BATCH_SIZE);
                    onLog(`[BATCH] 🔄 Analizando ${batch.length} perfiles con IA...`);

                    const batchPromises = batch.map(async (p) => {
                        if (!this.isRunning) return null;

                        const name = p.title.split('-')[0].trim() || 'Candidato';
                        const role = p.title.split('-')[1]?.trim() || currentQuery;

                        // ── ROLE PRE-FILTER ──────────────────────────────────────────────
                        // Reject headhunters / HR / non-engineers BEFORE calling OpenAI.
                        // Saves API cost and prevents false 80+ scores for non-engineers.
                        if (this.isClearlyNonEngineer(role)) {
                            onLog(`[ROLE-FILTER] ❌ ${name} rechazado — rol no-ingeniero: "${role}"`);
                            return null;
                        }

                        const analysis = await this.generateAIAnalysis({
                            name,
                            company: 'Linkedin Search',
                            role,
                            snippet: p.description,
                            query: currentQuery,
                            maxAge: options.maxAge
                        });

                        processedCount++;

                        if (analysis.symmetry_score < 80) {
                            onLog(`[FILTER] 📉 ${name} (Score: ${analysis.symmetry_score}) [${processedCount}/${newProfiles.length}]`);
                            return null;
                        }

                        const candidate: Candidate = {
                            id: crypto.randomUUID(),
                            full_name: name,
                            email: null,
                            linkedin_url: normalizeLinkedInUrl(p.url),
                            github_url: null,
                            avatar_url: p.pagemap?.cse_image?.[0]?.src || null,
                            job_title: role,
                            current_company: 'Ver Perfil',
                            location: options.language === 'Spanish' ? 'España/Latam' : 'Global',
                            experience_years: 0,
                            education: null,
                            skills: analysis.skills || [],
                            ai_analysis: JSON.stringify(analysis),
                            symmetry_score: analysis.symmetry_score,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        // Double-check against already accepted in this search
                        if (acceptedCandidates.some(ac => ac.linkedin_url === candidate.linkedin_url)) {
                            return null;
                        }

                        onLog(`[MATCH] ✅ ${name} (Score: ${analysis.symmetry_score}) [${acceptedCandidates.length + 1}/${maxResults}]`);
                        return candidate;
                    });

                    const batchResults = (await Promise.all(batchPromises)).filter(c => c !== null) as Candidate[];

                    // Add to dedup sets
                    batchResults.forEach(c => {
                        if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                        if (c.linkedin_url) {
                            const normalizedUrl = c.linkedin_url.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '').trim();
                            existingLinkedin.add(normalizedUrl);
                        }
                    });

                    acceptedCandidates.push(...batchResults);

                    if (acceptedCandidates.length >= maxResults) {
                        const elapsed = Math.round((performance.now() - startTime) / 1000);
                        onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} - Meta alcanzada en ${elapsed}s`);
                        break;
                    }

                    onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos`);
                }

                if (acceptedCandidates.length >= maxResults) {
                    onLog(`[SUCCESS] 🎉 Meta alcanzada en intento ${attempt}`);
                    break;
                }

            } catch (error: any) {
                onLog(`[LINKEDIN] ⚠️ Error en intento ${attempt}: ${error.message}`);
            }

            // No delay needed - continue immediately to maximize throughput
        }

        const totalTime = Math.round((performance.now() - startTime) / 1000);

        if (acceptedCandidates.length === 0) {
            onLog(`[WARNING] ⚠️ 0 candidatos tras ${attempt} intentos (${totalTime}s)`);
        } else if (acceptedCandidates.length < maxResults) {
            onLog(`[INFO] ℹ️ ${acceptedCandidates.length}/${maxResults} encontrados en ${totalTime}s`);
        }

        const finalCandidates = acceptedCandidates.slice(0, maxResults);
        onLog(`[LINKEDIN] ✅ ${finalCandidates.length} candidatos en ${totalTime}s`);

        return finalCandidates;
        onLog(`[LINKEDIN] ✅ ${finalCandidates.length} candidatos seleccionados`);

        return finalCandidates;
    }


    /** Returns true when the search query targets a backend engineering role. */
    private isBackendQuery(query: string): boolean {
        const q = query.toLowerCase();
        return q.includes('backend') || q.includes('back-end') || q.includes('back end');
    }

    private async generateAIAnalysis(context: any): Promise<any> {
        if (!this.openaiKey) return {
            summary: "Análisis no disponible (Sin API Key)",
            psychological_profile: "N/A",
            business_moment: "Desconocido",
            sales_angle: "Genérico",
            bottleneck: "No detectado",
            outreach_message: `¡Hola ${context.name}! Nos encantaría conectar contigo. https://symmetry.club/roles/product-engineer`,
            icebreaker: `Hola ${context.name}, me encantaría conectar. Tenemos roles top para ti.`,
            followup_message: `Vimos tu perfil y creemos que eres exactamente lo que buscamos. ¿Podríamos charlar?`,
            skills: [],
            symmetry_score: 0 // No real analysis available — scoring step will compute the actual value
        };

        const isBackend = this.isBackendQuery(context.query || '');

        // ── Backend Product Engineer prompt ─────────────────────────────────────
        const backendSystemPrompt = `Eres un Tech Recruiter de ÉLITE para Symmetry (app de fitness/bienestar con +400k descargas/mes).
Tu misión: identificar Backend Product Engineers con experiencia en apps de consumo (B2C). CALIDAD SOBRE VOLUMEN.

=== PERFIL OBJETIVO — BACKEND PRODUCT ENGINEER ===
Stack core: Node.js + TypeScript + PostgreSQL/Supabase. APIs REST/GraphQL. Consumer-facing apps.
Entienden producto, usuario Y negocio. Ownership end-to-end de features. Experiencia: 3-8 años en producción.

❌ RECHAZO INMEDIATO (score = 10, SIN EXCEPCIÓN):
- Recruiters, headhunters, talent acquisition, HR, people ops, staffing
- Sales manager, account manager, account executive, business development
- Marketing manager, community manager, customer success
- Cualquier perfil que NO escribe código profesionalmente
→ Si el título del perfil contiene cualquiera de los términos anteriores, asigna score = 10 y summary = "RECHAZADO: perfil no-ingeniero".

=== CALIBRACIÓN DE PUNTUACIÓN ===
• Backend con ownership de producto + app consumer real → 85-95
• Backend con algunas señales de producto, ownership poco claro → 75-84
• Backend genérico (enterprise/consulting/sin ownership) → 60-72
• DevOps/infraestructura/plataforma sin features de producto → 50-60
• CRÍTICO: análisis que dice "necesita desarrollar habilidades de producto" → máximo 72, NO arriba de 75
• CRÍTICO: perfil ambiguo sin señales claras de backend → 60, NO 75 por defecto

✅ GREEN FLAGS (suman desde el base):
- Node.js + TypeScript + PostgreSQL/Supabase en producción (+10)
- Ownership end-to-end de features con usuarios reales (+8)
- Consumer app publicada (App Store / Play Store) (+5)
- SDK de monetización: RevenueCat, Superwall, Stripe (+5)
- Startup / scale-up con tracción real de usuarios (+5)
- GitHub activo con repos de backend (+3)
- Experiencia con IA: OpenAI API, LangChain, pipelines de datos (+3)

🚫 RED FLAGS — fuerzan tier inferior:
- Solo formación teórica o bootcamp sin proyectos reales en producción → 30-45
- Solo herramientas B2B/enterprise sin contexto consumer → máximo 65
- Sin evidencia de código en producción → máximo 50

Devuelve ÚNICAMENTE JSON con este formato:
{
    "psychological_profile": "Perfil psicológico en 1 frase",
    "business_moment": "Momento actual en 1 frase",
    "sales_angle": "Mejor acercamiento en 1 frase",
    "bottleneck": "Principal dolor o cuello de botella",
    "summary": "Resumen ejecutivo en 1 frase",
    "outreach_message": "Mensaje personalizado (<280 chars) directo y creativo para primer contacto sobre el rol backend",
    "icebreaker": "Mensaje de invitación LINKEDIN máximo 200 caracteres, menciona el stack backend específico del candidato",
    "followup_message": "Mensaje de seguimiento (300-400 chars) tras aceptar conexión, menciona Symmetry y el rol backend",
    "second_followup": "Mensaje de seguimiento (300-500 chars) si no hay respuesta, proporciona más contexto técnico",
    "skills": ["Skill 1", "Skill 2"],
    "symmetry_score": 75
}

IMPORTANTE: Si el snippet indica que el usuario tiene > ${context.maxAge || 40} años, PENALIZAR SCORE (<50).`;

        // ── Generic Product Engineer prompt (Flutter / UI-UX / other) ───────────
        const genericSystemPrompt = `Eres un Tech Recruiter de ÉLITE para Symmetry (•400k descargas/mes). Tu misión: CALIDAD SOBRE VOLUMEN. Solo apruebas "Product Engineers" — no meros ejecutores de tareas técnicas.

                            === PERFIL OBJETIVO (extraído del documento Lead Ideal) ===
                            Experiencia: 3-8 años en producción. Stack core: React/Next.js, Node.js, TypeScript, APIs REST.
                            Full-stack end-to-end. Entienden producto, usuario Y negocio.

                            ✅ GREEN FLAGS (suman al symmetry_score):
                            - Ownership de features/productos + menciona métricas o impacto de negocio
                            - Stack: React/Next.js, Node.js, TypeScript, integraciones REST
                            - Construyó aplicaciones COMPLETAS (frontend + backend + deploy)
                            - Experiencia en startups, entornos ágiles o freelance
                            - Usa herramientas IA (ChatGPT, Claude, Cursor) en su flujo de trabajo
                            - Mobile (React Native o Flutter) o infra cloud (AWS/GCP/CI-CD) como bonus

                            🚫 RED FLAGS — AUTO-FAIL (symmetry_score DEBE ser < 40 si aplica alguno):
                            - Solo formación teórica o bootcamp SIN proyectos en producción
                            - Experiencia limitada a tareas muy específicas SIN contexto global de producto
                            - No demuestra comprensión del negocio ni del impacto de lo que construye
                            - Actitud pasiva: solo ejecuta, no tiene iniciativa ni ownership
                            - Sin apps funcionales usadas por usuarios reales

                            Analiza el perfil y devuelve UNICAMENTE JSON con este formato:
                            {
                                "psychological_profile": "Perfil psicológico en 1 frase",
                                "business_moment": "Momento actual en 1 frase",
                                "sales_angle": "Mejor acercamiento en 1 frase",
                                "bottleneck": "Principal dolor o cuello de botella",
                                "summary": "Resumen ejecutivo en 1 frase",
                                "outreach_message": "Mensaje personalizado (<280 chars) directo y creativo para primer contacto",
                                "icebreaker": "ICEBREAKER: Mensaje de invitación LINKEDIN máximo 200 caracteres, super personalizado, menciona algo específico del perfil",
                                "followup_message": "FOLLOWUP: Mensaje más completo (300-400 chars) para enviar después de aceptar la conexión. Profesional y genuino",
                                "second_followup": "Mensaje de seguimiento (300-500 chars) si no hay respuesta inicial. Proporciona más valor e información",
                                "skills": ["Habilidad 1", "Habilidad 2"],
                                "symmetry_score": 75
                            }
                            
                            IMPORTANTE:
                            - ICEBREAKER casual, corto (máx 200 chars), pedir conexión en LinkedIn
                            - FOLLOWUP profesional, describe oportunidad sin vender directamente
                            - SEGUNDO FOLLOWUP para seguimiento sin respuesta, ofrece valor adicional
                            - Los 3 mensajes super personalizados basados en el perfil
                            - Si el snippet indica que el usuario tiene > ${context.maxAge || 40} años, PENALIZAR SCORE (<50)`;

        try {
            // Create controller for timeout (6 seconds - gpt-4o-mini is fast)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: isBackend ? backendSystemPrompt : genericSystemPrompt
                        },
                        { role: 'user', content: JSON.stringify(context) }
                    ],
                    temperature: 0.7,
                    max_tokens: 350
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`OpenAI Error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            // Clean up markdown code blocks if present
            const cleanContent = content?.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanContent || '{}');
            
            // Ensure all required fields exist
            parsed.icebreaker = parsed.icebreaker || `Hola ${context.name}, me encantaría conectar contigo.`;
            parsed.followup_message = parsed.followup_message || `${context.name}, tras revisar tu perfil sabemos que eres el perfil ideal.`;
            parsed.second_followup = parsed.second_followup || `${context.name}, viendo tu trayectoria creemos que hay una gran alineación.`;
            
            return parsed;
        } catch (e: any) {
            // Return fallback on timeout or error
            return {
                summary: "Análisis rápido disponible",
                psychological_profile: "Profesional activo",
                business_moment: "En demanda",
                sales_angle: "Roles de alto impacto",
                bottleneck: "Oportunidades personalizadas",
                outreach_message: `¡Hola ${context.name}! Tenemos roles de alto nivel. https://symmetry.club/roles/product-engineer`,
                icebreaker: `Hola ${context.name}, me encantaría conectar contigo. Tenemos roles exclusivos para profesionales como vos.`,
                followup_message: `${context.name}, tras revisar tu perfil sabemos que eres el perfil ideal. ¿Podríamos agendar una llamada?`,
                second_followup: `${context.name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`,
                skills: context.skills || ['N/A'],
                symmetry_score: 65
            };
        }
    }
}

export const searchEngine = new SearchEngine();

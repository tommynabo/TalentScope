
import { Candidate, SearchFilterCriteria } from '../../types/database';
import { calculateFlutterDeveloperScore } from '../../lib/scoring';
import { deduplicationService } from '../../lib/deduplication';
import { SearchService } from '../../lib/search';
import { normalizeLinkedInUrl } from '../../lib/normalization';
import { UnbreakableExecutor, initializeUnbreakableMarker } from '../../lib/UnbreakableExecution';
import { isLikelySpanishSpeaker } from './spanishLanguageFilter';

export type LogCallback = (message: string) => void;

// Apify Actor IDs
const GOOGLE_SEARCH_SCRAPER = 'nFJndFXA5zjCTuudP';

/**
 * LinkedInSearchEngine: Specialized search engine for LinkedIn profiles
 * Handles the LinkedIn Radar methodology with optimized queries and AI analysis
 */
export class LinkedInSearchEngine {
    // UNBREAKABLE EXECUTION MODE
    private isRunning = false;
    private userIntentedStop = false;

    private apiKey = '';
    private openaiKey = '';
    private abortController: AbortController | null = null;
    private unbreakableExecutor: UnbreakableExecutor | null = null;

    constructor() {
        initializeUnbreakableMarker();
    }

    public stop() {
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
        maxResults: number,
        options: {
            language: string;
            maxAge: number;
            filters?: SearchFilterCriteria;
            scoreThreshold?: number;
            campaignId?: string;
        },
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void
    ) {
        this.isRunning = true;
        this.userIntentedStop = false;
        this.abortController = new AbortController();
        this.apiKey = import.meta.env.VITE_APIFY_API_KEY || '';
        this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

        const campaignId = options.campaignId || `campaign_${Date.now()}`;
        this.unbreakableExecutor = new UnbreakableExecutor(campaignId);

        try {
            this.unbreakableExecutor.run(
                async () => {
                    await this.executeCoreSearch(
                        query,
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

    private async executeCoreSearch(
        query: string,
        maxResults: number,
        options: any,
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void
    ): Promise<void> {
        // OPTIMIZED: Use fast fallback for demo/production without API keys
        if (!this.apiKey || !this.openaiKey) {
            onLog("🚀 Iniciando búsqueda en modo RÁPIDO (Sin APIs externas)...");
            this.startFastSearch(query, maxResults, options, onLog, onComplete);
            return;
        }

        try {
            onLog(`[DEDUP] 🔍 Cargando base de datos para evitar duplicados...`);
            const { existingEmails, existingLinkedin } = await deduplicationService.fetchExistingCandidates();
            onLog(`[DEDUP] ✅ ${existingEmails.size} emails y ${existingLinkedin.size} perfiles conocidos ignorados.`);

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
            const MAX_RETRIES = 30;
            let attempt = 0;
            const seenProfileNames: string[] = [];
            let consecutiveDupAttempts = 0; // EARLY EXIT: 3 consecutivos = abortar

            while (acceptedCandidates.length < maxResults && attempt < MAX_RETRIES && this.isRunning) {
                attempt++;
                const currentQuery = this.getQueryVariation(query, attempt, seenProfileNames);
                onLog(`[SEARCH] 🎯 Intento ${attempt}/${MAX_RETRIES}: Buscando con "${currentQuery}"...`);

                const startTime = performance.now();
                const rawCandidates = await SearchService.searchCandidates(currentQuery, maxResults * 4);
                const duration = performance.now() - startTime;

                onLog(`[SEARCH] ✅ ${rawCandidates.length} candidatos encontrados en ${Math.round(duration / 1000)}s`);

                onLog(`[DEDUP] 🧹 Filtrando duplicados...`);
                const uniqueCandidates = rawCandidates.filter(c => {
                    if (deduplicationService.isDuplicate(c, existingEmails, existingLinkedin)) return false;
                    if (acceptedCandidates.some(ac => ac.email === c.email || ac.linkedin_url === c.linkedin_url)) return false;
                    return true;
                });

                if (uniqueCandidates.length === 0) {
                    consecutiveDupAttempts++;
                    if (consecutiveDupAttempts >= 3) {
                        onLog(`[EARLY-EXIT] 🛑 3 intentos consecutivos con 100% duplicados. El nicho actual está agotado.`);
                        break;
                    }
                    onLog(`[DEDUP] ⚠️ No candidatos nuevos (${consecutiveDupAttempts}/3 consecutivos). Reintentando...`);
                    continue;
                }

                // Reset del contador al encontrar candidatos nuevos
                consecutiveDupAttempts = 0;

                // ═══ SPANISH LANGUAGE FILTER (Fast Search path) ═══
                let languageFiltered = uniqueCandidates;
                if (options.language === 'Spanish') {
                    const beforeCount = languageFiltered.length;
                    languageFiltered = uniqueCandidates.filter(c => {
                        const result = isLikelySpanishSpeaker(
                            c.full_name,
                            c.job_title,
                            c.ai_analysis || null,
                            c.location
                        );
                        if (!result.isSpanish) {
                            onLog(`[LANG-FILTER] ❌ ${c.full_name} no parece hispanohablante (conf: ${result.confidence})`);
                        }
                        return result.isSpanish;
                    });
                    if (beforeCount !== languageFiltered.length) {
                        onLog(`[LANG-FILTER] 🌐 ${beforeCount - languageFiltered.length} candidatos filtrados por idioma español`);
                    }
                }

                onLog(`[ANALYSIS] 🧠 Generando análisis personalizado (${languageFiltered.length} candidatos)...`);

                const analyzedCandidates = await Promise.all(
                    languageFiltered.map(c => this.enrichCandidateWithAnalysis(c))
                );

                let scoredCandidates = analyzedCandidates;
                if (options.filters) {
                    onLog(`[SCORING] 📊 Aplicando filtro Flutter Developer...`);

                    scoredCandidates = analyzedCandidates
                        .map(candidate => {
                            const scoring = calculateFlutterDeveloperScore(candidate, options.filters!);
                            return {
                                ...candidate,
                                symmetry_score: scoring.breakdown.normalized,
                                score_breakdown: scoring.breakdown
                            };
                        })
                        .filter(c => c.symmetry_score >= (options.scoreThreshold || 70))
                        .sort((a, b) => (b.symmetry_score || 0) - (a.symmetry_score || 0));

                    onLog(`[SCORING] ✅ ${scoredCandidates.length} candidatos cumplen threshold de ${options.scoreThreshold || 70}/100`);
                }

                const candidatesToAdd = scoredCandidates.slice(0, Math.max(0, maxResults - acceptedCandidates.length));
                acceptedCandidates.push(...candidatesToAdd);

                onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos encontrados`);

                if (acceptedCandidates.length >= maxResults) {
                    onLog(`[SUCCESS] 🎉 Meta alcanzada en intento ${attempt}`);
                    break;
                }
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

    private getQueryVariation(baseQuery: string, attempt: number, seenNames: string[]): string {
        // ═══ SNIPER MICRO-QUERIES: 1 rol × 1 tech × 1 ciudad por intento ═══
        // Elimina las queries genéricas con OR que devolvían siempre los mismos resultados.

        // Exclusiones por nombre (evitar repetir perfiles conocidos)
        const exclusions = seenNames
            .slice(-15)
            .map(name => {
                const parts = name.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().split(/\s+/);
                return parts[0] && parts[0].length > 2 ? `-"${parts[0]}"` : '';
            })
            .filter(Boolean)
            .join(' ');

        // Primer intento: query original del usuario tal cual
        if (attempt === 1) return baseQuery;

        const roles = [
            '"Product Engineer"', '"Full Stack Engineer"', '"Software Engineer"',
            '"Mobile Tech Lead"', '"Frontend Engineer"', '"Backend Engineer"',
            '"Full Stack Developer"', '"Senior Developer"',
        ];
        const techs = [
            '"Flutter"', '"React"', '"Node.js"', '"TypeScript"',
            '"Next.js"', '"React Native"', '"AWS"', '"Python"',
        ];
        const cities = [
            '"Madrid"', '"Barcelona"', '"Valencia"', '"Sevilla"',
            '"Ciudad de México"', '"Monterrey"', '"Guadalajara"',
            '"Bogotá"', '"Medellín"', '"Buenos Aires"', '"Córdoba"',
            '"Santiago"', '"Lima"', '"Quito"', '"Montevideo"',
        ];

        // Rotación con velocidades coprimas para máxima diversidad entre intentos
        const idx = attempt - 2; // offset porque attempt 1 ya se usó
        const role = roles[idx % roles.length];
        const tech = techs[(idx * 3) % techs.length];   // ×3 = coprime con 8
        const city = cities[idx % cities.length];

        let variation = `${role} ${tech} ${city}`;

        if (exclusions) {
            const finalQuery = `${variation} ${exclusions}`;
            return finalQuery.length > 250 ? variation : finalQuery;
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
            maxAge: 30
        });

        return {
            ...candidate,
            ai_analysis: JSON.stringify(analysis),
            symmetry_score: analysis.symmetry_score
        };
    }

    private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

    private async searchLinkedIn(
        query: string,
        maxResults: number,
        options: { language: string; maxAge: number },
        onLog: LogCallback,
        existingEmails: Set<string>,
        existingLinkedin: Set<string>
    ): Promise<Candidate[]> {
        const acceptedCandidates: Candidate[] = [];
        const MAX_RETRIES = 30;
        let attempt = 0;
        const seenProfileNames: string[] = [];
        const seenUrls = new Set<string>();
        let consecutiveDupAttempts = 0; // EARLY EXIT: cuenta intentos consecutivos 100% duplicados

        const startTime = performance.now();

        while (acceptedCandidates.length < maxResults && attempt < MAX_RETRIES && this.isRunning) {
            attempt++;
            const currentQuery = this.getQueryVariation(query, attempt, seenProfileNames);
            const remaining = maxResults - acceptedCandidates.length;
            onLog(`[LINKEDIN] 🎯 Intento ${attempt}/${MAX_RETRIES}: Necesito ${remaining} más...`);
            onLog(`[LINKEDIN] 🔎 Query: ${currentQuery.substring(0, 120)}${currentQuery.length > 120 ? '...' : ''}`);

            try {
                const siteOperator = 'site:linkedin.com/in';
                const langKeywords = options.language === 'Spanish'
                    ? '(España OR México OR Colombia OR Argentina OR Chile OR Perú OR "habla española" OR Español)'
                    : '';

                // DYNAMIC FETCH SCALE-UP: If target is high, request more results per attempt to handle duplicates
                const resultsPerPage = Math.max(20, Math.min(100, maxResults * 3));
                
                const searchInput = {
                    queries: `${siteOperator} ${currentQuery} ${langKeywords}`,
                    maxPagesPerQuery: 1,
                    resultsPerPage: resultsPerPage,
                    languageCode: options.language === 'Spanish' ? 'es' : 'en',
                    countryCode: options.language === 'Spanish' ? 'es' : 'us',
                };

                onLog(`[LINKEDIN] 📊 1 página × ${resultsPerPage} resultados (modo rápido ~8s)...`);
                const results = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, searchInput, onLog);

                let allResults: any[] = [];
                results.forEach(r => {
                    if (r.organicResults) allResults = allResults.concat(r.organicResults);
                });

                const profiles = allResults.filter((r: any) => r.url && r.url.includes('linkedin.com/in/'));

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

                const newProfiles = profiles.filter((p: any) => {
                    const url = normalizeLinkedInUrl(p.url);
                    const normalizedForCheck = url.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '').trim();

                    if (existingLinkedin.has(normalizedForCheck)) return false;
                    if (seenUrls.has(normalizedForCheck)) return false;

                    seenUrls.add(normalizedForCheck);
                    return true;
                });

                onLog(`[LINKEDIN] 📋 ${profiles.length} perfiles → ${newProfiles.length} nuevos (${profiles.length - newProfiles.length} duplicados descartados sin API)`);

                if (newProfiles.length === 0) {
                    consecutiveDupAttempts++;
                    if (consecutiveDupAttempts >= 3) {
                        onLog(`[EARLY-EXIT] 🛑 3 intentos consecutivos con 100% duplicados. El nicho actual está agotado.`);
                        break;
                    }
                    onLog(`[LINKEDIN] ⚠️ Todos duplicados (${consecutiveDupAttempts}/3 consecutivos). Reintentando...`);
                    continue;
                }

                // Reset del contador al encontrar perfiles nuevos
                consecutiveDupAttempts = 0;

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

                        // ═══ SPANISH LANGUAGE FILTER (pre-analysis) ═══
                        if (options.language === 'Spanish') {
                            // Extract potential location from Google snippet (often contains LinkedIn location)
                            const snippet = p.description || '';
                            const extractedLocation = snippet.match(/(?:^|·|–|-)\s*([^·–-]+(?:Spain|España|Madrid|Barcelona|México|Colombia|Argentina|Chile|Perú|Valencia|Sevilla|Bogotá|Lima|Santiago|Buenos Aires)[^·–-]*)/i)?.[1]?.trim() || null;
                            const langCheck = isLikelySpanishSpeaker(name, role, snippet, extractedLocation);
                            if (!langCheck.isSpanish) {
                                processedCount++;
                                onLog(`[LANG-FILTER] ❌ ${name} no parece hispanohablante (señales: ${langCheck.signals.length === 0 ? 'ninguna' : langCheck.signals.join(', ')})`);
                                return null;
                            }
                        }

                        const analysis = await this.generateAIAnalysis({
                            name,
                            company: 'Linkedin Search',
                            role,
                            snippet: p.description,
                            query: currentQuery,
                            maxAge: options.maxAge,
                            requireSpanish: options.language === 'Spanish'
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

                        if (acceptedCandidates.some(ac => ac.linkedin_url === candidate.linkedin_url)) {
                            return null;
                        }

                        onLog(`[MATCH] ✅ ${name} (Score: ${analysis.symmetry_score}) [${acceptedCandidates.length + 1}/${maxResults}]`);
                        return candidate;
                    });

                    const batchResults = (await Promise.all(batchPromises)).filter(c => c !== null) as Candidate[];

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
            symmetry_score: 75
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

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
                            content: `Eres un Tech Recruiter de ÉLITE para Symmetry (•400k descargas/mes). Tu misión: CALIDAD SOBRE VOLUMEN. Solo apruebas "Product Engineers" — no meros ejecutores de tareas técnicas.

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
                                "followup_message": "FOLLOWUP: Mensaje EXACTO que diga: 'Gracias por aceptar [Nombre]. Estamos escalando Symmetry, una app de salud y bienestar con mucha tracción (+400k descargas/mes) y equipo de producto pequeño. Buscamos product engineers en [stack específico extraído del perfil, ej: React/Node.js o Next.js/TypeScript]. ¿Te interesa que te pase el brief técnico?'",
                                "second_followup": "SEGUNDO FOLLOWUP: Mensaje de seguimiento (300-500 chars) si no hay respuesta inicial. Proporciona más valor e información",
                                "skills": ["Habilidad 1", "Habilidad 2"],
                                "symmetry_score": 75
                            }
                            
                            IMPORTANTE:
                            - ICEBREAKER debe ser casual, corto (máx 200 chars), pedir conexión en LinkedIn
                            - FOLLOWUP debe usar EXACTAMENTE el formato solicitado para el mensaje post-aceptación con el nombre del candidato y su stack principal.
                            - SEGUNDO FOLLOWUP es para seguimiento después de X días sin respuesta, ofrece valor adicional
                            - Los 3 mensajes deben ser super personalizados basados en el perfil
                            - If snippet implies user is > ${context.maxAge || 40} years old, PENALIZE SCORE (<50)
                            ${context.requireSpanish ? `- FILTRO IDIOMA OBLIGATORIO: Si el nombre, ubicación o texto del perfil NO muestran señales claras de hablar español (nombre hispano, ubicación en España/Latinoamérica, texto en español), PENALIZAR SCORE severamente (poner <30)
                            - TODOS los mensajes DEBEN estar escritos en español` : ''}`
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

            const cleanContent = content?.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanContent || '{}');

            parsed.icebreaker = parsed.icebreaker || `Hola ${context.name}, me encantaría conectar contigo.`;
            parsed.followup_message = parsed.followup_message || `Gracias por aceptar ${context.name.split(' ')[0]}. Estamos escalando Symmetry, una app de salud y bienestar con mucha tracción (+400k descargas/mes) y equipo de producto pequeño. Buscamos product engineers. ¿Te interesa que te pase el brief técnico?`;
            parsed.second_followup = parsed.second_followup || `${context.name}, viendo tu trayectoria creemos que hay una gran alineación.`;

            return parsed;
        } catch (e: any) {
            return {
                summary: "Análisis rápido disponible",
                psychological_profile: "Profesional activo",
                business_moment: "En demanda",
                sales_angle: "Roles de alto impacto",
                bottleneck: "Oportunidades personalizadas",
                outreach_message: `¡Hola ${context.name}! Tenemos roles de alto nivel. https://symmetry.club/roles/product-engineer`,
                icebreaker: `Hola ${context.name}, me encantaría conectar contigo. Tenemos roles exclusivos para profesionales como vos.`,
                followup_message: `Gracias por aceptar ${context.name.split(' ')[0]}. Estamos escalando Symmetry, una app de salud y bienestar con mucha tracción (+400k descargas/mes) y equipo de producto pequeño. Buscamos product engineers. ¿Te interesa que te pase el brief técnico?`,
                second_followup: `${context.name}, viendo tu trayectoria creemos que hay una gran alineación. Te compartimos una oportunidad que podría ser perfect fit para ti.`,
                skills: context.skills || ['N/A'],
                symmetry_score: 75
            };
        }
    }
}

export const linkedInSearchEngine = new LinkedInSearchEngine();

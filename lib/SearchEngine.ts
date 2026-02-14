
import { Candidate, SearchFilterCriteria } from '../types/database';
import { calculateFlutterDeveloperScore } from './scoring';
import { deduplicationService } from './deduplication';
import { SearchService } from './search';
import { normalizeLinkedInUrl } from './normalization';

export type LogCallback = (message: string) => void;

// Apify Actor IDs
const GOOGLE_SEARCH_SCRAPER = 'nFJndFXA5zjCTuudP';

export class SearchEngine {
    private isRunning = false;
    private apiKey = '';
    private openaiKey = '';

    public stop() {
        this.isRunning = false;
    }

    public async startSearch(
        query: string,
        source: 'linkedin',
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
        this.isRunning = true;
        this.apiKey = import.meta.env.VITE_APIFY_API_KEY || '';
        this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

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
        } finally {
            this.isRunning = false;
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
                    // Small delay before retry
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                onLog(`[ANALYSIS] 🧠 Generando análisis personalizado (${uniqueCandidates.length} candidatos)...`);

                const analyzedCandidates = await Promise.all(
                    uniqueCandidates.map(c => this.enrichCandidateWithAnalysis(c))
                );

                // Apply Flutter Developer scoring if filter criteria provided
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

                // Add new candidates to accepted list (but only up to maxResults total)
                const candidatesToAdd = scoredCandidates.slice(0, Math.max(0, maxResults - acceptedCandidates.length));
                acceptedCandidates.push(...candidatesToAdd);

                onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos encontrados`);

                // If we reached the goal, break out of loop
                if (acceptedCandidates.length >= maxResults) {
                    onLog(`[SUCCESS] 🎉 Meta alcanzada en intento ${attempt}`);
                    break;
                }

                // Small delay before next retry
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 500));
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
        } finally {
            this.isRunning = false;
        }
    }

    private getQueryVariation(baseQuery: string, attempt: number, seenNames: string[]): string {
        // Extract core keywords from the query for remixing
        const coreTerms = baseQuery.replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        const core = coreTerms.slice(0, 3).join(' ');

        // Build exclusion string from previously seen profiles (limit to avoid Google query max length)
        const exclusions = seenNames
            .slice(-12)
            .map(name => {
                const parts = name.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().split(/\s+/);
                // Use first name only (shorter, avoids special chars issues)
                return parts[0] && parts[0].length > 2 ? `-"${parts[0]}"` : '';
            })
            .filter(Boolean)
            .join(' ');

        // Truly diverse query variations that access different parts of Google's index
        const variations = [
            baseQuery, // Original
            `"${core}" Spain OR España`, // Quoted match + geography
            `${core} startup OR scaleup`, // Startup ecosystem
            `${core} freelance OR contractor OR autónomo`, // Freelancers 
            `${core} remote OR remoto`, // Remote workers
            `"senior" ${core}`, // Senior prefix (different ranking)
            `"head" OR "lead" OR "principal" ${coreTerms[0] || core}`, // Leadership
            `"CTO" OR "VP" OR "director" ${coreTerms[0] || core}`, // C-level
            `${coreTerms[0] || core} "full stack" OR "backend" OR "frontend"`, // Stack angles
            `${core} Barcelona OR Madrid OR Valencia OR Sevilla`, // City-specific
        ];

        const variation = variations[Math.min(attempt - 1, variations.length - 1)];
        
        // Append exclusions for attempts > 1
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

    private async callApifyActor(actorId: string, input: any, onLog: LogCallback): Promise<any[]> {
        // ... (remains unchanged)
        if (!this.apiKey) {
            throw new Error("Falta API Key de Apify configuration");
        }

        onLog(`[APIFY] 🚀 Ejecutando actor ${actorId}...`);

        // START
        const startRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        if (!startRes.ok) {
            const err = await startRes.text();
            throw new Error(`Apify Error: ${err}`);
        }

        const runData = await startRes.json();
        const runId = runData.data.id;
        const datasetId = runData.data.defaultDatasetId;

        // OPTIMIZED POLL: Reduced from 60 checks (5 min) to 30 checks (2.5 min)
        let finished = false;
        let checks = 0;
        let lastStatus = '';

        while (!finished && this.isRunning && checks < 30) {
            await new Promise(r => setTimeout(r, 5000));
            checks++;

            try {
                const statusRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${this.apiKey}`);
                const statusData = await statusRes.json();
                const status = statusData.data.status;

                if (status !== lastStatus) {
                    onLog(`[APIFY] Estado: ${status} (${checks * 5}s)`);
                    lastStatus = status;
                }

                if (status === 'SUCCEEDED') finished = true;
                else if (status === 'FAILED' || status === 'ABORTED') throw new Error(`Actor falló: ${status}`);
            } catch (err: any) {
                onLog(`[APIFY] ⚠️ Error checking status: ${err.message}`);
            }
        }

        if (!this.isRunning) {
            onLog(`[APIFY] ⏸️ Búsqueda cancelada por el usuario`);
            return [];
        }

        if (!finished) {
            onLog(`[APIFY] ⚠️ Timeout: Usando resultados parciales`);
            // Continue anyway with partial results
        }

        // FETCH ITEMS
        try {
            const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.apiKey}`);
            return await itemsRes.json();
        } catch (err: any) {
            onLog(`[APIFY] ❌ Error fetching results: ${err.message}`);
            return [];
        }
    }

    // ------------------------------------------------------------------
    // LINKEDIN STRATEGY (OPTIMIZED WITH RETRY LOGIC)
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
        const MAX_RETRIES = 10;
        let attempt = 0;
        const seenProfileNames: string[] = []; // Track ALL seen profile names across retries

        // RETRY LOOP: Continue searching until we have enough candidates or hit max retries
        while (acceptedCandidates.length < maxResults && attempt < MAX_RETRIES && this.isRunning) {
            attempt++;
            const currentQuery = this.getQueryVariation(query, attempt, seenProfileNames);
            onLog(`[LINKEDIN] 🎯 Intento ${attempt}/${MAX_RETRIES}: Buscando con query diversificada...`);
            onLog(`[LINKEDIN] 🔎 Query: ${currentQuery.substring(0, 120)}${currentQuery.length > 120 ? '...' : ''}`);

            try {
                // Use global site:linkedin.com/in - regional subdomains miss many profiles
                // Geographic targeting is handled by countryCode + language keywords
                const siteOperator = 'site:linkedin.com/in';

                // Add language keywords
                const langKeywords = options.language === 'Spanish' ? '(España OR Spanish OR Español)' : '';

                const searchInput = {
                    queries: `${siteOperator} ${currentQuery} ${langKeywords}`,
                    maxPagesPerQuery: 3,
                    resultsPerPage: Math.ceil(maxResults * 6),
                    languageCode: options.language === 'Spanish' ? 'es' : 'en',
                    countryCode: options.language === 'Spanish' ? 'es' : 'us',
                };

                const results = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, searchInput, onLog);

                let allResults: any[] = [];
                results.forEach(r => {
                    if (r.organicResults) allResults = allResults.concat(r.organicResults);
                });

                const profiles = allResults
                    .filter((r: any) => r.url && r.url.includes('linkedin.com/in/'))
                    .slice(0, maxResults * 4);

                // Track ALL profile names from this attempt (for future exclusions)
                profiles.forEach((p: any) => {
                    const name = (p.title || '').split('-')[0].replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
                    if (name && name.length > 2 && !seenProfileNames.includes(name)) {
                        seenProfileNames.push(name);
                    }
                });

                if (profiles.length === 0) {
                    onLog(`[LINKEDIN] ⚠️ No perfiles encontrados en intento ${attempt}. Reintentando...`);
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                onLog(`[LINKEDIN] 📋 ${profiles.length} perfiles detectados. Procesando con buffer 4x...`);

                // BATCHED PROCESSING: Process in small batches
                const BATCH_SIZE = 5; // Process 5 profiles at a time
                let processedCount = 0;

                for (let i = 0; i < profiles.length && acceptedCandidates.length < maxResults; i += BATCH_SIZE) {
                    if (!this.isRunning) break;

                    const batch = profiles.slice(i, i + BATCH_SIZE);
                    onLog(`[BATCH] 🔄 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} perfiles)...`);

                    const batchPromises = batch.map(async (p) => {
                        if (!this.isRunning) return null;

                        const name = p.title.split('-')[0].trim() || 'Candidato';
                        const role = p.title.split('-')[1]?.trim() || currentQuery;

                        // Generate AI Analysis for this candidate
                        const analysis = await this.generateAIAnalysis({
                            name,
                            company: 'Linkedin Search',
                            role,
                            snippet: p.description,
                            query: currentQuery,
                            maxAge: options.maxAge
                        });

                        processedCount++;

                        // STRICT FILTERING: Score must be >= 70
                        if (analysis.symmetry_score < 70) {
                            onLog(`[FILTER] 📉 ${name} descartado (Score: ${analysis.symmetry_score}) [${processedCount}/${profiles.length}]`);
                            return null;
                        }

                        // Create candidate object
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

                        // Check for duplicates against DB and current batch
                        if (deduplicationService.isDuplicate(candidate, existingEmails, existingLinkedin)) {
                            onLog(`[DEDUP] 🗑️ ${name} descartado (duplicado) [${processedCount}/${profiles.length}]`);
                            return null;
                        }

                        // Check against already accepted in this search
                        if (acceptedCandidates.some(ac => ac.email === candidate.email || ac.linkedin_url === candidate.linkedin_url)) {
                            return null;
                        }

                        onLog(`[MATCH] ✅ ${name} aceptado (Score: ${analysis.symmetry_score}) [${acceptedCandidates.length + 1}/${maxResults}]`);
                        return candidate;
                    });

                    const batchResults = (await Promise.all(batchPromises)).filter(c => c !== null) as Candidate[];

                    // Add newly accepted candidates to dedup sets
                    batchResults.forEach(c => {
                        if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                        if (c.linkedin_url) {
                            // URL is already normalized via normalizeLinkedInUrl at creation time
                            const normalizedUrl = c.linkedin_url
                                .toLowerCase()
                                .replace(/^https?:\/\//i, '')
                                .replace(/^www\./, '')
                                .replace(/\/$/, '')
                                .trim();
                            existingLinkedin.add(normalizedUrl);
                        }
                    });

                    acceptedCandidates.push(...batchResults);

                    // Check if we've reached the goal
                    if (acceptedCandidates.length >= maxResults) {
                        onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos encontrados - Meta alcanzada`);
                        break;
                    }

                    onLog(`[PROGRESS] 📊 ${acceptedCandidates.length}/${maxResults} candidatos encontrados`);

                    // Add small delay between batches
                    if (i + BATCH_SIZE < profiles.length && acceptedCandidates.length < maxResults) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }

                // If we got enough candidates, break the retry loop
                if (acceptedCandidates.length >= maxResults) {
                    onLog(`[SUCCESS] 🎉 Meta alcanzada en intento ${attempt}`);
                    break;
                }

            } catch (error: any) {
                onLog(`[LINKEDIN] ⚠️ Error en intento ${attempt}: ${error.message}`);
            }

            // Small delay before next retry
            if (attempt < MAX_RETRIES && acceptedCandidates.length < maxResults) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        if (acceptedCandidates.length === 0) {
            onLog(`[WARNING] ⚠️ No se encontraron candidatos nuevos después de ${attempt} intentos`);
        } else if (acceptedCandidates.length < maxResults) {
            onLog(`[INFO] ℹ️ Se encontraron ${acceptedCandidates.length}/${maxResults} candidatos (menos que el objetivo)`);
        }

        // Return exactly maxResults (or fewer if couldn't find enough)
        const finalCandidates = acceptedCandidates.slice(0, maxResults);
        onLog(`[LINKEDIN] ✅ ${finalCandidates.length} candidatos seleccionados`);

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
            symmetry_score: 75 // Default decent score
        };

        try {
            // Create controller for timeout (10 seconds)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

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
                            content: `Eres un experto reclutador specializado en talento tech. Analiza el perfil y devuelve UNICAMENTE JSON con este formato:
                            {
                                "psychological_profile": "Perfil psicológico en 1 frase",
                                "business_moment": "Momento actual en 1 frase",
                                "sales_angle": "Mejor acercamiento en 1 frase",
                                "bottleneck": "Principal dolor o cuello de botella",
                                "summary": "Resumen ejecutivo en 1 frase",
                                "outreach_message": "Mensaje personalizado (<280 chars) directo y creativo para primer contacto",
                                "icebreaker": "ICEBREAKER: Mensaje de invitación LINKEDIN máximo 200 caracteres, super personalizado, menciona algo específico del perfil",
                                "followup_message": "FOLLOWUP: Mensaje más completo (300-400 chars) para enviar después de aceptar la conexión. Profesional y genuino",
                                "skills": ["Habilidad 1", "Habilidad 2"],
                                "symmetry_score": 75
                            }
                            
                            IMPORTANTE:
                            - ICEBREAKER debe ser casual, corto (máx 200 chars), pedir conexión en LinkedIn
                            - FOLLOWUP debe ser más profesional y completo, describe oportunidad sin vender directamente
                            - Ambos mensajes deben ser super personalizados basados en el perfil
                            - If snippet implies user is > ${context.maxAge || 40} years old, PENALIZE SCORE (<50)`
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

            return JSON.parse(cleanContent || '{}');
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
                skills: context.skills || ['N/A'],
                symmetry_score: 65
            };
        }
    }
}

export const searchEngine = new SearchEngine();

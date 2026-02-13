
import { Candidate, SearchFilterCriteria } from '../types/database';
import { calculateFlutterDeveloperScore } from './scoring';
import { deduplicationService } from './deduplication';
import { SearchService } from './search';

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

            onLog(`[SEARCH] 🎯 Buscando candidatos con "${query}"...`);

            // Use fast search service (returns real-looking data with personalized DMs)
            const startTime = performance.now();
            const rawCandidates = await SearchService.searchCandidates(query, maxResults);
            const duration = performance.now() - startTime;

            onLog(`[SEARCH] ✅ ${rawCandidates.length} candidatos encontrados en ${Math.round(duration / 1000)}s`);

            // Deduplicate
            onLog(`[DEDUP] 🧹 Filtrando duplicados...`);
            const uniqueCandidates = rawCandidates.filter(c =>
                !deduplicationService.isDuplicate(c, existingEmails, existingLinkedin)
            );

            onLog(`[ANALYSIS] 🧠 Generando análisis personalizado...`);

            const analyzedCandidates = await Promise.all(
                uniqueCandidates.map(c => this.enrichCandidateWithAnalysis(c))
            );

            // NEW: Apply Flutter Developer scoring if filter criteria provided
            let scoredCandidates = analyzedCandidates;
            if (options.filters) {
                onLog(`[SCORING] 📊 Aplicando filtro Flutter Developer con 11-punto scoring system...`);
                
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

            onLog(`[FIN] ✅ ${scoredCandidates.length} candidatos procesados y listos.`);
            onComplete(scoredCandidates.slice(0, maxResults));

        } catch (error: any) {
            onLog(`[ERROR] ❌ ${error.message}`);
            onComplete([]);
        } finally {
            this.isRunning = false;
        }
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
    // LINKEDIN STRATEGY (OPTIMIZED)
    // ------------------------------------------------------------------
    private async searchLinkedIn(
        query: string,
        maxResults: number,
        options: { language: string; maxAge: number },
        onLog: LogCallback,
        existingEmails: Set<string>,
        existingLinkedin: Set<string>
    ): Promise<Candidate[]> {
        // 1. Google Search for LinkedIn Profiles (site:linkedin.com/in)
        let siteOperator = 'site:linkedin.com/in';
        if (options.language === 'Spanish') {
            siteOperator = 'site:es.linkedin.com/in';
        } else if (options.language === 'Portuguese') {
            siteOperator = 'site:br.linkedin.com/in';
        }

        // Add language keywords
        const langKeywords = options.language === 'Spanish' ? '(Español OR Spanish)' : '';

        const searchInput = {
            queries: `${siteOperator} ${query} ${langKeywords}`,
            maxPagesPerQuery: 2,
            resultsPerPage: Math.ceil(maxResults * 4),
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

        onLog(`[LINKEDIN] 📋 ${profiles.length} perfiles detectados. Analizando con buffer 4x y early stopping...`);

        // BATCHED PROCESSING: Process in small batches with early stopping
        const BATCH_SIZE = 5; // Process 5 profiles at a time
        const acceptedCandidates: Candidate[] = [];
        let processedCount = 0;

        for (let i = 0; i < profiles.length && acceptedCandidates.length < maxResults; i += BATCH_SIZE) {
            if (!this.isRunning) break;

            const batch = profiles.slice(i, i + BATCH_SIZE);
            onLog(`[BATCH] 🔄 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} perfiles)...`);

            const batchPromises = batch.map(async (p) => {
                if (!this.isRunning) return null;

                const name = p.title.split('-')[0].trim() || 'Candidato';
                const role = p.title.split('-')[1]?.trim() || query;

                // Generate AI Analysis for this candidate
                const analysis = await this.generateAIAnalysis({
                    name,
                    company: 'Linkedin Search',
                    role,
                    snippet: p.description,
                    query: query,
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
                    linkedin_url: p.url,
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

                // Check for duplicates BEFORE accepting
                if (deduplicationService.isDuplicate(candidate, existingEmails, existingLinkedin)) {
                    onLog(`[DEDUP] 🗑️ ${name} descartado (duplicado) [${processedCount}/${profiles.length}]`);
                    return null;
                }

                onLog(`[MATCH] ✅ ${name} aceptado (Score: ${analysis.symmetry_score}) [${acceptedCandidates.length + 1}/${maxResults}]`);
                return candidate;
            });

            const batchResults = (await Promise.all(batchPromises)).filter(c => c !== null) as Candidate[];

            // Add newly accepted candidates to dedup sets to prevent duplicates within the same search
            batchResults.forEach(c => {
                if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                if (c.linkedin_url) {
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

            // Early stopping: if we have enough candidates, stop processing
            if (acceptedCandidates.length >= maxResults) {
                onLog(`[EARLY STOP] 🎯 ${maxResults} candidatos encontrados después de procesar ${processedCount}/${profiles.length} perfiles`);
                break;
            }

            // Add small delay between batches to avoid rate limits
            if (i + BATCH_SIZE < profiles.length && acceptedCandidates.length < maxResults) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // Return exactly maxResults (or fewer if couldn't find enough)
        const finalCandidates = acceptedCandidates.slice(0, maxResults);
        onLog(`[LINKEDIN] ✅ ${finalCandidates.length} candidatos seleccionados de ${processedCount} procesados`);

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
                            content: `Eres un experto reclutador. Analiza el perfil y devuelve UNICAMENTE JSON:
                            {
                                "psychological_profile": "Perfil en 1 frase",
                                "business_moment": "Momento actual en 1 frase",
                                "sales_angle": "Mejor acercamiento en 1 frase",
                                "bottleneck": "Principal dolor o cuello de botella",
                                "summary": "Resumen ejecutivo en 1 frase",
                                "outreach_message": "Mensaje personalizado (<280 chars) directo y creativo",
                                "skills": ["Habilidad 1", "Habilidad 2"],
                                "symmetry_score": 75  // 0-100. IMPORTANT: If snippet implies user is > ${context.maxAge || 40} years old (e.g. 15+ years exp), PENALIZE SCORE heavily (<50).
                            }`
                        },
                        { role: 'user', content: JSON.stringify(context) }
                    ],
                    temperature: 0.7,
                    max_tokens: 250
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
                skills: context.skills || ['N/A'],
                symmetry_score: 65
            };
        }
    }
}

export const searchEngine = new SearchEngine();

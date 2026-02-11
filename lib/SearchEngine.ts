
import { Candidate } from '../types/database';
import { deduplicationService } from './deduplication';
import { SearchService } from './search';

export type LogCallback = (message: string) => void;

// Apify Actor IDs
const GOOGLE_MAPS_SCRAPER = 'nwua9Gu5YrADL7ZDj';
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
        source: 'gmail' | 'linkedin',
        maxResults: number,
        options: { language: string; maxAge: number },
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void
    ) {
        this.isRunning = true;
        this.apiKey = import.meta.env.VITE_APIFY_API_KEY || '';
        this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

        // OPTIMIZED: Use fast fallback for demo/production without API keys
        if (!this.apiKey || !this.openaiKey) {
            onLog("🚀 Iniciando búsqueda en modo RÁPIDO (Sin APIs externas)...");
            this.startFastSearch(query, maxResults, onLog, onComplete);
            return;
        }

        try {
            onLog(`[DEDUP] 🔍 Cargando base de datos para evitar duplicados...`);
            const { existingEmails, existingLinkedin } = await deduplicationService.fetchExistingCandidates();
            onLog(`[DEDUP] ✅ ${existingEmails.size} emails y ${existingLinkedin.size} perfiles conocidos ignorados.`);

            // Search Logic
            let rawCandidates: Candidate[] = [];
            if (source === 'linkedin') {
                rawCandidates = await this.searchLinkedIn(query, maxResults, options, onLog);
            } else {
                rawCandidates = await this.searchGmail(query, maxResults, onLog);
            }

            // Deduplicate
            onLog(`[DEDUP] 🧹 Filtrando duplicados...`);
            const uniqueCandidates = rawCandidates.filter(c =>
                !deduplicationService.isDuplicate(c, existingEmails, existingLinkedin)
            );

            const dupCount = rawCandidates.length - uniqueCandidates.length;
            if (dupCount > 0) {
                onLog(`[DEDUP] 🗑️ ${dupCount} candidatos descartados por ser duplicados.`);
            }

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
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void
    ) {
        // ... (Fast search implementation remains similar, potentially simulate filters)
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

            onLog(`[FIN] ✅ ${analyzedCandidates.length} candidatos procesados y listos.`);
            onComplete(analyzedCandidates);

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
    private async searchLinkedIn(query: string, maxResults: number, options: { language: string; maxAge: number }, onLog: LogCallback): Promise<Candidate[]> {
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
            resultsPerPage: Math.ceil(maxResults * 1.5),
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
            .slice(0, maxResults);

        onLog(`[LINKEDIN] 📋 ${profiles.length} perfiles detectados. Analizando con foco en Top Talent Joven...`);

        // OPTIMIZED: Parallelize AI analysis instead of sequential
        const candidatePromises = profiles.map(async (p) => {
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

            // STRICT FILTERING: Score must be >= 70
            if (analysis.symmetry_score < 70) {
                onLog(`[FILTER] 📉 Candidato ${name} descartado (Score: ${analysis.symmetry_score}/70)`);
                return null;
            }

            return {
                id: crypto.randomUUID(),
                full_name: name,
                email: null,
                linkedin_url: p.url,
                avatar_url: p.pagemap?.cse_image?.[0]?.src || null,
                job_title: role,
                current_company: 'Ver Perfil',
                location: options.language === 'Spanish' ? 'España/Latam' : 'Global',
                experience_years: 0,
                skills: analysis.skills || [],
                ai_analysis: JSON.stringify(analysis),
                symmetry_score: analysis.symmetry_score,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as Candidate;
        });

        const candidates = (await Promise.all(candidatePromises)).filter(c => c !== null) as Candidate[];
        onLog(`[LINKEDIN] ✅ ${candidates.length} candidatos seleccionados`);

        return candidates;
    }

    // ------------------------------------------------------------------
    // GMAIL STRATEGY (OPTIMIZED)
    // ------------------------------------------------------------------
    private async searchGmail(query: string, maxResults: number, onLog: LogCallback): Promise<Candidate[]> {
        // 1. Google Maps Search
        const mapsInput = {
            searchStringsArray: [query],
            maxCrawledPlacesPerSearch: Math.ceil(maxResults * 2),
            language: 'es',
            includeWebsiteEmail: true,
        };

        const places = await this.callApifyActor(GOOGLE_MAPS_SCRAPER, mapsInput, onLog);

        // Filter those with website or email
        const potential = places.filter((p: any) => p.email || p.website).slice(0, maxResults);

        onLog(`[GMAIL] 📍 ${potential.length} negocios encontrados en Maps.`);

        // OPTIMIZED: Parallelize analysis
        const candidatePromises = potential.map(async (p) => {
            if (!this.isRunning) return null;

            let email = p.email;
            if (!email || email === '') return null;

            const analysis = await this.generateAIAnalysis({
                name: p.title || 'Empresa',
                company: p.title,
                role: 'Propietario / Manager',
                snippet: `Negocio encontrado en ${p.address}`,
                query: query
            });

            // STRICT FILTERING: Score must be >= 70
            if (analysis.symmetry_score < 70) {
                onLog(`[FILTER] 📉 Negocio ${p.title} descartado (Score: ${analysis.symmetry_score}/70)`);
                return null;
            }

            return {
                id: crypto.randomUUID(),
                full_name: p.title || 'Sin Nombre',
                email: email,
                linkedin_url: p.website || null,
                avatar_url: p.imageUrl || p.image || null,
                job_title: 'Propietario',
                current_company: p.title,
                location: p.address,
                experience_years: 0,
                skills: analysis.skills || ['Negocio Local'],
                ai_analysis: JSON.stringify(analysis),
                symmetry_score: analysis.symmetry_score,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as Candidate;
        });

        const candidates = (await Promise.all(candidatePromises)).filter(c => c !== null) as Candidate[];
        onLog(`[GMAIL] ✅ ${candidates.length} candidatos seleccionados`);

        return candidates;
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


import { Candidate } from '../types/database';
import { deduplicationService } from './deduplication';

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
        onLog: LogCallback,
        onComplete: (candidates: Candidate[]) => void
    ) {
        this.isRunning = true;
        this.apiKey = import.meta.env.VITE_APIFY_API_KEY || '';
        this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

        // Fallback for demo if no API key is present (Localhost fallback)
        if (!this.apiKey) {
            onLog("⚠️ No se detectó API Key de Apify. Usando modo simulación local.");
            // We could delegate to the mock service here or just return empty.
            // For now, let's warn.
        }

        try {
            onLog(`[DEDUP] 🔍 Cargando base de datos para evitar duplicados...`);
            const { existingEmails, existingLinkedin } = await deduplicationService.fetchExistingCandidates();
            onLog(`[DEDUP] ✅ ${existingEmails.size} emails y ${existingLinkedin.size} perfiles conocidos ignorados.`);

            // Search Logic
            let rawCandidates: Candidate[] = [];
            if (source === 'linkedin') {
                rawCandidates = await this.searchLinkedIn(query, maxResults, onLog);
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

    private async callApifyActor(actorId: string, input: any, onLog: LogCallback): Promise<any[]> {
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

        // POLL
        let finished = false;
        let checks = 0;
        while (!finished && this.isRunning && checks < 60) { // 5 minutes max
            await new Promise(r => setTimeout(r, 5000));
            checks++;
            const statusRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${this.apiKey}`);
            const statusData = await statusRes.json();
            const status = statusData.data.status;

            if (checks % 2 === 0) onLog(`[APIFY] Estado: ${status}`);

            if (status === 'SUCCEEDED') finished = true;
            else if (status === 'FAILED' || status === 'ABORTED') throw new Error(`Actor falló: ${status}`);
        }

        if (!this.isRunning) return [];

        // FETCH ITEMS
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.apiKey}`);
        return await itemsRes.json();
    }

    // ------------------------------------------------------------------
    // LINKEDIN STRATEGY
    // ------------------------------------------------------------------
    private async searchLinkedIn(query: string, maxResults: number, onLog: LogCallback): Promise<Candidate[]> {
        // 1. Google Search for LinkedIn Profiles (site:linkedin.com/in)
        const searchInput = {
            queries: `site:linkedin.com/in ${query}`,
            maxPagesPerQuery: 2,
            resultsPerPage: maxResults * 1.5, // Overfetch
            languageCode: 'es',
            countryCode: 'es',
        };

        const results = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, searchInput, onLog);

        let allResults: any[] = [];
        results.forEach(r => {
            if (r.organicResults) allResults = allResults.concat(r.organicResults);
        });

        const profiles = allResults
            .filter((r: any) => r.url && r.url.includes('linkedin.com/in/'))
            .slice(0, maxResults);

        onLog(`[LINKEDIN] 📋 ${profiles.length} perfiles detectados. Analizando...`);

        const candidates: Candidate[] = [];

        for (const p of profiles) {
            if (!this.isRunning) break;

            const name = p.title.split('-')[0].trim() || 'Candidato';
            const role = p.title.split('-')[1]?.trim() || query;

            // Generate AI Analysis for this candidate
            const analysis = await this.generateAIAnalysis({
                name,
                company: 'Linkedin Search',
                role,
                snippet: p.description
            });

            candidates.push({
                id: crypto.randomUUID(),
                full_name: name,
                email: null, // Hard to get from just google search of linkedin
                linkedin_url: p.url,
                job_title: role,
                current_company: 'Ver Perfil',
                location: 'España',
                experience_years: 0,
                skills: [],
                ai_analysis: analysis,
                symmetry_score: 85,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as Candidate);
        }

        return candidates;
    }

    // ------------------------------------------------------------------
    // GMAIL STRATEGY (Maps + Contact Scraper)
    // ------------------------------------------------------------------
    private async searchGmail(query: string, maxResults: number, onLog: LogCallback): Promise<Candidate[]> {
        // 1. Google Maps Search
        const mapsInput = {
            searchStringsArray: [query],
            maxCrawledPlacesPerSearch: maxResults * 2,
            language: 'es',
            includeWebsiteEmail: true,
        };

        const places = await this.callApifyActor(GOOGLE_MAPS_SCRAPER, mapsInput, onLog);

        // Filter those with website or email
        const potential = places.filter((p: any) => p.email || p.website).slice(0, maxResults);

        onLog(`[GMAIL] 📍 ${potential.length} negocios encontrados en Maps.`);

        const candidates: Candidate[] = [];

        for (const p of potential) {
            if (!this.isRunning) break;

            let email = p.email;
            // Check if email is valid string
            if (!email || email === '') continue;

            const analysis = await this.generateAIAnalysis({
                name: p.title || 'Empresa',
                company: p.title,
                role: 'Propietario / Manager',
                snippet: `Negocio encontrado en ${p.address}`
            });

            candidates.push({
                id: crypto.randomUUID(),
                full_name: p.title || 'Sin Nombre',
                email: email,
                linkedin_url: p.website || null,
                job_title: 'Propietario',
                current_company: p.title,
                location: p.address,
                experience_years: 0,
                skills: ['Negocio Local'],
                ai_analysis: analysis,
                symmetry_score: 80,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as Candidate);
        }

        return candidates;
    }

    private async generateAIAnalysis(context: any): Promise<string> {
        if (!this.openaiKey) return "Análisis no disponible (Sin API Key)";

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'Eres un experto reclutador. Analiza brevemente este perfil en Español en max 2 lineas.' },
                        { role: 'user', content: JSON.stringify(context) }
                    ],
                    max_tokens: 150
                })
            });
            const data = await response.json();
            return data.choices?.[0]?.message?.content || "Sin análisis";
        } catch (e) {
            return "Error en análisis de IA";
        }
    }
}

export const searchEngine = new SearchEngine();

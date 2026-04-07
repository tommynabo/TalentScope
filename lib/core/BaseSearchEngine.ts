/**
 * BaseSearchEngine  —  Template Method Pattern
 *
 * Defines the FIXED orchestration pipeline shared by all four TalentScope
 * search engines (LinkedIn, GitHub, Marketplace, Community).
 *
 * Fixed execution order (Template Method):
 *
 *   execute()
 *     ├─ [1] loadDeduplicationData()       — load known DB records
 *     ├─ [2] fetchRawCandidates()           — 🔴 ABSTRACT: pull data from source
 *     ├─ [3] preFilter()                    — language filter + custom filters
 *     ├─ [4] evaluateBatchWithAI()          — batch OpenAI scoring
 *     ├─ [5] applyScoreThreshold()          — drop low-scoring profiles
 *     └─ [6] save()                         — 🔴 ABSTRACT: persist to Supabase
 *
 * Subclasses MUST implement:
 *   - fetchRawCandidates()  — how to pull raw profiles from the platform
 *   - save()                — how to persist the scored profiles
 *
 * Subclasses MAY override:
 *   - buildScoringProfiles()  — how to convert a raw candidate into ScoringProfile
 *   - mergeScoreIntoCandidate() — how to write score + reasoning back onto the candidate
 *   - preFilterOne()            — additional per-candidate pre-filters specific to a platform
 *   - getSystemPrompt()         — which OpenAI system prompt to use
 */

import { SharedDeduplicationService, LoadOptions } from './SharedDeduplicationService';
import { SharedBatchScoringService, ScoringProfile, ScoringResult, SYSTEM_PROMPTS } from './SharedBatchScoringService';
import { isLikelySpanishSpeaker } from './SharedLanguageFilter';
import { UnbreakableExecutor, initializeUnbreakableMarker } from '../UnbreakableExecution';

// ─── Sliding-Window constants ─────────────────────────────────────────────────
/** Number of candidates processed per window: score → filter → save → notify UI. */
const CHUNK_SIZE = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogCallback = (message: string) => void;

export interface BaseSearchOptions {
    /** Campaign to associate results with. */
    campaignId?: string;
    /** User that initiated the search (needed for global dedup scopes). */
    userId?: string;
    /** Only accept candidates with score >= threshold. Default: 0 (accept all). */
    scoreThreshold?: number;
    /** When true, skip the Spanish-language pre-filter. Default: false. */
    skipLanguageFilter?: boolean;
    /** Maximum number of candidates to accept. */
    maxResults?: number;
}

export interface RawCandidate {
    /** Platform-agnostic identifier used as the batch-scoring key. */
    _id: string;
    name: string;
    title?: string | null;
    description?: string | null;
    location?: string | null;
    email?: string | null;
    profileUrl?: string | null;
    /** Free-form platform-specific data (preserved as-is through the pipeline). */
    [key: string]: unknown;
}

// ─── Abstract Base ────────────────────────────────────────────────────────────

export abstract class BaseSearchEngine<TCandidate extends RawCandidate = RawCandidate> {

    // ── State ────────────────────────────────────────────────────────────────
    protected isRunning         = false;
    protected userIntendedStop  = false;
    protected abortController: AbortController | null = null;
    protected unbreakableExecutor: UnbreakableExecutor | null = null;

    // ── Shared services ──────────────────────────────────────────────────────
    protected readonly dedup   = new SharedDeduplicationService();
    protected scorer!: SharedBatchScoringService; // created in execute() after keys are read

    constructor() {
        initializeUnbreakableMarker();
    }

    // ─── Lifecycle control ────────────────────────────────────────────────────

    /**
     * Call from subclass start methods to kick off the pipeline.
     *
     * @param onProgress  Optional incremental callback fired after each
     *                    sliding window (chunk of CHUNK_SIZE) is persisted.
     *                    Use this to refresh the UI without waiting for the
     *                    full pipeline to finish.
     */
    protected async execute(
        query: string,
        options: BaseSearchOptions,
        onLog: LogCallback,
        onComplete: (candidates: TCandidate[]) => void,
        onProgress?: (chunk: TCandidate[]) => void,
    ): Promise<void> {
        this.isRunning        = true;
        this.userIntendedStop = false;
        this.abortController  = new AbortController();

        const campaignId = options.campaignId ?? `campaign_${Date.now()}`;
        this.unbreakableExecutor = new UnbreakableExecutor(campaignId);

        // Initialise the batch scorer with the engine-specific system prompt
        const openaiKey = import.meta.env.VITE_OPENAI_API_KEY ?? '';
        this.scorer = new SharedBatchScoringService(openaiKey, this.getSystemPrompt());

        try {
            await this.unbreakableExecutor.run(
                async () => {
                    await this.runPipeline(query, options, onLog, onComplete, onProgress);
                },
                (state) => onLog(`[EXECUTOR] ${state}`),
            );
        } catch (err: any) {
            if (!this.userIntendedStop) {
                onLog(`[ERROR] ❌ ${err.message}`);
                console.error(`[${this.engineName}] Fatal pipeline error:`, err);
            }
            onComplete([]);
        } finally {
            this.isRunning = false;
        }
    }

    /** Stop the current search immediately. */
    public stop(reason = 'User clicked stop'): void {
        this.userIntendedStop = true;
        this.isRunning        = false;
        this.abortController?.abort();
        this.abortController = null;
        this.unbreakableExecutor?.stop(reason);
    }

    public getIsRunning(): boolean { return this.isRunning; }

    // ─── Template Method — fixed pipeline ────────────────────────────────────

    private async runPipeline(
        query: string,
        options: BaseSearchOptions,
        onLog: LogCallback,
        onComplete: (candidates: TCandidate[]) => void,
        onProgress?: (chunk: TCandidate[]) => void,
    ): Promise<void> {

        const { scoreThreshold = 0, maxResults, skipLanguageFilter = false } = options;

        // ── Step 1: Load deduplication data ──────────────────────────────────
        onLog(`[${this.engineName}] 🔍 Cargando datos de deduplicación...`);
        try {
            await this.loadDeduplicationData(options);
            onLog(`[${this.engineName}] ✅ Dedup listo: ${JSON.stringify(this.dedup.stats)}`);
        } catch (err: any) {
            onLog(`[${this.engineName}] ⚠️ Dedup falló: ${err.message} — continuando sin dedup.`);
        }

        if (!this.isRunning || this.userIntendedStop) { onComplete([]); return; }

        // ── Step 2: Fetch raw candidates from the platform source ─────────────
        onLog(`[${this.engineName}] 🚀 Obteniendo candidatos de ${this.platformLabel}...`);
        let rawCandidates: TCandidate[];

        try {
            rawCandidates = await this.fetchRawCandidates(query, options, onLog);
        } catch (err: any) {
            onLog(`[${this.engineName}] ❌ fetchRawCandidates falló: ${err.message}`);
            onComplete([]);
            return;
        }

        onLog(`[${this.engineName}] 📦 ${rawCandidates.length} perfiles crudos obtenidos.`);
        if (!this.isRunning || this.userIntendedStop) { onComplete([]); return; }

        // ── Step 3: Pre-filter (dedup + language + custom) ────────────────────
        onLog(`[${this.engineName}] 🧹 Pre-filtrando (dedup + idioma)...`);
        const preFiltered: TCandidate[] = [];

        for (const candidate of rawCandidates) {
            if (!this.isRunning || this.userIntendedStop) break;
            if (maxResults && preFiltered.length >= maxResults) break;

            // Dedup check
            if (this.dedup.isDuplicate({
                profileUrl:  candidate.profileUrl,
                email:       candidate.email,
                platformKey: this.toPlatformKey(candidate),
            })) continue;

            // Language filter
            if (!skipLanguageFilter) {
                const langResult = isLikelySpanishSpeaker(
                    candidate.name,
                    candidate.title   ?? null,
                    candidate.description ?? null,
                    candidate.location ?? null,
                );
                if (!langResult.isSpanish) continue;
            }

            // Engine-specific extra filter
            if (!this.preFilterOne(candidate)) continue;

            // Register to avoid in-session duplicates
            this.dedup.register({
                profileUrl:  candidate.profileUrl,
                email:       candidate.email,
                platformKey: this.toPlatformKey(candidate),
            });

            preFiltered.push(candidate);
        }

        onLog(`[${this.engineName}] ✅ ${preFiltered.length} candidatos tras pre-filtrado.`);
        if (preFiltered.length === 0) { onComplete([]); return; }

        // ── Step 3b: Heuristic keyword pre-filter (Layer 2) ──────────────────
        const heuristicPassed = this.applyHeuristicFilter(preFiltered, query, onLog);
        onLog(`[${this.engineName}] 🔑 ${heuristicPassed.length}/${preFiltered.length} pasaron el filtro heurístico de keywords.`);
        if (heuristicPassed.length === 0) { onComplete([]); return; }

        // ── Steps 4-6: Sliding Window — CHUNK_SIZE candidatos a la vez ────────
        //
        // Por cada ventana:
        //   1. Score con IA (un solo llamado batch de ≤ CHUNK_SIZE perfiles)
        //   2. Aplicar threshold
        //   3. Guardar en Supabase (save())
        //   4. Notificar a la UI (onProgress)
        //   5. Pasar a la siguiente ventana
        //
        // Esto evita explosiones de Rate Limit en OpenAI y permite que la
        // interfaz muestre candidatos en tiempo real sin esperar el batch completo.
        // ─────────────────────────────────────────────────────────────────────────

        const windows = this.chunkArray(heuristicPassed, CHUNK_SIZE);
        const allFinalCandidates: TCandidate[] = [];

        onLog(`[${this.engineName}] 🪟 Procesando ${heuristicPassed.length} candidatos en ${windows.length} ventanas de ${CHUNK_SIZE}...`);

        for (let winIdx = 0; winIdx < windows.length; winIdx++) {
            if (!this.isRunning || this.userIntendedStop) break;

            const window = windows[winIdx];
            onLog(`[${this.engineName}] ⚙️  Ventana ${winIdx + 1}/${windows.length} — evaluando ${window.length} candidatos con IA...`);

            // ── Score this window ────────────────────────────────────────────
            const profiles: ScoringProfile[] = window.map(c => this.buildScoringProfile(c));
            let scoringResults: ScoringResult[] = [];

            try {
                scoringResults = await this.scorer.scoreBatch(profiles);
            } catch (err: any) {
                onLog(`[${this.engineName}] ⚠️ Scoring falló en ventana ${winIdx + 1}: ${err.message} — asignando score 0.`);
                scoringResults = window.map(c => ({ id: c._id, score: 0, reasoning: 'Scoring unavailable.' }));
            }

            // ── Merge scores + apply threshold ───────────────────────────────
            const scoreMap = new Map(scoringResults.map(r => [r.id, r]));
            const scored: TCandidate[] = [];

            for (const candidate of window) {
                const result = scoreMap.get(candidate._id);
                const score  = result?.score ?? 0;
                if (score < scoreThreshold) continue;
                scored.push(this.mergeScoreIntoCandidate(candidate, result ?? { id: candidate._id, score: 0, reasoning: '' }));
            }

            onLog(`[${this.engineName}] 🎯 Ventana ${winIdx + 1}: ${scored.length}/${window.length} superaron el umbral de ${scoreThreshold} pts.`);

            if (scored.length === 0) continue;

            // ── Save this window ─────────────────────────────────────────────
            let savedChunk: TCandidate[];
            try {
                onLog(`[${this.engineName}] 💾 Guardando ventana ${winIdx + 1} en Supabase...`);
                savedChunk = await this.save(scored, options, onLog);
            } catch (err: any) {
                onLog(`[${this.engineName}] ❌ save() falló en ventana ${winIdx + 1}: ${err.message}`);
                savedChunk = scored; // Return unsaved so UI still sees them
            }

            allFinalCandidates.push(...savedChunk);

            // ── Notify UI of incremental progress ────────────────────────────
            onProgress?.(savedChunk);

            onLog(`[${this.engineName}] ✅ Ventana ${winIdx + 1} lista — ${savedChunk.length} guardados (acumulado: ${allFinalCandidates.length}).`);

            // ── Early exit when target reached ───────────────────────────────
            if (maxResults && allFinalCandidates.length >= maxResults) {
                onLog(`[${this.engineName}] 🎉 Objetivo alcanzado: ${allFinalCandidates.length}/${maxResults}.`);
                break;
            }
        }

        onLog(`[${this.engineName}] ✅ Pipeline completo: ${allFinalCandidates.length} candidatos guardados.`);
        onComplete(allFinalCandidates);
    }

    // ─── Hooks that subclasses MUST implement ────────────────────────────────

    /**
     * Pull raw profiles from the platform (Apify, GitHub API, etc.).
     * The base class does NOT know how. Subclass owns this entirely.
     */
    protected abstract fetchRawCandidates(
        query: string,
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<TCandidate[]>;

    /**
     * Persist the final scored candidates to Supabase (or any store).
     * Must return the persisted candidates (with DB-assigned IDs).
     */
    protected abstract save(
        candidates: TCandidate[],
        options: BaseSearchOptions,
        onLog: LogCallback,
    ): Promise<TCandidate[]>;

    // ─── Hooks that subclasses MAY override ──────────────────────────────────

    /**
     * Name of the Supabase table (and related load options) for deduplication.
     * Override to customise which table and columns to read.
     */
    protected getDeduplicationLoadOptions(_options: BaseSearchOptions): LoadOptions | null {
        // Default: no pre-load (starts fresh). Override in each engine.
        return null;
    }

    /**
     * The recruiter system prompt injected into the batch scorer.
     * Defaults to the general Symmetry Product Engineer rubric.
     * Override in each engine to use a platform-specific prompt.
     */
    protected getSystemPrompt(): string {
        return SYSTEM_PROMPTS.SYMMETRY_PRODUCT_ENGINEER;
    }

    /**
     * Additional per-candidate filter beyond language + dedup.
     * Return `false` to discard the candidate, `true` to keep.
     * Default: accept all.
     */
    protected preFilterOne(_candidate: TCandidate): boolean {
        return true;
    }

    /**
     * Converts a raw candidate into the text blob sent to OpenAI.
     * Override to include platform-specific fields (e.g. GitHub stars, Upwork JSS).
     */
    protected buildScoringProfile(candidate: TCandidate): ScoringProfile {
        return {
            id: candidate._id,
            profileText: [
                `Name: ${candidate.name}`,
                candidate.title       ? `Title: ${candidate.title}`          : '',
                candidate.location    ? `Location: ${candidate.location}`    : '',
                candidate.description ? `Bio: ${candidate.description}`      : '',
            ].filter(Boolean).join('\n'),
        };
    }

    /**
     * Write AI scoring results back onto the candidate object.
     * Override when the subclass has typed fields (e.g. `symmetry_score`).
     */
    protected mergeScoreIntoCandidate(candidate: TCandidate, result: ScoringResult): TCandidate {
        return {
            ...candidate,
            _score:     result.score,
            _reasoning: result.reasoning,
        } as TCandidate;
    }

    /**
     * Build a platform-scoped dedup key for username-based detection.
     * e.g. `"github:torvalds"`.  Return `null` to skip username check.
     */
    protected toPlatformKey(_candidate: TCandidate): string | null {
        return null;
    }

    /**
     * LAYER 2 — Heuristic Keyword Hook
     *
     * Override to return role-specific keywords that MUST appear in a candidate's
     * text fields for them to advance past the heuristic pre-filter.
     *
     * Rules:
     *  - Return an empty array to DISABLE the heuristic filter for this engine.
     *  - Keywords are matched case-insensitively in title + description + name.
     *  - A candidate passes if AT LEAST ONE keyword matches.
     *
     * The base implementation extracts meaningful words from the search query
     * (stripping common stopwords and short tokens).
     */
    protected getHeuristicKeywords(query: string): string[] {
        const STOPWORDS = new Set([
            'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for',
            'with', 'by', 'from', 'as', 'is', 'are', 'was', 'be', 'type', 'user',
            'site', 'http', 'https', 'www', 'location', 'de', 'en', 'la', 'el',
        ]);
        return query
            .toLowerCase()
            .replace(/site:\S+/g, '')          // strip site: operators
            .replace(/location:\S+/g, '')       // strip location: operators
            .replace(/type:\S+/g, '')           // strip type: operators
            .replace(/[^a-z0-9\s]/g, ' ')       // remove punctuation
            .split(/\s+/)
            .filter(w => w.length > 3 && !STOPWORDS.has(w));
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /**
     * LAYER 2 — Heuristic pre-filter (runs in milliseconds, before any LLM call).
     *
     * Keeps only candidates that contain at least one role keyword from
     * `getHeuristicKeywords()` in their searchable text (name + title + description).
     * When zero keywords are configured the filter is a no-op.
     */
    private applyHeuristicFilter(
        candidates: TCandidate[],
        query: string,
        onLog: LogCallback,
    ): TCandidate[] {
        const keywords = this.getHeuristicKeywords(query);
        if (keywords.length === 0) return candidates;   // filter disabled

        const passed: TCandidate[] = [];
        let dropped = 0;

        for (const c of candidates) {
            const haystack = [
                c.name        ?? '',
                c.title       ?? '',
                c.description ?? '',
            ].join(' ').toLowerCase();

            const hits = keywords.filter(kw => haystack.includes(kw));
            if (hits.length > 0) {
                passed.push(c);
            } else {
                dropped++;
                onLog(`[HEURISTIC] ⏭️ Descartado "${c.name}" — ninguna keyword encontrada (${keywords.slice(0, 3).join(', ')}…)`);
            }
        }

        return passed;
    }

    /** Human-readable engine name used in log prefixes. Override in subclass. */
    protected get engineName(): string { return this.constructor.name; }

    /** Human-readable platform label used in progress messages. Override in subclass. */
    protected get platformLabel(): string { return 'platform'; }

    private async loadDeduplicationData(options: BaseSearchOptions): Promise<void> {
        const loadOpts = this.getDeduplicationLoadOptions(options);
        if (!loadOpts) return;
        await this.dedup.loadFromDatabase(loadOpts);
    }

    /** Split an array into sequential chunks of at most `size` elements. */
    private chunkArray<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
}

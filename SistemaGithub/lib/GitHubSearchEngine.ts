
import { GitHubFilterCriteria, GitHubCandidate, CrossLinkedCandidate } from '../../types/database';
import { githubService } from '../../lib/githubService';
import { ApifyCrossSearchService, performCrossSearch } from '../../lib/apifyCrossSearchService';
import { UnbreakableExecutor, initializeUnbreakableMarker } from '../../lib/UnbreakableExecution';
import { PRESET_PRODUCT_ENGINEERS } from '../../lib/githubPresets';

export type LogCallback = (message: string) => void;

/**
 * GitHubSearchEngine: Specialized search engine for GitHub Code Scan
 * Handles GitHub developer search and optional cross-linking with LinkedIn
 */
export class GitHubSearchEngine {
    private isRunning = false;
    private userIntentedStop = false;
    
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

    /**
     * Search for GitHub developers with provided filters
     */
    public async startGitHubSearch(
        query: string,
        maxResults: number,
        options: { 
            language: string; 
            maxAge: number;
            githubFilters?: GitHubFilterCriteria;
            campaignId?: string;
            userId?: string;
        },
        onLog: LogCallback,
        onComplete: (candidates: GitHubCandidate[]) => void
    ) {
        this.isRunning = true;
        this.userIntentedStop = false;
        this.abortController = new AbortController();

        const campaignId = options.campaignId || `campaign_${Date.now()}`;
        this.unbreakableExecutor = new UnbreakableExecutor(campaignId);

        try {
            this.unbreakableExecutor.run(
                async () => {
                    await this.executeCoreGitHubSearch(
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

    /**
     * Search for GitHub developers with cross-linking to LinkedIn
     */
    public async startCrossSearch(
        query: string,
        maxResults: number,
        options: { 
            language: string;
            maxAge: number;
            githubFilters?: GitHubFilterCriteria;
            campaignId?: string;
            userId?: string;
        },
        onLog: LogCallback,
        onComplete: (candidates: CrossLinkedCandidate[]) => void
    ) {
        this.isRunning = true;
        this.userIntentedStop = false;
        this.abortController = new AbortController();

        const campaignId = options.campaignId || `campaign_${Date.now()}`;
        this.unbreakableExecutor = new UnbreakableExecutor(campaignId);

        try {
            this.unbreakableExecutor.run(
                async () => {
                    await this.executeCroseSearch(
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

    private async executeCoreGitHubSearch(
        query: string,
        maxResults: number,
        options: any,
        onLog: LogCallback,
        onComplete: (candidates: GitHubCandidate[]) => void
    ): Promise<void> {
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

            onLog(`✅ Búsqueda completada: ${candidates.length} desarrolladores encontrados`);
            onComplete(candidates);
        } catch (error: any) {
            onLog(`[ERROR] ❌ ${error.message}`);
            onComplete([]);
        }
    }

    private async executeCroseSearch(
        query: string,
        maxResults: number,
        options: any,
        onLog: LogCallback,
        onComplete: (candidates: CrossLinkedCandidate[]) => void
    ): Promise<void> {
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
    }
}

export const gitHubSearchEngine = new GitHubSearchEngine();

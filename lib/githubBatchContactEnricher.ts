import { GitHubMetrics } from '../types/database';
import { githubDeepContactResearch, ContactResearchResult } from './githubDeepContactResearch';
import { GitHubCandidatePersistence } from './githubCandidatePersistence';

/**
 * BATCH CONTACT ENRICHER SERVICE
 * ════════════════════════════════════════════════════════════════════
 * Coordina la búsqueda de contactos para múltiples candidatos
 * 
 * CARACTERÍSTICAS:
 * - Procesamiento automático uno por uno
 * - Control de rate limiting
 * - Actualización incremental de candidatos
 * - Persistencia en Supabase
 * - Capacidad de pausar/reanudar
 * - Reporte de progreso en tiempo real
 */

export interface EnrichmentOptions {
    parallelRequests?: number;              // Cuántos simultáneamente (default: 1 para ser seguro)
    delayBetweenRequests?: number;          // Milliseconds entre requests (default: 500 ms)
    maxRetries?: number;                    // Reintentos si falla (default: 2)
    persistProgressEvery?: number;          // Guardar en BD cada N candidatos (default: 5)
    skipAlreadyEnriched?: boolean;          // No re-buscar si ya tiene email/linkedin (default: true)
}

export interface EnrichmentProgress {
    totalCandidates: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    emailsFound: number;
    linkedinsFound: number;
    currentProcessing: string | null;
    estimatedTimeRemaining: number; // seconds
    percentComplete: number;
}

export interface EnrichmentResult {
    username: string;
    original: GitHubMetrics;
    updated: GitHubMetrics;
    research: ContactResearchResult;
    updated_fields: string[];      // Qué campos fueron actualizados
    success: boolean;
    error?: string;
}

export class GitHubBatchContactEnricher {
    private isProcessing = false;
    private isPaused = false;
    private startTime = 0;
    private processedCount = 0;
    private successCount = 0;
    private failedCount = 0;

    /**
     * Enriquecer múltiples candidatos con búsqueda de contactos
     */
    async enrichCandidates(
        candidates: GitHubMetrics[],
        campaignId: string,
        userId: string,
        options: EnrichmentOptions = {},
        onProgress?: (progress: EnrichmentProgress, results: EnrichmentResult[]) => void
    ): Promise<EnrichmentResult[]> {
        const {
            parallelRequests = 1,
            delayBetweenRequests = 500,
            maxRetries = 2,
            persistProgressEvery = 5,
            skipAlreadyEnriched = true
        } = options;

        this.isProcessing = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.processedCount = 0;
        this.successCount = 0;
        this.failedCount = 0;

        const results: EnrichmentResult[] = [];
        const candidatesToProcess = candidates.filter(c => {
            // Skip if already enriched and skipAlreadyEnriched is true
            if (skipAlreadyEnriched && (c.mentioned_email || c.linkedin_url)) {
                return false;
            }
            return true;
        });

        // Procesar en batches según parallelRequests
        for (let i = 0; i < candidatesToProcess.length; i += parallelRequests) {
            if (!this.isProcessing) break;

            // Wait if paused
            while (this.isPaused && this.isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const batch = candidatesToProcess.slice(i, i + parallelRequests);
            
            // Process batch in parallel
            const batchPromises = batch.map(async candidate => {
                return this.enrichSingleCandidate(
                    candidate,
                    maxRetries,
                    delayBetweenRequests
                );
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Update counts
            for (const result of batchResults) {
                this.processedCount++;
                if (result.success) {
                    this.successCount++;
                } else {
                    this.failedCount++;
                }
            }

            // Persist progress every N candidates
            if (this.processedCount % persistProgressEvery === 0 || i + parallelRequests >= candidatesToProcess.length) {
                const allUpdatedCandidates = candidates.map(original => {
                    const enriched = results.find(r => r.original.github_username === original.github_username);
                    return enriched ? enriched.updated : original;
                });

                try {
                    await GitHubCandidatePersistence.saveCandidates(
                        campaignId,
                        allUpdatedCandidates,
                        userId
                    );
                } catch (error) {
                    console.warn('Failed to persist progress to Supabase:', error);
                }
            }

            // Report progress
            if (onProgress) {
                const progress: EnrichmentProgress = {
                    totalCandidates: candidatesToProcess.length,
                    processedCount: this.processedCount,
                    successCount: this.successCount,
                    failedCount: this.failedCount,
                    emailsFound: results.filter(r => r.updated.mentioned_email).length,
                    linkedinsFound: results.filter(r => r.updated.linkedin_url).length,
                    currentProcessing: batch[0]?.github_username || null,
                    estimatedTimeRemaining: this.estimateTimeRemaining(candidatesToProcess.length),
                    percentComplete: Math.round((this.processedCount / candidatesToProcess.length) * 100)
                };

                onProgress(progress, batchResults);
            }

            // Delay between requests
            if (i + parallelRequests < candidatesToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            }
        }

        this.isProcessing = false;
        return results;
    }

    /**
     * Enriquecer un solo candidato
     */
    private async enrichSingleCandidate(
        candidate: GitHubMetrics,
        maxRetries: number,
        delayBetweenRequests: number
    ): Promise<EnrichmentResult> {
        const result: EnrichmentResult = {
            username: candidate.github_username,
            original: { ...candidate },
            updated: { ...candidate },
            research: {} as ContactResearchResult,
            updated_fields: [],
            success: false
        };

        let lastError: string | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Perform deep research
                result.research = await githubDeepContactResearch.deepResearchContact(
                    candidate.github_username
                );

                // Update fields if found
                const updatedFields: string[] = [];

                if (result.research.primary_email && !candidate.mentioned_email) {
                    result.updated.mentioned_email = result.research.primary_email;
                    updatedFields.push('mentioned_email');
                }

                if (result.research.linkedin_url && !candidate.linkedin_url) {
                    result.updated.linkedin_url = result.research.linkedin_url;
                    updatedFields.push('linkedin_url');
                }

                if (result.research.personal_website && !candidate.personal_website) {
                    result.updated.personal_website = result.research.personal_website;
                    updatedFields.push('personal_website');
                }

                result.updated_fields = updatedFields;
                result.success = true;
                return result;

            } catch (error: any) {
                lastError = error.message;

                // Retry with exponential backoff
                if (attempt < maxRetries) {
                    const backoffDelay = delayBetweenRequests * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }
        }

        result.error = lastError || 'Unknown error';
        result.success = false;
        return result;
    }

    /**
     * Pausar enriquecimiento
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Reanudar enriquecimiento
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * Cancelar enriquecimiento
     */
    cancel() {
        this.isProcessing = false;
        this.isPaused = false;
    }

    /**
     * Estimar tiempo restante
     */
    private estimateTimeRemaining(totalCandidates: number): number {
        if (this.processedCount === 0) return totalCandidates * 2; // Estimar 2 segundos por candidato

        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        const avgTimePerCandidate = elapsedSeconds / this.processedCount;
        const remainingCandidates = totalCandidates - this.processedCount;

        return Math.round(remainingCandidates * avgTimePerCandidate);
    }

    /**
     * Obtener estado actual
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            isPaused: this.isPaused,
            processedCount: this.processedCount,
            successCount: this.successCount,
            failedCount: this.failedCount,
            elapsedSeconds: Math.round((Date.now() - this.startTime) / 1000)
        };
    }
}

export const githubBatchContactEnricher = new GitHubBatchContactEnricher();

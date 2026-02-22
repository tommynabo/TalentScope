import { supabase } from '../../lib/supabase';
import { GitHubMetrics } from '../../types/database';
import { GitHubCandidatePersistence } from '../../SistemaGithub/lib/githubCandidatePersistence';

/**
 * Servicio de deduplicación para búsquedas de GitHub
 * Busca contra candidatos en la CAMPAÑA ESPECÍFICA (NOT global)
 * Evita candidatos duplicados por username, email o LinkedIn
 */
export class GitHubDeduplicationService {
    /**
     * Fetch existing candidates from SPECIFIC CAMPAIGN
     * Este es el cambio clave: por campaña en lugar de global
     */
    async fetchExistingGitHubCandidates(
        campaignId: string,
        userId: string
    ): Promise<{
        existingUsernames: Set<string>;
        existingEmails: Set<string>;
        existingLinkedin: Set<string>;
    }> {
        const existingUsernames = new Set<string>();
        const existingEmails = new Set<string>();
        const existingLinkedin = new Set<string>();

        try {
            // Buscar candidatos existentes EN LA CAMPAÑA ESPECÍFICA
            const dedupeData = await GitHubCandidatePersistence.getDeduplicationData(
                campaignId,
                userId
            );

            return {
                existingUsernames: dedupeData.usernames,
                existingEmails: dedupeData.emails,
                existingLinkedin: dedupeData.linkedins
            };
        } catch (e) {
            console.error("[GITHUB_DEDUP] Failed to fetch existing candidates", e);
            return { existingUsernames, existingEmails, existingLinkedin };
        }
    }

    isDuplicate(
        metrics: GitHubMetrics,
        existingUsernames: Set<string>,
        existingEmails: Set<string>,
        existingLinkedin: Set<string>,
        currentBatchUsernames?: Set<string>
    ): boolean {
        const lowerUsername = metrics.github_username.toLowerCase();

        // Check if already in database
        if (existingUsernames.has(lowerUsername)) {
            return true;
        }

        // Check if already in current batch (para no duplicar dentro de la misma búsqueda)
        if (currentBatchUsernames?.has(lowerUsername)) {
            return true;
        }

        // Check email duplicates
        if (metrics.mentioned_email) {
            const normalizedEmail = metrics.mentioned_email.toLowerCase().trim();
            if (existingEmails.has(normalizedEmail)) {
                return true;
            }
        }

        // Check LinkedIn duplicates
        if (metrics.linkedin_url) {
            const normalizedLinkedin = metrics.linkedin_url.toLowerCase().trim();
            if (existingLinkedin.has(normalizedLinkedin)) {
                return true;
            }
        }

        return false;
    }
}

export const githubDeduplicationService = new GitHubDeduplicationService();

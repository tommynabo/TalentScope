import { supabase } from './supabase';
import { GitHubMetrics } from '../types/database';

/**
 * Servicio de deduplicación para búsquedas de GitHub
 * Evita candidatos duplicados por username, email o LinkedIn
 */
export class GitHubDeduplicationService {
    async fetchExistingGitHubCandidates(): Promise<{
        existingUsernames: Set<string>;
        existingEmails: Set<string>;
        existingLinkedin: Set<string>;
    }> {
        const existingUsernames = new Set<string>();
        const existingEmails = new Set<string>();
        const existingLinkedin = new Set<string>();

        try {
            // Buscar candidatos existentes en tabla candidates con datos GitHub
            const { data, error } = await supabase
                .from('candidates')
                .select('github_url, email, linkedin_url')
                .not('github_url', 'is', null);

            if (error) {
                console.error("[GITHUB_DEDUP] Error fetching existing candidates:", error);
                return { existingUsernames, existingEmails, existingLinkedin };
            }

            data?.forEach((c: any) => {
                // Extract username from GitHub URL
                if (c.github_url) {
                    const username = c.github_url.split('/').pop();
                    if (username) existingUsernames.add(username.toLowerCase());
                }
                if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                if (c.linkedin_url) existingLinkedin.add(c.linkedin_url.toLowerCase().trim());
            });

            return { existingUsernames, existingEmails, existingLinkedin };
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

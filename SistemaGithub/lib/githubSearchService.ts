import { supabase } from '../../SistemaGithub/lib/supabase';
import { GitHubMetrics } from '../../types/database';

/**
 * Servicio para guardar y restaurar resultados de búsqueda GitHub
 * Almacena candidatos en una tabla JSON dentro de campaigns o en sessionStorage
 */
export const GitHubSearchService = {
    /**
     * Guardar resultados de búsqueda GitHub en Supabase
     */
    async saveSearchResults(campaignId: string, candidates: GitHubMetrics[], userId: string) {
        try {
            // Guardar en tabla campaigns > github_results JSONB
            const { error } = await supabase
                .from('campaigns')
                .update({
                    github_results: candidates,
                    updated_at: new Date().toISOString(),
                    status: 'Running' // Mark as running since we have results
                })
                .eq('id', campaignId)
                .eq('user_id', userId);

            if (error) {
                console.warn('Failed to save to Supabase:', error);
                // Fallback to sessionStorage
                this.saveToSessionStorage(campaignId, candidates);
            }
            return true;
        } catch (err) {
            console.warn('Error saving GitHub results:', err);
            this.saveToSessionStorage(campaignId, candidates);
            return false;
        }
    },

    /**
     * Restaurar resultados de búsqueda GitHub desde Supabase
     */
    async getSearchResults(campaignId: string, userId: string): Promise<GitHubMetrics[] | null> {
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .select('github_results')
                .eq('id', campaignId)
                .eq('user_id', userId)
                .single();

            if (error || !data || !data.github_results) {
                // Fallback to sessionStorage
                return this.getFromSessionStorage(campaignId);
            }

            return data.github_results as GitHubMetrics[];
        } catch (err) {
            console.warn('Error retrieving GitHub results:', err);
            return this.getFromSessionStorage(campaignId);
        }
    },

    /**
     * Guardar en sessionStorage como fallback
     */
    saveToSessionStorage(campaignId: string, candidates: GitHubMetrics[]) {
        try {
            sessionStorage.setItem(
                `github_search_${campaignId}`,
                JSON.stringify({
                    candidates,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
                })
            );
        } catch (err) {
            console.warn('Failed to save to sessionStorage:', err);
        }
    },

    /**
     * Restaurar desde sessionStorage
     */
    getFromSessionStorage(campaignId: string): GitHubMetrics[] | null {
        try {
            const stored = sessionStorage.getItem(`github_search_${campaignId}`);
            if (!stored) return null;

            const data = JSON.parse(stored);
            
            // Verificar que no haya expirado
            if (data.expiresAt && Date.now() > data.expiresAt) {
                sessionStorage.removeItem(`github_search_${campaignId}`);
                return null;
            }

            return data.candidates;
        } catch (err) {
            console.warn('Failed to restore from sessionStorage:', err);
            return null;
        }
    },

    /**
     * Limpiar resultados de búsqueda
     */
    clearSearchResults(campaignId: string) {
        try {
            sessionStorage.removeItem(`github_search_${campaignId}`);
        } catch (err) {
            console.warn('Failed to clear search results:', err);
        }
    }
};
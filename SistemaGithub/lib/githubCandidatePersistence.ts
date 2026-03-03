import { supabase } from '../../lib/supabase';
import { GitHubMetrics } from '../../types/database';

/**
 * Servicio robusto para persistencia de candidatos GitHub en Supabase
 * Maneja guardado, carga, acumulación y deduplicación real contra BD
 */
export const GitHubCandidatePersistence = {
    /**
     * Guardar o actualizar candidato individual en Supabase
     * Crea tabla github_search_results con campaña + candidato
     */
    async saveCandidates(
        campaignId: string,
        candidates: GitHubMetrics[],
        userId: string
    ): Promise<boolean> {
        try {
            if (candidates.length === 0) return true;

            // Convertir GitHubMetrics a formato para guardar
            const recordsToSave = candidates.map(candidate => ({
                campaign_id: campaignId,
                user_id: userId,
                github_username: candidate.github_username,
                github_url: candidate.github_url,
                github_id: candidate.github_id,
                github_metrics: candidate, // Guardar todo el objeto como JSONB
                email: candidate.mentioned_email,
                linkedin_url: candidate.linkedin_url,
                score: candidate.github_score,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                analysis_psychological: candidate.analysis_psychological || null,
                analysis_business: candidate.analysis_business || null,
                analysis_sales_angle: candidate.analysis_sales_angle || null,
                analysis_bottleneck: candidate.analysis_bottleneck || null,
                outreach_icebreaker: candidate.outreach_icebreaker || null,
                outreach_pitch: candidate.outreach_pitch || null,
                outreach_followup: candidate.outreach_followup || null
            }));

            // Upsert - si existe con mismo github_username, actualizar; si no, insertar
            const { error } = await supabase
                .from('github_search_results')
                .upsert(recordsToSave, {
                    onConflict: 'campaign_id,github_username', // Avoid duplicates
                    ignoreDuplicates: false // Update if exists
                });

            if (error) {
                console.error('Error saving candidates to Supabase:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Error in saveCandidates:', err);
            return false;
        }
    },

    /**
     * Obtener todos los candidatos guardados de una campaña
     */
    async getCampaignCandidates(
        campaignId: string,
        userId: string
    ): Promise<GitHubMetrics[]> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('github_metrics')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching candidates:', error);
                return [];
            }

            if (!data || data.length === 0) return [];

            return data
                .map(record => record.github_metrics)
                .filter((m): m is GitHubMetrics => m !== null);
        } catch (err) {
            console.error('Error in getCampaignCandidates:', err);
            return [];
        }
    },

    /**
     * Obtener todos los usernames existentes para deduplicación rápida
     */
    async getExistingUsernames(campaignId: string, userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('github_username')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching existing usernames:', error);
                return new Set();
            }

            return new Set(
                data?.map(record => record.github_username.toLowerCase()) || []
            );
        } catch (err) {
            console.error('Error in getExistingUsernames:', err);
            return new Set();
        }
    },

    /**
     * Obtener todos los emails existentes para deduplicación
     */
    async getExistingEmails(campaignId: string, userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('email')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .not('email', 'is', null);

            if (error) {
                console.error('Error fetching existing emails:', error);
                return new Set();
            }

            return new Set(
                data
                    ?.map(record => record.email?.toLowerCase())
                    .filter((e): e is string => e !== null && e !== undefined) || []
            );
        } catch (err) {
            console.error('Error in getExistingEmails:', err);
            return new Set();
        }
    },

    /**
     * Obtener todos los LinkedIn URLs existentes para deduplicación
     */
    async getExistingLinkedIn(campaignId: string, userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('linkedin_url')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .not('linkedin_url', 'is', null);

            if (error) {
                console.error('Error fetching existing LinkedIn URLs:', error);
                return new Set();
            }

            return new Set(
                data
                    ?.map(record => record.linkedin_url?.toLowerCase())
                    .filter((u): u is string => u !== null && u !== undefined) || []
            );
        } catch (err) {
            console.error('Error in getExistingLinkedIn:', err);
            return new Set();
        }
    },

    /**
     * Cargar y devolver datos para deduplicación (usernames, emails, linkedin)
     */
    async getDeduplicationData(campaignId: string, userId: string) {
        const [usernames, emails, linkedins] = await Promise.all([
            this.getExistingUsernames(campaignId, userId),
            this.getExistingEmails(campaignId, userId),
            this.getExistingLinkedIn(campaignId, userId)
        ]);

        return { usernames, emails, linkedins };
    },

    // ═══════════════════════════════════════════════════════
    // 🌍 GLOBAL DEDUPLICATION — across ALL campaigns
    // ═══════════════════════════════════════════════════════

    /**
     * Obtener TODOS los usernames existentes en TODAS las campañas
     */
    async getGlobalExistingUsernames(userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('github_username')
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching global usernames:', error);
                return new Set();
            }

            return new Set(
                data?.map(record => record.github_username.toLowerCase()) || []
            );
        } catch (err) {
            console.error('Error in getGlobalExistingUsernames:', err);
            return new Set();
        }
    },

    /**
     * Obtener TODOS los emails existentes en TODAS las campañas
     */
    async getGlobalExistingEmails(userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('email')
                .eq('user_id', userId)
                .not('email', 'is', null);

            if (error) {
                console.error('Error fetching global emails:', error);
                return new Set();
            }

            return new Set(
                data
                    ?.map(record => record.email?.toLowerCase())
                    .filter((e): e is string => e !== null && e !== undefined) || []
            );
        } catch (err) {
            console.error('Error in getGlobalExistingEmails:', err);
            return new Set();
        }
    },

    /**
     * Obtener TODOS los LinkedIn URLs existentes en TODAS las campañas
     */
    async getGlobalExistingLinkedIn(userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('linkedin_url')
                .eq('user_id', userId)
                .not('linkedin_url', 'is', null);

            if (error) {
                console.error('Error fetching global LinkedIn URLs:', error);
                return new Set();
            }

            return new Set(
                data
                    ?.map(record => record.linkedin_url?.toLowerCase())
                    .filter((u): u is string => u !== null && u !== undefined) || []
            );
        } catch (err) {
            console.error('Error in getGlobalExistingLinkedIn:', err);
            return new Set();
        }
    },

    /**
     * 🌍 Cargar datos de deduplicación GLOBAL (todas las campañas)
     */
    async getGlobalDeduplicationData(userId: string) {
        const [usernames, emails, linkedins] = await Promise.all([
            this.getGlobalExistingUsernames(userId),
            this.getGlobalExistingEmails(userId),
            this.getGlobalExistingLinkedIn(userId)
        ]);

        return { usernames, emails, linkedins };
    },

    /**
     * Eliminar candidato específico
     */
    async deleteCandidate(campaignId: string, username: string, userId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('github_search_results')
                .delete()
                .eq('campaign_id', campaignId)
                .eq('github_username', username)
                .eq('user_id', userId);

            if (error) {
                console.error('Error deleting candidate:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Error in deleteCandidate:', err);
            return false;
        }
    },

    /**
     * Eliminar todos los candidatos de una campaña
     */
    async clearCampaignCandidates(campaignId: string, userId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('github_search_results')
                .delete()
                .eq('campaign_id', campaignId)
                .eq('user_id', userId);

            if (error) {
                console.error('Error clearing candidates:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Error in clearCampaignCandidates:', err);
            return false;
        }
    },

    /**
     * Obtener candidatos agrupados por fecha de creación (para vista Kanban/Pipeline)
     */
    async getCandidatesGroupedByDate(
        campaignId: string,
        userId: string
    ): Promise<{ [date: string]: GitHubMetrics[] }> {
        try {
            const candidates = await this.getCampaignCandidates(campaignId, userId);

            const grouped: { [date: string]: GitHubMetrics[] } = {};

            candidates.forEach(candidate => {
                const date = new Date(candidate.updated_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                if (!grouped[date]) {
                    grouped[date] = [];
                }
                grouped[date].push(candidate);
            });

            return grouped;
        } catch (err) {
            console.error('Error in getCandidatesGroupedByDate:', err);
            return {};
        }
    },

    /**
     * Contar total de candidatos en campaña
     */
    async countCandidates(campaignId: string, userId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('github_search_results')
                .select('id', { count: 'exact', head: true })
                .eq('campaign_id', campaignId)
                .eq('user_id', userId);

            if (error) {
                console.error('Error counting candidates:', error);
                return 0;
            }

            return count || 0;
        } catch (err) {
            console.error('Error in countCandidates:', err);
            return 0;
        }
    }
};

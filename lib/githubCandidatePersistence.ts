import { supabase } from './supabase';
import { GitHubMetrics } from '../types/database';

/**
 * Servicio robusto para persistencia de candidatos GitHub en Supabase
 * Maneja guardado, carga, acumulación y deduplicación real contra BD
 */
export const GitHubCandidatePersistence = {
    /**
     * Guardar o actualizar candidato individual en Supabase
     * Crea tabla github_search_results con campaña + candidato
     */
    /**
     * Build the record object from a GitHubMetrics candidate
     */
    _buildRecord(campaignId: string, userId: string, candidate: GitHubMetrics) {
        return {
            campaign_id: campaignId,
            user_id: userId,
            github_username: candidate.github_username,
            github_url: candidate.github_url,
            github_id: candidate.github_id,
            github_metrics: candidate, // Guardar todo el objeto como JSONB
            email: candidate.mentioned_email,
            linkedin_url: candidate.linkedin_url,
            score: candidate.github_score,
            updated_at: new Date().toISOString(),

            // Add AI fields if they exist in metrics
            analysis_psychological: candidate.analysis_psychological,
            analysis_business: candidate.analysis_business,
            analysis_sales_angle: candidate.analysis_sales_angle,
            analysis_bottleneck: candidate.analysis_bottleneck,

            // Add outreach messages if they exist
            outreach_icebreaker: candidate.outreach_icebreaker,
            outreach_pitch: candidate.outreach_pitch,
            outreach_followup: candidate.outreach_followup
        };
    },

    /**
     * Fallback: guardar candidatos uno por uno cuando el bulk upsert falla (Error 409).
     * Para cada candidato:
     *   1) Intenta SELECT por campaign_id + github_username
     *   2) Si existe → UPDATE
     *   3) Si no existe → INSERT
     */
    async _saveCandidatesFallback(
        campaignId: string,
        candidates: GitHubMetrics[],
        userId: string
    ): Promise<boolean> {
        let allOk = true;
        for (const candidate of candidates) {
            try {
                const record = this._buildRecord(campaignId, userId, candidate);

                // Check if record already exists
                const { data: existing } = await supabase
                    .from('github_search_results')
                    .select('id')
                    .eq('campaign_id', campaignId)
                    .eq('github_username', candidate.github_username)
                    .maybeSingle();

                if (existing) {
                    // UPDATE existing row
                    const { error: updateErr } = await supabase
                        .from('github_search_results')
                        .update(record)
                        .eq('id', existing.id);

                    if (updateErr) {
                        console.warn(`[saveCandidatesFallback] update failed for ${candidate.github_username}:`, updateErr);
                        allOk = false;
                    }
                } else {
                    // INSERT new row
                    const { error: insertErr } = await supabase
                        .from('github_search_results')
                        .insert(record);

                    if (insertErr) {
                        console.warn(`[saveCandidatesFallback] insert failed for ${candidate.github_username}:`, insertErr);
                        allOk = false;
                    }
                }
            } catch (e) {
                console.warn(`[saveCandidatesFallback] exception for ${candidate.github_username}:`, e);
                allOk = false;
            }
        }
        return allOk;
    },

    async saveCandidates(
        campaignId: string,
        candidates: GitHubMetrics[],
        userId: string
    ): Promise<boolean> {
        try {
            if (candidates.length === 0) return true;

            const recordsToSave = candidates.map(c => this._buildRecord(campaignId, userId, c));

            // Attempt bulk upsert first (fastest path)
            const { error } = await supabase
                .from('github_search_results')
                .upsert(recordsToSave, {
                    onConflict: 'campaign_id,github_username',
                    ignoreDuplicates: false
                });

            if (error) {
                // 409 = unique-constraint mismatch in PostgREST → fall back to individual inserts/updates
                if (error.code === '23505' || error.message?.includes('409') || error.code === 'PGRST116' || (error as any).status === 409) {
                    console.warn('[saveCandidates] Upsert conflict (409) → falling back to individual saves...');
                    return await this._saveCandidatesFallback(campaignId, candidates, userId);
                }
                console.error('Error saving candidates to Supabase:', error);
                // Last resort: try individual saves anyway
                console.warn('[saveCandidates] Attempting individual fallback for any error...');
                return await this._saveCandidatesFallback(campaignId, candidates, userId);
            }

            return true;
        } catch (err) {
            console.error('Error in saveCandidates:', err);
            // Even on exception, try fallback
            try {
                return await this._saveCandidatesFallback(campaignId, candidates, userId);
            } catch (fallbackErr) {
                console.error('Fallback also failed:', fallbackErr);
                return false;
            }
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
    },

    /**
     * Guardar mensajes de outreach editados para un candidato
     */
    async saveOutreachMessages(
        campaignId: string,
        githubUsername: string,
        messages: {
            outreach_icebreaker?: string;
            outreach_pitch?: string;
            outreach_followup?: string;
        }
    ): Promise<boolean> {
        try {
            const updateData: any = {
                updated_at: new Date().toISOString()
            };

            if (messages.outreach_icebreaker !== undefined) {
                updateData.outreach_icebreaker = messages.outreach_icebreaker;
            }
            if (messages.outreach_pitch !== undefined) {
                updateData.outreach_pitch = messages.outreach_pitch;
            }
            if (messages.outreach_followup !== undefined) {
                updateData.outreach_followup = messages.outreach_followup;
            }

            const { error } = await supabase
                .from('github_search_results')
                .update(updateData)
                .eq('campaign_id', campaignId)
                .eq('github_username', githubUsername);

            if (error) {
                console.error('Error saving outreach messages:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Error in saveOutreachMessages:', err);
            return false;
        }
    }
};

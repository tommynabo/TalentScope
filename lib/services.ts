
import { supabase } from './supabase';
import { Candidate, Campaign, CampaignCandidate, SavedSearch } from '../types/database';

// --- Candidate Service ---
export const CandidateService = {
    async getAll() {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Candidate[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Candidate;
    },

    async create(candidateData: Partial<Candidate>) {
        const { data, error } = await supabase
            .from('candidates')
            .insert([candidateData])
            .select()
            .single();

        if (error) throw error;
        return data as Candidate;
    },

    async update(id: string, updates: Partial<Candidate>) {
        const { data, error } = await supabase
            .from('candidates')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Candidate;
    },

    async deleteAll() {
        const { error } = await supabase
            .from('candidates')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        if (error) throw error;
    }
};

// --- Campaign Service ---
export const CampaignService = {
    async getAll(userId?: string) {
        let query = supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Campaign[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Campaign;
    },

    async deleteAll() {
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        if (error) throw error;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async create(campaignData: Partial<Campaign>) {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error("User must be logged in to create a campaign.");

        const { data, error } = await supabase
            .from('campaigns')
            .insert([{
                ...campaignData,
                user_id: user.id,
                settings: {
                    ...(campaignData.settings || {}),
                    stats: { sent: 0, addedToday: 0, responseRate: 0, leads: 0 }
                }
            }])
            .select()
            .single();

        if (error) throw error;
        return data as Campaign;
    },

    async addCandidateToCampaign(campaignId: string, candidateId: string) {
        const { data, error } = await supabase
            .from('campaign_candidates')
            .insert([{
                campaign_id: campaignId,
                candidate_id: candidateId,
                status: 'Pool'
            }])
            .select()
            .single();

        if (error) throw error;
        return data as CampaignCandidate;
    },

    async updateStats(campaignId: string) {
        console.log('[updateStats] Starting stats update for campaign:', campaignId);

        // Get all candidates for this campaign
        const { data: relations, error: relError } = await supabase
            .from('campaign_candidates')
            .select('added_at')
            .eq('campaign_id', campaignId);

        if (relError) {
            console.error('[updateStats] Error fetching campaign_candidates:', relError);
            throw relError;
        }

        const totalCandidates = relations?.length || 0;
        console.log('[updateStats] Total candidates in campaign:', totalCandidates);

        // Count candidates added today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const addedToday = relations?.filter(r => {
            const addedDate = new Date(r.added_at);
            addedDate.setHours(0, 0, 0, 0);
            return addedDate.getTime() === today.getTime();
        }).length || 0;
        console.log('[updateStats] Candidates added today:', addedToday);

        // Get current campaign to preserve other settings
        const { data: campaign, error: fetchError } = await supabase
            .from('campaigns')
            .select('settings')
            .eq('id', campaignId)
            .single();

        if (fetchError) {
            console.error('[updateStats] Error fetching campaign:', fetchError);
            throw fetchError;
        }

        console.log('[updateStats] Current campaign settings:', campaign.settings);

        const updatedStats = {
            sent: totalCandidates,
            addedToday: addedToday,
            responseRate: campaign.settings?.stats?.responseRate || 0,
            leads: campaign.settings?.stats?.leads || 0
        };

        console.log('[updateStats] Updating with stats:', updatedStats);

        // Update campaign stats
        const { data, error } = await supabase
            .from('campaigns')
            .update({
                settings: {
                    ...campaign.settings,
                    stats: updatedStats
                }
            })
            .eq('id', campaignId)
            .select()
            .single();

        if (error) {
            console.error('[updateStats] Error updating campaign:', error);
            throw error;
        }

        console.log('[updateStats] Successfully updated campaign stats:', data.settings.stats);
        return data as Campaign;
    },

    async getCandidatesByCampaign(campaignId: string) {
        // Fetch relations. inner join with candidates
        const { data, error } = await supabase
            .from('campaign_candidates')
            .select(`
                *,
                candidate:candidates(*)
            `)
            .eq('campaign_id', campaignId);

        if (error) throw error;

        // Flatten structure for the UI, include added_at for date grouping
        return data.map((item: any) => ({
            ...item.candidate,
            status_in_campaign: item.status,
            added_at: item.added_at
        })) as (Candidate & { status_in_campaign: string; added_at: string })[];
    },

};

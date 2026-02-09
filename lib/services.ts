
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
    }
};

// --- Campaign Service ---
export const CampaignService = {
    async getAll(userId: string) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Campaign[];
    },

    async create(campaignData: Partial<Campaign>) {
        const { data, error } = await supabase
            .from('campaigns')
            .insert([campaignData])
            .select()
            .single();

        if (error) throw error;
        return data as Campaign;
    },

    async addCandidateToCampaign(campaignId: string, candidateId: string) {
        const { data, error } = await supabase
            .from('campaign_candidates')
            .insert([{ campaign_id: campaignId, candidate_id: candidateId }])
            .select()
            .single();

        if (error) throw error;
        return data as CampaignCandidate;
    }
};

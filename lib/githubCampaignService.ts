/**
 * GITHUB CAMPAIGN SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Complete separation from LinkedIn campaigns
 * Uses campaigns_github table in Supabase
 */

import { supabase } from './supabase';

export interface GitHubCampaign {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    status: 'Draft' | 'Running' | 'Completed' | 'Paused';
    target_role?: string;
    platform: 'GitHub';
    criteria?: Record<string, any>;
    settings?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export const GitHubCampaignService = {
    /**
     * Get all GitHub campaigns for the current user
     */
    async getAll(userId?: string): Promise<GitHubCampaign[]> {
        let query = supabase
            .from('campaigns_github')
            .select('*')
            .order('created_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching GitHub campaigns:', error);
            throw error;
        }
        return (data || []) as GitHubCampaign[];
    },

    /**
     * Get a specific GitHub campaign by ID
     */
    async getById(id: string): Promise<GitHubCampaign> {
        const { data, error } = await supabase
            .from('campaigns_github')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching GitHub campaign:', error);
            throw error;
        }
        return data as GitHubCampaign;
    },

    /**
     * Create a new GitHub campaign
     */
    async create(campaignData: Partial<GitHubCampaign>): Promise<GitHubCampaign> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("User must be logged in to create a campaign.");
        }

        const { data, error } = await supabase
            .from('campaigns_github')
            .insert([{
                ...campaignData,
                user_id: user.id,
                platform: 'GitHub',
                settings: {
                    ...(campaignData.settings || {}),
                    stats: { 
                        sent: 0, 
                        addedToday: 0, 
                        responseRate: 0, 
                        leads: 0 
                    }
                }
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating GitHub campaign:', error);
            throw error;
        }
        return data as GitHubCampaign;
    },

    /**
     * Update a GitHub campaign
     */
    async update(id: string, updates: Partial<GitHubCampaign>): Promise<GitHubCampaign> {
        const { data, error } = await supabase
            .from('campaigns_github')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating GitHub campaign:', error);
            throw error;
        }
        return data as GitHubCampaign;
    },

    /**
     * Delete a GitHub campaign
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('campaigns_github')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting GitHub campaign:', error);
            throw error;
        }
    },

    /**
     * Update campaign status
     */
    async updateStatus(id: string, status: 'Draft' | 'Running' | 'Completed' | 'Paused'): Promise<GitHubCampaign> {
        return this.update(id, { status });
    },

    /**
     * Update campaign settings (stats, etc)
     */
    async updateSettings(id: string, settings: Record<string, any>): Promise<GitHubCampaign> {
        const campaign = await this.getById(id);
        return this.update(id, {
            settings: {
                ...campaign.settings,
                ...settings
            }
        });
    }
};

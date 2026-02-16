
import { supabase } from './supabase';
import { AnalyticsDaily } from '../types/database';

export const AnalyticsService = {
    // Fetch today's stats (or latest available)
    async getDailyStats(): Promise<AnalyticsDaily> {
        const today = new Date().toISOString().split('T')[0];

        // Try to get today's stats
        const { data, error } = await supabase
            .from('analytics_daily')
            .select('*')
            .eq('date', today)
            .maybeSingle();

        if (error) {
            console.error('Error fetching analytics:', error);
            return this.getEmptyStats();
        }

        if (data) return data;

        // If no stats for today, return aggregation of all time or just zeros for now
        // For this MVP, let's return zeros if no entry exists for today
        return this.getEmptyStats();
    },

    getEmptyStats(): AnalyticsDaily {
        return {
            id: '',
            campaign_id: null,
            date: new Date().toISOString().split('T')[0],
            emails_sent: 0,
            replies_received: 0,
            interviews_booked: 0,
            leads_generated: 0
        };
    },

    // Track an event (increment counter)
    async trackEvent(type: 'emails_sent' | 'replies_received' | 'interviews_booked' | 'leads_generated', amount: number = 1) {
        const today = new Date().toISOString().split('T')[0];

        // 1. Try to find today's record
        const { data: existing } = await supabase
            .from('analytics_daily')
            .select('id, ' + type)
            .eq('date', today)
            .maybeSingle();

        if (existing) {
            // Update
            await supabase
                .from('analytics_daily')
                .update({ [type]: (existing[type] as number) + amount })
                .eq('id', (existing as any).id);
        } else {
            // Insert new
            await supabase
                .from('analytics_daily')
                .insert([{ date: today, [type]: amount }]);
        }
    },

    // Track multiple leads at once
    async trackLeadsGenerated(count: number) {
        return this.trackEvent('leads_generated', count);
    }
};

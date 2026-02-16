
import { supabase } from './supabase';
import { AnalyticsDaily } from '../types/database';

export const AnalyticsService = {
    // Fetch today's stats (or latest available)
    async getDailyStats(): Promise<AnalyticsDaily> {
        try {
            const today = new Date().toISOString().split('T')[0];
            console.log(`[Analytics] Fetching stats for ${today}`);

            // Try to get today's stats
            const { data, error } = await supabase
                .from('analytics_daily')
                .select('*')
                .eq('date', today)
                .maybeSingle();

            if (error) {
                console.error('[Analytics] Error fetching analytics:', error);
                return this.getEmptyStats();
            }

            if (data) {
                console.log('[Analytics] Found stats for today:', data);
                return data;
            }

            console.log('[Analytics] No stats for today, returning empty stats');
            // If no stats for today, return aggregation of all time or just zeros for now
            // For this MVP, let's return zeros if no entry exists for today
            return this.getEmptyStats();
        } catch (error) {
            console.error('[Analytics] Exception in getDailyStats:', error);
            return this.getEmptyStats();
        }
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
        try {
            const today = new Date().toISOString().split('T')[0];
            console.log(`[Analytics] Tracking ${type}: +${amount} for ${today}`);

            // 1. Try to find today's record - select all fields
            const { data: existing, error: fetchError } = await supabase
                .from('analytics_daily')
                .select('*')
                .eq('date', today)
                .maybeSingle();

            if (fetchError) {
                console.error('[Analytics] Error fetching existing record:', fetchError);
                throw fetchError;
            }

            if (existing) {
                console.log('[Analytics] Found existing record, updating...', existing);
                // Update - safely access the field
                const currentValue = (existing as any)[type] || 0;
                const newValue = currentValue + amount;
                
                const { error: updateError } = await supabase
                    .from('analytics_daily')
                    .update({ [type]: newValue })
                    .eq('id', existing.id);

                if (updateError) {
                    console.error('[Analytics] Error updating record:', updateError);
                    throw updateError;
                }
                console.log(`[Analytics] Updated ${type} from ${currentValue} to ${newValue}`);
            } else {
                console.log('[Analytics] No existing record, creating new one...');
                // Insert new - initialize all fields with zeros first
                const payload: any = { 
                    date: today,
                    emails_sent: 0,
                    replies_received: 0,
                    interviews_booked: 0,
                    leads_generated: 0,
                    campaign_id: null
                };
                
                // Override the specific field being tracked
                payload[type] = amount;
                
                console.log('[Analytics] Insert payload:', payload);
                
                const { error: insertError, data: insertedData } = await supabase
                    .from('analytics_daily')
                    .insert([payload])
                    .select();

                if (insertError) {
                    console.error('[Analytics] Error inserting record:', insertError);
                    throw insertError;
                }
                console.log('[Analytics] Created new analytics record:', insertedData);
            }
        } catch (error) {
            console.error('[Analytics] trackEvent failed:', error);
            throw error;
        }
    },

    // Track multiple leads at once
    async trackLeadsGenerated(count: number) {
        console.log(`[Analytics] trackLeadsGenerated called with count: ${count}`);
        return this.trackEvent('leads_generated', count);
    }
};

import { supabase } from './supabase';

export interface GmailAccount {
    id: string;
    user_id: string;
    email: string;
    status: 'active' | 'invalid' | 'error' | 'disconnected';
    created_at: string;
    updated_at: string;
}

export interface GmailSequence {
    id: string;
    user_id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'completed';
    created_at: string;
    updated_at: string;
}

export interface GmailSequenceStep {
    id: string;
    sequence_id: string;
    step_number: number;
    subject_template: string;
    body_template: string;
    delay_hours: number;
    created_at: string;
    updated_at: string;
}

export interface GmailOutreachLead {
    id: string;
    sequence_id: string;
    campaign_id: string;
    candidate_id: string;
    candidate_name: string;
    candidate_email: string;
    status: 'pending' | 'running' | 'replied' | 'bounced' | 'failed' | 'completed';
    current_step_number: number;
    scheduled_for: string;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface GmailLog {
    id: string;
    user_id: string;
    action_type: 'sent' | 'reply' | 'bounce' | 'error';
    message_id: string | null;
    sequence_id: string | null;
    lead_id: string | null;
    account_id: string | null;
    metadata: any;
    created_at: string;
}

export const GmailService = {
    // Accounts
    async getAccounts(): Promise<GmailAccount[]> {
        const { data, error } = await supabase
            .from('gmail_accounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching gmail accounts:', error);
            throw error;
        }
        return data || [];
    },

    async connectGoogleAccount(): Promise<void> {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/gmail.send',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
                redirectTo: `${window.location.origin}/buzones/cuentas`
            }
        });
        if (error) throw error;
    },

    async captureSessionAccount(): Promise<void> {
        const { data: { session } } = await supabase.auth.getSession();

        // If we have a provider token, it means we just logged in via OAuth
        if (session && session.provider_token) {
            const user = session.user;

            // Upsert the main account connected
            const { error } = await supabase
                .from('gmail_accounts')
                .upsert({
                    user_id: user.id,
                    email: user.email!, // Use the authenticated user's email
                    access_token: session.provider_token,
                    // If refresh token is missing, keep the old one or set a default.
                    refresh_token: session.provider_refresh_token || '',
                    status: 'active'
                }, { onConflict: 'user_id,email' });

            if (error) {
                console.error('Error saving gmail account:', error);
            }
        }
    },

    async disconnectAccount(accountId: string): Promise<void> {
        const { error } = await supabase
            .from('gmail_accounts')
            .delete()
            .eq('id', accountId);

        if (error) throw error;
    },

    // Sequences
    async getSequences(): Promise<GmailSequence[]> {
        const { data, error } = await supabase
            .from('gmail_sequences')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async createSequence(name: string): Promise<GmailSequence> {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('gmail_sequences')
            .insert({
                user_id: user.id,
                name: name,
                status: 'draft'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getSequenceSteps(sequenceId: string): Promise<GmailSequenceStep[]> {
        const { data, error } = await supabase
            .from('gmail_sequence_steps')
            .select('*')
            .eq('sequence_id', sequenceId)
            .order('step_number', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async saveSequenceSteps(sequenceId: string, steps: Partial<GmailSequenceStep>[]): Promise<void> {
        // First delete existing steps for this sequence to replace them
        await supabase.from('gmail_sequence_steps').delete().eq('sequence_id', sequenceId);

        if (steps.length === 0) return;

        const stepsToInsert = steps.map((step, index) => ({
            sequence_id: sequenceId,
            step_number: index + 1,
            subject_template: step.subject_template || '',
            body_template: step.body_template || '',
            delay_hours: step.delay_hours || 0,
        }));

        const { error } = await supabase.from('gmail_sequence_steps').insert(stepsToInsert);
        if (error) throw error;
    },

    async getAllOutreachLeads(): Promise<GmailOutreachLead[]> {
        const { data, error } = await supabase
            .from('gmail_outreach_leads')
            .select('*');
        if (error) throw error;
        return data || [];
    },

    async updateLeadStatus(leadId: string, newStatus: string): Promise<void> {
        const { error } = await supabase
            .from('gmail_outreach_leads')
            .update({ status: newStatus })
            .eq('id', leadId);
        if (error) throw error;
    },

    // Analytics
    async getAnalyticsStats(): Promise<{
        totalSent: number;
        totalReplied: number;
        activeAccounts: number;
        activeSequences: number;
    }> {
        // Very basic overview. You'd typically use COUNT queries.
        const [logsSent, logsReplies, accounts, sequences] = await Promise.all([
            supabase.from('gmail_logs').select('id', { count: 'exact', head: true }).eq('action_type', 'sent'),
            supabase.from('gmail_logs').select('id', { count: 'exact', head: true }).eq('action_type', 'reply'),
            supabase.from('gmail_accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('gmail_sequences').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        ]);

        return {
            totalSent: logsSent.count || 0,
            totalReplied: logsReplies.count || 0,
            activeAccounts: accounts.count || 0,
            activeSequences: sequences.count || 0
        };
    }
};

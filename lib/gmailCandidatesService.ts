import { supabase } from './supabase';

export interface GlobalEmailCandidate {
    candidate_id: string;
    source_platform: 'LinkedIn' | 'GitHub' | 'Upwork' | 'Fiverr';
    name: string;
    email: string;
    profile_url: string | null;
    current_role: string | null;
    created_at: string;
}

export const GmailCandidatesService = {
    /**
     * Get all unique candidates that have an email registered.
     */
    async getGlobalEmailCandidates(): Promise<GlobalEmailCandidate[]> {
        const { data, error } = await supabase
            .from('global_email_candidates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching global email candidates:', error);
            throw error;
        }

        return data as GlobalEmailCandidate[];
    },

    /**
     * Add selected candidates to a specific Gmail sequence.
     */
    async enrollCandidatesToSequence(
        sequenceId: string,
        candidates: GlobalEmailCandidate[]
    ): Promise<{ success: number; failed: number }> {
        // We'll insert these into `gmail_outreach_leads`
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error('Not authenticated');

        const recordsToInsert = candidates.map(c => ({
            sequence_id: sequenceId,
            // we aren't using campaign_id strictly for this unified view yet, you could pass null or a dummy uuid
            campaign_id: '00000000-0000-0000-0000-000000000000',
            candidate_id: c.candidate_id,
            candidate_name: c.name,
            candidate_email: c.email,
            status: 'pending',
            current_step_number: 1, // Start at step 1
            scheduled_for: new Date().toISOString() // Start now
        }));

        // Perform a bulk insert. Some might fail if they are already in the sequence (handled by unique constraint)
        const { data, error } = await supabase
            .from('gmail_outreach_leads')
            .insert(recordsToInsert)
            // returning helps us know exactly how many went in
            .select('id');

        if (error) {
            console.error('Error enrolling candidates:', error);
            throw error;
        }

        return {
            success: data?.length || 0,
            failed: candidates.length - (data?.length || 0)
        };
    }
};

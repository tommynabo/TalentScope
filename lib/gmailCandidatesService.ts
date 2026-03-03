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
     * First tries the global_email_candidates view.
     * Falls back to querying github_search_results directly if the view doesn't exist.
     */
    async getGlobalEmailCandidates(): Promise<GlobalEmailCandidate[]> {
        // 1. Try the unified view first
        const { data, error } = await supabase
            .from('global_email_candidates')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
            return data as GlobalEmailCandidate[];
        }

        // 2. If view fails or returns empty, build candidates from individual tables
        console.warn('[GmailCandidates] View returned empty or failed, querying tables directly...', error?.message);
        
        const results: GlobalEmailCandidate[] = [];

        // Query GitHub candidates directly from github_search_results
        try {
            const { data: ghData } = await supabase
                .from('github_search_results')
                .select('id, github_username, email, github_url, github_metrics, created_at')
                .order('created_at', { ascending: false });

            if (ghData) {
                for (const row of ghData) {
                    // Extract email from either the column or the JSONB metrics
                    const email = row.email || row.github_metrics?.mentioned_email;
                    if (email) {
                        results.push({
                            candidate_id: row.id,
                            source_platform: 'GitHub',
                            name: row.github_metrics?.name || row.github_username || 'Unknown',
                            email,
                            profile_url: row.github_url || null,
                            current_role: 'Developer',
                            created_at: row.created_at
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[GmailCandidates] Could not query github_search_results:', e);
        }

        // Query LinkedIn candidates directly
        try {
            const { data: liData } = await supabase
                .from('candidates')
                .select('id, full_name, email, linkedin_url, job_title, created_at')
                .not('email', 'is', null)
                .neq('email', '')
                .order('created_at', { ascending: false });

            if (liData) {
                for (const row of liData) {
                    results.push({
                        candidate_id: row.id,
                        source_platform: 'LinkedIn',
                        name: row.full_name || 'Unknown',
                        email: row.email,
                        profile_url: row.linkedin_url || null,
                        current_role: row.job_title || null,
                        created_at: row.created_at
                    });
                }
            }
        } catch (e) {
            console.warn('[GmailCandidates] Could not query candidates:', e);
        }

        // Query Marketplace candidates directly (Upwork/Fiverr)
        try {
            const { data: mpData } = await supabase
                .from('marketplace_candidates')
                .select('id, name, email, linkedin_url, platform, platform_data, added_at')
                .not('email', 'is', null)
                .neq('email', '')
                .order('added_at', { ascending: false });

            if (mpData) {
                for (const row of mpData) {
                    results.push({
                        candidate_id: row.id,
                        source_platform: row.platform || 'Upwork',
                        name: row.name || 'Unknown',
                        email: row.email,
                        profile_url: row.linkedin_url || row.platform_data?.profile_url || null,
                        current_role: 'Freelancer',
                        created_at: row.added_at
                    });
                }
            }
        } catch (e) {
            console.warn('[GmailCandidates] Could not query marketplace_candidates:', e);
        }

        // Sort by created_at descending
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return results;
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

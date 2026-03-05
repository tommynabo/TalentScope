import { supabase } from '../../lib/supabase';
import { CommunityCandidate } from '../types/community';

/**
 * Service to sync enriched community candidates to the global email candidates view
 * for use in Gmail outreach campaigns
 */
export const CommunityCandidateSyncService = {
    /**
     * Add a newly enriched community candidate to the Gmail outreach system
     * (they will appear automatically in buzones > candidatos)
     */
    async syncToGmailCandidates(candidate: CommunityCandidate): Promise<boolean> {
        if (!candidate.email || !candidate.campaignId) {
            console.warn('[CommunitySyncService] Candidate missing email or campaignId, skipping sync.');
            return false;
        }

        try {
            // The candidate already exists in community_candidates table
            // The global_email_candidates view will automatically pick them up
            // since they now have an email address
            
            console.log(`[CommunitySyncService] Candidate ${candidate.username} is now available in global_email_candidates view`);
            
            // Optionally verify the candidate appears in the view
            const { data: viewData, error: viewError } = await supabase
                .from('global_email_candidates')
                .select('candidate_id, name, email, source_platform')
                .eq('candidate_id', candidate.id)
                .single();

            if (viewError) {
                console.warn(`[CommunitySyncService] Could not verify candidate in view:`, viewError);
                return false;
            }

            if (viewData) {
                console.log(`[CommunitySyncService] ✅ Candidate synced successfully:`, viewData);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[CommunitySyncService] Error syncing candidate:', error);
            throw error;
        }
    },

    /**
     * Bulk sync multiple enriched community candidates
     * Returns count of successfully synced candidates
     */
    async bulkSyncToGmailCandidates(candidates: CommunityCandidate[]): Promise<number> {
        let syncedCount = 0;

        for (const candidate of candidates) {
            try {
                const synced = await this.syncToGmailCandidates(candidate);
                if (synced) syncedCount++;
            } catch (error) {
                console.error(`[CommunitySyncService] Failed to sync ${candidate.username}:`, error);
            }
        }

        console.log(`[CommunitySyncService] Bulk sync completed: ${syncedCount}/${candidates.length} candidates synced`);
        return syncedCount;
    },

    /**
     * Get a candidate from global_email_candidates by their community ID
     * This checks if they are visible in the unified view
     */
    async getCandidateFromGlobalView(candidateId: string): Promise<any | null> {
        try {
            const { data, error } = await supabase
                .from('global_email_candidates')
                .select('*')
                .eq('candidate_id', candidateId)
                .single();

            if (error || !data) {
                console.warn(`[CommunitySyncService] Candidate ${candidateId} not visible in global view:`, error?.message);
                return null;
            }

            return data;
        } catch (error) {
            console.error('[CommunitySyncService] Error fetching from global view:', error);
            return null;
        }
    },

    /**
     * Direct addition to gmail_outreach_leads for immediate enrollment in campaigns
     * Used when you want to immediately add the extracted candidate to a sequence
     */
    async enrollToGmailSequence(
        candidate: CommunityCandidate,
        sequenceId: string
    ): Promise<boolean> {
        if (!candidate.email) {
            console.warn('[CommunitySyncService] Candidate missing email, cannot enroll to sequence.');
            return false;
        }

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('gmail_outreach_leads')
                .insert([
                    {
                        sequence_id: sequenceId,
                        campaign_id: candidate.campaignId || '00000000-0000-0000-0000-000000000000',
                        candidate_id: candidate.id,
                        candidate_name: candidate.displayName || candidate.username,
                        candidate_email: candidate.email,
                        status: 'pending',
                        current_step_number: 1,
                        scheduled_for: new Date().toISOString()
                    }
                ])
                .select('id');

            if (error) {
                console.error('[CommunitySyncService] Error enrolling to sequence:', error);
                return false;
            }

            console.log(`[CommunitySyncService] ✅ Candidate enrolled to sequence: ${data?.[0]?.id}`);
            return !!data?.[0];
        } catch (error) {
            console.error('[CommunitySyncService] Error in enrollToGmailSequence:', error);
            return false;
        }
    }
};

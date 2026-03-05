import { supabase } from '../../lib/supabase';
import { CommunityCandidate, CommunityPlatform } from '../types/community';

/**
 * CommunityCandidatePersistence
 * 
 * Persists community candidates in Supabase using the battle-tested
 * 3-level strategy from GitHub system:
 *   1. RPC function (bypasses PostgREST schema cache)
 *   2. Bulk upsert fallback
 *   3. Individual SELECT + INSERT/UPDATE fallback
 */
export const CommunityCandidatePersistence = {

    // ─── Build Record ────────────────────────────────────────────────────────

    _buildRecord(campaignId: string, userId: string, candidate: CommunityCandidate) {
        return {
            campaign_id: campaignId,
            user_id: userId,
            platform: candidate.platform,
            username: candidate.username,
            display_name: candidate.displayName || candidate.username,
            profile_url: candidate.profileUrl,
            avatar_url: candidate.avatarUrl || null,
            bio: candidate.bio || null,
            join_date: candidate.joinDate || null,
            last_active_date: candidate.lastActiveDate || null,
            message_count: candidate.messageCount || 0,
            helpfulness_score: candidate.helpfulnessScore || 0,
            questions_answered: candidate.questionsAnswered || 0,
            shared_code_snippets: candidate.sharedCodeSnippets || 0,
            project_links: candidate.projectLinks || [],
            repo_links: candidate.repoLinks || [],
            skills: candidate.skills || [],
            community_roles: candidate.communityRoles || [],
            reputation_score: candidate.reputationScore || 0,
            talent_score: candidate.talentScore || 0,
            score_breakdown: candidate.scoreBreakdown || null,
            detected_language: candidate.detectedLanguage || 'unknown',
            email: candidate.email || null,
            linkedin_url: candidate.linkedInUrl || null,
            github_url: candidate.githubUrl || null,
            github_username: candidate.githubUsername || null,
            personal_website: candidate.personalWebsite || null,
            community_name: candidate.communityName || null,
            community_id: candidate.communityId || null,
            ai_summary: candidate.aiSummary || null,
            analysis_projects: candidate.analysisProjects || null,
            analysis_psychological: candidate.analysisPsychological || null,
            analysis_business_moment: candidate.analysisBusinessMoment || null,
            analysis_sales_angle: candidate.analysisSalesAngle || null,
            outreach_icebreaker: candidate.outreachIcebreaker || null,
            outreach_pitch: candidate.outreachPitch || null,
            outreach_followup: candidate.outreachFollowup || null,
            scraped_at: candidate.scrapedAt || new Date().toISOString(),
        };
    },

    // ─── Level 1: Save via RPC ───────────────────────────────────────────────

    async _saveViaRPC(
        campaignId: string, userId: string, candidate: CommunityCandidate
    ): Promise<boolean> {
        try {
            const record = this._buildRecord(campaignId, userId, candidate);
            const { error } = await supabase.rpc('upsert_community_candidate', {
                p_data: record,
            });
            if (error) {
                console.warn(`[RPC] Failed for ${candidate.username}:`, error.message);
                return false;
            }
            return true;
        } catch (err: any) {
            console.warn(`[RPC] Exception for ${candidate.username}:`, err.message);
            return false;
        }
    },

    // ─── Level 3: Individual fallback ────────────────────────────────────────

    async _saveFallback(
        campaignId: string,
        userId: string,
        candidates: CommunityCandidate[]
    ): Promise<boolean> {
        let successCount = 0;

        for (const candidate of candidates) {
            try {
                const record = this._buildRecord(campaignId, userId, candidate);

                // Check if exists
                const { data: existing } = await supabase
                    .from('community_candidates')
                    .select('id')
                    .eq('campaign_id', campaignId)
                    .eq('username', candidate.username)
                    .eq('platform', candidate.platform)
                    .maybeSingle();

                if (existing) {
                    // UPDATE
                    const { error } = await supabase
                        .from('community_candidates')
                        .update(record)
                        .eq('id', existing.id);
                    if (!error) successCount++;
                } else {
                    // INSERT
                    const { error } = await supabase
                        .from('community_candidates')
                        .insert(record);
                    if (!error) successCount++;
                }
            } catch (err: any) {
                console.warn(`[FALLBACK] Error saving ${candidate.username}:`, err.message);
            }
        }

        console.log(`[FALLBACK] Saved ${successCount}/${candidates.length} candidates`);
        return successCount > 0;
    },

    // ─── Main save method ────────────────────────────────────────────────────

    async saveCandidates(
        campaignId: string,
        candidates: CommunityCandidate[],
        userId: string
    ): Promise<boolean> {
        if (!candidates || candidates.length === 0) return true;

        console.log(`💾 Saving ${candidates.length} community candidates to Supabase...`);

        // Ensure campaign exists
        await this._ensureCampaignExists(campaignId, candidates[0]?.communityName || 'Community Scan', userId);

        // Strategy 1: Try RPC for first candidate
        const rpcSuccess = await this._saveViaRPC(campaignId, userId, candidates[0]);

        if (rpcSuccess) {
            // RPC works — use it for all
            let saved = 1;
            for (let i = 1; i < candidates.length; i++) {
                const ok = await this._saveViaRPC(campaignId, userId, candidates[i]);
                if (ok) saved++;
            }
            console.log(`✅ [RPC] Saved ${saved}/${candidates.length} candidates`);
            return saved > 0;
        }

        // Strategy 2: Bulk upsert
        try {
            const records = candidates.map(c => this._buildRecord(campaignId, userId, c));
            const { error } = await supabase
                .from('community_candidates')
                .upsert(records, {
                    onConflict: 'campaign_id,username,platform',
                    ignoreDuplicates: false,
                });

            if (!error) {
                console.log(`✅ [BULK] Saved ${candidates.length} candidates`);
                return true;
            }
            console.warn(`[BULK] Failed:`, error.message);
        } catch (err: any) {
            console.warn(`[BULK] Exception:`, err.message);
        }

        // Strategy 3: Individual fallback
        return this._saveFallback(campaignId, userId, candidates);
    },

    // ─── Load candidates ────────────────────────────────────────────────────

    async getCampaignCandidates(
        campaignId: string,
        userId: string
    ): Promise<CommunityCandidate[]> {
        try {
            const { data, error } = await supabase
                .from('community_candidates')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .order('talent_score', { ascending: false });

            if (error) {
                console.error(`[LOAD] Error loading candidates:`, error.message);
                return [];
            }

            return (data || []).map(row => this._rowToCandidate(row));
        } catch (err: any) {
            console.error(`[LOAD] Exception:`, err.message);
            return [];
        }
    },

    // ─── Dedup helpers ──────────────────────────────────────────────────────

    async getExistingUsernames(campaignId: string, userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('community_candidates')
                .select('username, platform')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId);

            if (error || !data) return new Set();

            return new Set(data.map(r => `${r.platform}:${r.username}`.toLowerCase()));
        } catch {
            return new Set();
        }
    },

    async getExistingEmails(campaignId: string, userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('community_candidates')
                .select('email')
                .eq('campaign_id', campaignId)
                .eq('user_id', userId)
                .not('email', 'is', null);

            if (error || !data) return new Set();

            return new Set(data.map(r => r.email.toLowerCase()));
        } catch {
            return new Set();
        }
    },

    async getDeduplicationData(campaignId: string, userId: string) {
        const [usernames, emails] = await Promise.all([
            this.getExistingUsernames(campaignId, userId),
            this.getExistingEmails(campaignId, userId),
        ]);
        return { usernames, emails };
    },

    // ─── Global dedup (across ALL campaigns) ────────────────────────────────

    async getGlobalExistingUsernames(userId: string): Promise<Set<string>> {
        try {
            const { data, error } = await supabase
                .from('community_candidates')
                .select('username, platform')
                .eq('user_id', userId);

            if (error || !data) return new Set();

            return new Set(data.map(r => `${r.platform}:${r.username}`.toLowerCase()));
        } catch {
            return new Set();
        }
    },

    async getGlobalDeduplicationData(userId: string) {
        const [usernames, emails] = await Promise.all([
            this.getGlobalExistingUsernames(userId),
            this.getExistingEmails('', userId), // '' = global
        ]);
        return { usernames, emails };
    },

    // ─── Delete methods ─────────────────────────────────────────────────────

    async deleteCandidate(
        campaignId: string, username: string, platform: string, userId: string
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('community_candidates')
                .delete()
                .eq('campaign_id', campaignId)
                .eq('username', username)
                .eq('platform', platform)
                .eq('user_id', userId);

            return !error;
        } catch {
            return false;
        }
    },

    async countCandidates(campaignId: string, userId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('community_candidates')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaignId)
                .eq('user_id', userId);

            return error ? 0 : (count || 0);
        } catch {
            return 0;
        }
    },

    // ─── Campaign management ────────────────────────────────────────────────

    async _ensureCampaignExists(
        campaignId: string, campaignName: string, userId: string
    ): Promise<void> {
        try {
            const { data: existing } = await supabase
                .from('community_campaigns')
                .select('id')
                .eq('id', campaignId)
                .maybeSingle();

            if (!existing) {
                await supabase.from('community_campaigns').insert({
                    id: campaignId,
                    user_id: userId,
                    name: campaignName,
                    status: 'active',
                    created_at: new Date().toISOString(),
                });
            }
        } catch (err: any) {
            console.warn(`[CAMPAIGN] Could not ensure campaign exists:`, err.message);
        }
    },

    // ─── Row → Candidate mapper ─────────────────────────────────────────────

    _rowToCandidate(row: any): CommunityCandidate {
        return {
            id: row.id || '',
            username: row.username || '',
            displayName: row.display_name || row.username || '',
            platform: row.platform as CommunityPlatform,
            profileUrl: row.profile_url || '',
            avatarUrl: row.avatar_url,
            bio: row.bio,
            joinDate: row.join_date,
            lastActiveDate: row.last_active_date,
            messageCount: row.message_count || 0,
            helpfulnessScore: row.helpfulness_score || 0,
            questionsAnswered: row.questions_answered || 0,
            sharedCodeSnippets: row.shared_code_snippets || 0,
            projectLinks: row.project_links || [],
            repoLinks: row.repo_links || [],
            skills: row.skills || [],
            communityRoles: row.community_roles || [],
            reputationScore: row.reputation_score || 0,
            talentScore: row.talent_score || 0,
            scoreBreakdown: row.score_breakdown,
            detectedLanguage: row.detected_language || 'unknown',
            email: row.email,
            linkedInUrl: row.linkedin_url,
            githubUrl: row.github_url,
            githubUsername: row.github_username,
            personalWebsite: row.personal_website,
            communityName: row.community_name,
            communityId: row.community_id,
            aiSummary: row.ai_summary,
            analysisProjects: row.analysis_projects,
            analysisPsychological: row.analysis_psychological,
            analysisBusinessMoment: row.analysis_business_moment,
            analysisSalesAngle: row.analysis_sales_angle,
            outreachIcebreaker: row.outreach_icebreaker,
            outreachPitch: row.outreach_pitch,
            outreachFollowup: row.outreach_followup,
            scrapedAt: row.scraped_at || row.created_at || '',
        };
    },
};

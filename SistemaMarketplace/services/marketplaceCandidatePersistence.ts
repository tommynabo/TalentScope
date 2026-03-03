import { supabase } from '../../lib/supabase';
import { EnrichedCandidateInCampaign } from '../types/campaigns';

/**
 * MarketplaceCandidatePersistence
 * 
 * Persiste candidatos del marketplace (Upwork/Fiverr) en Supabase
 * para que aparezcan en Buzones > Candidatos (global_email_candidates view).
 * 
 * Patrón: misma estrategia de 3 niveles que githubCandidatePersistence:
 *   1. RPC function (evita cache PostgREST)
 *   2. Bulk upsert
 *   3. Individual SELECT + INSERT/UPDATE
 */
export const MarketplaceCandidatePersistence = {

    /**
     * Build record from EnrichedCandidateInCampaign
     */
    _buildRecord(campaignId: string, userId: string, platform: string, candidate: EnrichedCandidateInCampaign) {
        return {
            campaign_id: campaignId,
            user_id: userId,
            name: candidate.name,
            email: candidate.email,
            linkedin_url: candidate.linkedInUrl || null,
            platform: platform,
            hourly_rate: candidate.hourlyRate || 0,
            job_success_rate: candidate.jobSuccessRate || 0,
            talent_score: candidate.talentScore || 0,
            kanban_lane: candidate.kanbanLane || 'todo',
            platform_data: {
                candidateId: candidate.candidateId,
                profile_url: candidate.linkedInUrl || null,
                psychologicalProfile: candidate.psychologicalProfile || null,
                businessMoment: candidate.businessMoment || null,
                salesAngle: candidate.salesAngle || null,
                bottleneck: candidate.bottleneck || null,
                walead_messages: candidate.walead_messages || null,
            },
            notes: candidate.notes || null,
            updated_at: new Date().toISOString(),
        };
    },

    /**
     * Save via RPC function (most reliable)
     */
    async _saveViaRPC(campaignId: string, userId: string, platform: string, candidate: EnrichedCandidateInCampaign): Promise<boolean> {
        try {
            const record = this._buildRecord(campaignId, userId, platform, candidate);
            const { error } = await supabase.rpc('upsert_marketplace_candidate', {
                candidate_data: record
            });
            if (error) {
                console.warn(`[MarketplacePersistence:RPC] Failed for ${candidate.name}:`, error.message);
                return false;
            }
            return true;
        } catch (e) {
            console.warn(`[MarketplacePersistence:RPC] Exception for ${candidate.name}:`, e);
            return false;
        }
    },

    /**
     * Individual fallback: SELECT + INSERT/UPDATE
     */
    async _saveFallback(
        campaignId: string,
        userId: string,
        platform: string,
        candidates: EnrichedCandidateInCampaign[]
    ): Promise<boolean> {
        let allOk = true;
        for (const candidate of candidates) {
            try {
                const record = this._buildRecord(campaignId, userId, platform, candidate);

                const { data: existing } = await supabase
                    .from('marketplace_candidates')
                    .select('id')
                    .eq('campaign_id', campaignId)
                    .eq('name', candidate.name)
                    .maybeSingle();

                if (existing) {
                    const { error } = await supabase
                        .from('marketplace_candidates')
                        .update(record)
                        .eq('id', existing.id);
                    if (error) {
                        console.warn(`[MarketplacePersistence:fallback] update failed for ${candidate.name}:`, error.message);
                        allOk = false;
                    }
                } else {
                    const { error } = await supabase
                        .from('marketplace_candidates')
                        .insert(record);
                    if (error) {
                        console.warn(`[MarketplacePersistence:fallback] insert failed for ${candidate.name}:`, error.message);
                        allOk = false;
                    }
                }
            } catch (e) {
                console.warn(`[MarketplacePersistence:fallback] exception for ${candidate.name}:`, e);
                allOk = false;
            }
        }
        return allOk;
    },

    /**
     * Save marketplace candidates to Supabase
     * Also ensures the campaign exists in marketplace_campaigns table
     */
    async saveCandidates(
        campaignId: string,
        campaignName: string,
        platform: string,
        candidates: EnrichedCandidateInCampaign[],
        userId: string
    ): Promise<boolean> {
        try {
            if (candidates.length === 0) return true;

            // Ensure campaign exists in Supabase
            await this._ensureCampaignExists(campaignId, campaignName, platform, userId);

            // Deduplicate by name
            const seen = new Map<string, EnrichedCandidateInCampaign>();
            for (const c of candidates) {
                seen.set(c.name.toLowerCase().trim(), c);
            }
            const uniqueCandidates = Array.from(seen.values());

            // Strategy 1: RPC
            console.log(`[MarketplacePersistence] Saving ${uniqueCandidates.length} candidates via RPC...`);
            let rpcSuccess = 0;
            let rpcFailed = 0;
            let rpcAvailable = true;
            const rpcSuccessSet = new Set<string>();

            for (const candidate of uniqueCandidates) {
                const ok = await this._saveViaRPC(campaignId, userId, platform, candidate);
                if (ok) {
                    rpcSuccess++;
                    rpcSuccessSet.add(candidate.name.toLowerCase().trim());
                } else {
                    rpcFailed++;
                    if (rpcSuccess === 0 && rpcFailed === 1) {
                        console.warn('[MarketplacePersistence] RPC not available, switching to fallback...');
                        rpcAvailable = false;
                        break;
                    }
                }
            }

            if (rpcAvailable && rpcFailed === 0) {
                console.log(`[MarketplacePersistence] ✅ All ${rpcSuccess} candidates saved via RPC`);
                return true;
            }

            // Strategy 2: Bulk upsert
            const candidatesForFallback = rpcAvailable
                ? uniqueCandidates.filter(c => !rpcSuccessSet.has(c.name.toLowerCase().trim()))
                : uniqueCandidates;

            if (candidatesForFallback.length > 0) {
                const records = candidatesForFallback.map(c => this._buildRecord(campaignId, userId, platform, c));
                const { error } = await supabase
                    .from('marketplace_candidates')
                    .upsert(records, {
                        onConflict: 'campaign_id,name',
                        ignoreDuplicates: false
                    });

                if (!error) {
                    console.log(`[MarketplacePersistence] ✅ ${candidatesForFallback.length} candidates saved via bulk upsert`);
                    return true;
                }
                console.warn('[MarketplacePersistence] Bulk upsert failed:', error.message);

                // Strategy 3: Individual fallback
                console.warn(`[MarketplacePersistence] Using individual fallback for ${candidatesForFallback.length} candidates...`);
                return await this._saveFallback(campaignId, userId, platform, candidatesForFallback);
            }

            return rpcSuccess > 0;
        } catch (err) {
            console.error('[MarketplacePersistence] Error:', err);
            return false;
        }
    },

    /**
     * Ensure the marketplace campaign exists in Supabase
     */
    async _ensureCampaignExists(
        campaignId: string,
        campaignName: string,
        platform: string,
        userId: string
    ): Promise<void> {
        try {
            const { data: existing } = await supabase
                .from('marketplace_campaigns')
                .select('id')
                .eq('id', campaignId)
                .maybeSingle();

            if (!existing) {
                const { error } = await supabase
                    .from('marketplace_campaigns')
                    .insert({
                        id: campaignId,
                        name: campaignName,
                        platform: platform,
                        user_id: userId,
                        status: 'active',
                        search_terms: {},
                    });

                if (error) {
                    console.warn('[MarketplacePersistence] Could not create campaign in Supabase:', error.message);
                } else {
                    console.log(`[MarketplacePersistence] ✅ Campaign synced to Supabase: ${campaignName}`);
                }
            }
        } catch (e) {
            console.warn('[MarketplacePersistence] Campaign sync error:', e);
        }
    },
};

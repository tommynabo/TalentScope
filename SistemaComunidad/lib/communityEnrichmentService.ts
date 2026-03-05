import { supabase } from '../../lib/supabase';
import { CommunityCandidate } from '../types/community';
import { ContactResearchService } from '../../SistemaMarketplace/services/contactResearchService';
import { ScrapedCandidate } from '../../SistemaMarketplace/types/marketplace';

export const CommunityEnrichmentService = {
    /**
     * Enriches a community candidate by searching for their LinkedIn profile and email addresses
     * using the existing OSINT logic from the Marketplace system.
     */
    async enrichCandidate(candidate: CommunityCandidate): Promise<Partial<CommunityCandidate>> {
        console.log(`[CommunityEnrichment] Starting enrichment for ${candidate.username}...`);

        const apifyApiKey = import.meta.env.VITE_APIFY_API_KEY;
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

        if (!apifyApiKey) {
            console.warn('[CommunityEnrichment] Missing Apify API Key, cannot perform OSINT search.');
            throw new Error('Missing Apify API Key.');
        }

        // Initialize the research service from Marketplace
        const researchService = new ContactResearchService(apifyApiKey, openaiApiKey || '');

        // Map CommunityCandidate to ScrapedCandidate format expected by the service
        const mappedCandidate: ScrapedCandidate = {
            id: candidate.id || '',
            name: candidate.displayName || candidate.username,
            title: candidate.skills?.[0] || 'Developer',
            country: 'Global', // Usually we don't have this in communities unless inferred
            hourlyRate: 0,
            jobSuccessRate: 100,
            profileUrl: candidate.profileUrl || '',
            avatarUrl: candidate.avatarUrl || '',
            bio: candidate.bio || '',
            platform: 'Upwork', // Mocked to bypass type errors, not deeply used in email logic
            platformData: {}
        };

        try {
            // 1. Find LinkedIn
            console.log('[CommunityEnrichment] Searching for LinkedIn...');
            const linkedInResult = await researchService.findLinkedInProfile(mappedCandidate);

            // 2. Find Emails
            console.log('[CommunityEnrichment] Searching for Emails...');
            const portfolioStr = candidate.personalWebsite || candidate.projectLinks?.[0] || null;
            const emailResult = await researchService.findEmailAddresses(mappedCandidate, portfolioStr);

            const updates: Partial<CommunityCandidate> = {};
            let hasNewData = false;

            if (linkedInResult.linkedInUrl && !candidate.linkedInUrl) {
                updates.linkedInUrl = linkedInResult.linkedInUrl;
                hasNewData = true;
            }

            if (emailResult.emails.length > 0 && !candidate.email) {
                updates.email = emailResult.emails[0]; // Take the highest confidence email
                hasNewData = true;
            }

            // 3. Update DB if new data was found
            if (hasNewData && candidate.campaignId) {
                console.log(`[CommunityEnrichment] Saving new data to DB for ${candidate.username}...`, updates);
                const { error } = await supabase
                    .from('community_candidates')
                    .update({
                        email: updates.email || candidate.email,
                        linkedin_url: updates.linkedInUrl || candidate.linkedInUrl
                    })
                    .eq('campaign_id', candidate.campaignId)
                    .eq('username', candidate.username)
                    .eq('platform', candidate.platform);

                if (error) {
                    console.error('[CommunityEnrichment] Error saving enriched data:', error);
                    throw error;
                }
            } else if (!hasNewData) {
                console.log(`[CommunityEnrichment] No new data found for ${candidate.username}.`);
            }

            return updates;

        } catch (error) {
            console.error(`[CommunityEnrichment] Failed to enrich ${candidate.username}:`, error);
            throw error;
        }
    }
};

import { supabase } from '../../lib/supabase';
import { CommunityCandidate } from '../types/community';
import { ContactResearchService } from '../../SistemaMarketplace/services/contactResearchService';
import { ScrapedCandidate } from '../../SistemaMarketplace/types/marketplace';

// ─── Email Validation ─────────────────────────────────────────────────────────
// Reject placeholder, template, and obviously fake emails

const FAKE_EMAIL_PATTERNS = [
    /^your@/i,
    /^(user|test|example|sample|demo|noreply|no-reply|info|admin|mail|email|contact|hello|hi|name|firstname|lastname)@/i,
    /@(example|test|domain|email|placeholder|fake|dummy|sample|mailtest)\./i,
    /\.(test|invalid|example|localhost)$/i,
    /^[a-z]+@[a-z]+\.(com|net|org)$/i, // Too generic: abc@xyz.com with no real specificity
];

const FAKE_EMAIL_EXACT = new Set([
    'your@email.com',
    'user@example.com',
    'test@test.com',
    'email@example.com',
    'name@domain.com',
    'admin@admin.com',
    'info@info.com',
    'hello@hello.com',
]);

function isRealEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const normalized = email.trim().toLowerCase();
    
    // Must contain exactly one @ and have valid structure
    const parts = normalized.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    
    // Domain must have at least one dot
    if (!parts[1].includes('.')) return false;
    
    // Reject known fakes
    if (FAKE_EMAIL_EXACT.has(normalized)) return false;
    
    // Reject pattern-matched placeholders
    if (FAKE_EMAIL_PATTERNS.some(rx => rx.test(normalized))) return false;
    
    // Local part must be at least 2 chars and not look like a template
    if (parts[0].length < 2) return false;
    
    // Reject if looks like bracket placeholders: {email}, [email], <email>
    if (/[{}\[\]<>]/.test(normalized)) return false;
    
    return true;
}

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

            // Filter out placeholder / fake emails before accepting
            const realEmails = emailResult.emails.filter(isRealEmail);
            if (realEmails.length > 0 && !candidate.email) {
                updates.email = realEmails[0]; // Take the highest confidence real email
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

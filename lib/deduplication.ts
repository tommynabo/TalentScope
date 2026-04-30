
import { supabase } from './supabase';
import { Candidate } from '../types/database';
import { normalizeLinkedInUrl } from './normalization';

export class DeduplicationService {
    private normalizeUrl(url: string | null): string {
        if (!url) return '';
        // Use the shared normalization utility to handle regional subdomains
        // (es.linkedin.com, fr.linkedin.com, etc.) before stripping for comparison
        const canonical = normalizeLinkedInUrl(url);
        return canonical
            .toLowerCase()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .trim();
    }

    async fetchExistingCandidates(): Promise<{
        existingEmails: Set<string>;
        existingLinkedin: Set<string>;
    }> {
        const existingEmails = new Set<string>();
        const existingLinkedin = new Set<string>();

        try {
            // Paginate in batches of 1000 to bypass Supabase PostgREST default row limit
            const PAGE_SIZE = 1000;
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('candidates')
                    .select('email, linkedin_url')
                    .range(from, from + PAGE_SIZE - 1);

                if (error) {
                    console.error("[DEDUP] Error fetching existing candidates:", error);
                    break;
                }

                if (!data || data.length === 0) {
                    hasMore = false;
                    break;
                }

                data.forEach((c: any) => {
                    if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                    if (c.linkedin_url) existingLinkedin.add(this.normalizeUrl(c.linkedin_url));
                });

                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                }
            }

            return { existingEmails, existingLinkedin };
        } catch (e) {
            console.error("[DEDUP] Failed to fetch existing candidates", e);
            return { existingEmails, existingLinkedin };
        }
    }

    /**
     * Loads only the candidates already linked to a specific campaign.
     * This is the correct scope for LinkedIn dedup: prevents adding the same
     * person twice to one campaign while allowing the same profile to appear
     * in a different campaign.
     */
    async fetchCampaignCandidates(campaignId: string): Promise<{
        existingEmails: Set<string>;
        existingLinkedin: Set<string>;
    }> {
        const existingEmails = new Set<string>();
        const existingLinkedin = new Set<string>();

        try {
            const PAGE_SIZE = 1000;
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('campaign_candidates')
                    .select('candidates(email, linkedin_url)')
                    .eq('campaign_id', campaignId)
                    .range(from, from + PAGE_SIZE - 1);

                if (error) {
                    console.error("[DEDUP] Error fetching campaign candidates:", error);
                    break;
                }

                if (!data || data.length === 0) {
                    hasMore = false;
                    break;
                }

                data.forEach((row: any) => {
                    const c = row.candidates;
                    if (!c) return;
                    if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                    if (c.linkedin_url) existingLinkedin.add(this.normalizeUrl(c.linkedin_url));
                });

                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                }
            }

            return { existingEmails, existingLinkedin };
        } catch (e) {
            console.error("[DEDUP] Failed to fetch campaign candidates", e);
            return { existingEmails, existingLinkedin };
        }
    }

    isDuplicate(
        candidate: Partial<Candidate>,
        existingEmails: Set<string>,
        existingLinkedin: Set<string>
    ): boolean {
        if (candidate.email && existingEmails.has(candidate.email.toLowerCase().trim())) {
            return true;
        }
        if (candidate.linkedin_url) {
            const norm = this.normalizeUrl(candidate.linkedin_url);
            if (existingLinkedin.has(norm)) return true;
        }
        return false;
    }
}

export const deduplicationService = new DeduplicationService();

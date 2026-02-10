
import { supabase } from './supabase';
import { Candidate } from '../types/database';

export class DeduplicationService {
    private normalizeUrl(url: string | null): string {
        if (!url) return '';
        return url
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
            const { data, error } = await supabase
                .from('candidates')
                .select('email, linkedin_url');

            if (error) {
                console.error("[DEDUP] Error fetching existing candidates:", error);
                return { existingEmails, existingLinkedin };
            }

            data?.forEach((c: any) => {
                if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                if (c.linkedin_url) existingLinkedin.add(this.normalizeUrl(c.linkedin_url));
            });

            return { existingEmails, existingLinkedin };
        } catch (e) {
            console.error("[DEDUP] Failed to fetch existing candidates", e);
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

import { CommunityCandidate } from '../types/community';

/**
 * CommunityDeduplicationService
 * 
 * Handles duplicate detection across multiple community scans and platforms.
 * Based on SistemaMarketplace/services/marketplaceDeduplicationService.ts
 * with improvements for cross-platform detection.
 * 
 * Dedup strategies:
 * - URL-based (primary, most reliable)
 * - Username-based (platform-specific)
 * - Email-based (if enriched)
 * - Fuzzy name matching (Levenshtein distance, fallback)
 * - Cross-platform: same person on Discord + Reddit
 */
export class CommunityDeduplicationService {
    private existingUrls = new Set<string>();
    private existingUsernames = new Set<string>(); // platform:username format
    private existingEmails = new Set<string>();
    private existingNames = new Map<string, string[]>(); // normalized name → original names

    /**
     * Initialize from previously discovered candidates in Supabase
     */
    async initializeFromDatabase(campaignId: string): Promise<void> {
        // TODO: Load from Supabase community_candidates table
        // For now, clear and start fresh
        this.existingUrls.clear();
        this.existingUsernames.clear();
        this.existingEmails.clear();
        this.existingNames.clear();
    }

    /**
     * Initialize from an existing array of candidates (e.g. loaded from localStorage)
     */
    registerCandidates(candidates: CommunityCandidate[]): void {
        console.log(`🔄 Initializing community dedup with ${candidates.length} existing candidates...`);
        candidates.forEach(c => this.registerCandidate(c));
        console.log(`✅ Community dedup service initialized`);
    }

    /**
     * Check if a candidate is a duplicate
     */
    isDuplicate(candidate: CommunityCandidate): boolean {
        // 1. URL check (most reliable)
        if (candidate.profileUrl && this.existingUrls.has(this.normalizeUrl(candidate.profileUrl))) {
            return true;
        }

        // 2. Platform+Username check (platform-scoped)
        const platformKey = this.getPlatformUsernameKey(candidate);
        if (platformKey && this.existingUsernames.has(platformKey)) {
            return true;
        }

        // 3. Email check (cross-platform)
        if (candidate.email && this.existingEmails.has(candidate.email.toLowerCase())) {
            return true;
        }

        // 4. GitHub username cross-link (same person on Discord and Reddit)
        if (candidate.githubUsername) {
            const ghKey = `github:${candidate.githubUsername.toLowerCase()}`;
            if (this.existingUsernames.has(ghKey)) {
                return true;
            }
        }

        // 5. Fuzzy name match (only if other checks fail)
        if (candidate.displayName && this.isFuzzyDuplicate(candidate)) {
            return true;
        }

        return false;
    }

    /**
     * Register a candidate as processed
     */
    registerCandidate(candidate: CommunityCandidate): void {
        // URL
        if (candidate.profileUrl) {
            this.existingUrls.add(this.normalizeUrl(candidate.profileUrl));
        }

        // Platform+Username
        const platformKey = this.getPlatformUsernameKey(candidate);
        if (platformKey) {
            this.existingUsernames.add(platformKey);
        }

        // Email
        if (candidate.email) {
            this.existingEmails.add(candidate.email.toLowerCase());
        }

        // GitHub username (for cross-platform matching)
        if (candidate.githubUsername) {
            this.existingUsernames.add(`github:${candidate.githubUsername.toLowerCase()}`);
        }

        // Fuzzy name cache
        if (candidate.displayName) {
            const normalized = this.normalizeName(candidate.displayName);
            const existing = this.existingNames.get(normalized) || [];
            existing.push(candidate.displayName);
            this.existingNames.set(normalized, existing);
        }
    }

    /**
     * Filter out duplicates from a candidate list
     */
    filterDuplicates(candidates: CommunityCandidate[]): CommunityCandidate[] {
        return candidates.filter(c => !this.isDuplicate(c));
    }

    /**
     * Deduplicate an array (keeps first occurrence)
     */
    deduplicateArray(candidates: CommunityCandidate[]): CommunityCandidate[] {
        const seen = new Set<string>();
        const deduped: CommunityCandidate[] = [];

        for (const candidate of candidates) {
            const key = this.getCandidateKey(candidate);

            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(candidate);
            }
        }

        return deduped;
    }

    /**
     * Get dedup stats
     */
    getStats(): {
        urls: number;
        usernames: number;
        emails: number;
        names: number;
    } {
        return {
            urls: this.existingUrls.size,
            usernames: this.existingUsernames.size,
            emails: this.existingEmails.size,
            names: this.existingNames.size,
        };
    }

    /**
     * Clear all cached data
     */
    clear(): void {
        this.existingUrls.clear();
        this.existingUsernames.clear();
        this.existingEmails.clear();
        this.existingNames.clear();
    }

    // ─── Private Helpers ────────────────────────────────────────────────────

    private getPlatformUsernameKey(candidate: CommunityCandidate): string | null {
        if (!candidate.username || !candidate.platform) return null;
        return `${candidate.platform.toLowerCase()}:${candidate.username.toLowerCase()}`;
    }

    private getCandidateKey(candidate: CommunityCandidate): string {
        // Priority: URL > Platform:Username > Email > Normalized Name
        if (candidate.profileUrl) {
            return `url:${this.normalizeUrl(candidate.profileUrl)}`;
        }
        const platformKey = this.getPlatformUsernameKey(candidate);
        if (platformKey) {
            return platformKey;
        }
        if (candidate.email) {
            return `email:${candidate.email.toLowerCase()}`;
        }
        return `name:${this.normalizeName(candidate.displayName || candidate.username)}`;
    }

    private normalizeUrl(url: string): string {
        try {
            const parsed = new URL(url);
            let normalized = parsed.hostname || '';
            if (normalized.startsWith('www.')) {
                normalized = normalized.slice(4);
            }
            normalized += parsed.pathname;
            return normalized.toLowerCase().replace(/\/$/, '');
        } catch {
            return url.toLowerCase();
        }
    }

    private normalizeName(name: string): string {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '')  // Remove special chars
            .replace(/\s+/g, ' ')     // Normalize spaces
            .slice(0, 50);            // Limit length
    }

    private isFuzzyDuplicate(candidate: CommunityCandidate): boolean {
        if (!candidate.displayName) return false;

        const normalized = this.normalizeName(candidate.displayName);

        // Check exact normalized match
        if (this.existingNames.has(normalized)) {
            const existing = this.existingNames.get(normalized) || [];
            for (const existingName of existing) {
                if (this.levenshteinSimilarity(candidate.displayName, existingName) > 0.85) {
                    return true;
                }
            }
        }

        // Check all stored names for high similarity
        for (const [, names] of this.existingNames) {
            for (const existingName of names) {
                if (this.levenshteinSimilarity(candidate.displayName, existingName) > 0.90) {
                    return true;
                }
            }
        }

        return false;
    }

    private levenshteinSimilarity(str1: string, str2: string): number {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        const maxLen = Math.max(s1.length, s2.length);
        if (maxLen === 0) return 1.0;
        const distance = this.levenshteinDistance(s1, s2);
        return 1 - distance / maxLen;
    }

    private levenshteinDistance(s1: string, s2: string): number {
        const track = Array(s2.length + 1)
            .fill(null)
            .map(() => Array(s1.length + 1).fill(0));

        for (let i = 0; i <= s1.length; i++) track[0][i] = i;
        for (let j = 0; j <= s2.length; j++) track[j][0] = j;

        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1,
                    track[j - 1][i] + 1,
                    track[j - 1][i - 1] + indicator
                );
            }
        }

        return track[s2.length][s1.length];
    }
}

// Singleton instance
export const communityDedupService = new CommunityDeduplicationService();

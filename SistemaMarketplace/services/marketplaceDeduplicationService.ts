import { ScrapedCandidate } from '../types/marketplace';

/**
 * MarketplaceDeduplicationService
 * 
 * Handles duplicate detection across multiple runs and platforms
 * - URL-based dedup (primary)
 * - Username-based dedup
 * - Fuzzy name matching (fallback)
 * - Cross-platform detection
 */

export class MarketplaceDeduplicationService {
  private existingUrls = new Set<string>();
  private existingUsernames = new Set<string>();
  private existingEmails = new Set<string>();
  private existingNames = new Map<string, string[]>(); // fuzzy match cache

  /**
   * Initialize from previously scraped candidates
   */
  async initializeFromDatabase(campaignId: string): Promise<void> {
    // TODO: Load from Supabase if available
    // For now, start fresh
    this.existingUrls.clear();
    this.existingUsernames.clear();
    this.existingEmails.clear();
    this.existingNames.clear();
  }

  /**
   * Check if candidate is a duplicate
   */
  isDuplicate(candidate: ScrapedCandidate): boolean {
    // 1. URL check (most reliable)
    if (this.existingUrls.has(this.normalizeUrl(candidate.profileUrl))) {
      return true;
    }

    // 2. Username check
    if (candidate.platformUsername && this.existingUsernames.has(candidate.platformUsername.toLowerCase())) {
      return true;
    }

    // 3. Email check (if available)
    if (candidate.email && this.existingEmails.has(candidate.email.toLowerCase())) {
      return true;
    }

    // 4. Fuzzy name match (complex check - only if above fail)
    if (this.isFuzzyDuplicate(candidate)) {
      return true;
    }

    return false;
  }

  /**
   * Register candidate as processed
   */
  registerCandidate(candidate: ScrapedCandidate): void {
    this.existingUrls.add(this.normalizeUrl(candidate.profileUrl));

    if (candidate.platformUsername) {
      this.existingUsernames.add(candidate.platformUsername.toLowerCase());
    }

    if (candidate.email) {
      this.existingEmails.add(candidate.email.toLowerCase());
    }

    // Add to fuzzy cache
    const normalized = this.normalizeName(candidate.name);
    this.existingNames.set(normalized, [
      ...(this.existingNames.get(normalized) || []),
      candidate.name,
    ]);
  }

  /**
   * Register multiple candidates at once (for initializing from existing campaign)
   */
  registerCandidates(candidates: ScrapedCandidate[]): void {
    console.log(`🔄 Initializing dedup service with ${candidates.length} existing candidates...`);
    candidates.forEach(candidate => this.registerCandidate(candidate));
    console.log(`✅ Dedup service initialized`);
  }

  /**
   * Deduplicate an array of candidates
   * Returns only unique candidates (keeps first occurrence)
   */
  deduplicateArray(candidates: ScrapedCandidate[]): ScrapedCandidate[] {
    const seen = new Set<string>();
    const deduped: ScrapedCandidate[] = [];

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
   * Filter out duplicates from a list against this set
   */
  filterDuplicates(candidates: ScrapedCandidate[]): ScrapedCandidate[] {
    return candidates.filter(c => !this.isDuplicate(c));
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────

  private getCandidateKey(candidate: ScrapedCandidate): string {
    // Priority: URL > Username > Email > Normalized Name
    if (candidate.profileUrl) {
      return `url:${this.normalizeUrl(candidate.profileUrl)}`;
    }
    if (candidate.platformUsername) {
      return `user:${candidate.platformUsername.toLowerCase()}`;
    }
    if (candidate.email) {
      return `email:${candidate.email.toLowerCase()}`;
    }
    return `name:${this.normalizeName(candidate.name)}`;
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove protocol and www
      let normalized = parsed.hostname || '';
      if (normalized.startsWith('www.')) {
        normalized = normalized.slice(4);
      }
      // Add pathname
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
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .slice(0, 50); // Limit length
  }

  private isFuzzyDuplicate(candidate: ScrapedCandidate): boolean {
    const normalized = this.normalizeName(candidate.name);

    // Check if normalized name exists in cache
    if (this.existingNames.has(normalized)) {
      // Check Levenshtein distance (very similar names)
      const existing = this.existingNames.get(normalized) || [];
      for (const existingName of existing) {
        if (this.levenshteinSimilarity(candidate.name, existingName) > 0.85) {
          return true;
        }
      }
    }

    // Also check if any stored name is similar to this one
    for (const [, names] of this.existingNames) {
      for (const existingName of names) {
        if (this.levenshteinSimilarity(candidate.name, existingName) > 0.90) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Levenshtein distance-based similarity (0-1)
   * Higher = more similar
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const maxLen = Math.max(s1.length, s2.length);

    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(s1, s2);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const track = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(0));

    for (let i = 0; i <= s1.length; i += 1) {
      track[0][i] = i;
    }

    for (let j = 0; j <= s2.length; j += 1) {
      track[j][0] = j;
    }

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return track[s2.length][s1.length];
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
   * Clear all data
   */
  clear(): void {
    this.existingUrls.clear();
    this.existingUsernames.clear();
    this.existingEmails.clear();
    this.existingNames.clear();
  }
}

// Singleton instance
export const dedupService = new MarketplaceDeduplicationService();

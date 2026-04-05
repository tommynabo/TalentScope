import { supabase } from '../supabase';

/**
 * SharedDeduplicationService
 *
 * Single source of truth for duplicate detection across ALL modules
 * (LinkedIn, GitHub, Marketplace, Community).
 *
 * Strategy (checked in order, most reliable first):
 *  1. Profile URL / LinkedIn URL (normalised, no trailing slash)
 *  2. Email address (lower-cased)
 *  3. Platform-scoped username  → `platform:username`
 *
 * Usage:
 *   const dedup = new SharedDeduplicationService();
 *   await dedup.loadFromDatabase({ table: 'candidates', campaignId });
 *   if (dedup.isDuplicate({ email, profileUrl })) continue;
 *   dedup.register({ email, profileUrl });
 */

export interface DeduplicationKey {
    /** The profile's canonical URL (LinkedIn, GitHub profile, etc.) */
    profileUrl?: string | null;
    /** Email address, if known */
    email?: string | null;
    /**
     * Platform-scoped username string already formatted as `platform:username`
     * e.g. `"github:torvalds"` or `"discord:user#1234"`
     */
    platformKey?: string | null;
}

export interface LoadOptions {
    /**
     * Supabase table to query.
     * The table must expose at least `email` and one of:
     *   `linkedin_url` | `profile_url` | `github_url`
     */
    table: 'candidates' | 'github_candidates' | 'marketplace_candidates' | 'community_candidates';
    /** When provided, restricts the load to a specific campaign */
    campaignId?: string;
    /**
     * Extra columns to select in addition to the dedup keys.
     * Useful when the table uses non-standard column names.
     */
    extraColumns?: string;
    /**
     * Custom URL column name (defaults vary per table).
     * Pass `null` to skip URL deduplication for this table.
     */
    urlColumn?: string | null;
    /**
     * Custom username column name. Pass `null` to skip username dedup.
     */
    usernameColumn?: string | null;
    /**
     * Platform prefix for username keys when loading from DB
     * e.g. `"github"` → key becomes `"github:<username>"`
     */
    platformPrefix?: string;
}

const PAGE_SIZE = 1000;

export class SharedDeduplicationService {
    private urls      = new Set<string>();
    private emails    = new Set<string>();
    private platforms = new Set<string>(); // "platform:username"

    // ─── Private helpers ─────────────────────────────────────────────────────

    private normalizeUrl(raw: string): string {
        return raw
            .toLowerCase()
            // Strip regional subdomains: es.linkedin.com → linkedin.com
            .replace(/^https?:\/\//i, '')
            .replace(/^[a-z]{2}\./, '')   // e.g. es., fr., pt.
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .trim();
    }

    private normalizeEmail(raw: string): string {
        return raw.toLowerCase().trim();
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /** Load existing records from a Supabase table to pre-populate known keys. */
    async loadFromDatabase(opts: LoadOptions): Promise<void> {
        const {
            table,
            campaignId,
            urlColumn   = table === 'candidates'            ? 'linkedin_url'
                        : table === 'github_candidates'     ? 'github_url'
                        : table === 'marketplace_candidates'? 'profile_url'
                        : 'profile_url',        // community_candidates
            usernameColumn = table === 'github_candidates'      ? 'github_username'
                           : table === 'marketplace_candidates' ? 'platform_username'
                           : table === 'community_candidates'   ? 'username'
                           : null,
            platformPrefix = '',
        } = opts;

        const columns = ['email', urlColumn, usernameColumn]
            .filter(Boolean)
            .join(', ');

        let from = 0;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from(table as any)
                .select(columns)
                .range(from, from + PAGE_SIZE - 1);

            if (campaignId) {
                query = query.eq('campaign_id', campaignId) as any;
            }

            const { data, error } = await query;

            if (error) {
                console.warn(`[DEDUP] loadFromDatabase(${table}) error:`, error.message);
                break;
            }

            if (!data || data.length === 0) { hasMore = false; break; }

            for (const row of data as any[]) {
                if (row.email)                this.emails.add(this.normalizeEmail(row.email));
                if (urlColumn && row[urlColumn])      this.urls.add(this.normalizeUrl(row[urlColumn]));
                if (usernameColumn && row[usernameColumn]) {
                    const key = platformPrefix
                        ? `${platformPrefix}:${row[usernameColumn].toLowerCase()}`
                        : row[usernameColumn].toLowerCase();
                    this.platforms.add(key);
                }
            }

            hasMore = data.length === PAGE_SIZE;
            from += PAGE_SIZE;
        }

        console.log(
            `[DEDUP] Loaded ${this.urls.size} URLs, ` +
            `${this.emails.size} emails, ` +
            `${this.platforms.size} platform keys from "${table}".`
        );
    }

    /**
     * Check whether a candidate is already known.
     * Returns `true` as soon as ANY field matches.
     */
    isDuplicate(keys: DeduplicationKey): boolean {
        if (keys.profileUrl && this.urls.has(this.normalizeUrl(keys.profileUrl))) return true;
        if (keys.email      && this.emails.has(this.normalizeEmail(keys.email)))    return true;
        if (keys.platformKey && this.platforms.has(keys.platformKey.toLowerCase())) return true;
        return false;
    }

    /**
     * Register a candidate so they are not flagged as duplicates
     * within the same search session.
     */
    register(keys: DeduplicationKey): void {
        if (keys.profileUrl) this.urls.add(this.normalizeUrl(keys.profileUrl));
        if (keys.email)      this.emails.add(this.normalizeEmail(keys.email));
        if (keys.platformKey) this.platforms.add(keys.platformKey.toLowerCase());
    }

    /** Remove all in-memory state. */
    reset(): void {
        this.urls.clear();
        this.emails.clear();
        this.platforms.clear();
    }

    // ─── Convenience stats ───────────────────────────────────────────────────

    get stats() {
        return {
            urls:      this.urls.size,
            emails:    this.emails.size,
            platforms: this.platforms.size,
        };
    }
}

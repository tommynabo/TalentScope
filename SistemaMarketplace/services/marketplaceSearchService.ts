import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';
import { MarketplaceScoringService } from './marketplaceScoringService';

/**
 * MarketplaceSearchService v3 - REWRITE
 * 
 * Pattern: SIMPLIFIED & ROBUST extraction
 * - No complex pageFunction strings
 * - Direct API usage when available
 * - Fallback to simple HTML extraction
 * - Strong deduplication (integrated)
 * - Lenient validation (fix issues downstream, not at extraction)
 * - TalentScore calculation integrated
 */

type RawActorResult = Record<string, any>;

export class MarketplaceSearchService {
  private apiKey: string;
  private baseUrl = 'https://api.apify.com/v2';

  constructor(apiKey: string) {
    if (!apiKey) {
      console.error('❌ MarketplaceSearchService: No API key provided');
    }
    this.apiKey = apiKey;
  }

  /**
   * Normalize URLs for consistent comparison
   * Handles various domain formats and protocols
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';
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
      return url.toLowerCase().trim();
    }
  }

  /**
   * CORE EXTRACTION: Get raw items from Apify actor dataset
   * Returns the EXACT items from dataset without interpretation
   */
  private async getActorDataset(
    actorId: string,
    input: Record<string, any>,
    timeoutSec: number = 300
  ): Promise<RawActorResult[]> {
    const encodedActorId = this.encodeActorId(actorId);

    try {
      console.log(`🚀 Ejecutando actor: ${actorId}`);

      // 1. START ACTOR RUN
      const runResponse = await fetch(
        `${this.baseUrl}/acts/${encodedActorId}/runs?token=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!runResponse.ok) {
        const errText = await runResponse.text();
        throw new Error(`Actor start failed: ${runResponse.status} - ${errText}`);
      }

      const runData = await runResponse.json();
      const runId = runData.data.id;
      console.log(`⏳ Actor started, run ID: ${runId}`);

      // 2. POLL FOR COMPLETION
      let completed = false;
      let pollCount = 0;
      const maxPolls = Math.ceil(timeoutSec / 1) * 1.5; // Account for 1s poll interval

      while (!completed && pollCount < maxPolls) {
        await this.sleep(1000);
        pollCount++;

        const statusResponse = await fetch(
          `${this.baseUrl}/acts/${encodedActorId}/runs/${runId}?token=${this.apiKey}`
        );

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          const runStatus = status.data.status;

          if (pollCount % 30 === 0) {
            console.log(`⏳ Status: ${runStatus} (${pollCount}s)`);
          }

          if (runStatus === 'SUCCEEDED') {
            completed = true;
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
            throw new Error(
              `Actor failed: ${runStatus} - ${status.data.statusMessage || ''}`
            );
          }
        }
      }

      if (!completed) {
        throw new Error(`Actor timeout after ${timeoutSec}s`);
      }

      // 3. FETCH DATASET ITEMS
      const datasetId = runData.data.defaultDatasetId;
      if (!datasetId) {
        throw new Error('No dataset ID returned');
      }

      const itemsUrl = `${this.baseUrl}/datasets/${datasetId}/items?token=${this.apiKey}&clean=false`;
      const itemsResponse = await fetch(itemsUrl);

      if (!itemsResponse.ok) {
        throw new Error(`Failed to fetch items: ${itemsResponse.status}`);
      }

      const data = await itemsResponse.json();
      const items = Array.isArray(data) ? data : (data.items || []);

      console.log(`📊 Raw dataset items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`❌ Actor execution failed (${actorId}):`, error);
      return [];
    }
  }

  /**
   * FLATTEN: Extract actual results from pageFunction wrapper
   * Apify wraps pageFunction output in: { pageFunctionResult: [...] }
   * Also handles error items gracefully
   */
  private flattenPageFunctionResults(items: RawActorResult[]): RawActorResult[] {
    const flattened: RawActorResult[] = [];

    for (const item of items) {
      // Skip error markers (but be lenient - not all errors should be skipped)
      if (item['#error']) {
        console.warn('⚠️ Skipping error item:', item['#error']);
        continue;
      }

      // Extract pageFunctionResult if present
      if (item.pageFunctionResult) {
        if (Array.isArray(item.pageFunctionResult)) {
          flattened.push(...item.pageFunctionResult);
        } else if (typeof item.pageFunctionResult === 'object') {
          flattened.push(item.pageFunctionResult);
        }
      } else {
        // Item is direct result (no wrapper)
        flattened.push(item);
      }
    }

    console.log(`📊 Flattened results: ${flattened.length}`);
    return flattened;
  }

  /**
   * UPWORK: Scrape with simplified approach
   * Focus on: name, profile URL, skills, rate, success rate
   * Will skip existing candidates and keep searching until target is met
   */
  async scrapeUpwork(filter: ScrapingFilter, maxAttempts: number = 10): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    const buffer: ScrapedCandidate[] = [];
    const seenProfiles = new Set<string>();
    // Normalize existing URLs for comparison
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(url => this.normalizeUrl(url))
    );
    const existingEmails = new Set<string>(filter.existingEmails || []);
    let attempt = 0;
    const targetCount = filter.maxResults || 50;

    console.log(`🔍 Upwork: Starting buffer search... target=${targetCount}`);
    if (existingUrls.size > 0) {
      console.log(`   ⏭️ Skipping ${existingUrls.size} existing candidates`);
    }

    while (buffer.length < targetCount && attempt < maxAttempts) {
      attempt++;

      const query = this.getUpworkQueryVariation(filter.keyword, attempt);
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Searching: "${query}"`);

      try {
        // Calculate how many more candidates we need
        const remainingNeeded = targetCount - buffer.length;
        const results = await this.scrapeUpworkOnce(query, remainingNeeded * 2);
        console.log(`   ✅ ${results.length} candidates retrieved`);

        // Filter out duplicates (within session and existing)
        const newCandidates = results.filter(c => {
          // Skip if seen in this session
          if (c.profileUrl && seenProfiles.has(this.normalizeUrl(c.profileUrl))) {
            return false;
          }
          // Skip if it's an existing candidate from campaign
          const normalizedUrl = this.normalizeUrl(c.profileUrl);
          if (normalizedUrl && existingUrls.has(normalizedUrl)) {
            console.log(`   ⏭️ Skipping existing: ${c.name} (${normalizedUrl})`);
            return false;
          }
          // Skip if email already exists
          if (c.email && existingEmails.has(c.email.toLowerCase())) {
            console.log(`   ⏭️ Skipping existing email: ${c.email}`);
            return false;
          }
          // Mark as seen for future checks
          if (c.profileUrl) {
            seenProfiles.add(this.normalizeUrl(c.profileUrl));
          }
          return true;
        });

        // Add to buffer, but don't exceed target
        for (const candidate of newCandidates) {
          if (buffer.length < targetCount) {
            buffer.push(candidate);
          } else {
            break;
          }
        }

        console.log(`   📦 Buffer: ${buffer.length}/${targetCount}`);

        // Break early if we hit exactly what we need
        if (buffer.length === targetCount) {
          break;
        }
      } catch (err) {
        console.error(`   ❌ Attempt ${attempt} failed:`, err);
      }
    }

    console.log(`\n✅ Upwork search complete: ${buffer.length} unique candidates`);
    return buffer.slice(0, targetCount).sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
  }

  private async scrapeUpworkOnce(query: string, remainingNeeded: number = 50): Promise<ScrapedCandidate[]> {
    const dorkQuery = query;

    console.log(`🔗 Upwork Dork: ${dorkQuery}`);

    const actorId = 'apify/google-search-scraper';

    const actorInput = {
      queries: dorkQuery,
      resultsPerPage: 100,
      maxPagesPerQuery: 1,
      languageCode: "es", // Enforce Spanish language
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false
    };

    // Execute and get raw items from dataset
    const rawItems = await this.getActorDataset(
      actorId,
      actorInput,
      300
    );

    if (!rawItems.length) {
      console.warn('⚠️ Upwork (Google): No results returned from actor');
      return [];
    }

    // Google Search Scraper returns results inside organicResults array
    let organicResults: any[] = [];
    for (const item of rawItems) {
      if (item.organicResults && Array.isArray(item.organicResults)) {
        organicResults = organicResults.concat(item.organicResults);
      }
    }

    if (organicResults.length === 0) {
      console.warn('⚠️ Upwork (Google): No organicResults found.');
      return [];
    }

    // Filter valid Upwork profiles
    const validResults = organicResults.filter((r: any) => {
      if (!r.url) return false;
      return r.url.includes('upwork.com/freelancers') || r.url.includes('upwork.com/o/profiles');
    });

    console.log(`✅ Upwork (Google): ${validResults.length} raw valid results`);

    // Slice only the amount we need (respect the buffer limit)
    const slicedResults = validResults.slice(0, remainingNeeded);

    // Convert to ScrapedCandidate format
    const candidates = slicedResults
      .map((item, idx) => this.parseUpworkItem(item, idx))
      .filter((c): c is ScrapedCandidate => c !== null)
      .filter(c => c.name.trim().length > 0);

    // Calculate scores
    return candidates.map(c => ({
      ...c,
      talentScore: MarketplaceScoringService.calculateTalentScore(c, {
        keyword: '',
        skills: [],
        maxResults: 50,
      }).score,
    }));
  }

  private getUpworkPageFunction(): string {
    return ``;
  }

  private parseUpworkItem(item: RawActorResult, index: number): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const profileUrl = item.url || '';
    if (!profileUrl || !profileUrl.includes('upwork')) return null;

    let title = item.title || 'Upwork Freelancer';
    let name = 'Upwork Freelancer';

    // Attempt to extract name from format 'Name Initial. - Title - Upwork'
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      if (parts.length > 0) {
        name = parts[0].trim();
      }
      if (parts.length > 1) {
        title = parts[1].trim();
      }
    }

    if (!name || name.length < 2) return null;

    const bio = item.description || '';

    // Extract rate
    let rate = 0;
    const rateMatch = bio.match(/\$([0-9.]+)\s*\/\s*hr/i);
    if (rateMatch) {
      rate = parseFloat(rateMatch[1]);
    }

    // Extract Success Rate
    let successRate = 0;
    const successMatch = bio.match(/([0-9]+)%\s*Job\s*Success/i);
    if (successMatch) {
      successRate = parseInt(successMatch[1]);
    }

    return {
      id: `upwork-google-${index}-${Date.now()}`,
      name,
      platform: 'Upwork' as FreelancePlatform,
      platformUsername: profileUrl.split('~').pop()?.split('/').filter(Boolean).pop() || `user-${index}`,
      profileUrl,
      title,
      country: 'Unknown',
      hourlyRate: rate,
      jobSuccessRate: successRate,
      certifications: [],
      bio: bio,
      scrapedAt: new Date().toISOString(),
      talentScore: 0, // Calculated later
      skills: [],
      badges: [],
      yearsExperience: 0,
      totalEarnings: 0,
      totalJobs: 0,
      totalHours: 0,
    };
  }

  /**
   * FIVERR: Similar simplified approach - skip existing candidates
   */
  async scrapeFiverr(filter: ScrapingFilter, maxAttempts: number = 10): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    const buffer: ScrapedCandidate[] = [];
    const seenProfiles = new Set<string>();
    // Normalize existing URLs for comparison
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(url => this.normalizeUrl(url))
    );
    const existingEmails = new Set<string>(filter.existingEmails || []);
    let attempt = 0;
    const targetCount = filter.maxResults || 40;

    console.log(`🔍 Fiverr: Starting buffer search... target=${targetCount}`);
    if (existingUrls.size > 0) {
      console.log(`   ⏭️ Skipping ${existingUrls.size} existing candidates`);
    }

    while (buffer.length < targetCount && attempt < maxAttempts) {
      attempt++;
      const query = this.getFiverrQueryVariation(filter.keyword, attempt);
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Searching: "${query}"`);

      try {
        const results = await this.scrapeFiverrOnce(query);
        console.log(`   ✅ ${results.length} sellers retrieved`);

        // Filter duplicates and existing candidates
        const newCandidates = results.filter(c => {
          if (c.profileUrl && seenProfiles.has(this.normalizeUrl(c.profileUrl))) {
            return false;
          }
          const normalizedUrl = this.normalizeUrl(c.profileUrl);
          if (normalizedUrl && existingUrls.has(normalizedUrl)) {
            console.log(`   ⏭️ Skipping existing: ${c.name} (${normalizedUrl})`);
            return false;
          }
          if (c.email && existingEmails.has(c.email.toLowerCase())) {
            console.log(`   ⏭️ Skipping existing email: ${c.email}`);
            return false;
          }
          if (c.profileUrl) {
            seenProfiles.add(this.normalizeUrl(c.profileUrl));
          }
          return true;
        });

        for (const candidate of newCandidates) {
          if (buffer.length < targetCount) {
            buffer.push(candidate);
          } else {
            break;
          }
        }

        console.log(`   📦 Buffer: ${buffer.length}/${targetCount}`);

        if (buffer.length === targetCount) {
          break;
        }
      } catch (err) {
        console.error(`   ❌ Attempt ${attempt} failed:`, err);
      }
    }

    console.log(`\n✅ Fiverr search complete: ${buffer.length} unique candidates`);
    return buffer.slice(0, targetCount).sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
  }

  private async scrapeFiverrOnce(query: string): Promise<ScrapedCandidate[]> {
    const searchUrl = `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(query)}`;

    const actorInput = {
      startUrls: [{ url: searchUrl }],
      maxResultsPerStartUrl: 50,
      maxResults: 50,
      pageFunction: this.getFiverrPageFunction(),
      proxyConfiguration: { useApifyProxy: true },
    };

    const rawItems = await this.getActorDataset('apify/web-scraper', actorInput, 300);
    if (!rawItems.length) return [];

    const items = this.flattenPageFunctionResults(rawItems);

    const candidates = items
      .map((item, idx) => this.parseFiverrItem(item, idx))
      .filter((c): c is ScrapedCandidate => c !== null)
      .filter(c => c.name.trim().length > 0);

    // Calculate scores
    return candidates.map(c => ({
      ...c,
      talentScore: MarketplaceScoringService.calculateTalentScore(c, {
        keyword: '',
        skills: [],
        maxResults: 40,
      }).score,
    }));
  }

  private getFiverrPageFunction(): string {
    return `
    async function pageFunction(context) {
      const { page } = context;
      const results = [];
      
      try {
        const sellers = await page.$$('[data-qa*=seller], [class*=seller], a[href*="/user/"]');
        
        for (const seller of sellers.slice(0, 100)) {
          try {
            const name = await seller.evaluate(el => (el.textContent || '').trim().substring(0, 50));
            const href = await seller.evaluate(el => el.getAttribute('href') || el.closest('a')?.getAttribute('href') || '');
            
            if (name && name.length > 2 && href && href.includes('fiverr')) {
              results.push({
                name,
                profileUrl: href,
              });
            }
          } catch (e) {}
        }
      } catch (e) {}
      
      return results.slice(0, 50);
    }
    `;
  }

  private parseFiverrItem(item: RawActorResult, index: number): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const name = (item.name || item.seller || item.username || '').trim();
    if (!name || name.length < 2) return null;

    const profileUrl = item.profileUrl || item.url || item.link || '';
    if (!profileUrl || !profileUrl.includes('fiverr')) return null;

    return {
      id: `fiverr-${index}-${Date.now()}`,
      name,
      platform: 'Fiverr' as FreelancePlatform,
      platformUsername: profileUrl.split('/').filter(Boolean).pop() || `user-${index}`,
      profileUrl,
      title: item.title || item.service || 'Seller',
      country: item.country || 'Unknown',
      hourlyRate: this.parseRate(item.rate),
      jobSuccessRate: this.parseSuccessRate(item.rating),
      certifications: item.badges || [],
      bio: item.description || '',
      scrapedAt: new Date().toISOString(),
      talentScore: 0,
      skills: Array.isArray(item.skills) ? item.skills : [],
      badges: item.badges || [],
      yearsExperience: 0,
    };
  }

  /**
   * LINKEDIN: Via dedicated actor or fallback to browser - skip existing candidates
   */
  async scrapeLinkedIn(filter: ScrapingFilter, maxAttempts: number = 10): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    const buffer: ScrapedCandidate[] = [];
    const seenProfiles = new Set<string>();
    // Normalize existing URLs for comparison
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(url => this.normalizeUrl(url))
    );
    const existingEmails = new Set<string>(filter.existingEmails || []);
    let attempt = 0;
    const targetCount = filter.maxResults || 50;

    console.log(`🔍 LinkedIn: Starting search... target=${targetCount}`);
    if (existingUrls.size > 0) {
      console.log(`   ⏭️ Skipping ${existingUrls.size} existing candidates`);
    }

    while (buffer.length < targetCount && attempt < maxAttempts) {
      attempt++;
      const query = this.getLinkedInQueryVariation(filter.keyword, attempt);
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Searching: "${query}"`);

      try {
        const results = await this.scrapeLinkedInOnce(query);
        console.log(`   ✅ ${results.length} professionals retrieved`);

        // Filter duplicates and existing candidates
        const newCandidates = results.filter(c => {
          if (c.profileUrl && seenProfiles.has(this.normalizeUrl(c.profileUrl))) {
            return false;
          }
          const normalizedUrl = this.normalizeUrl(c.profileUrl);
          if (normalizedUrl && existingUrls.has(normalizedUrl)) {
            console.log(`   ⏭️ Skipping existing: ${c.name} (${normalizedUrl})`);
            return false;
          }
          if (c.email && existingEmails.has(c.email.toLowerCase())) {
            console.log(`   ⏭️ Skipping existing email: ${c.email}`);
            return false;
          }
          if (c.profileUrl) {
            seenProfiles.add(this.normalizeUrl(c.profileUrl));
          }
          return true;
        });

        for (const candidate of newCandidates) {
          if (buffer.length < targetCount) {
            buffer.push(candidate);
          } else {
            break;
          }
        }

        console.log(`   📦 Buffer: ${buffer.length}/${targetCount}`);

        if (buffer.length === targetCount) {
          break;
        }
      } catch (err) {
        console.error(`   ❌ Attempt ${attempt} failed:`, err);
      }
    }

    console.log(`\n✅ LinkedIn search complete: ${buffer.length} unique candidates`);
    return buffer.slice(0, targetCount).sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
  }

  private async scrapeLinkedInOnce(query: string): Promise<ScrapedCandidate[]> {
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;

    const actorInput = {
      startUrls: [{ url: searchUrl }],
      maxResults: 50,
      pageFunction: this.getLinkedInPageFunction(),
      proxyConfiguration: { useApifyProxy: true },
    };

    const rawItems = await this.getActorDataset('apify/web-scraper', actorInput, 300);
    if (!rawItems.length) return [];

    const items = this.flattenPageFunctionResults(rawItems);

    const candidates = items
      .map((item, idx) => this.parseLinkedInItem(item, idx))
      .filter((c): c is ScrapedCandidate => c !== null)
      .filter(c => c.name.trim().length > 0);

    // Calculate scores
    return candidates.map(c => ({
      ...c,
      talentScore: MarketplaceScoringService.calculateTalentScore(c, {
        keyword: '',
        skills: [],
        maxResults: 50,
      }).score,
    }));
  }

  private getLinkedInPageFunction(): string {
    return `
    async function pageFunction(context) {
      const { page } = context;
      const results = [];
      
      try {
        const profiles = await page.$$('a[href*="/in/"], [data-qa*=profile]');
        
        for (const profile of profiles.slice(0, 50)) {
          try {
            const href = await profile.evaluate(el => el.getAttribute('href') || el.closest('a')?.getAttribute('href') || '');
            const name = await profile.evaluate(el => (el.textContent || '').trim());
            
            if (href && href.includes('linkedin.com/in/') && name && name.length > 2) {
              results.push({
                name: name.substring(0, 100),
                profileUrl: href,
              });
            }
          } catch (e) {}
        }
      } catch (e) {}
      
      return results.slice(0, 50);
    }
    `;
  }

  private parseLinkedInItem(item: RawActorResult, index: number): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const name = (item.name || item.user || item.fullName || '').trim();
    if (!name || name.length < 2) return null;

    const profileUrl = item.profileUrl || item.url || item.link || '';
    if (!profileUrl || !profileUrl.includes('linkedin.com')) return null;

    return {
      id: `linkedin-${index}-${Date.now()}`,
      name,
      platform: 'LinkedIn' as FreelancePlatform,
      platformUsername: profileUrl.split('/').filter(Boolean).pop() || `user-${index}`,
      profileUrl,
      title: item.title || item.jobTitle || item.headline || 'Professional',
      country: item.country || item.location || 'Unknown',
      hourlyRate: 0,
      jobSuccessRate: 0,
      certifications: [],
      bio: item.bio || item.headline || '',
      scrapedAt: new Date().toISOString(),
      talentScore: 0,
      skills: Array.isArray(item.skills) ? item.skills : [],
      badges: [],
      yearsExperience: 0,
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────────

  private isSameCandidate(c1: ScrapedCandidate, c2: ScrapedCandidate): boolean {
    // Same URL = same candidate
    if (c1.profileUrl && c2.profileUrl && c1.profileUrl === c2.profileUrl) {
      return true;
    }
    // Same username = same candidate
    if (c1.platformUsername && c2.platformUsername && c1.platformUsername === c2.platformUsername) {
      return true;
    }
    return false;
  }

  private getUpworkQueryVariation(base: string, attempt: number): string {
    const sitePrefix = 'site:upwork.com/freelancers OR site:upwork.com/o/profiles';
    // Siempre incluir "Español" o variaciones para asegurar candidatos de habla hispana
    const variations = [
      `${sitePrefix} "${base}" "Spanish"`,
      `${sitePrefix} "${base}" "top rated" "Spanish"`,
      `${sitePrefix} ${base} "100% Job Success" Español`,
      `${sitePrefix} ${base} freelance remote Spanish`,
      `${sitePrefix} ${base} expert OR senior Español`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getFiverrQueryVariation(base: string, attempt: number): string {
    const sitePrefix = 'site:fiverr.com';
    const variations = [
      `${sitePrefix} "${base}" "Spanish"`,
      `${sitePrefix} "${base}" "top rated" "Spanish"`,
      `${sitePrefix} "${base}" seller Español`,
      `${sitePrefix} "${base}" portfolio Spanish`,
      `${sitePrefix} "${base}" studio Español`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getLinkedInQueryVariation(base: string, attempt: number): string {
    const variations = [
      `${base} Spanish`,
      `${base} Español skill:${base}`,
      `${base} title:${base} Spanish`,
      `${base} location:Remote Español`,
      `${base} experience:5+ Spanish`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private parseRate(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private parseSuccessRate(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return Math.min(100, Math.max(0, value));
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
    }
    return 0;
  }

  private parseNumber(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private estimateExperience(item: RawActorResult): number {
    const totalJobs = this.parseNumber(item.totalJobs);
    const totalHours = this.parseNumber(item.totalHours);
    if (totalHours > 0) return Math.round(totalHours / 1000);
    if (totalJobs > 0) return Math.round(totalJobs / 10);
    return 0;
  }

  private encodeActorId(actorId: string): string {
    return actorId.replace(/\//g, '~');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

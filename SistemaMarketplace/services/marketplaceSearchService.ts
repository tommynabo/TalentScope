import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';
import { MarketplaceScoringService } from './marketplaceScoringService';
import { dedupService } from './marketplaceDeduplicationService';

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
   */
  async scrapeUpwork(filter: ScrapingFilter, maxAttempts: number = 5): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    const buffer: ScrapedCandidate[] = [];
    let attempt = 0;

    console.log(`🔍 Upwork: Starting buffer search... target=${filter.maxResults || 50}`);

    while (buffer.length < (filter.maxResults || 50) && attempt < maxAttempts) {
      attempt++;

      const query = this.getUpworkQueryVariation(filter.keyword, attempt);
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Searching: "${query}"`);

      try {
        const results = await this.scrapeUpworkOnce(query);
        console.log(`   ✅ ${results.length} candidates retrieved`);

        // Filter duplicates against previously found candidates
        const newCandidates = results.filter(c => {
          if (buffer.some(b => this.isSameCandidate(b, c))) {
            return false;
          }
          if (dedupService.isDuplicate(c)) {
            return false;
          }
          return true;
        });

        // Register all new candidates
        newCandidates.forEach(c => dedupService.registerCandidate(c));
        buffer.push(...newCandidates);

        console.log(`   📦 Buffer: ${buffer.length}/${filter.maxResults || 50}`);

        if (buffer.length >= (filter.maxResults || 50)) {
          console.log(`   ✅ Target reached at attempt ${attempt}`);
          break;
        }
      } catch (err) {
        console.error(`   ❌ Attempt ${attempt} failed:`, err);
      }
    }

    console.log(`\n✅ Upwork search complete: ${buffer.length} unique candidates`);
    return buffer.slice(0, filter.maxResults || 50).sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
  }

  private async scrapeUpworkOnce(query: string): Promise<ScrapedCandidate[]> {
    const searchUrl = new URL('https://www.upwork.com/nx/search/talent/');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('sort', 'relevance');

    const actorInput = {
      startUrls: [{ url: searchUrl.toString() }],
      maxResultsPerStartUrl: 50,
      maxResults: 50,
      pageFunction: this.getUpworkPageFunction(),
      proxyConfiguration: {
        useApifyProxy: true,
      },
    };

    // Execute and get raw items from dataset
    const rawItems = await this.getActorDataset(
      'apify/web-scraper', // Free actor
      actorInput,
      300
    );

    if (!rawItems.length) {
      return [];
    }

    // Flatten pageFunction results
    const items = this.flattenPageFunctionResults(rawItems);

    // Convert to ScrapedCandidate format
    const candidates = items
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
    return `
    async function pageFunction(context) {
      const { page } = context;
      const results = [];
      
      try {
        // Find profile cards/links on page
        const profileLinks = await page.$$('a[href*="/o/"], a[href*="/freelancers/"]');
        
        for (const link of profileLinks.slice(0, 100)) {
          try {
            const href = await link.evaluate(el => el.getAttribute('href') || '');
            const name = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
            
            // Get title/role from nearby elements
            const parent = await link.evaluate(el => el.closest('[data-qa], [class*=card], [class*=profile]'));
            const title = parent ? await link.evaluate(el => el.closest('[data-qa], [class*=card]')?.textContent || '') : '';
            
            if (href && name && name.length > 2) {
              results.push({
                name: name.substring(0, 100),
                profileUrl: href,
                title: title.substring(0, 200),
              });
            }
          } catch (e) {
            // Skip this link
          }
        }
      } catch (e) {
        // Page parsing failed, return partial results
      }
      
      return results.slice(0, 50);
    }
    `;
  }

  private parseUpworkItem(item: RawActorResult, index: number): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const name = (item.name || item.freelancerName || item.title_name || '').trim();
    if (!name || name.length < 2) return null;

    const profileUrl = item.profileUrl || item.url || item.link || '';
    if (!profileUrl || !profileUrl.includes('upwork')) return null;

    const title = item.title || item.headline || item.occupation || 'Freelancer';

    return {
      id: `upwork-${index}-${Date.now()}`,
      name,
      platform: 'Upwork' as FreelancePlatform,
      platformUsername: profileUrl.split('/').filter(Boolean).pop() || `user-${index}`,
      profileUrl,
      title,
      country: item.country || item.location || 'Unknown',
      hourlyRate: this.parseRate(item.rate || item.hourlyRate || item.price),
      jobSuccessRate: this.parseSuccessRate(item.success || item.jobSuccess),
      certifications: item.badges || [],
      bio: item.description || item.bio || '',
      scrapedAt: new Date().toISOString(),
      talentScore: 0, // Calculated later
      skills: Array.isArray(item.skills) ? item.skills : [],
      badges: item.badges || [],
      yearsExperience: this.estimateExperience(item),
      totalEarnings: this.parseNumber(item.totalEarnings),
      totalJobs: this.parseNumber(item.totalJobs),
      totalHours: this.parseNumber(item.totalHours),
    };
  }

  /**
   * FIVERR: Similar simplified approach
   */
  async scrapeFiverr(filter: ScrapingFilter, maxAttempts: number = 5): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    const buffer: ScrapedCandidate[] = [];
    let attempt = 0;

    console.log(`🔍 Fiverr: Starting buffer search...`);

    while (buffer.length < (filter.maxResults || 40) && attempt < maxAttempts) {
      attempt++;
      const query = this.getFiverrQueryVariation(filter.keyword, attempt);
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Searching: "${query}"`);

      try {
        const results = await this.scrapeFiverrOnce(query);
        console.log(`   ✅ ${results.length} sellers retrieved`);

        const newCandidates = results.filter(c => {
          if (buffer.some(b => this.isSameCandidate(b, c))) {
            return false;
          }
          if (dedupService.isDuplicate(c)) {
            return false;
          }
          return true;
        });

        newCandidates.forEach(c => dedupService.registerCandidate(c));
        buffer.push(...newCandidates);

        console.log(`   📦 Buffer: ${buffer.length}/${filter.maxResults || 40}`);

        if (buffer.length >= (filter.maxResults || 40)) {
          break;
        }
      } catch (err) {
        console.error(`   ❌ Attempt ${attempt} failed:`, err);
      }
    }

    console.log(`\n✅ Fiverr search complete: ${buffer.length} unique candidates`);
    return buffer.slice(0, filter.maxResults || 40).sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
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
   * LINKEDIN: Via dedicated actor or fallback to browser
   */
  async scrapeLinkedIn(filter: ScrapingFilter, maxAttempts: number = 3): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    const buffer: ScrapedCandidate[] = [];
    let attempt = 0;

    console.log(`🔍 LinkedIn: Starting search...`);

    while (buffer.length < (filter.maxResults || 50) && attempt < maxAttempts) {
      attempt++;
      const query = this.getLinkedInQueryVariation(filter.keyword, attempt);
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Searching: "${query}"`);

      try {
        const results = await this.scrapeLinkedInOnce(query);
        console.log(`   ✅ ${results.length} professionals retrieved`);

        const newCandidates = results.filter(c => {
          if (buffer.some(b => this.isSameCandidate(b, c))) {
            return false;
          }
          if (dedupService.isDuplicate(c)) {
            return false;
          }
          return true;
        });

        newCandidates.forEach(c => dedupService.registerCandidate(c));
        buffer.push(...newCandidates);

        console.log(`   📦 Buffer: ${buffer.length}/${filter.maxResults || 50}`);

        if (buffer.length >= (filter.maxResults || 50)) {
          break;
        }
      } catch (err) {
        console.error(`   ❌ Attempt ${attempt} failed:`, err);
      }
    }

    console.log(`\n✅ LinkedIn search complete: ${buffer.length} unique candidates`);
    return buffer.slice(0, filter.maxResults || 50).sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
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
    const variations = [
      base,
      `"${base}" top rated`,
      `${base} "level 1" OR "rising talent"`,
      `${base} freelance remote`,
      `${base} expert OR senior`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getFiverrQueryVariation(base: string, attempt: number): string {
    const variations = [
      base,
      `"${base}" rating high`,
      `${base} "top rated"`,
      `${base} seller`,
      `${base} portfolio`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getLinkedInQueryVariation(base: string, attempt: number): string {
    const variations = [
      base,
      `${base} skill:${base}`,
      `${base} title:${base}`,
      `${base} location:Remote`,
      `${base} experience:5+`,
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

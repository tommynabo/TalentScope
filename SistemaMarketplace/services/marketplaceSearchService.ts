import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';
import { MarketplaceScoringService } from './marketplaceScoringService';
import { LanguageDetectionService } from './languageDetectionService';

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
  async scrapeUpwork(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    if (!filter.keyword) {
      console.warn('⚠️ No keyword provided for Upwork search');
      return [];
    }

    // Just do ONE search with the provided keyword
    // The loop and query variations are handled by RaidService, not here
    // NOTE: Do NOT wrap keyword in quotes — RaidService query variations already include
    // their own quoting (e.g. Flutter "Spanish" OR "Español"). Adding outer quotes
    // would create broken nested quotes like "Flutter "Spanish" OR "Español""
    const dorkQuery = `site:upwork.com/freelancers OR site:upwork.com/o/profiles ${filter.keyword.trim()}`;
    const results = await this.scrapeUpworkOnce(dorkQuery, filter.maxResults || 50, filter.languages?.[0]);

    // Simple dedup against existing URLs/emails
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(url => this.normalizeUrl(url))
    );
    const existingEmails = new Set<string>(filter.existingEmails || []);
    const existingNames = new Set<string>(
      (filter.existingNames || []).map(n => n.toLowerCase().trim())
    );

    const filtered = results.filter(c => {
      // Skip by name
      if (existingNames.has(c.name.toLowerCase().trim())) {
        return false;
      }
      // Skip by URL
      if (c.profileUrl && existingUrls.has(this.normalizeUrl(c.profileUrl))) {
        return false;
      }
      // Skip by email
      if (c.email && existingEmails.has(c.email.toLowerCase())) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, filter.maxResults || 50);
  }

  private async scrapeUpworkOnce(query: string, remainingNeeded: number = 50, language: string = 'en'): Promise<ScrapedCandidate[]> {
    const dorkQuery = query;

    console.log(`🔗 Upwork Dork: ${dorkQuery}`);
    console.log(`🌐 Búsqueda en idioma: ${language}`);

    const actorId = 'apify/google-search-scraper';

    // Map language codes to Google language codes
    const languageCodeMap: Record<string, string> = {
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'pt': 'pt',
    };

    const actorInput = {
      queries: dorkQuery,
      resultsPerPage: 100,
      maxPagesPerQuery: 1,
      languageCode: languageCodeMap[language] || 'en', // Use provided language or default to en
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
      .map((item, idx) => this.parseUpworkItem(item, idx, language))
      .filter((c): c is ScrapedCandidate => c !== null)
      .filter(c => c.name.trim().length > 0)
      // FILTER BY LANGUAGE: Validate candidate speaks required language
      // Lenient for marketplace: Google snippets have limited data (country='Unknown').
      // If snippet text mentions Spanish/Español, accept the candidate.
      .filter(c => {
        if (language === 'es' || language === 'español') {
          // Primary check: multi-signal (name, location, bio text)
          const speaksSpanish = LanguageDetectionService.speaksLanguage(
            c.bio, c.title, c.country, 'es', c.name
          );
          if (speaksSpanish) return true;

          // Fallback: Google snippet mentions Spanish/Español → accept
          const textLower = `${c.bio || ''} ${c.title || ''}`.toLowerCase();
          if (/\b(spanish|español|espanol|hispanohablante|habla español|castellano)\b/i.test(textLower)) {
            return true;
          }

          console.log(`⏭️  Candidato filtrado (no hispanohablante): ${c.name}`);
          return false;
        }
        return true;
      });

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

  private parseUpworkItem(item: RawActorResult, index: number, language: string = 'en'): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const profileUrl = item.url || '';
    if (!profileUrl || !profileUrl.includes('upwork')) return null;

    // Ignore generic platform pages or listings that are not user profiles
    // e.g. https://www.upwork.com/ or pages that do not contain '/freelancers/' or '/o/profiles/'
    try {
      const parsed = new URL(profileUrl);
      const path = parsed.pathname.toLowerCase();
      if (!path.includes('/freelancers/') && !path.includes('/o/profiles/') && !path.includes('/profiles/')) {
        return null;
      }
    } catch (err) {
      // If URL parsing fails, drop the item
      return null;
    }

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

    // Filter out results where the extracted name looks like the platform itself
    if (name.toLowerCase().includes('upwork') || name.toLowerCase().includes('freelancer')) return null;

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

    // Detect language from profile data
    const detectedLanguage = LanguageDetectionService.detectLanguage(bio, title, 'Unknown', name);

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
      detectedLanguage,
    };
  }

  /**
   * FIVERR: Similar simplified approach - skip existing candidates
   */
  async scrapeFiverr(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    if (!filter.keyword) {
      console.warn('⚠️ No keyword provided for Fiverr search');
      return [];
    }

    // Just do ONE search with the provided keyword
    // The loop and query variations are handled by RaidService, not here
    const results = await this.scrapeFiverrOnce(filter.keyword, filter.languages?.[0]);

    // Simple dedup against existing URLs/emails
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(url => this.normalizeUrl(url))
    );
    const existingEmails = new Set<string>(filter.existingEmails || []);
    const existingNames = new Set<string>(
      (filter.existingNames || []).map(n => n.toLowerCase().trim())
    );

    const filtered = results.filter(c => {
      // Skip by name
      if (existingNames.has(c.name.toLowerCase().trim())) {
        return false;
      }
      // Skip by URL
      if (c.profileUrl && existingUrls.has(this.normalizeUrl(c.profileUrl))) {
        return false;
      }
      // Skip by email
      if (c.email && existingEmails.has(c.email.toLowerCase())) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, filter.maxResults || 40);
  }

  private async scrapeFiverrOnce(query: string, language: string = 'en'): Promise<ScrapedCandidate[]> {
    // Use Google Search Scraper for Fiverr (much faster than web-scraper)
    // NOTE: Do NOT wrap query in quotes — RaidService variations already include quoting
    const dorkQuery = `site:fiverr.com/gigs ${query.trim()}`;
    console.log(`🔗 Fiverr Dork: ${dorkQuery}`);
    console.log(`🌐 Búsqueda en idioma: ${language}`);

    const actorId = 'apify/google-search-scraper';

    // Map language codes to Google language codes
    const languageCodeMap: Record<string, string> = {
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'pt': 'pt',
    };

    const actorInput = {
      queries: dorkQuery,
      resultsPerPage: 100,
      maxPagesPerQuery: 1,
      languageCode: languageCodeMap[language] || 'en',
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false
    };

    // Execute and get raw items from dataset
    const rawItems = await this.getActorDataset(
      actorId,
      actorInput,
      60 // Shorter timeout since Google searches are fast
    );

    if (!rawItems.length) {
      console.warn('⚠️ Fiverr (Google): No results returned from actor');
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
      console.warn('⚠️ Fiverr (Google): No organicResults found.');
      return [];
    }

    // Filter valid Fiverr gig pages
    const validResults = organicResults.filter((r: any) => {
      if (!r.url) return false;
      return r.url.includes('fiverr.com/gigs');
    });

    console.log(`✅ Fiverr (Google): ${validResults.length} raw valid results`);

    // Convert to ScrapedCandidate format
    const candidates = validResults
      .map((item, idx) => this.parseFiverrItem(item, idx, language))
      .filter((c): c is ScrapedCandidate => c !== null)
      .filter(c => c.name.trim().length > 0)
      // FILTER BY LANGUAGE: Lenient for Google snippets
      .filter(c => {
        if (language === 'es' || language === 'español') {
          const speaksSpanish = LanguageDetectionService.speaksLanguage(
            c.bio, c.title, c.country, 'es', c.name
          );
          if (speaksSpanish) return true;

          const textLower = `${c.bio || ''} ${c.title || ''}`.toLowerCase();
          if (/\b(spanish|español|espanol|hispanohablante|habla español|castellano)\b/i.test(textLower)) {
            return true;
          }

          console.log(`⏭️  Candidato filtrado (no hispanohablante): ${c.name}`);
          return false;
        }
        return true;
      });

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

  private parseFiverrItem(item: RawActorResult, index: number, language: string = 'en'): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const profileUrl = item.url || '';
    if (!profileUrl || !profileUrl.includes('fiverr.com/gigs')) return null;

    // Extract seller name and gig title from URL and title
    // Fiverr URLs typically: https://www.fiverr.com/gigs/flutter-development?...
    // Title from Google: "Flutter Development by [Seller Name] | Fiverr"
    let title = item.title || 'Fiverr Seller';
    let name = 'Fiverr Seller';

    // Try to extract name from Google result title
    // Typical format: "Gig Title by Seller Name | Fiverr"
    if (title.includes('by ')) {
      const byPart = title.split('by ').pop() || '';
      const namePart = byPart.split(' |')[0].trim();
      if (namePart && namePart.length > 2) {
        name = namePart;
      }
    }

    // Also try to extract from URL if possible
    try {
      const parsed = new URL(profileUrl);
      const path = parsed.pathname.toLowerCase();
      // Extract gig name from URL: /gigs/flutter-development
      if (path.includes('/gigs/')) {
        const gigName = path.split('/gigs/')[1]?.split('?')[0] || '';
        if (gigName && !title.includes('-')) {
          title = gigName.replace(/-/g, ' ');
        }
      }
    } catch {
      // URL parsing failed, continue with what we have
    }

    if (!name || name.length < 2 || name.toLowerCase().includes('fiverr')) {
      return null;
    }

    const bio = item.description || '';
    const country = 'Unknown';

    // Detect language from profile data
    const detectedLanguage = LanguageDetectionService.detectLanguage(bio, title, country, name);

    return {
      id: `fiverr-google-${index}-${Date.now()}`,
      name,
      platform: 'Fiverr' as FreelancePlatform,
      platformUsername: profileUrl.split('/gigs/')[1]?.split('?')[0]?.split('~')?.pop() || `user-${index}`,
      profileUrl,
      title,
      country,
      hourlyRate: 0, // Can't extract from Google results
      jobSuccessRate: 0, // Can't extract from Google results
      certifications: [],
      bio,
      scrapedAt: new Date().toISOString(),
      talentScore: 0, // Calculated later
      skills: [],
      badges: [],
      yearsExperience: 0,
      totalEarnings: 0,
      totalJobs: 0,
      totalHours: 0,
      detectedLanguage,
    };
  }

  /**
   * LINKEDIN: Via dedicated actor or fallback to browser - skip existing candidates
   */
  async scrapeLinkedIn(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No Apify API key');
      return [];
    }

    if (!filter.keyword) {
      console.warn('⚠️ No keyword provided for LinkedIn search');
      return [];
    }

    // Just do ONE search with the provided keyword
    // The loop and query variations are handled by RaidService, not here
    const results = await this.scrapeLinkedInOnce(filter.keyword, filter.languages?.[0]);

    // Simple dedup against existing URLs/emails
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(url => this.normalizeUrl(url))
    );
    const existingEmails = new Set<string>(filter.existingEmails || []);
    const existingNames = new Set<string>(
      (filter.existingNames || []).map(n => n.toLowerCase().trim())
    );

    const filtered = results.filter(c => {
      if (existingNames.has(c.name.toLowerCase().trim())) return false;
      if (c.profileUrl && existingUrls.has(this.normalizeUrl(c.profileUrl))) return false;
      if (c.email && existingEmails.has(c.email.toLowerCase())) return false;
      return true;
    });

    return filtered.slice(0, filter.maxResults || 30);
  }

  private async scrapeLinkedInOnce(query: string, language: string = 'en'): Promise<ScrapedCandidate[]> {
    // Map language codes to LinkedIn language parameters
    const languageCountryMap: Record<string, string> = {
      'en': '',  // Default/English
      'es': '&origin=SWITCH_SEARCH_VERTICAL&skillId=&keywords=',  // Spanish results in LinkedIn
      'fr': '&geoUrn=&keywords=',  // French
      'de': '&keywords=',  // German
      'pt': '&keywords=',  // Portuguese
    };

    const langParam = languageCountryMap[language] || '';
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}${langParam}`;

    console.log(`🌐 LinkedIn búsqueda en idioma: ${language} - URL: ${searchUrl}`);

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
      .map((item, idx) => this.parseLinkedInItem(item, idx, language))
      .filter((c): c is ScrapedCandidate => c !== null)
      .filter(c => c.name.trim().length > 0)
      // FILTER BY LANGUAGE: If Spanish is required, validate candidate speaks it
      .filter(c => {
        if (language === 'es') {
          const speaksSpanish = LanguageDetectionService.speaksLanguage(
            c.bio,
            c.title,
            c.country,
            'es',
            c.name
          );
          if (!speaksSpanish) {
            console.log(`⏭️  Candidato filtrado (no hispanohablante): ${c.name}`);
          }
          return speaksSpanish;
        }
        return true;
      });

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

  private parseLinkedInItem(item: RawActorResult, index: number, language: string = 'en'): ScrapedCandidate | null {
    if (!item || typeof item !== 'object') return null;

    const name = (item.name || item.user || item.fullName || '').trim();
    if (!name || name.length < 2) return null;

    const profileUrl = item.profileUrl || item.url || item.link || '';
    if (!profileUrl || !profileUrl.includes('linkedin.com')) return null;

    const bio = item.bio || item.headline || '';
    const title = item.title || item.jobTitle || item.headline || 'Professional';
    const country = item.country || item.location || 'Unknown';

    // Detect language from profile data
    const detectedLanguage = LanguageDetectionService.detectLanguage(bio, title, country, name);

    return {
      id: `linkedin-${index}-${Date.now()}`,
      name,
      platform: 'LinkedIn' as FreelancePlatform,
      platformUsername: profileUrl.split('/').filter(Boolean).pop() || `user-${index}`,
      profileUrl,
      title,
      country,
      hourlyRate: 0,
      jobSuccessRate: 0,
      certifications: [],
      bio,
      scrapedAt: new Date().toISOString(),
      talentScore: 0,
      skills: Array.isArray(item.skills) ? item.skills : [],
      badges: [],
      yearsExperience: 0,
      detectedLanguage,
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

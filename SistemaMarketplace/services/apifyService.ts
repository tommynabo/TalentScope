import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';

export class ApifyService {
  private apiKey: string;
  private baseUrl = 'https://api.apify.com/v2';

  // ⚠️ CRITICAL: Update these Actor IDs with the actual ones from your Apify account
  // Go to: https://apify.com/store and search for "Fiverr" or "Upwork"
  // Copy the EXACT Actor ID of a working scraper and paste it below
  private actors = {
    // TODO: Find the correct Fiverr actor in your Apify store and replace this
    fiverr: 'CONFIGURE_APIFY_FIVERR_ACTOR_ID',

    // TODO: Find the correct Upwork actor in your Apify store and replace this  
    upwork: 'CONFIGURE_APIFY_UPWORK_ACTOR_ID',
  };

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'mock') {
      console.warn('⚠️ ApifyService initialized with mock key - will return sample data');
    }
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<boolean> {
    if (!this.apiKey || this.apiKey === 'mock') return false;

    try {
      const response = await fetch(`${this.baseUrl}/users/me?token=${this.apiKey}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async scrapeUpwork(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey || this.apiKey === 'mock') {
      console.error('❌ ERROR: No valid Apify key - cannot scrape');
      return []; // Return empty array - NO MOCK DATA
    }

    try {
      return await this.runUpworkActor(filter);
    } catch (error) {
      console.error('❌ Upwork scraping error:', error);
      return []; // Return empty - NO FALLBACK TO MOCK
    }
  }

  async scrapeFiverr(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey || this.apiKey === 'mock') {
      console.error('❌ ERROR: No valid Apify key - cannot scrape');
      return []; // Return empty array - NO MOCK DATA
    }

    try {
      return await this.runFiverrActor(filter);
    } catch (error) {
      console.error('❌ Fiverr scraping error:', error);
      return []; // Return empty - NO FALLBACK TO MOCK
    }
  }

  private async runUpworkActor(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    // Execute Upwork scraper actor on Apify
    const input = {
      searchKeyword: filter.keyword,
      sortBy: 'best_match',
      maxResults: 50,
      minRating: (filter.minJobSuccessRate / 100),
      minHourlyRate: filter.minHourlyRate,
      maxPrice: filter.platforms.includes('Upwork' as any) ? 10000 : undefined,
    };

    const runResult = await this.executeActor(this.actors.upwork, input);

    if (!runResult || !runResult.items || runResult.items.length === 0) {
      console.error('❌ Upwork: No se obtuvieron resultados reales del actor de Apify');
      return [];
    }

    return runResult.items.map((item: any) => ({
      id: `upwork-${item.userId || item.id}`,
      name: item.name || item.title || 'Unknown',
      platform: 'Upwork' as FreelancePlatform,
      platformUsername: item.username || item.userId || '',
      profileUrl: item.profileUrl || `https://upwork.com/freelancers/~${item.userId}`,
      title: item.jobTitle || item.topSkill || 'Freelancer',
      country: item.country || 'Unknown',
      hourlyRate: parseFloat(item.hourlyRate) || filter.minHourlyRate,
      jobSuccessRate: parseFloat(item.jobSuccess) || filter.minJobSuccessRate,
      certifications: item.certifications || [],
      bio: item.bio || item.description || '',
      scrapedAt: new Date().toISOString(),
    }));
  }

  private async runFiverrActor(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    // Execute Fiverr scraper actor on Apify
    const input = {
      searchKeyword: filter.keyword,
      maxResults: 50,
      minRating: (filter.minJobSuccessRate / 100),
    };

    const runResult = await this.executeActor(this.actors.fiverr, input);

    if (!runResult || !runResult.items || runResult.items.length === 0) {
      console.error('❌ Fiverr: No se obtuvieron resultados reales del actor de Apify');
      return [];
    }

    return runResult.items.map((item: any) => ({
      id: `fiverr-${item.sellerId || item.id}`,
      name: item.sellerName || item.name || 'Unknown',
      platform: 'Fiverr' as FreelancePlatform,
      platformUsername: item.username || item.sellerId || '',
      profileUrl: item.profileUrl || `https://fiverr.com/${item.username}`,
      title: item.title || 'Freelancer',
      country: item.location || 'Unknown',
      hourlyRate: parseFloat(item.pricePerHour) || parseFloat(item.minPrice) || filter.minHourlyRate,
      jobSuccessRate: (parseFloat(item.rating) / 5) * 100 || filter.minJobSuccessRate,
      certifications: item.certifications || [],
      bio: item.description || item.bio || '',
      scrapedAt: new Date().toISOString(),
    }));
  }

  private async executeActor(
    actorId: string,
    input: Record<string, any>
  ): Promise<{ items: any[] } | null> {
    // Validate actor ID is properly configured
    if (actorId.includes('CONFIGURE_')) {
      console.error(`❌ Actor ID no configurado: "${actorId}". Debes configurar el Actor ID real de Apify.`);
      console.error('📋 Ve a https://apify.com/store, busca el scraper correspondiente, y actualiza el ID en apifyService.ts');
      return null;
    }

    try {
      // Call Apify to run the actor
      const runResponse = await fetch(
        `${this.baseUrl}/acts/${actorId}/runs?token=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!runResponse.ok) {
        throw new Error(`Actor execution failed: ${runResponse.status}`);
      }

      const runData = await runResponse.json();
      const runId = runData.data.id;

      // Poll for completion (max 30 seconds)
      let completed = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 500ms = 30 seconds

      while (!completed && attempts < maxAttempts) {
        await this.sleep(500);

        const statusResponse = await fetch(
          `${this.baseUrl}/acts/${actorId}/runs/${runId}?token=${this.apiKey}`
        );

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.data.status === 'SUCCEEDED') {
            completed = true;
          } else if (status.data.status === 'FAILED') {
            throw new Error(`Actor run failed: ${status.data.statusMessage}`);
          }
        }
        attempts++;
      }

      if (!completed) {
        throw new Error('Actor run timeout');
      }

      // Get results
      const resultsResponse = await fetch(
        `${this.baseUrl}/acts/${actorId}/runs/${runId}/dataset/items?token=${this.apiKey}`
      );

      if (resultsResponse.ok) {
        return await resultsResponse.json();
      }

      return null;
    } catch (error) {
      console.error('Apify actor execution error:', error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // generateMockCandidates ELIMINADO — NO MOCK DATA, SOLO DATOS REALES
}

import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';

export class ApifyService {
  private apiKey: string;
  private baseUrl = 'https://api.apify.com/v2';

  // Actor IDs reales de Apify Store — configurables via ENV o hardcoded
  private actors = {
    upwork: import.meta.env.VITE_APIFY_UPWORK_ACTOR_ID || 'powerai/upwork-talent-search-scraper',
    fiverr: import.meta.env.VITE_APIFY_FIVERR_ACTOR_ID || 'newpo/fiverr-scraper',
  };

  constructor(apiKey: string) {
    if (!apiKey) {
      console.error('❌ ApifyService: No se proporcionó API key');
    }
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}/users/me?token=${this.apiKey}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async scrapeUpwork(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ ERROR: No valid Apify key - cannot scrape');
      return [];
    }

    try {
      return await this.runUpworkActor(filter);
    } catch (error) {
      console.error('❌ Upwork scraping error:', error);
      return [];
    }
  }

  async scrapeFiverr(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ ERROR: No valid Apify key - cannot scrape');
      return [];
    }

    try {
      return await this.runFiverrActor(filter);
    } catch (error) {
      console.error('❌ Fiverr scraping error:', error);
      return [];
    }
  }

  private async runUpworkActor(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    // Build Upwork search URL with filters
    const keyword = encodeURIComponent(filter.keyword);
    const rate = filter.minHourlyRate ? `&rate=${filter.minHourlyRate}-` : '';
    const searchUrl = `https://www.upwork.com/nx/search/talent/?q=${keyword}${rate}&sort=relevance`;

    console.log(`🔗 Upwork search URL: ${searchUrl}`);

    const input = {
      searchUrl,
    };

    const results = await this.executeActor(this.actors.upwork, input);

    if (!results || results.length === 0) {
      console.error('❌ Upwork: No se obtuvieron resultados reales del actor de Apify');
      return [];
    }

    console.log(`✅ Upwork actor devolvió ${results.length} resultados raw`);

    return results.map((item: any, index: number) => ({
      id: `upwork-${item.userId || item.id || item.ciphertext || index}`,
      name: item.name || item.freelancerName || item.title || 'Unknown',
      platform: 'Upwork' as FreelancePlatform,
      platformUsername: item.username || item.userId || item.ciphertext || '',
      profileUrl: item.profileUrl || item.url || item.link || `https://upwork.com/freelancers/~${item.userId || item.ciphertext || ''}`,
      title: item.jobTitle || item.title || item.topSkill || item.specialization || 'Freelancer',
      country: item.country || item.location || 'Unknown',
      hourlyRate: parseFloat(item.hourlyRate || item.rate || item.price || '0') || filter.minHourlyRate,
      jobSuccessRate: parseFloat(item.jobSuccess || item.jobSuccessRate || item.successRate || '0') || 0,
      certifications: item.certifications || item.badges || [],
      bio: item.bio || item.description || item.overview || item.shortOverview || '',
      scrapedAt: new Date().toISOString(),
    }));
  }

  private async runFiverrActor(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    // Build Fiverr search URL
    const keyword = encodeURIComponent(filter.keyword);
    const searchUrl = `https://www.fiverr.com/search/gigs?query=${keyword}`;

    console.log(`🔗 Fiverr search URL: ${searchUrl}`);

    const input = {
      urls: [searchUrl],
      maxPages: 3,
    };

    const results = await this.executeActor(this.actors.fiverr, input);

    if (!results || results.length === 0) {
      console.error('❌ Fiverr: No se obtuvieron resultados reales del actor de Apify');
      return [];
    }

    console.log(`✅ Fiverr actor devolvió ${results.length} resultados raw`);

    return results.map((item: any, index: number) => ({
      id: `fiverr-${item.gigId || item.sellerId || item.id || index}`,
      name: item.seller || item.sellerName || item.name || 'Unknown',
      platform: 'Fiverr' as FreelancePlatform,
      platformUsername: item.seller || item.username || item.sellerId || '',
      profileUrl: item.url || item.profileUrl || `https://fiverr.com/${item.seller || ''}`,
      title: item.title || 'Freelancer',
      country: item.location || item.country || 'Unknown',
      hourlyRate: this.parseFiverrPrice(item.price) || filter.minHourlyRate,
      jobSuccessRate: this.parseFiverrRating(item.rating),
      certifications: item.isPro ? ['Fiverr Pro'] : [],
      bio: item.description || item.title || '',
      scrapedAt: new Date().toISOString(),
    }));
  }

  /**
   * Parses Fiverr price strings like "Starting at$200" => 200
   */
  private parseFiverrPrice(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const match = price.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    }
    return 0;
  }

  /**
   * Converts Fiverr rating (0-5 scale) to job success percentage (0-100)
   */
  private parseFiverrRating(rating: any): number {
    const num = parseFloat(rating);
    if (isNaN(num)) return 0;
    // Fiverr uses 0-5 scale, convert to percentage
    return Math.round((num / 5) * 100);
  }

  /**
   * Apify API uses ~ instead of / in actor IDs for URL paths
   * e.g. powerai/upwork-talent-search-scraper => powerai~upwork-talent-search-scraper
   */
  private encodeActorId(actorId: string): string {
    return actorId.replace(/\//g, '~');
  }

  private async executeActor(
    actorId: string,
    input: Record<string, any>
  ): Promise<any[] | null> {
    const encodedActorId = this.encodeActorId(actorId);
    try {
      console.log(`🚀 Ejecutando actor: ${actorId} (API path: ${encodedActorId})`);

      // Call Apify to run the actor
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
        throw new Error(`Actor execution failed: ${runResponse.status} - ${errText}`);
      }

      const runData = await runResponse.json();
      const runId = runData.data.id;

      console.log(`⏳ Actor iniciado, run ID: ${runId}. Esperando resultados...`);

      // Poll for completion (max 3 minutes — actors reales tardan más)
      let completed = false;
      let attempts = 0;
      const maxAttempts = 180; // 180 * 1000ms = 3 minutes
      const pollInterval = 1000;

      while (!completed && attempts < maxAttempts) {
        await this.sleep(pollInterval);

        const statusResponse = await fetch(
          `${this.baseUrl}/acts/${encodedActorId}/runs/${runId}?token=${this.apiKey}`
        );

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          const runStatus = status.data.status;

          if (attempts % 10 === 0) {
            console.log(`⏳ Estado del actor: ${runStatus} (${attempts}s transcurridos)`);
          }

          if (runStatus === 'SUCCEEDED') {
            completed = true;
          } else if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
            throw new Error(`Actor run failed with status: ${runStatus} - ${status.data.statusMessage || ''}`);
          }
        }
        attempts++;
      }

      if (!completed) {
        throw new Error(`Actor run timeout after ${maxAttempts} seconds`);
      }

      // Get results from the default dataset
      const datasetId = runData.data.defaultDatasetId;
      const resultsUrl = datasetId
        ? `${this.baseUrl}/datasets/${datasetId}/items?token=${this.apiKey}`
        : `${this.baseUrl}/acts/${encodedActorId}/runs/${runId}/dataset/items?token=${this.apiKey}`;

      const resultsResponse = await fetch(resultsUrl);

      if (resultsResponse.ok) {
        const data = await resultsResponse.json();
        // The dataset endpoint returns a flat array directly
        const items = Array.isArray(data) ? data : (data.items || data.data || []);
        console.log(`📊 Dataset devolvió ${items.length} items`);
        return items;
      }

      console.error(`❌ Error obteniendo resultados del dataset: ${resultsResponse.status}`);
      return null;
    } catch (error) {
      console.error('❌ Apify actor execution error:', error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

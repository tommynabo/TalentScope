import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';
import { ApifyConfigService } from './apifyConfigService';

export class ApifyService {
  private apiKey: string;
  private baseUrl = 'https://api.apify.com/v2';
  private configService: ApifyConfigService | null = null;

  // Actor IDs por defecto (fallback si no están en DB)
  private defaultActors = {
    upwork: 'nwtn/upwork-profile-scraper',
    fiverr: 'apify/web-scraper',
  };

  // Actor IDs cargados desde la base de datos
  private actors = {
    upwork: '',
    fiverr: '',
  };

  /**
   * Constructor
   * @param apiKey - API key de Apify (puede ser específica para marketplace)
   * @param supabaseUrl - URL de Supabase
   * @param supabaseKey - Clave anon de Supabase
   */
  constructor(apiKey: string, supabaseUrl?: string, supabaseKey?: string) {
    if (!apiKey) {
      console.error('❌ ApifyService: No se proporcionó API key');
    }
    this.apiKey = apiKey;

    // Inicializar servicio de configuración si se proporciona
    if (supabaseUrl && supabaseKey) {
      this.configService = new ApifyConfigService(supabaseUrl, supabaseKey);
      this.initializeActorIds();
    } else {
      // Usar valores por defecto si no hay Supabase
      this.actors = { ...this.defaultActors };
      console.warn('⚠️ ApifyService: Usando Actor IDs por defecto. Para usar configuración de BD, proporciona supabaseUrl y supabaseKey');
    }
  }

  /**
   * Inicializar los Actor IDs desde la base de datos
   */
  private async initializeActorIds(): Promise<void> {
    if (!this.configService) {
      this.actors = { ...this.defaultActors };
      return;
    }

    try {
      // Obtener Actor IDs desde la base de datos
      const upworkId = await this.configService.getActorId('upwork_scraper');
      const fiverrId = await this.configService.getActorId('fiverr_scraper');

      // Usar valores de BD si existen, si no usar defaults
      this.actors.upwork = upworkId || this.defaultActors.upwork;
      this.actors.fiverr = fiverrId || this.defaultActors.fiverr;

      console.log('✅ Actor IDs cargados desde base de datos');
      console.log(`   - Upwork: ${this.actors.upwork}`);
      console.log(`   - Fiverr: ${this.actors.fiverr}`);
    } catch (error) {
      console.error('❌ Error inicializando Actor IDs desde BD:', error);
      // Fallback a valores por defecto
      this.actors = { ...this.defaultActors };
    }
  }

  /**
   * Actualizar un Actor ID en la base de datos
   */
  async updateActorId(platform: 'upwork' | 'fiverr', newActorId: string): Promise<boolean> {
    if (!this.configService) {
      console.error('❌ No hay servicio de configuración - no se puede actualizar Actor ID');
      return false;
    }

    const configKey = platform === 'upwork' ? 'upwork_scraper' : 'fiverr_scraper';
    const platformName = platform === 'upwork' ? 'Upwork' : 'Fiverr';

    const success = await this.configService.setActorId(
      configKey,
      newActorId,
      platformName as any,
      `Scraper de ${platformName} actualizado ${new Date().toISOString()}`
    );

    if (success) {
      this.actors[platform] = newActorId;
      console.log(`✅ Actor ID de ${platformName} actualizado: ${newActorId}`);
    }

    return success;
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

    // Input adaptado para nwtn/upwork-profile-scraper
    const input = {
      startUrls: [{ url: searchUrl }],
      maxPages: 2,
      maxResults: 50,
      waitUntilContentLoaded: true,
    };

    const results = await this.executeActor(this.actors.upwork, input);

    if (!results || results.length === 0) {
      console.error('❌ Upwork: No se obtuvieron resultados reales del actor de Apify');
      return [];
    }

    console.log(`✅ Upwork actor devolvió ${results.length} resultados raw`);

    return results.map((item: any, index: number) => ({
      id: `upwork-${item.id || item.userId || item.ciphertext || index}`,
      name: item.name || item.title || item.freelancerName || 'Unknown',
      platform: 'Upwork' as FreelancePlatform,
      platformUsername: item.username || item.userId || item.ciphertext || '',
      profileUrl: item.profileUrl || item.url || item.link || `https://upwork.com/freelancers/~${item.id || item.userId || ''}`,
      title: item.title || item.jobTitle || item.topSkill || item.specialization || 'Freelancer',
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

    // Input adaptado para apify/web-scraper (universal)
    const input = {
      startUrls: [{ url: searchUrl }],
      maxPages: 2,
      maxResults: 50,
      pageFunction: `
        async function pageFunction(context) {
          const { page, request, log } = context;
          const results = [];
          const gigs = page.querySelectorAll('[data-qa="gig-card"]');
          
          gigs.forEach((gig, idx) => {
            const titleElement = gig.querySelector('[data-qa="gig-card-title"]') || gig.querySelector('h3');
            const priceElement = gig.querySelector('[data-qa="gig-price"]') || gig.querySelector('.price');
            const ratingElement = gig.querySelector('[data-qa="star-rating"]') || gig.querySelector('.star-rating');
            const sellerElement = gig.querySelector('[data-qa="seller-name"]') || gig.querySelector('[data-qa="gig-creator-name"]');
            const linkElement = gig.querySelector('a[href*="/"]');
            
            results.push({
              id: idx,
              title: titleElement?.textContent?.trim() || 'Gig',
              price: priceElement?.textContent?.trim() || '0',
              rating: ratingElement?.textContent?.trim() || '0',
              seller: sellerElement?.textContent?.trim() || 'Unknown',
              url: linkElement?.href || '',
              description: gig.textContent?.substring(0, 200) || '',
            });
          });
          
          return results;
        }
      `,
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

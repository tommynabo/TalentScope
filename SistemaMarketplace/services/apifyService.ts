import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';
import { ApifyConfigService } from './apifyConfigService';

export class ApifyService {
  private apiKey: string;
  private baseUrl = 'https://api.apify.com/v2';
  private configService: ApifyConfigService | null = null;

  // Actor IDs por defecto (fallback si no están en DB)
  private defaultActors = {
    upwork: 'apify/web-scraper',  // Changed from nwtn/upwork-profile-scraper - not available in all accounts
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

    // Usar apify/web-scraper con pageFunction optimizado para Upwork
    const input = {
      startUrls: [{ url: searchUrl }],
      maxPages: 2,
      maxResults: 50,
      pageFunction: `
        async function pageFunction(context) {
          const { page, request, log } = context;
          const results = [];
          
          // Selector mejorado para tarjetas de freelancer en Upwork
          const freelancerCards = page.querySelectorAll('[data-test="freelancer-card"]') || 
                                 page.querySelectorAll('.freelancer-card') ||
                                 page.querySelectorAll('[class*="freelancer"]');
          
          if (freelancerCards.length === 0) {
            // Fallback: buscar por estructura HTML común
            const searchResults = page.querySelectorAll('[data-testid="search-result"]') ||
                                 page.querySelectorAll('[class*="search"] [class*="result"]');
            
            searchResults.forEach((result, idx) => {
              const nameEl = result.querySelector('h2') || result.querySelector('[class*="name"]');
              const titleEl = result.querySelector('[class*="title"]') || result.querySelector('p');
              const rateEl = result.querySelector('[class*="rate"]') || result.querySelector('[class*="price"]');
              const linkEl = result.querySelector('a[href*="/freelancers/"]') || result.querySelector('a');
              
              if (nameEl && linkEl) {
                results.push({
                  name: nameEl.textContent?.trim() || 'Unknown',
                  title: titleEl?.textContent?.trim() || 'Freelancer',
                  rate: rateEl?.textContent?.trim() || '0',
                  url: linkEl.href || '',
                  userId: linkEl.href?.split('/').pop() || idx,
                });
              }
            });
          } else {
            // Extracción desde tarjetas de freelancer
            freelancerCards.forEach((card, idx) => {
              const nameEl = card.querySelector('[class*="freelancer-name"]') || card.querySelector('h2');
              const titleEl = card.querySelector('[class*="title"]') || card.querySelector('p:first-of-type');
              const rateEl = card.querySelector('[class*="hourly-rate"]') || card.querySelector('[class*="rate"]');
              const ratingEl = card.querySelector('[class*="rating"]') || card.querySelector('[class*="stars"]');
              const linkEl = card.querySelector('a[href*="/freelancers/"]') || card.querySelector('a');
              
              results.push({
                name: nameEl?.textContent?.trim() || 'Unknown',
                title: titleEl?.textContent?.trim() || 'Freelancer',
                rate: rateEl?.textContent?.trim() || '0',
                rating: ratingEl?.textContent?.trim() || '0',
                url: linkEl?.href || '',
                userId: linkEl?.href?.split('/').pop() || idx,
              });
            });
          }
          
          return results.length > 0 ? results : [];
        }
      `,
    };

    const results = await this.executeActor(this.actors.upwork, input);

    if (!results || results.length === 0) {
      console.error('❌ Upwork: No se obtuvieron resultados reales del actor de Apify');
      return [];
    }

    console.log(`✅ Upwork actor devolvió ${results.length} resultados raw`);

    return results.map((item: any, index: number) => ({
      id: `upwork-${item.userId || item.id || index}`,
      name: item.name || 'Unknown',
      platform: 'Upwork' as FreelancePlatform,
      platformUsername: item.userId || item.username || '',
      profileUrl: item.url || `https://upwork.com/freelancers/${item.userId || ''}`,
      title: item.title || 'Freelancer',
      country: item.country || 'Unknown',
      hourlyRate: this.parseRate(item.rate) || filter.minHourlyRate,
      jobSuccessRate: this.parseRating(item.rating) || 0,
      certifications: [],
      bio: '',
      scrapedAt: new Date().toISOString(),
    }));
  }

  private async runFiverrActor(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    // Build Fiverr search URL
    const keyword = encodeURIComponent(filter.keyword);
    const searchUrl = `https://www.fiverr.com/search/gigs?query=${keyword}`;

    console.log(`🔗 Fiverr search URL: ${searchUrl}`);

    // Input optimizado para apify/web-scraper con pageFunction mejorada
    const input = {
      startUrls: [{ url: searchUrl }],
      maxPages: 2,
      maxResults: 100,
      pageFunction: `
        async function pageFunction(context) {
          const { page, request, log } = context;
          const results = [];
          
          // Estrategia 1: Buscar tarjetas de gig por data-qa
          let gigs = page.querySelectorAll('[data-qa="gig-card"]');
          
          if (gigs.length === 0) {
            // Estrategia 2: Buscar por clase común
            gigs = page.querySelectorAll('[class*="gig-card"], [class*="gig"], .s-result-item');
          }
          
          if (gigs.length === 0) {
            // Estrategia 3: Buscar todos los enlaces que contengan /gigs/
            const allGigLinks = page.querySelectorAll('a[href*="/gigs/"]');
            const processedUrls = new Set();
            
            allGigLinks.forEach((link) => {
              const href = link.href;
              if (!processedUrls.has(href) && href.includes('/gigs/')) {
                const parent = link.closest('[class*="card"]') || link.closest('div[data-qa]') || link.parentElement.parentElement;
                if (parent) {
                  const titleEl = link.querySelector('h3, [class*="title"]') || link;
                  const priceEl = parent.querySelector('[class*="price"], [data-qa*="price"]');
                  const sellerEl = parent.querySelector('[data-qa*="seller"], [class*="seller-name"]');
                  
                  const seller = sellerEl?.textContent?.trim() || link.getAttribute('aria-label') || '';
                  const title = titleEl?.textContent?.trim() || '';
                  
                  if (title && !title.includes('Fiverr') && seller && !seller.includes('Fiverr')) {
                    results.push({
                      title: title,
                      seller: seller,
                      price: priceEl?.textContent?.trim() || 'Starting at',
                      rating: parent.querySelector('[class*="rating"], [data-qa*="rating"]')?.textContent?.trim() || '0',
                      reviews: parent.querySelector('[class*="review"]')?.textContent?.match(/\\d+/)?.[0] || '0',
                      url: href,
                    });
                    processedUrls.add(href);
                  }
                }
              }
            });
            
            return results;
          }
          
          // Procesar tarjetas de gig encontradas
          gigs.forEach((gig, idx) => {
            const titleEl = gig.querySelector('[data-qa="gig-card-title"]') || gig.querySelector('h3') || gig.querySelector('[class*="title"]');
            const priceEl = gig.querySelector('[data-qa="gig-price"]') || gig.querySelector('[class*="price"]');
            const ratingEl = gig.querySelector('[data-qa="star-rating"]') || gig.querySelector('[class*="rating"]');
            const reviewsEl = gig.querySelector('[class*="reviews"]');
            const sellerEl = gig.querySelector('[data-qa="gig-creator-name"]') || gig.querySelector('[class*="seller-name"]') || gig.querySelector('[class*="by"]');
            const linkEl = gig.querySelector('a[href*="/gigs/"]') || gig.querySelector('a');
            
            const title = titleEl?.textContent?.trim() || '';
            const seller = sellerEl?.textContent?.trim()?.replace(/^by\\s+/i, '') || '';
            const price = priceEl?.textContent?.trim() || '';
            
            // Validaciones: descartar si no tiene datos o si es Fiverr
            const isValidSeller = seller && !seller.toLowerCase().includes('fiverr') && seller.length > 0;
            const isValidTitle = title && !title.toLowerCase().includes('fiverr');
            
            if (isValidSeller && isValidTitle) {
              results.push({
                title: title,
                seller: seller,
                price: price || 'Starting at',
                rating: ratingEl?.textContent?.trim() || '0',
                reviews: reviewsEl?.textContent?.match(/\\d+/)?.[0] || '0',
                url: linkEl?.href || '',
              });
            }
          });
          
          console.log('Extracted ' + results.length + ' valid gigs');
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

    // Filtrado adicional en frontend para eliminar resultados inválidos
    return results
      .filter((item: any) => {
        const seller = (item.seller || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        
        // Descartar si no tiene seller válido o es resultado de Fiverr
        return item.seller && item.seller.trim().length > 2 && 
               !seller.includes('fiverr') && 
               !title.includes('fiverr') &&
               item.title;
      })
      .map((item: any, index: number) => ({
        id: `fiverr-${item.url?.split('/').pop() || index}`,
        name: item.seller || 'Unknown Seller',
        platform: 'Fiverr' as FreelancePlatform,
        platformUsername: item.seller?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
        profileUrl: item.url || 'https://www.fiverr.com',
        title: item.title || 'Gig Provider',
        country: 'Unknown',
        hourlyRate: this.parseRate(item.price),
        jobSuccessRate: this.parseRating(item.rating),
        certifications: item.reviews && parseInt(item.reviews) > 50 ? ['Top Rated'] : [],
        bio: item.reviews ? `${item.reviews} reviews` : '',
        scrapedAt: new Date().toISOString(),
      }));
  }

  /**
   * Parse price strings from any platform
   * Examples: "$25", "Starting at $100", "€50/hr", "¥5000"
   */
  private parseRate(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      // Extract all numbers and take the first one
      const match = price.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    }
    return 0;
  }

  /**
   * Convert rating to 0-100 scale
   * Handles both 5-star (Fiverr) and percentage (Upwork) ratings
   */
  private parseRating(rating: any): number {
    if (typeof rating === 'string') {
      const num = parseFloat(rating.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return 0;
      
      // If number is > 5, assume it's already a percentage
      if (num > 5) return Math.min(Math.round(num), 100);
      // Otherwise convert 5-star to percentage
      return Math.round((num / 5) * 100);
    }
    if (typeof rating === 'number') {
      if (rating > 5) return Math.min(Math.round(rating), 100);
      return Math.round((rating / 5) * 100);
    }
    return 0;
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

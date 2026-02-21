import { ScrapingFilter, ScrapedCandidate, FreelancePlatform } from '../types/marketplace';
import { ApifyConfigService } from './apifyConfigService';

/**
 * ApifyService v2 — Dedicated Actors + TalentScore
 * 
 * Uses platform-specific Apify actors that are actively maintained
 * instead of generic web-scraper with fragile CSS selectors.
 * 
 * Actors:
 *  - Upwork: upwork-vibe/upwork-scraper (dedicated, no auth)
 *  - Fiverr: apify/web-scraper with Puppeteer pageFunction
 *  - LinkedIn: curious_coder/linkedin-search-api (no cookies needed)
 */
export class ApifyService {
  private apiKey: string;
  private baseUrl = 'https://api.apify.com/v2';
  private configService: ApifyConfigService | null = null;

  // Actor IDs — apify/web-scraper is FREE and included in every Apify account
  // Dedicated actors (upwork-vibe, newpo, etc.) require PAID rental
  private defaultActors = {
    upwork: 'nwtn/upwork-profile-scraper',
    fiverr: 'apify/web-scraper',
    linkedin: 'curious_coder/linkedin-search-api',
  };

  // Actor IDs loaded from DB (overrides defaults)
  private actors = {
    upwork: '',
    fiverr: '',
    linkedin: '',
  };

  private actorsInitialized = false;

  constructor(apiKey: string, supabaseUrl?: string, supabaseKey?: string) {
    if (!apiKey) {
      console.error('❌ ApifyService: No se proporcionó API key');
    }
    this.apiKey = apiKey;

    if (supabaseUrl && supabaseKey) {
      this.configService = new ApifyConfigService(supabaseUrl, supabaseKey);
      this.initializeActorIds();
    } else {
      this.actors = { ...this.defaultActors };
      console.warn('⚠️ ApifyService: Usando Actor IDs por defecto (sin Supabase)');
    }
  }

  private async initializeActorIds(): Promise<void> {
    if (this.actorsInitialized) return;

    if (!this.configService) {
      this.actors = { ...this.defaultActors };
      return;
    }

    try {
      const upworkId = await this.configService.getActorId('upwork_scraper');
      const fiverrId = await this.configService.getActorId('fiverr_scraper');
      const linkedinId = await this.configService.getActorId('linkedin_scraper');

      this.actors.upwork = upworkId || this.defaultActors.upwork;
      this.actors.fiverr = fiverrId || this.defaultActors.fiverr;
      this.actors.linkedin = linkedinId || this.defaultActors.linkedin;

      this.actorsInitialized = true;
      console.log('✅ Actor IDs cargados:');
      console.log(`   - Upwork: ${this.actors.upwork}`);
      console.log(`   - Fiverr: ${this.actors.fiverr}`);
      console.log(`   - LinkedIn: ${this.actors.linkedin}`);
    } catch (error) {
      console.error('❌ Error inicializando Actor IDs:', error);
      this.actors = { ...this.defaultActors };
    }
  }

  async updateActorId(platform: 'upwork' | 'fiverr' | 'linkedin', newActorId: string): Promise<boolean> {
    if (!this.configService) {
      console.error('❌ No hay servicio de configuración');
      return false;
    }

    const keyMap: Record<string, string> = {
      upwork: 'upwork_scraper',
      fiverr: 'fiverr_scraper',
      linkedin: 'linkedin_scraper',
    };

    const platformMap: Record<string, 'Upwork' | 'Fiverr' | 'LinkedIn'> = {
      upwork: 'Upwork',
      fiverr: 'Fiverr',
      linkedin: 'LinkedIn',
    };

    const success = await this.configService.setActorId(
      keyMap[platform],
      newActorId,
      platformMap[platform],
      `Scraper de ${platformMap[platform]} actualizado ${new Date().toISOString()}`
    );

    if (success) {
      this.actors[platform] = newActorId;
      console.log(`✅ Actor ID de ${platformMap[platform]} actualizado: ${newActorId}`);
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

  // ─── UPWORK SCRAPING ────────────────────────────────────────────────────

  async scrapeUpwork(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No hay API key de Apify');
      return [];
    }

    await this.initializeActorIds();

    try {
      console.log(`🔍 Upwork: Iniciando búsqueda con buffer de intentos múltiples...`);
      // NUEVO: Usar búsqueda con buffer + loop de reintentos (como LinkedIn/GitHub)
      return await this.scrapeUpworkWithBuffer(filter);
    } catch (error) {
      console.error('❌ Upwork scraping error:', error);
      return [];
    }
  }

  // ─── BÚSQUEDA CON BUFFER (Patrón LinkedIn/GitHub) ──────────────────────────

  private async scrapeUpworkWithBuffer(filter: ScrapingFilter, maxRetries: number = 5): Promise<ScrapedCandidate[]> {
    const buffer: ScrapedCandidate[] = [];
    const targetCount = 50; // Objetivo de candidatos
    const seenProfiles = new Set<string>(); // Dedup por profileUrl
    let attempt = 0;

    console.log(`📊 Upwork: Búsqueda con buffer - Target: ${targetCount} candidatos en ${maxRetries} intentos`);

    while (buffer.length < targetCount && attempt < maxRetries) {
      attempt++;

      // Crear variación de query
      const queryKeyword = this.getUpworkQueryVariation(filter.keyword, attempt);
      console.log(`\n[Intento ${attempt}/${maxRetries}] 🔍 Buscando "${queryKeyword}"...`);

      // Crear filtro modificado con la nueva keyword
      const modifiedFilter = {
        ...filter,
        keyword: queryKeyword
      };

      try {
        // Buscar con maxResults * 4 (como LinkedIn)
        const tempResults = await this.runUpworkDedicated(modifiedFilter);
        console.log(`   ✅ ${tempResults.length} resultados raw obtenidos`);

        if (tempResults.length === 0) {
          console.log(`   ⚠️ Sin resultados en este intento`);
          continue;
        }

        // Filtrar duplicados (por profileUrl/platformUsername) y agregar al buffer
        const newCandidates = tempResults.filter(c => {
          const key = c.profileUrl || c.platformUsername;
          if (seenProfiles.has(key)) {
            return false;
          }
          seenProfiles.add(key);
          return true;
        });

        buffer.push(...newCandidates);
        console.log(`   📦 Buffer: ${buffer.length}/${targetCount} candidatos acumulados`);

        if (buffer.length >= targetCount) {
          console.log(`   ✅ Meta alcanzada en intento ${attempt}`);
          break;
        }
      } catch (err: any) {
        console.error(`   ❌ Error en intento ${attempt}: ${err.message}`);
      }
    }

    console.log(`\n✅ Búsqueda completada: ${buffer.length} candidatos únicos encontrados`);
    return buffer.slice(0, 50); // Retorna máximo 50
  }

  private getUpworkQueryVariation(baseKeyword: string, attempt: number): string {
    const variations = [
      baseKeyword, // Intento 1: Keyword base
      `"${baseKeyword}" Top Rated`, // Intento 2: Con badge
      `${baseKeyword} "rising talent" OR "level 1"`, // Intento 3: Nivel bajo
      `${baseKeyword} freelance remote`, // Intento 4: Con atributos
      `${baseKeyword} experienced OR expert OR senior`, // Intento 5: Experiencia
    ];

    const selected = variations[Math.min(attempt - 1, variations.length - 1)];
    console.log(`   📝 Variación: ${selected}`);
    return selected;
  }

  private extractPageFunctionResults(results: any[]): any[] {
    if (!results || !Array.isArray(results)) return [];

    const extracted: any[] = [];
    for (const r of results) {
      if (r && r.pageFunctionResult) {
        if (Array.isArray(r.pageFunctionResult)) {
          extracted.push(...r.pageFunctionResult);
        } else {
          extracted.push(r.pageFunctionResult);
        }
      } else {
        extracted.push(r);
      }
    }
    return extracted;
  }

  private async runUpworkDedicated(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    const keyword = encodeURIComponent(filter.keyword);
    // Many dedicated actors prefer direct query, others prefer searchUrl
    // Provide both to be safe
    const searchUrl = `https://www.upwork.com/nx/search/talent/?q=${keyword}&sort=relevance`;

    console.log(`🔗 Upwork URL: ${searchUrl}`);
    const actorId = this.actors.upwork;

    // For dedicated actors like nwtn/upwork-profile-scraper
    const input: Record<string, any> = {
      searchQuery: filter.keyword,
      search: filter.keyword,
      query: filter.keyword,
      searchUrl: searchUrl,
      startUrls: [{ url: searchUrl }],
      urls: [searchUrl], // specific to nwtn
      maxResults: 50,
      maxItems: 50,
      maxPages: 3 // specific to nwtn
    };

    // Real pageFunction for apify/web-scraper - SIMPLIFIED, working extraction
    if (actorId === 'apify/web-scraper') {
      input.pageFunction = `
        async function pageFunction(context) {
          const { page } = context;
          
          // Simple extraction - find ALL links that look like Upwork profiles
          const results = [];
          
          try {
            // Get all links on the page
            const links = await page.$$('a[href*="/o/"], a[href*="/freelancers/"]');
            
            for (const link of links.slice(0, 50)) {
              try {
                // Get href
                const href = await link.evaluate(el => el.href);
                
                // Get text
                const text = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
                
                if (href && text && text.length > 2) {
                  results.push({
                    name: text,
                    profileUrl: href,
                    title: 'Freelancer'
                  });
                }
              } catch (e) {
                // Skip this link
              }
            }
          } catch (e) {
            // If selector didn't find anything, try a different approach
          }
          
          // If no results, try ANY link that might be a profile
          if (results.length === 0) {
            try {
              const allLinks = await page.$$('a');
              for (const link of allLinks.slice(0, 100)) {
                try {
                  const href = await link.evaluate(el => el.href || '');
                  const text = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
                  
                  // Check if looks like Upwork profile
                  if ((href.includes('/o/') || href.includes('/freelancers/')) && text && text.length > 2) {
                    results.push({
                      name: text,
                      profileUrl: href,
                      title: 'Freelancer'
                    });
                  }
                  
                  if (results.length >= 50) break;
                } catch (e) {
                  // Continue
                }
              }
            } catch (e) {
              // Fallback failed too
            }
          }
          
          return results.slice(0, 50);
        }
      `;
      input.proxyConfiguration = { useApifyProxy: true };
    }

    const rawResults = await this.executeActor(actorId, input);

    if (!rawResults || rawResults.length === 0) {
      console.warn('⚠️ Upwork: El actor no devolvió resultados.');
      return [];
    }

    // Extract pageFunctionResult if it exists (apify/web-scraper wraps results)
    const results = this.extractPageFunctionResults(rawResults);

    // Filter out actual error items (not all items - be lenient)
    // Only filter if item is explicitly marked as error
    let validResults = results.filter((r: any) => {
      if (typeof r === 'object' && r !== null) {
        // Skip only if explicitly marked as error and has nothing else
        if (r['#error'] && !r.name && !r.profileUrl) {
          return false;
        }
        // Keep anything with basic info
        return r.name || r.profileUrl || r.title;
      }
      return false;
    });

    // If we got nothing after filtering, return original results
    if (validResults.length === 0) {
      validResults = results.filter((r: any) => typeof r === 'object' && r !== null);
      if (validResults.length === 0) {
        console.warn('⚠️ Upwork: Los resultados no tienen formato válido.');
        return [];
      }
    }

    console.log(`✅ Upwork: ${validResults.length} resultados raw del actor`);
    return this.normalizeUpworkResults(validResults, filter);
  }

  private normalizeUpworkResults(results: any[], filter: ScrapingFilter): ScrapedCandidate[] {
    return results
      .map((item: any, index: number) => {
        const name = item.name || item.freelancerName || item.title_name || 'Unknown';
        const title = item.title || item.headline || item.occupation || 'Freelancer';
        const rate = this.parseRate(item.rate || item.hourlyRate || item.price || item.chargeRate);
        const successRate = this.parseSuccessRate(item.success || item.jobSuccess || item.jobSuccessRate);
        const country = item.country || item.location || 'Unknown';
        const profileUrl = item.url || item.profileUrl || item.link || '';
        const badges = item.badges || [];
        const skills = item.skills || item.topSkills || [];
        const totalEarnings = this.parseNumber(item.totalEarnings || item.earnings);
        const totalJobs = this.parseNumber(item.totalJobs || item.jobs);
        const totalHours = this.parseNumber(item.totalHours || item.hours);

        const candidate: ScrapedCandidate = {
          id: `upwork-${item.userId || item.id || item.ciphertext || index}-${Date.now()}`,
          name,
          platform: 'Upwork' as FreelancePlatform,
          platformUsername: profileUrl.split('/').filter(Boolean).pop() || `user-${index}`,
          profileUrl,
          title,
          country,
          hourlyRate: rate,
          jobSuccessRate: successRate,
          certifications: badges,
          bio: item.description || item.bio || item.overview || '',
          scrapedAt: new Date().toISOString(),
          talentScore: 0, // Will be calculated below
          skills: Array.isArray(skills) ? skills : [],
          badges,
          yearsExperience: this.estimateExperience(item),
          totalEarnings,
          totalJobs,
          totalHours,
        };

        // Calculate TalentScore
        candidate.talentScore = this.calculateTalentScore(candidate, filter);
        return candidate;
      })
      .filter(c => c.name !== 'Unknown' && c.name.trim().length > 0)
      .filter(c => c.talentScore >= 1) // Very lenient threshold - can be filtered by user
      .sort((a, b) => b.talentScore - a.talentScore); // Best first
  }

  // ─── FIVERR SCRAPING ────────────────────────────────────────────────────

  async scrapeFiverr(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No hay API key de Apify');
      return [];
    }

    await this.initializeActorIds();

    try {
      console.log(`🔍 Fiverr: Iniciando búsqueda con buffer de intentos múltiples...`);
      return await this.scrapeFiverrWithBuffer(filter);
    } catch (error) {
      console.error('❌ Fiverr scraping error:', error);
      return [];
    }
  }

  private async scrapeFiverrWithBuffer(filter: ScrapingFilter, maxRetries: number = 5): Promise<ScrapedCandidate[]> {
    const buffer: ScrapedCandidate[] = [];
    const targetCount = 40; // Objetivo para Fiverr (menos que Upwork)
    const seenProfiles = new Set<string>(); // Dedup por profileUrl
    let attempt = 0;

    console.log(`📊 Fiverr: Búsqueda con buffer - Target: ${targetCount} candidatos en ${maxRetries} intentos`);

    while (buffer.length < targetCount && attempt < maxRetries) {
      attempt++;

      // Crear variación de query
      const queryKeyword = this.getFiverrQueryVariation(filter.keyword, attempt);
      console.log(`\n[Intento ${attempt}/${maxRetries}] 🔍 Buscando "${queryKeyword}"...`);

      // Crear filtro modificado
      const modifiedFilter = {
        ...filter,
        keyword: queryKeyword
      };

      try {
        const tempResults = await this.runFiverrScraper(modifiedFilter);
        console.log(`   ✅ ${tempResults.length} resultados raw obtenidos`);

        if (tempResults.length === 0) {
          console.log(`   ⚠️ Sin resultados en este intento`);
          continue;
        }

        // Filtrar duplicados
        const newCandidates = tempResults.filter(c => {
          const key = c.platformUsername || c.profileUrl;
          if (seenProfiles.has(key)) {
            return false;
          }
          seenProfiles.add(key);
          return true;
        });

        buffer.push(...newCandidates);
        console.log(`   📦 Buffer: ${buffer.length}/${targetCount} candidatos acumulados`);

        if (buffer.length >= targetCount) {
          console.log(`   ✅ Meta alcanzada en intento ${attempt}`);
          break;
        }
      } catch (err: any) {
        console.error(`   ❌ Error en intento ${attempt}: ${err.message}`);
      }
    }

    console.log(`\n✅ Búsqueda completada: ${buffer.length} candidatos únicos encontrados`);
    return buffer.slice(0, 40);
  }

  private getFiverrQueryVariation(baseKeyword: string, attempt: number): string {
    const variations = [
      baseKeyword,
      `"${baseKeyword}" rating high`,
      `${baseKeyword} "top rated" OR "pro"`,
      `${baseKeyword} seller "english" OR "spanish"`,
      `${baseKeyword} portfolio reviews`,
    ];

    const selected = variations[Math.min(attempt - 1, variations.length - 1)];
    console.log(`   📝 Variación: ${selected}`);
    return selected;
  }

  private async runFiverrScraper(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    const keyword = encodeURIComponent(filter.keyword);
    // Search for sellers (people), not gigs, by default if possible
    const searchUrl = `https://www.fiverr.com/search/gigs?query=${keyword}&source=top-bar&ref_ctx_id=2&search_in=everywhere`;

    console.log(`🔗 Fiverr URL: ${searchUrl}`);
    const actorId = this.actors.fiverr;

    // Dedicated Fiverr actors like newpo/fiverr-scraper usually accept search queries
    const input: Record<string, any> = {
      searchQuery: filter.keyword,
      search: filter.keyword,
      query: filter.keyword,
      searchUrl: searchUrl,
      startUrls: [{ url: searchUrl }],
      maxItems: 50,
      maxResults: 50
    };

    // Real pageFunction for apify/web-scraper - SIMPLIFIED, working extraction
    if (actorId === 'apify/web-scraper') {
      input.pageFunction = `
        async function pageFunction(context) {
          const { page } = context;
          
          const results = [];
          
          try {
            // Get all links
            const links = await page.$$('a');
            
            for (const link of links.slice(0, 100)) {
              try {
                const href = await link.evaluate(el => el.href || '');
                const text = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
                
                // Fiverr seller links typically have pattern /[username] or contain /user/
                // OR are seller profile links
                if (text && text.length > 1 && href && href.includes('fiverr.com')) {
                  // Check if it looks like a seller profile URL
                  if (href.match(/fiverr\\.com\\/[a-z0-9_-]+\\/?$/i) || 
                      href.includes('/user/') ||
                      href.includes('seller')) {
                    results.push({
                      seller: text,
                      sellerUrl: href,
                      title: 'Seller'
                    });
                  }
                }
                
                if (results.length >= 50) break;
              } catch (e) {
                // Continue
              }
            }
          } catch (e) {
            // Fallback
          }
          
          // If nothing found, try to extract from any Fiverr links
          if (results.length === 0) {
            try {
              const links = await page.$$('a[href*="fiverr"]');
              for (const link of links.slice(0, 50)) {
                try {
                  const href = await link.evaluate(el => el.href || '');
                  const text = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
                  
                  if (text && href) {
                    results.push({
                      seller: text,
                      sellerUrl: href,
                      title: 'Seller'
                    });
                  }
                } catch (e) {
                  // Skip
                }
              }
            } catch (e) {
              // Fallback failed
            }
          }
          
          return results.slice(0, 50);
        }
      `;
      input.proxyConfiguration = { useApifyProxy: true };
    }

    const rawResults = await this.executeActor(actorId, input);

    if (!rawResults || rawResults.length === 0) {
      console.error('❌ Fiverr: El actor no devolvió resultados.');
      return [];
    }

    // Extract pageFunctionResult if it exists (apify/web-scraper wraps results)
    const results = this.extractPageFunctionResults(rawResults);

    // Better error filtering - be lenient
    let validResults = results.filter((r: any) => {
      if (typeof r === 'object' && r !== null) {
        // Skip only if explicitly error and empty
        if (r['#error'] && !r.seller && !r.sellerUrl && !r.title) {
          return false;
        }
        return r.seller || r.sellerUrl || r.title;
      }
      return false;
    });

    // If nothing valid, return all objects
    if (validResults.length === 0) {
      validResults = results.filter((r: any) => typeof r === 'object' && r !== null);
      if (validResults.length === 0) {
        console.warn('⚠️ Fiverr: Los resultados no tienen formato válido.');
        return [];
      }
    }

    console.log(`✅ Fiverr: ${validResults.length} resultados raw`);
    return this.normalizeFiverrResults(validResults, filter);
  }

  private normalizeFiverrResults(results: any[], filter: ScrapingFilter): ScrapedCandidate[] {
    return results
      .filter((item: any) => {
        const seller = (item.seller || '').toLowerCase();
        return seller && seller.length > 2 && !seller.includes('fiverr') && item.title;
      })
      .map((item: any, index: number) => {
        const badges: string[] = [];
        if (item.level) badges.push(item.level);
        const reviewCount = parseInt(String(item.reviews || '0').replace(/[kK]/g, '000').replace(/\+/g, ''));
        if (reviewCount > 100) badges.push('Highly Reviewed');

        const candidate: ScrapedCandidate = {
          id: `fiverr-${item.sellerUrl?.split('/').pop() || index}-${Date.now()}`,
          name: item.seller || 'Unknown Seller',
          platform: 'Fiverr' as FreelancePlatform,
          platformUsername: item.seller?.toLowerCase().replace(/\s+/g, '') || 'unknown',
          profileUrl: item.sellerUrl || 'https://www.fiverr.com',
          title: item.title || 'Gig Provider',
          country: 'Unknown',
          hourlyRate: this.parseRate(item.price),
          jobSuccessRate: this.parseRating(item.rating),
          certifications: badges,
          bio: item.reviews ? `${item.reviews} reviews` : '',
          scrapedAt: new Date().toISOString(),
          talentScore: 0,
          skills: [],
          badges,
          yearsExperience: 0,
        };

        candidate.talentScore = this.calculateTalentScore(candidate, filter);
        return candidate;
      })
      .filter(c => c.talentScore >= 1) // Very lenient - filter in UI
      .sort((a, b) => b.talentScore - a.talentScore);
  }

  // ─── LINKEDIN SCRAPING ──────────────────────────────────────────────────

  async scrapeLinkedIn(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    if (!this.apiKey) {
      console.error('❌ No hay API key de Apify');
      return [];
    }

    await this.initializeActorIds();

    try {
      console.log(`🔍 LinkedIn: Iniciando búsqueda con buffer de intentos múltiples...`);
      return await this.scrapeLinkedInWithBuffer(filter);
    } catch (error) {
      console.error('❌ LinkedIn scraping error:', error);
      return [];
    }
  }

  private async scrapeLinkedInWithBuffer(filter: ScrapingFilter, maxRetries: number = 5): Promise<ScrapedCandidate[]> {
    const buffer: ScrapedCandidate[] = [];
    const targetCount = 30; // Objetivo para LinkedIn (menos dados disponibles)
    const seenLinkedInProfiles = new Set<string>(); // Dedup por profileUrl
    let attempt = 0;

    console.log(`📊 LinkedIn: Búsqueda con buffer - Target: ${targetCount} candidatos en ${maxRetries} intentos`);

    while (buffer.length < targetCount && attempt < maxRetries) {
      attempt++;

      // Crear variación de query
      const queryKeyword = this.getLinkedInQueryVariation(filter.keyword, attempt);
      console.log(`\n[Intento ${attempt}/${maxRetries}] 🔍 Buscando "${queryKeyword}"...`);

      // Crear filtro modificado
      const modifiedFilter = {
        ...filter,
        keyword: queryKeyword
      };

      try {
        const tempResults = await this.runLinkedInSearch(modifiedFilter);
        console.log(`   ✅ ${tempResults.length} resultados raw obtenidos`);

        if (tempResults.length === 0) {
          console.log(`   ⚠️ Sin resultados en este intento`);
          continue;
        }

        // Filtrar duplicados
        const newCandidates = tempResults.filter(c => {
          const key = c.profileUrl || c.platformUsername;
          if (seenLinkedInProfiles.has(key)) {
            return false;
          }
          seenLinkedInProfiles.add(key);
          return true;
        });

        buffer.push(...newCandidates);
        console.log(`   📦 Buffer: ${buffer.length}/${targetCount} candidatos acumulados`);

        if (buffer.length >= targetCount) {
          console.log(`   ✅ Meta alcanzada en intento ${attempt}`);
          break;
        }
      } catch (err: any) {
        console.error(`   ❌ Error en intento ${attempt}: ${err.message}`);
      }
    }

    console.log(`\n✅ Búsqueda completada: ${buffer.length} candidatos únicos encontrados`);
    return buffer.slice(0, 30);
  }

  private getLinkedInQueryVariation(baseKeyword: string, attempt: number): string {
    const variations = [
      baseKeyword,
      `"${baseKeyword}" current company tech`,
      `${baseKeyword} "Senior" OR "Lead" OR "Principal"`,
      `${baseKeyword} location "España" OR "Spain" OR "remote"`,
      `${baseKeyword} experience "5 years" OR "10 years" OR "15 years"`,
    ];

    const selected = variations[Math.min(attempt - 1, variations.length - 1)];
    console.log(`   📝 Variación: ${selected}`);
    return selected;
  }

  private async runLinkedInSearch(filter: ScrapingFilter): Promise<ScrapedCandidate[]> {
    const keyword = encodeURIComponent(filter.keyword);
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${keyword}&origin=GLOBAL_SEARCH_HEADER`;

    console.log(`🔗 LinkedIn search URL: ${searchUrl}`);

    const actorId = this.actors.linkedin;
    let input: Record<string, any>;

    if (actorId.includes('curious_coder')) {
      // curious_coder/linkedin-search-api — no cookies needed
      input = {
        searchUrl: searchUrl,
        deepScrape: true,
        limit: 50,
      };
    } else if (actorId.includes('linkedin')) {
      // Generic LinkedIn actor
      input = {
        searchUrls: [searchUrl],
        limit: 50,
        proxy: { useApifyProxy: true },
      };
    } else {
      // Fallback: web-scraper with improved LinkedIn pageFunction
      input = {
        startUrls: [{ url: searchUrl }],
        maxPagesPerCrawl: 2,
        proxyConfiguration: { useApifyProxy: true },
        waitUntilNetworkIdle: false,
        navigationTimeoutSecs: 30,
        pageFunction: `
          async function pageFunction(context) {
            const { page } = context;
            
            const results = [];
            
            try {
              // Get all links
              const links = await page.$$('a');
              
              for (const link of links.slice(0, 100)) {
                try {
                  const href = await link.evaluate(el => el.href || '');
                  const text = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
                  
                  // LinkedIn profile URLs contain /in/ 
                  if (text && text.length > 2 && href && href.includes('/in/')) {
                    results.push({
                      name: text,
                      profileUrl: href,
                      title: 'Professional'
                    });
                  }
                  
                  if (results.length >= 50) break;
                } catch (e) {
                  // Continue
                }
              }
            } catch (e) {
              // Fallback
            }
            
            // If nothing, try direct selector
            if (results.length === 0) {
              try {
                const links = await page.$$('a[href*="/in/"]');
                for (const link of links.slice(0, 50)) {
                  try {
                    const href = await link.evaluate(el => el.href || '');
                    const text = await link.evaluate(el => (el.textContent || el.innerText || '').trim());
                    
                    if (text && href) {
                      results.push({
                        name: text,
                        profileUrl: href,
                        title: 'Professional'
                      });
                    }
                  } catch (e) {
                    // Skip
                  }
                }
              } catch (e) {
                // Fallback failed
              }
            }
            
            return results.slice(0, 50);
          }
        `,
      };
    }

    const rawResults = await this.executeActor(actorId, input);

    if (!rawResults || rawResults.length === 0) {
      console.error('❌ LinkedIn: Sin resultados del actor');
      return [];
    }

    // Extract pageFunctionResult if it exists (apify/web-scraper wraps results)
    const results = this.extractPageFunctionResults(rawResults);

    // Better filtering for LinkedIn
    let validResults = results.filter((r: any) => {
      if (typeof r === 'object' && r !== null) {
        // Skip only real errors
        if (r['#error'] && !r.name && !r.profileUrl) {
          return false;
        }
        return r.name || r.profileUrl;
      }
      return false;
    });

    // If nothing valid, return all objects
    if (validResults.length === 0) {
      validResults = results.filter((r: any) => typeof r === 'object' && r !== null);
      if (validResults.length === 0) {
        console.warn('⚠️ LinkedIn: Los resultados no tienen formato válido.');
        return [];
      }
    }

    console.log(`✅ LinkedIn: ${validResults.length} resultados raw`);
    return this.normalizeLinkedInResults(validResults, filter);
  }

  private normalizeLinkedInResults(results: any[], filter: ScrapingFilter): ScrapedCandidate[] {
    return results
      .map((item: any, index: number) => {
        const name = item.name || item.fullName || item.firstName && item.lastName
          ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
          : 'Unknown';
        const title = item.title || item.headline || item.occupation || '';
        const profileUrl = item.profileUrl || item.url || item.linkedInUrl || '';
        const location = item.location || item.country || item.geo || '';

        // LinkedIn profiles don't have hourly rates — estimate from title
        const estimatedRate = this.estimateRateFromTitle(title);

        // Extract skills from profile data
        const skills = item.skills || item.topSkills || [];

        const candidate: ScrapedCandidate = {
          id: `linkedin-${item.publicIdentifier || item.id || index}-${Date.now()}`,
          name,
          platform: 'LinkedIn' as FreelancePlatform,
          platformUsername: item.publicIdentifier || profileUrl.split('/in/').pop()?.replace(/\//g, '') || `li-${index}`,
          profileUrl,
          title,
          country: location,
          hourlyRate: estimatedRate,
          jobSuccessRate: 0, // N/A for LinkedIn
          certifications: [],
          bio: item.summary || item.about || '',
          scrapedAt: new Date().toISOString(),
          talentScore: 0,
          skills: Array.isArray(skills) ? skills.map((s: any) => typeof s === 'string' ? s : s.name || '') : [],
          badges: [],
          yearsExperience: this.estimateExperience(item),
        };

        candidate.talentScore = this.calculateTalentScore(candidate, filter);
        return candidate;
      })
      .filter(c => c.name !== 'Unknown' && c.name.trim().length > 1)
      .filter(c => c.talentScore >= 1) // Very low threshold for LinkedIn (minimal data available)
      .sort((a, b) => b.talentScore - a.talentScore);
  }

  // ─── TALENT SCORE SYSTEM ────────────────────────────────────────────────

  /**
   * Calculates a TalentScore from 0-100 based on multiple quality signals.
   * This is the core algorithm for finding A-Players.
   * 
   * Components:
   *  - Rate relevance (0-25): Is their rate in the desired range?
   *  - Success rate (0-25): Job success / rating
   *  - Title relevance (0-25): How well does their title match the keyword?
   *  - Badges / certifications (0-25): Top Rated, Level 2, etc.
   */
  private calculateTalentScore(candidate: ScrapedCandidate, filter: ScrapingFilter): number {
    let score = 0;

    // 1. Rate Score (0-25)
    if (candidate.hourlyRate > 0) {
      if (candidate.hourlyRate >= filter.minHourlyRate) {
        // In range or above — good
        score += 20;
        // Bonus for premium pricing (confidence signal)
        if (candidate.hourlyRate >= filter.minHourlyRate * 1.5) score += 5;
      } else if (candidate.hourlyRate >= filter.minHourlyRate * 0.7) {
        // Slightly below — still acceptable
        score += 10;
      }
      // Below 70% of minimum — 0 points
    } else if (candidate.platform === 'LinkedIn') {
      // LinkedIn doesn't have rates — give base score
      score += 12;
    }

    // 2. Success/Rating Score (0-25)
    if (candidate.jobSuccessRate > 0) {
      if (candidate.jobSuccessRate >= 95) {
        score += 25;
      } else if (candidate.jobSuccessRate >= 90) {
        score += 20;
      } else if (candidate.jobSuccessRate >= 80) {
        score += 15;
      } else if (candidate.jobSuccessRate >= 70) {
        score += 10;
      } else if (candidate.jobSuccessRate >= 50) {
        score += 5;
      }
    } else if (candidate.platform === 'LinkedIn') {
      // LinkedIn — no success rate, give base
      score += 10;
    }

    // 3. Title Relevance (0-25)
    const titleRelevance = this.calculateTitleRelevance(candidate.title, filter.keyword);
    score += Math.round(titleRelevance * 25);

    // 4. Badges & Certifications Score (0-25)
    const badgeTexts = [...candidate.badges, ...candidate.certifications]
      .map(b => b.toLowerCase());

    if (badgeTexts.some(b => b.includes('top rated plus'))) {
      score += 25;
    } else if (badgeTexts.some(b => b.includes('top rated'))) {
      score += 20;
    } else if (badgeTexts.some(b => b.includes('level 2'))) {
      score += 15;
    } else if (badgeTexts.some(b => b.includes('rising talent') || b.includes('level 1'))) {
      score += 10;
    } else if (badgeTexts.some(b => b.includes('highly reviewed'))) {
      score += 10;
    } else if (candidate.totalJobs && candidate.totalJobs > 20) {
      score += 8; // Experience signal without badge
    }

    // Bonus: Years of experience
    if (candidate.yearsExperience >= 8) score += 5;
    else if (candidate.yearsExperience >= 5) score += 3;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates how relevant a candidate's title is to the search keyword.
   * Returns 0.0 to 1.0
   */
  private calculateTitleRelevance(title: string, keyword: string): number {
    if (!title || !keyword) return 0;

    const titleLower = title.toLowerCase();
    const keywordLower = keyword.toLowerCase();

    // Exact match or contains full keyword
    if (titleLower.includes(keywordLower)) return 1.0;

    // Check individual words
    const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);
    const titleWords = titleLower.split(/\s+/);

    if (keywordWords.length === 0) return 0;

    let matchCount = 0;
    for (const kw of keywordWords) {
      if (titleWords.some(tw => tw.includes(kw) || kw.includes(tw))) {
        matchCount++;
      }
    }

    return matchCount / keywordWords.length;
  }

  // ─── UTILITY METHODS ────────────────────────────────────────────────────

  private parseRate(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const match = price.match(/\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : 0;
    }
    return 0;
  }

  private parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[,$€£]/g, '').trim();
      const match = cleaned.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : 0;
    }
    return 0;
  }

  private parseSuccessRate(rate: any): number {
    if (typeof rate === 'number') {
      return rate > 5 ? Math.min(rate, 100) : Math.round((rate / 5) * 100);
    }
    if (typeof rate === 'string') {
      const num = parseFloat(rate.replace(/[^0-9.]/g, ''));
      if (isNaN(num)) return 0;
      return num > 5 ? Math.min(Math.round(num), 100) : Math.round((num / 5) * 100);
    }
    return 0;
  }

  private parseRating(rating: any): number {
    if (typeof rating === 'string') {
      const num = parseFloat(rating.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return 0;
      if (num > 5) return Math.min(Math.round(num), 100);
      return Math.round((num / 5) * 100);
    }
    if (typeof rating === 'number') {
      if (rating > 5) return Math.min(Math.round(rating), 100);
      return Math.round((rating / 5) * 100);
    }
    return 0;
  }

  private estimateExperience(item: any): number {
    if (item.yearsExperience) return parseInt(item.yearsExperience);
    if (item.memberSince) {
      const year = parseInt(item.memberSince);
      if (year > 2000) return new Date().getFullYear() - year;
    }
    if (item.totalHours && item.totalHours > 5000) return 5;
    if (item.totalJobs && item.totalJobs > 50) return 3;
    return 0;
  }

  private estimateRateFromTitle(title: string): number {
    if (!title) return 0;
    const t = title.toLowerCase();
    // Senior/Lead/Principal/CTO — premium
    if (t.match(/\b(senior|lead|principal|staff|director|cto|vp|head)\b/)) return 80;
    // Mid-level signals
    if (t.match(/\b(developer|engineer|architect|consultant)\b/)) return 50;
    // Junior signals
    if (t.match(/\b(junior|intern|trainee|student)\b/)) return 25;
    return 40; // Default mid-range
  }

  // ─── ACTOR EXECUTION ───────────────────────────────────────────────────

  private encodeActorId(actorId: string): string {
    return actorId.replace(/\//g, '~');
  }

  private async executeActor(
    actorId: string,
    input: Record<string, any>
  ): Promise<any[] | null> {
    const encodedActorId = this.encodeActorId(actorId);
    try {
      console.log(`🚀 Ejecutando actor: ${actorId}`);

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
        console.error(`❌ Actor ${actorId}: HTTP ${runResponse.status} - ${errText}`);

        // Parse error response for specific error types
        let errorType = '';
        try {
          const errJson = JSON.parse(errText);
          errorType = errJson?.error?.type || '';
        } catch { /* not JSON */ }

        if (errorType === 'actor-is-not-rented' || errText.includes('actor-is-not-rented')) {
          console.error(`� El actor "${actorId}" requiere SUSCRIPCIÓN DE PAGO en Apify.`);
          console.error(`💡 Opciones: 1) Alquila el actor en https://apify.com/store  2) Usa 'apify/web-scraper' (gratuito)`);
        } else if (runResponse.status === 404) {
          console.error(`💡 El actor "${actorId}" no existe. Ve a https://apify.com/store y busca uno compatible.`);
        } else if (runResponse.status === 403) {
          console.error(`💡 Acceso denegado al actor "${actorId}".`);
        }

        throw new Error(`Actor execution failed: ${runResponse.status} (${errorType || 'unknown'})`);
      }

      const runData = await runResponse.json();
      const runId = runData.data.id;

      console.log(`⏳ Actor iniciado, run ID: ${runId}`);

      // Poll for completion (max 5 minutes for dedicated actors)
      let completed = false;
      let attempts = 0;
      const maxAttempts = 300; // 300 * 1000ms = 5 minutes
      const pollInterval = 1000;

      while (!completed && attempts < maxAttempts) {
        await this.sleep(pollInterval);

        const statusResponse = await fetch(
          `${this.baseUrl}/acts/${encodedActorId}/runs/${runId}?token=${this.apiKey}`
        );

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          const runStatus = status.data.status;

          if (attempts % 15 === 0) {
            console.log(`⏳ Actor ${actorId}: ${runStatus} (${attempts}s)`);
          }

          if (runStatus === 'SUCCEEDED') {
            completed = true;
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
            throw new Error(`Actor failed: ${runStatus} - ${status.data.statusMessage || ''}`);
          }
        }
        attempts++;
      }

      if (!completed) {
        throw new Error(`Actor timeout after ${maxAttempts}s`);
      }

      // Get results
      const datasetId = runData.data.defaultDatasetId;
      const resultsUrl = datasetId
        ? `${this.baseUrl}/datasets/${datasetId}/items?token=${this.apiKey}`
        : `${this.baseUrl}/acts/${encodedActorId}/runs/${runId}/dataset/items?token=${this.apiKey}`;

      const resultsResponse = await fetch(resultsUrl);

      if (resultsResponse.ok) {
        const data = await resultsResponse.json();
        const items = Array.isArray(data) ? data : (data.items || data.data || []);
        console.log(`📊 Dataset: ${items.length} items`);
        return items;
      }

      console.error(`❌ Error obteniendo dataset: ${resultsResponse.status}`);
      return null;
    } catch (error) {
      console.error(`❌ Actor execution error (${actorId}):`, error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

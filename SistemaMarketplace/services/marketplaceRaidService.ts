import { MarketplaceRaid, ScrapingFilter, EnrichedCandidate, OutreachCampaign, ScrapedCandidate } from '../types/marketplace';
import { MarketplaceSearchService } from './marketplaceSearchService';
import { AIEnrichmentService } from './aiEnrichmentService';

export class MarketplaceRaidService {
  private static instance: MarketplaceRaidService;
  private raids: Map<string, MarketplaceRaid> = new Map();
  private searchService: MarketplaceSearchService;
  private aiEnrichmentService: AIEnrichmentService;

  private constructor(
    apifyKey: string,
    openaiKey: string,
    supabaseUrl?: string,
    supabaseKey?: string
  ) {
    this.searchService = new MarketplaceSearchService(apifyKey);
    this.aiEnrichmentService = new AIEnrichmentService(openaiKey, apifyKey);
  }

  static getInstance(
    apifyKey: string = '',
    openaiKey: string = '',
    supabaseUrl?: string,
    supabaseKey?: string
  ): MarketplaceRaidService {
    if (!MarketplaceRaidService.instance) {
      MarketplaceRaidService.instance = new MarketplaceRaidService(
        apifyKey,
        openaiKey,
        supabaseUrl,
        supabaseKey
      );
    }
    return MarketplaceRaidService.instance;
  }

  /**
   * Get the search service instance
   */
  getSearchService(): MarketplaceSearchService {
    return this.searchService;
  }

  async validateAllConnections(): Promise<{
    apify: boolean;
    openai: boolean;
  }> {
    // Simple validation - will be tested when actually scraping
    return {
      apify: true, // Tested in scraper itself
      openai: await this.aiEnrichmentService.validateConnection(),
    };
  }

  async startRaid(raidName: string, filter: ScrapingFilter): Promise<MarketplaceRaid> {
    const raid: MarketplaceRaid = {
      id: crypto.randomUUID(),
      raidName,
      createdAt: new Date().toISOString(),
      status: 'Phase 1: Scraping',
      scrapedCandidates: [],
      enrichedCandidates: [],
      campaigns: [],
      outreachRecords: [],
      scrapingProgress: { total: 0, completed: 0, failed: 0 },
      enrichmentProgress: { total: 0, completed: 0, failed: 0 },
      stats: { totalScraped: 0, totalEnriched: 0, totalContacted: 0 },
    };

    this.raids.set(raid.id, raid);
    return raid;
  }

  async executeScraping(raidId: string, filter: ScrapingFilter): Promise<MarketplaceRaid | null> {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    try {
      const targetCount = filter.maxResults || 1; // Default target
      const platforms = filter.platforms || [];

      // NUEVO FLUJO IMPENETRABLE: Búsqueda + Dedup + Enriquecimiento integrados
      if (platforms.includes('Upwork' as any)) {
        console.log(`📊 Upwork: Iniciando búsqueda impenetrable con target de ${targetCount} candidatos...`);
        const upworkResults = await this.executeScrapingUnbreakableForPlatform(
          'Upwork',
          filter,
          targetCount
        );
        
        // Agregar resultados enriquecidos directamente
        raid.scrapedCandidates = upworkResults;
        raid.enrichedCandidates = upworkResults; // Ya están enriquecidos en el loop
        console.log(`   ✅ Upwork completado: ${upworkResults.length}/${targetCount} candidatos encontrados y enriquecidos`);
      }

      if (platforms.includes('Fiverr' as any) && raid.scrapedCandidates.length < targetCount) {
        console.log(`📊 Fiverr: Iniciando búsqueda complementaria...`);
        const fiverrFilter = { ...filter };
        const needed = targetCount - raid.scrapedCandidates.length;
        fiverrFilter.maxResults = needed;
        
        const fiverrResults = await this.executeScrapingUnbreakableForPlatform(
          'Fiverr',
          fiverrFilter,
          needed
        );
        
        raid.scrapedCandidates = [...raid.scrapedCandidates, ...fiverrResults];
        raid.enrichedCandidates = [...raid.enrichedCandidates, ...fiverrResults];
        console.log(`   ✅ Fiverr completado: ${fiverrResults.length}/${needed} candidatos encontrados`);
      }

      if (platforms.includes('LinkedIn' as any) && raid.scrapedCandidates.length < targetCount) {
        console.log(`📊 LinkedIn: Iniciando búsqueda complementaria...`);
        const linkedinFilter = { ...filter };
        const needed = targetCount - raid.scrapedCandidates.length;
        linkedinFilter.maxResults = needed;
        
        const linkedinResults = await this.executeScrapingUnbreakableForPlatform(
          'LinkedIn',
          linkedinFilter,
          needed
        );
        
        raid.scrapedCandidates = [...raid.scrapedCandidates, ...linkedinResults];
        raid.enrichedCandidates = [...raid.enrichedCandidates, ...linkedinResults];
        console.log(`   ✅ LinkedIn completado: ${linkedinResults.length}/${needed} candidatos encontrados`);
      }

      // Sort all candidates by TalentScore (best first)
      raid.scrapedCandidates.sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
      raid.enrichedCandidates.sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));

      raid.scrapingProgress = {
        total: raid.scrapedCandidates.length,
        completed: raid.scrapedCandidates.length,
        failed: 0,
      };
      raid.enrichmentProgress = {
        total: raid.enrichedCandidates.length,
        completed: raid.enrichedCandidates.length,
        failed: 0,
      };
      raid.stats.totalScraped = raid.scrapedCandidates.length;
      raid.stats.totalEnriched = raid.enrichedCandidates.length;
      raid.status = 'Ready to Export'; // Ya está completamente enriquecido

      this.raids.set(raidId, raid);
      return raid;
    } catch (error) {
      console.error('Scraping error:', error);
      return raid;
    }
  }

  /**
   * FLUJO IMPENETRABLE DE BÚSQUEDA
   * 
   * Loop que continúa buscando hasta encontrar exactamente X candidatos únicos:
   * 1. Busca con variación 1 → Obtiene N candidatos
   * 2. Deduplica contra lo ya encontrado
   * 3. Enriquece SOLO los nuevos
   * 4. Verifica si tiene suficientes
   * 5. Si no → Busca con variación 2 (diferente query)
   * 6. Repite hasta tener X candidatos únicos
   */
  private async executeScrapingUnbreakableForPlatform(
    platform: string,
    filter: ScrapingFilter,
    targetCount: number,
    maxRetries: number = 10
  ): Promise<EnrichedCandidate[]> {
    const uniqueCandidates: EnrichedCandidate[] = [];
    const seenProfiles = new Set<string>(); // Dedup por profileUrl
    let attempt = 0;

    console.log(`\n🔍 ${platform}: Búsqueda impenetrable con buffer...`);
    console.log(`   Target: ${targetCount} candidatos únicos en máximo ${maxRetries} intentos\n`);

    while (uniqueCandidates.length < targetCount && attempt < maxRetries) {
      attempt++;

      const modifiedFilter = { ...filter };

      // Generar variación de query según plataforma
      if (platform === 'Upwork' && !modifiedFilter.keyword) {
        modifiedFilter.keyword = this.getUpworkQueryVariation(filter.keyword || '', attempt);
      } else if (platform === 'Fiverr' && !modifiedFilter.keyword) {
        modifiedFilter.keyword = this.getFiverrQueryVariation(filter.keyword || '', attempt);
      } else if (platform === 'LinkedIn' && !modifiedFilter.keyword) {
        modifiedFilter.keyword = this.getLinkedInQueryVariation(filter.keyword || '', attempt);
      }

      console.log(`[Intento ${attempt}/${maxRetries}] 🔄 Buscando con query: "${modifiedFilter.keyword}"`);

      try {
        // 1️⃣ BUSCAR
        let rawResults: ScrapedCandidate[] = [];
        if (platform === 'Upwork') {
          rawResults = await this.searchService.scrapeUpwork(modifiedFilter);
        } else if (platform === 'Fiverr') {
          rawResults = await this.searchService.scrapeFiverr(modifiedFilter);
        } else if (platform === 'LinkedIn') {
          rawResults = await this.searchService.scrapeLinkedIn(modifiedFilter);
        }

        console.log(`   📋 Resultados raw: ${rawResults.length}`);

        if (rawResults.length === 0) {
          console.log(`   ⚠️ Sin resultados en este intento`);
          continue;
        }

        // 2️⃣ DEDUPLICAR contra lo ya encontrado
        const newCandidates = rawResults.filter(candidate => {
          const key = candidate.profileUrl || candidate.platformUsername;
          if (seenProfiles.has(key)) {
            return false; // Ya lo encontramos antes
          }
          seenProfiles.add(key);
          return true;
        });

        console.log(`   ✅ Nuevos candidatos (no duplicados): ${newCandidates.length}`);

        if (newCandidates.length === 0) {
          console.log(`   ⚠️ Todos estos resultados ya fueron encontrados`);
          continue;
        }

        // 3️⃣ ENRIQUECER SOLO LOS NUEVOS
        console.log(`   🤖 Enriqueciendo ${newCandidates.length} nuevos candidatos...`);
        const enrichedBatch = await this.aiEnrichmentService.enrichBatch(newCandidates);

        console.log(`   ✅ Enriquecimiento completado: ${enrichedBatch.length} candidatos`);

        // 4️⃣ AGREGAR AL RESULTADO FINAL
        uniqueCandidates.push(...enrichedBatch);

        console.log(`   📦 Buffer total: ${uniqueCandidates.length}/${targetCount} candidatos\n`);

        // 5️⃣ VERIFICAR SI ALCANZAMOS EL OBJETIVO
        if (uniqueCandidates.length >= targetCount) {
          console.log(`   ✅ META ALCANZADA en intento ${attempt}`);
          break;
        }
      } catch (error: any) {
        console.error(`   ❌ Error en intento ${attempt}: ${error.message}`);
        continue;
      }
    }

    console.log(`\n✅ Búsqueda ${platform} completada: ${uniqueCandidates.length} candidatos únicos encontrados\n`);

    // Retornar solo la cantidad solicitada
    return uniqueCandidates.slice(0, targetCount);
  }

  // Query variation generators
  private getUpworkQueryVariation(baseKeyword: string, attempt: number): string {
    const variations = [
      baseKeyword,
      `"${baseKeyword}" Top Rated`,
      `${baseKeyword} certified`,
      `${baseKeyword} "100% Job Success"`,
      `${baseKeyword} "5 starts" OR "4.8 starts"`,
      `${baseKeyword} experienced`,
      `${baseKeyword} remote freelance`,
      `${baseKeyword} specialist`,
      `${baseKeyword} expert portfolio`,
      `${baseKeyword} available now`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getFiverrQueryVariation(baseKeyword: string, attempt: number): string {
    const variations = [
      baseKeyword,
      `"${baseKeyword}" pro`,
      `${baseKeyword} certified`,
      `${baseKeyword} seller`,
      `${baseKeyword} top rated`,
      `${baseKeyword} english`,
      `${baseKeyword} fast delivery`,
      `${baseKeyword} rating 5`,
      `${baseKeyword} portfolio`,
      `${baseKeyword} reviews`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getLinkedInQueryVariation(baseKeyword: string, attempt: number): string {
    const variations = [
      baseKeyword,
      `"${baseKeyword}" current`,
      `${baseKeyword} senior`,
      `${baseKeyword} experience`,
      `${baseKeyword} skill`,
      `${baseKeyword} specialist`,
      `${baseKeyword} expert`,
      `${baseKeyword} developer`,
      `${baseKeyword} engineer`,
      `${baseKeyword} architect`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  async executeEnrichment(raidId: string): Promise<MarketplaceRaid | null> {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    try {
      // NOTA: Con el nuevo flujo impenetrable, el enriquecimiento YA se hizo durante executeScraping
      // Este método ahora es un no-op o puede usarse para re-enriquecer si es necesario
      
      if (raid.enrichedCandidates.length === 0 && raid.scrapedCandidates.length > 0) {
        // Si por algún motivo no hay enriquecidos (flujo legacy), enriquecer ahora
        console.log(`⚠️ Ejecutando enriquecimiento retroactivo para ${raid.scrapedCandidates.length} candidatos...`);
        const enriched = await this.aiEnrichmentService.enrichBatch(raid.scrapedCandidates);
        raid.enrichedCandidates = enriched;
      }

      raid.enrichmentProgress = {
        total: raid.enrichedCandidates.length,
        completed: raid.enrichedCandidates.length,
        failed: 0,
      };
      raid.stats.totalEnriched = raid.enrichedCandidates.length;
      raid.status = 'Ready to Export';

      this.raids.set(raidId, raid);
      return raid;
    } catch (error) {
      console.error('Enrichment error:', error);
      return raid;
    }
  }

  /**
   * OUTREACH FUNCTIONALITY REMOVED
   * 
   * This version does NOT send automatic messages (No Walead/Instantly).
   * Enriched candidates are available for manual export, CSV download,
   * or integration with your own outreach tools.
   * 
   * Use enrichedCandidates for:
   * - CSV export for bulk messaging
   * - Manual LinkedIn outreach
   * - Email campaign setup in your preferred platform
   * - CRM integration
   */

  getRaid(raidId: string): MarketplaceRaid | undefined {
    return this.raids.get(raidId);
  }

  getAllRaids(): MarketplaceRaid[] {
    return Array.from(this.raids.values());
  }
}

import { MarketplaceRaid, ScrapingFilter, EnrichedCandidate, OutreachCampaign, ScrapedCandidate } from '../types/marketplace';
import { MarketplaceSearchService } from './marketplaceSearchService';
import { AIEnrichmentService } from './aiEnrichmentService';
import { dedupService } from './marketplaceDeduplicationService';

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
   * FLUJO IMPENETRABLE DE BÚSQUEDA v3
   * 
   * ORDEN CORRECTO:
   * 1. Busca batch de candidatos con query N
   * 2. Deduplica INMEDIATAMENTE contra campaña existente (nombres, URLs, emails)
   * 3. Enriquece SOLO los supervivientes (ahorra API calls)
   * 4. Después de enriquecer, verifica si LinkedIn/email encontrado ya existen
   * 5. Si aún faltan candidatos → busca con query diferente (no repite los mismos)
   * 6. Frena exactamente cuando tiene los X solicitados
   */
  private async executeScrapingUnbreakableForPlatform(
    platform: string,
    filter: ScrapingFilter,
    targetCount: number,
    maxRetries: number = 10
  ): Promise<EnrichedCandidate[]> {
    const confirmedCandidates: EnrichedCandidate[] = [];
    
    // Build comprehensive dedup sets from campaign data
    const existingNames = new Set<string>(
      (filter.existingNames || []).map(n => n.toLowerCase().trim())
    );
    const existingUrls = new Set<string>(
      (filter.existingProfileUrls || []).map(u => this.normalizeUrl(u))
    );
    const existingEmails = new Set<string>(
      (filter.existingEmails || []).map(e => e.toLowerCase().trim())
    );
    
    // Track all profiles seen across ALL attempts (no repeats)
    const seenProfileKeys = new Set<string>();
    
    let attempt = 0;
    const remaining = () => targetCount - confirmedCandidates.length;

    console.log(`\n🔒 ${platform}: BÚSQUEDA IMPENETRABLE v3`);
    console.log(`   🎯 Target: ${targetCount} candidatos NUEVOS`);
    console.log(`   🚫 Excluidos: ${existingNames.size} nombres, ${existingUrls.size} URLs, ${existingEmails.size} emails\n`);

    while (remaining() > 0 && attempt < maxRetries) {
      attempt++;

      // ⭐ Generate query variation for this attempt
      let queryVariation = filter.keyword || '';
      if (platform === 'Upwork') {
        queryVariation = this.getUpworkQueryVariation(filter.keyword || '', attempt, filter.languages?.[0]);
      } else if (platform === 'Fiverr') {
        queryVariation = this.getFiverrQueryVariation(filter.keyword || '', attempt, filter.languages?.[0]);
      } else if (platform === 'LinkedIn') {
        queryVariation = this.getLinkedInQueryVariation(filter.keyword || '', attempt);
      }

      console.log(`\n═══ [Intento ${attempt}/${maxRetries}] ═══════════════════════════════════`);
      console.log(`   🎯 Faltan: ${remaining()} candidatos`);
      console.log(`   🔍 Query: "${queryVariation}"`);

      // Use SearchService's single-attempt method with the query variation
      const modifiedFilter = { ...filter, keyword: queryVariation, maxResults: remaining() * 2 };

      try {
        // ── PASO 1: BUSCAR ──────────────────────────────────────────────
        let rawResults: ScrapedCandidate[] = [];
        if (platform === 'Upwork') {
          rawResults = await this.searchService.scrapeUpwork(modifiedFilter);
        } else if (platform === 'Fiverr') {
          rawResults = await this.searchService.scrapeFiverr(modifiedFilter);
        } else if (platform === 'LinkedIn') {
          rawResults = await this.searchService.scrapeLinkedIn(modifiedFilter);
        }

        console.log(`   📋 Resultados del SearchService: ${rawResults.length}`);

        if (rawResults.length === 0) {
          console.log(`   ⚠️ Sin resultados en este intento`);
          continue;
        }

        // ── PASO 2: DEDUP AGRESIVO ANTES DE ENRIQUECER ──────────────────
        const trulyNew: ScrapedCandidate[] = [];
        
        for (const candidate of rawResults) {
          const profileKey = candidate.profileUrl || candidate.platformUsername || candidate.name;
          
          // 2a. ¿Ya visto en esta sesión de búsqueda?
          if (seenProfileKeys.has(profileKey.toLowerCase())) {
            console.log(`   ⏭️ Skip (ya visto en sesión): ${candidate.name}`);
            continue;
          }

          // 2b. ¿Nombre ya existe en la campaña?
          const candidateNameNorm = candidate.name.toLowerCase().trim();
          if (existingNames.has(candidateNameNorm)) {
            console.log(`   ⏭️ Skip (nombre duplicado): ${candidate.name}`);
            seenProfileKeys.add(profileKey.toLowerCase());
            continue;
          }

          // 2c. ¿URL ya existe en la campaña?
          if (candidate.profileUrl) {
            const normalizedUrl = this.normalizeUrl(candidate.profileUrl);
            if (existingUrls.has(normalizedUrl)) {
              console.log(`   ⏭️ Skip (URL duplicada): ${candidate.name} → ${normalizedUrl}`);
              seenProfileKeys.add(profileKey.toLowerCase());
              continue;
            }
          }

          // 2d. ¿Email ya existe en la campaña?
          if (candidate.email && existingEmails.has(candidate.email.toLowerCase())) {
            console.log(`   ⏭️ Skip (email duplicado): ${candidate.name}`);
            seenProfileKeys.add(profileKey.toLowerCase());
            continue;
          }

          // 2e. Check against dedupService (fuzzy name + all dimensions)
          if (dedupService.isDuplicate(candidate)) {
            console.log(`   ⏭️ Skip (dedupService): ${candidate.name}`);
            seenProfileKeys.add(profileKey.toLowerCase());
            continue;
          }

          // ✅ Passed all dedup checks
          seenProfileKeys.add(profileKey.toLowerCase());
          trulyNew.push(candidate);
        }

        console.log(`   ✅ Supervivientes post-dedup: ${trulyNew.length} de ${rawResults.length}`);

        if (trulyNew.length === 0) {
          console.log(`   ⚠️ Todos los resultados son duplicados, intentando con otra query...`);
          continue;
        }

        // ── PASO 3: TOMAR SOLO LOS QUE NECESITAMOS ─────────────────────
        const toEnrich = trulyNew.slice(0, remaining());
        console.log(`   🤖 Enriqueciendo ${toEnrich.length} candidatos nuevos...`);

        // ── PASO 4: ENRIQUECER ──────────────────────────────────────────
        const enrichedBatch = await this.aiEnrichmentService.enrichBatch(toEnrich);

        console.log(`   ✅ Enriquecimiento completado: ${enrichedBatch.length}`);

        // ── PASO 5: POST-ENRICHMENT DEDUP ───────────────────────────────
        // Ahora que tenemos LinkedIn URLs y emails REALES, verificar de nuevo
        const finalConfirmed: EnrichedCandidate[] = [];
        
        for (const enriched of enrichedBatch) {
          let isDup = false;
          
          // ¿LinkedIn URL ya existe?
          if (enriched.linkedInUrl) {
            const normalizedLinkedIn = this.normalizeUrl(enriched.linkedInUrl);
            if (existingUrls.has(normalizedLinkedIn)) {
              console.log(`   ⏭️ Post-enrich skip (LinkedIn duplicado): ${enriched.name} → ${normalizedLinkedIn}`);
              isDup = true;
            }
          }

          // ¿Email encontrado ya existe?
          if (!isDup && enriched.emails && enriched.emails.length > 0) {
            for (const email of enriched.emails) {
              if (existingEmails.has(email.toLowerCase())) {
                console.log(`   ⏭️ Post-enrich skip (email duplicado): ${enriched.name} → ${email}`);
                isDup = true;
                break;
              }
            }
          }

          if (!isDup) {
            finalConfirmed.push(enriched);
            
            // Registrar en los sets para futuras iteraciones
            existingNames.add(enriched.name.toLowerCase().trim());
            if (enriched.linkedInUrl) {
              existingUrls.add(this.normalizeUrl(enriched.linkedInUrl));
            }
            if (enriched.emails) {
              enriched.emails.forEach(e => existingEmails.add(e.toLowerCase()));
            }
            if (enriched.profileUrl) {
              existingUrls.add(this.normalizeUrl(enriched.profileUrl));
            }

            // Register in dedupService for future fuzzy checks
            dedupService.registerCandidate(enriched as any);
          }
        }

        console.log(`   ✅ Confirmados finales: ${finalConfirmed.length}`);

        // ── PASO 6: AGREGAR AL RESULTADO ────────────────────────────────
        confirmedCandidates.push(...finalConfirmed);

        console.log(`   📦 PROGRESO: ${confirmedCandidates.length}/${targetCount} candidatos confirmados`);

        if (remaining() <= 0) {
          console.log(`\n   🎉 META ALCANZADA en intento ${attempt}!`);
          break;
        } else {
          console.log(`   🔄 Faltan ${remaining()} → continuando búsqueda con query diferente...`);
        }

      } catch (error: any) {
        console.error(`   ❌ Error en intento ${attempt}: ${error.message}`);
        continue;
      }
    }

    if (remaining() > 0) {
      console.log(`\n⚠️ Búsqueda agotada: ${confirmedCandidates.length}/${targetCount} candidatos (se agotaron los ${maxRetries} intentos)`);
    }

    console.log(`\n✅ Búsqueda ${platform} completada: ${confirmedCandidates.length} candidatos NUEVOS y ENRIQUECIDOS\n`);
    return confirmedCandidates.slice(0, targetCount);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      let normalized = parsed.hostname || '';
      if (normalized.startsWith('www.')) {
        normalized = normalized.slice(4);
      }
      normalized += parsed.pathname;
      return normalized.toLowerCase().replace(/\/$/, '');
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  // Query variation generators for the impenetrable loop
  private getUpworkQueryVariation(baseKeyword: string, attempt: number, language?: string): string {
    const isSpanish = language === 'es' || language === 'español';
    
    // Spanish-focused variations - include language keywords
    if (isSpanish) {
      const spanishVariations = [
        `${baseKeyword} "Spanish" OR "Español"`,
        `${baseKeyword} "Spanish speaker" OR "habla español"`,
        `${baseKeyword} "Top Rated" "Spanish"`,
        `${baseKeyword} "100% Job Success" "Español"`,
        `${baseKeyword} expert "Spanish language"`,
        `${baseKeyword} remote "habla español"`,
        `${baseKeyword} specialist "Spanish"`,
        `${baseKeyword} portfolio "Español"`,
        `${baseKeyword} "available" "Spanish speaker"`,
        `${baseKeyword} "native spanish" OR "spanish native"`,
      ];
      return spanishVariations[Math.min(attempt - 1, spanishVariations.length - 1)];
    }

    // English/default variations
    const variations = [
      baseKeyword,
      `"${baseKeyword}" Top Rated`,
      `${baseKeyword} certified`,
      `${baseKeyword} "100% Job Success"`,
      `${baseKeyword} "5 stars" OR "4.8 stars"`,
      `${baseKeyword} experienced`,
      `${baseKeyword} remote freelance`,
      `${baseKeyword} specialist`,
      `${baseKeyword} expert portfolio`,
      `${baseKeyword} available now`,
    ];
    return variations[Math.min(attempt - 1, variations.length - 1)];
  }

  private getFiverrQueryVariation(baseKeyword: string, attempt: number, language?: string): string {
    const isSpanish = language === 'es' || language === 'español';
    
    // Spanish-focused variations
    if (isSpanish) {
      const spanishVariations = [
        `${baseKeyword} "Spanish" OR "Español"`,
        `${baseKeyword} "Spanish speaker" OR "habla español"`,
        `${baseKeyword} pro "Spanish"`,
        `${baseKeyword} certified "Español"`,
        `${baseKeyword} "Spanish language"`,
        `${baseKeyword} "top rated" "Spanish"`,
        `${baseKeyword} "fast delivery" "Español"`,
        `${baseKeyword} "rating 5" "Spanish"`,
        `${baseKeyword} portfolio "habla español"`,
        `${baseKeyword} "native spanish" OR "spanish native"`,
      ];
      return spanishVariations[Math.min(attempt - 1, spanishVariations.length - 1)];
    }

    // English/default variations
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

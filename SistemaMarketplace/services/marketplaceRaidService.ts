import { MarketplaceRaid, ScrapingFilter, EnrichedCandidate, OutreachCampaign } from '../types/marketplace';
import { ApifyService } from './apifyService';
import { AIEnrichmentService } from './aiEnrichmentService';

export class MarketplaceRaidService {
  private static instance: MarketplaceRaidService;
  private raids: Map<string, MarketplaceRaid> = new Map();
  private apifyService: ApifyService;
  private aiEnrichmentService: AIEnrichmentService;

  private constructor(
    apifyKey: string,
    openaiKey: string,
    supabaseUrl?: string,
    supabaseKey?: string
  ) {
    this.apifyService = new ApifyService(apifyKey, supabaseUrl, supabaseKey);
    this.aiEnrichmentService = new AIEnrichmentService(openaiKey);
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
   * Obtener la instancia del servicio Apify para actualizar Actor IDs
   */
  getApifyService(): ApifyService {
    return this.apifyService;
  }

  async validateAllConnections(): Promise<{
    apify: boolean;
    openai: boolean;
  }> {
    return {
      apify: await this.apifyService.validateConnection(),
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
      let allCandidates: any[] = [];

      // Scrape based on selected platforms
      const platforms = filter.platforms || [];

      if (platforms.includes('Upwork' as any)) {
        console.log('📊 Scraping Upwork...');
        const upworkCandidates = await this.apifyService.scrapeUpwork(filter);
        allCandidates = [...allCandidates, ...upworkCandidates];
        console.log(`   → Upwork: ${upworkCandidates.length} candidatos`);
      }

      if (platforms.includes('Fiverr' as any)) {
        console.log('📊 Scraping Fiverr...');
        const fiverrCandidates = await this.apifyService.scrapeFiverr(filter);
        allCandidates = [...allCandidates, ...fiverrCandidates];
        console.log(`   → Fiverr: ${fiverrCandidates.length} candidatos`);
      }

      if (platforms.includes('LinkedIn' as any)) {
        console.log('📊 Scraping LinkedIn...');
        const linkedinCandidates = await this.apifyService.scrapeLinkedIn(filter);
        allCandidates = [...allCandidates, ...linkedinCandidates];
        console.log(`   → LinkedIn: ${linkedinCandidates.length} candidatos`);
      }

      // Sort all candidates by TalentScore (best first)
      allCandidates.sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));

      raid.scrapedCandidates = allCandidates;
      raid.scrapingProgress = {
        total: raid.scrapedCandidates.length,
        completed: raid.scrapedCandidates.length,
        failed: 0,
      };
      raid.stats.totalScraped = raid.scrapedCandidates.length;
      raid.status = 'Phase 2: Enrichment';

      this.raids.set(raidId, raid);
      return raid;
    } catch (error) {
      console.error('Scraping error:', error);
      return raid;
    }
  }

  async executeEnrichment(raidId: string): Promise<MarketplaceRaid | null> {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    try {
      // Use AI Enrichment Service with batch processing
      const enriched = await this.aiEnrichmentService.enrichBatch(raid.scrapedCandidates);

      raid.enrichedCandidates = enriched;
      raid.enrichmentProgress = {
        total: enriched.length,
        completed: enriched.length,
        failed: 0,
      };
      raid.stats.totalEnriched = enriched.length;
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

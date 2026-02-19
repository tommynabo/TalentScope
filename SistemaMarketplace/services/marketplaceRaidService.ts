import { MarketplaceRaid, ScrapingFilter, EnrichedCandidate, OutreachCampaign } from '../types/marketplace';
import { ApifyService } from './apifyService';
import { ClayEnrichmentService } from './clayEnrichmentService';
import { WaleadService } from './waleadService';
import { InstantlyService } from './instantlyService';

export class MarketplaceRaidService {
  private static instance: MarketplaceRaidService;
  private raids: Map<string, MarketplaceRaid> = new Map();
  private apifyService: ApifyService;
  private clayService: ClayEnrichmentService;
  private waleadService: WaleadService;
  private instantlyService: InstantlyService;

  private constructor(
    apifyKey: string,
    clayKey: string,
    prospeoKey: string,
    waleadKey: string,
    instantlyKey: string
  ) {
    this.apifyService = new ApifyService(apifyKey);
    this.clayService = new ClayEnrichmentService(clayKey, prospeoKey);
    this.waleadService = new WaleadService(waleadKey);
    this.instantlyService = new InstantlyService(instantlyKey);
  }

  static getInstance(
    apifyKey: string = 'mock',
    clayKey: string = 'mock',
    prospeoKey: string = 'mock',
    waleadKey: string = 'mock',
    instantlyKey: string = 'mock'
  ): MarketplaceRaidService {
    if (!MarketplaceRaidService.instance) {
      MarketplaceRaidService.instance = new MarketplaceRaidService(
        apifyKey,
        clayKey,
        prospeoKey,
        waleadKey,
        instantlyKey
      );
    }
    return MarketplaceRaidService.instance;
  }

  async validateAllConnections(): Promise<{
    apify: boolean;
    clay: boolean;
    walead: boolean;
    instantly: boolean;
  }> {
    return {
      apify: await this.apifyService.validateConnection(),
      clay: await this.clayService.validateConnection(),
      walead: await this.waleadService.validateConnection(),
      instantly: await this.instantlyService.validateConnection(),
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
      const upworkCandidates = await this.apifyService.scrapeUpwork(filter);
      const fiverrrCandidates = await this.apifyService.scrapeFiverr(filter);

      raid.scrapedCandidates = [...upworkCandidates, ...fiverrrCandidates];
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
      const enriched: EnrichedCandidate[] = [];

      for (const candidate of raid.scrapedCandidates) {
        const enrichedCandidate = await this.clayService.enrichCandidate(candidate);
        enriched.push(enrichedCandidate);
      }

      raid.enrichedCandidates = enriched;
      raid.enrichmentProgress = {
        total: enriched.length,
        completed: enriched.length,
        failed: 0,
      };
      raid.stats.totalEnriched = enriched.length;
      raid.status = 'Phase 3: Outreach';

      this.raids.set(raidId, raid);
      return raid;
    } catch (error) {
      console.error('Enrichment error:', error);
      return raid;
    }
  }

  async executeOutreach(raidId: string, campaign: OutreachCampaign): Promise<MarketplaceRaid | null> {
    const raid = this.raids.get(raidId);
    if (!raid) return null;

    try {
      for (const candidate of raid.enrichedCandidates) {
        if (campaign.platforms === 'LinkedIn' || campaign.platforms === 'Both') {
          const record = await this.waleadService.sendLinkedInMessage(
            candidate,
            campaign.messageTemplate
          );
          raid.outreachRecords.push(record);
        }

        if (campaign.platforms === 'Email' || campaign.platforms === 'Both') {
          const record = await this.instantlyService.sendOutreachEmail(
            candidate,
            campaign.name,
            campaign.messageTemplate
          );
          raid.outreachRecords.push(record);
        }
      }

      raid.stats.totalContacted = raid.outreachRecords.length;
      raid.status = 'Phase 4: Complete';

      this.raids.set(raidId, raid);
      return raid;
    } catch (error) {
      console.error('Outreach error:', error);
      return raid;
    }
  }

  getRaid(raidId: string): MarketplaceRaid | undefined {
    return this.raids.get(raidId);
  }

  getAllRaids(): MarketplaceRaid[] {
    return Array.from(this.raids.values());
  }
}

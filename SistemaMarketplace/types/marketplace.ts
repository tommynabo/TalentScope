/**
 * marketplace.ts - TypeScript types for Sistema Marketplace Raid
 */

export enum FreelancePlatform {
  Upwork = 'Upwork',
  Fiverr = 'Fiverr',
}

export enum CandidateStatus {
  Scraped = 'Scraped',
  Enriched = 'Enriched',
  Contacted = 'Contacted',
  Replied = 'Replied',
}

export interface ScrapingFilter {
  keyword: string;
  minHourlyRate: number;
  minJobSuccessRate: number;
  certifications: string[];
  platforms: FreelancePlatform[];
}

export interface ScrapedCandidate {
  id: string;
  name: string;
  platform: FreelancePlatform;
  platformUsername: string;
  profileUrl: string;
  title: string;
  country: string;
  hourlyRate: number;
  jobSuccessRate: number;
  certifications: string[];
  bio: string;
  scrapedAt: string;
}

export interface EnrichedCandidate extends ScrapedCandidate {
  linkedInUrl?: string;
  linkedInProfileData?: {
    fullName: string;
    title: string;
    company: string;
    skills: string[];
  };
  emails: string[];
  photoValidated: boolean;
  identityConfidenceScore: number;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  companyName: string;
  messageTemplate: string;
  platforms: 'LinkedIn' | 'Email' | 'Both';
  createdAt: string;
  totalCandidates: number;
  sentCount: number;
  stats: OutreachStats;
}

export interface OutreachRecord {
  id: string;
  campaignId: string;
  candidateId: string;
  platform: 'LinkedIn' | 'Email';
  messageContent: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
}

export interface OutreachStats {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalReplied: number;
}

export interface MarketplaceRaid {
  id: string;
  raidName: string;
  createdAt: string;
  status: string;
  scrapedCandidates: ScrapedCandidate[];
  enrichedCandidates: EnrichedCandidate[];
  campaigns: OutreachCampaign[];
  outreachRecords: OutreachRecord[];
  scrapingProgress: {
    total: number;
    completed: number;
    failed: number;
  };
  enrichmentProgress: {
    total: number;
    completed: number;
    failed: number;
  };
  stats: {
    totalScraped: number;
    totalEnriched: number;
    totalContacted: number;
  };
}

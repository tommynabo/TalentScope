/**
 * marketplace.ts - TypeScript types for Sistema Marketplace Raid
 */

export enum FreelancePlatform {
  Upwork = 'Upwork',
  Fiverr = 'Fiverr',
  LinkedIn = 'LinkedIn',
}

export enum CandidateStatus {
  Scraped = 'Scraped',
  Enriched = 'Enriched',
  Contacted = 'Contacted',
  Replied = 'Replied',
}

export interface ScrapingFilter {
  keyword?: string;
  minHourlyRate?: number;
  minJobSuccessRate?: number;
  certifications?: string[];
  platforms?: FreelancePlatform[];
  skills?: string[];
  maxResults?: number;
  // Existing candidates to skip during scraping
  existingProfileUrls?: string[];
  existingEmails?: string[];
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
  // New fields for quality filtering
  talentScore: number; // 0-100 composite score
  skills: string[];
  badges: string[]; // e.g. "Top Rated", "Top Rated Plus", "Rising Talent"
  yearsExperience: number;
  totalEarnings?: number;
  totalJobs?: number;
  totalHours?: number;
  email?: string;
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
  psychologicalProfile?: string;
  businessMoment?: string;
  salesAngle?: string;
  bottleneck?: string;
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

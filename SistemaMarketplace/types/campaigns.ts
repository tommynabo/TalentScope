import { MarketplaceRaid, ScrapingFilter, FreelancePlatform } from '../types/marketplace';

/**
 * Campaign - Define una campaña de reclutamiento
 */
export interface Campaign {
  id: string;
  name: string;
  platform: FreelancePlatform;
  createdAt: string;
  
  // Búsqueda específica por plataforma
  searchTerms: {
    keyword: string;
    keywords?: string[]; // Array de múltiples keywords
    minHourlyRate: number;
    maxHourlyRate?: number;
    minJobSuccessRate: number;
    certifications: string[];
    countries?: string[];
    languages?: string[];
    // Upwork específico
    upworkCategory?: string;
    upworkTests?: string[];
    // Fiverr específico
    fiverrlevel?: 'basic' | 'pro' | 'top-rated' | 'top-rated-plus';
  };

  // Candidatos en esta campaña
  candidates: EnrichedCandidateInCampaign[];
  
  // Stats
  stats: CampaignStats;
  status: 'active' | 'paused' | 'completed';
}

/**
 * Candidato marcado según estado en la campaña
 */
export interface EnrichedCandidateInCampaign {
  candidateId: string;
  name: string;
  email: string;
  linkedInUrl?: string;
  platform: FreelancePlatform;
  hourlyRate: number;
  jobSuccessRate: number;
  addedAt: string;
  
  // Pipeline status
  kanbanLane: 'todo' | 'contacted' | 'replied' | 'rejected' | 'hired';
  notes?: string;
  contactedAt?: string;
  respondedAt?: string;
}

export interface CampaignStats {
  total: number;
  inTodo: number;
  inContacted: number;
  inReplied: number;
  inRejected: number;
  inHired: number;
  contactRate: number;
  responseRate: number;
}

export interface UpworkSearchTerms {
  keyword: string;
  category: string;
  minHourlyRate: number;
  maxHourlyRate?: number;
  minJobSuccessRate: number;
  tests?: string[];
  languages?: string[];
}

export interface FiverrSearchTerms {
  keyword: string;
  minHourlyRate: number;
  maxHourlyRate?: number;
  level: 'basic' | 'pro' | 'top-rated' | 'top-rated-plus';
  languages?: string[];
}

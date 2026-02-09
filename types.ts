export type ViewMode = 'login' | 'dashboard' | 'campaign-list' | 'campaign-detail' | 'campaign-create' | 'talent-pool' | 'analytics' | 'settings';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface Campaign {
  id: string;
  platform: 'LinkedIn' | 'GitHub' | 'Freelance' | 'Communities';
  title: string;
  role: string;
  status: 'Running' | 'Paused' | 'Draft' | 'Completed';
  createdAt: string;
  stats: {
    sent: number;
    responseRate: number;
    leads: number;
  };
}

export interface Candidate {
  id: string;
  name: string;
  avatar: string;
  role: string;
  company: string;
  status: 'Contacted' | 'Responded' | 'Scheduled' | 'Offer Sent' | 'Pool';
  aiAnalysis: string;
  matchScore: number;
  skills?: string[];
  location?: string;
  experience?: string;
  education?: string;
}

export interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}
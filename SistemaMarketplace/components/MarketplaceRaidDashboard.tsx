import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ScraperConfig } from './ScraperConfig';
import { EnrichmentFlow } from './EnrichmentFlow';
import { OutreachManager } from './OutreachManager';
import { RaidCandidatesList } from './RaidCandidatesList';
import { MarketplaceRaid, ScrapingFilter } from '../types/marketplace';

interface MarketplaceRaidDashboardProps {
  onBack: () => void;
}

type Phase = 'setup' | 'scraping' | 'enrichment' | 'outreach';

export const MarketplaceRaidDashboard: React.FC<MarketplaceRaidDashboardProps> = ({ onBack }) => {
  const [currentPhase, setCurrentPhase] = useState<Phase>('setup');
  const [raid, setRaid] = useState<MarketplaceRaid | null>(null);
  const [error, setError] = useState<string>('');

  const handleScrapingComplete = async (name: string, filter: ScrapingFilter) => {
    const newRaid: MarketplaceRaid = {
      id: crypto.randomUUID(),
      raidName: name,
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

    // Simulate scraping
    const candidates = Array.from({ length: 25 }, (_, i) => ({
      id: `candidate-${i}`,
      name: `Dev ${String.fromCharCode(65 + (i % 26))}${i}`,
      platform: filter.platforms[i % filter.platforms.length],
      platformUsername: `dev${i}`,
      profileUrl: `https://upwork.com/freelancers/~dev${i}`,
      title: `Senior ${filter.keyword} Developer`,
      country: ['España', 'Argentina', 'México', 'Colombia', 'Chile'][i % 5],
      hourlyRate: filter.minHourlyRate + Math.random() * 60,
      jobSuccessRate: filter.minJobSuccessRate + Math.random() * 10,
      certifications: filter.certifications,
      bio: `Experienced ${filter.keyword} developer`,
      scrapedAt: new Date().toISOString(),
    }));

    newRaid.scrapedCandidates = candidates;
    newRaid.stats.totalScraped = candidates.length;
    newRaid.scrapingProgress = {
      total: candidates.length,
      completed: candidates.length,
      failed: 0,
    };

    // Transform to enriched candidates
    const enrichedCandidates = candidates.map((c) => ({
      ...c,
      linkedInUrl: `https://linkedin.com/in/${c.platformUsername}`,
      linkedInProfileData: {
        fullName: c.name,
        title: c.title,
        company: 'Tech Company',
        location: c.country,
        skills: [filter.keyword, 'React', 'Node.js'],
        experience: '5+ years',
        education: 'CS Degree',
      },
      emails: [`${c.platformUsername}@gmail.com`],
      photoValidated: true,
      photoConfidence: 0.92,
      identityConfidenceScore: 0.88,
    }));

    newRaid.enrichedCandidates = enrichedCandidates;
    newRaid.stats.totalEnriched = enrichedCandidates.length;
    newRaid.enrichmentProgress = {
      total: enrichedCandidates.length,
      completed: enrichedCandidates.length,
      failed: 0,
    };

    setRaid(newRaid);
    setCurrentPhase('enrichment');
  };

  const handleEnrichmentComplete = () => {
    setCurrentPhase('outreach');
  };

  const handleOutreachComplete = () => {
    if (raid) {
      raid.stats.totalContacted = raid.enrichedCandidates.length * 2; // LinkedIn + Email
    }
  };

  const handleError = (err: string) => {
    setError(err);
    setTimeout(() => setError(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white">
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition"
        >
          <ChevronLeft className="h-5 w-5" />
          Volver
        </button>
        <h1 className="text-2xl font-bold">Marketplace Raid</h1>
        <div className="text-sm text-slate-400">
          {raid ? `ID: ${raid.id.slice(0, 8)}...` : 'Sin raid activo'}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex h-[calc(100vh-80px)]">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 mb-8">
              {(['setup', 'scraping', 'enrichment', 'outreach'] as const).map((phase) => (
                <button
                  key={phase}
                  onClick={() => setCurrentPhase(phase)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPhase === phase
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {phase === 'setup'
                    ? 'Setup'
                    : phase === 'scraping'
                      ? 'Scraping'
                      : phase === 'enrichment'
                        ? 'Enriquecimiento'
                        : 'Outreach'}
                </button>
              ))}
            </div>

            {currentPhase === 'setup' && (
              <ScraperConfig
                raid={raid}
                onScrapingComplete={handleScrapingComplete}
                onError={handleError}
                isInitialSetup={!raid}
              />
            )}

            {currentPhase === 'scraping' && raid && (
              <div className="text-center py-8 text-slate-400">
                Scraping completado: {raid.stats.totalScraped} candidatos
              </div>
            )}

            {currentPhase === 'enrichment' && (
              <EnrichmentFlow
                raid={raid}
                onEnrichmentComplete={handleEnrichmentComplete}
                onError={handleError}
              />
            )}

            {currentPhase === 'outreach' && (
              <OutreachManager
                raid={raid}
                onOutreachComplete={handleOutreachComplete}
                onError={handleError}
              />
            )}
          </div>
        </div>

        <div className="w-80 border-l border-slate-700 bg-slate-900/50 flex flex-col">
          <RaidCandidatesList raid={raid} />
        </div>
      </div>
    </div>
  );
};

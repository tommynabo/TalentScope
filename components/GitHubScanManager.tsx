import React, { useState, useCallback } from 'react';
import { GitHubCodeScan } from './GitHubCodeScan';
import { GitHubCampaignDashboard } from './GitHubCampaignDashboard';
import { Code2, Plus } from 'lucide-react';

export interface SearchCampaign {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  source: 'github' | 'github-linkedin';
}

export const GitHubScanManager: React.FC = () => {
  const [activeCampaign, setActiveCampaign] = useState<SearchCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<SearchCampaign[]>([]);
  const [mode, setMode] = useState<'scan' | 'campaign' | 'results'>('scan');

  const handleCreateCampaign = useCallback((campaign: SearchCampaign) => {
    setCampaigns(prev => [campaign, ...prev]);
    setActiveCampaign(campaign);
    setMode('results');
  }, []);

  const handleViewCampaign = useCallback((campaign: SearchCampaign) => {
    setActiveCampaign(campaign);
    setMode('campaign');
  }, []);

  if (mode === 'campaign' && activeCampaign) {
    return (
      <GitHubCampaignDashboard
        campaignId={activeCampaign.id}
        campaignTitle={activeCampaign.title}
        onClose={() => setMode('scan')}
      />
    );
  }

  if (mode === 'scan') {
    return (
      <div className="space-y-6">
        {/* Recent Campaigns */}
        {campaigns.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Code2 className="h-5 w-5 text-cyan-400" />
              Campañas Recientes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {campaigns.slice(0, 4).map(campaign => (
                <button
                  key={campaign.id}
                  onClick={() => handleViewCampaign(campaign)}
                  className="p-4 bg-slate-900/50 border border-slate-600 rounded-lg hover:border-cyan-500 hover:bg-slate-900/80 transition text-left"
                >
                  <h4 className="font-semibold text-white hover:text-cyan-400">{campaign.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(campaign.created_at).toLocaleDateString('es-ES')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {campaign.source === 'github-linkedin' ? '🔗 GitHub ↔ LinkedIn' : '📍 GitHub'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Scan */}
        <GitHubCodeScan onCampaignCreated={handleCreateCampaign} />
      </div>
    );
  }

  return <GitHubCodeScan onCampaignCreated={handleCreateCampaign} />;
};

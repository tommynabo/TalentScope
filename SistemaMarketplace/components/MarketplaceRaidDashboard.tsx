import React, { useState } from 'react';
import { Target, Plus, ChevronLeft } from 'lucide-react';
import { Campaign } from '../types/campaigns';
import { CampaignsList } from './CampaignsList';
import { CreateCampaignModal } from './CreateCampaignModal';
import { CampaignDashboard } from './CampaignDashboard';
import { SearchGenerator } from './SearchGenerator';

interface MarketplaceRaidDashboardProps {
  onBack: () => void;
}

type ViewState = 
  | { type: 'list' }
  | { type: 'creating' }
  | { type: 'dashboard'; campaignId: string }
  | { type: 'search'; campaignId: string };

export const MarketplaceRaidDashboard: React.FC<MarketplaceRaidDashboardProps> = ({ onBack }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<ViewState>({ type: 'list' });

  const handleCreateCampaign = (newCampaign: Campaign) => {
    setCampaigns([...campaigns, newCampaign]);
    setView({ type: 'list' });
  };

  const handleUpdateCampaign = (updated: Campaign) => {
    setCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaigns(campaigns.filter(c => c.id !== campaignId));
    if (view.type === 'dashboard' && view.campaignId === campaignId) {
      setView({ type: 'list' });
    }
  };

  const selectedCampaign = view.type === 'dashboard' || view.type === 'search' 
    ? campaigns.find(c => c.id === view.campaignId)
    : null;

  // Render List View
  if (view.type === 'list') {
    return (
      <div className="flex h-screen flex-col bg-slate-950">
        {/* Header */}
        <div className="border-b border-slate-700 bg-slate-900 p-6 flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-3"
            >
              <ChevronLeft className="h-5 w-5" />
              Atrás
            </button>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Target className="h-8 w-8 text-emerald-400" />
              Marketplace Raid
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestiona tus campañas de búsqueda de talento</p>
          </div>
          <button
            onClick={() => setView({ type: 'creating' })}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nueva Campaña
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Target className="h-16 w-16 text-slate-600 mb-4" />
              <h2 className="text-2xl font-bold text-slate-300 mb-2">Sin campañas yet</h2>
              <p className="text-slate-500 mb-6">Crea tu primera campaña para comenzar</p>
              <button
                onClick={() => setView({ type: 'creating' })}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="h-5 w-5" />
                Nueva Campaña
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map(campaign => (
                <button
                  key={campaign.id}
                  onClick={() => setView({ type: 'dashboard', campaignId: campaign.id })}
                  className="group p-6 bg-slate-900 border border-slate-700 rounded-xl hover:border-emerald-600 hover:bg-slate-800/50 transition-all text-left cursor-pointer"
                >
                  {/* Status Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      campaign.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                      campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {campaign.status === 'active' ? 'Activa' : campaign.status === 'paused' ? 'Pausa' : 'Completada'}
                    </span>
                    <span className="px-2 py-1 rounded text-xs text-slate-400 bg-slate-800">
                      {campaign.platform}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-lg text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {campaign.name}
                  </h3>

                  {/* Keywords */}
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                    Keywords: {campaign.searchTerms.keyword}
                  </p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="text-xl font-bold text-white">{campaign.stats.total}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Contactados</div>
                      <div className="text-xl font-bold text-blue-400">{campaign.stats.inContacted}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Respondieron</div>
                      <div className="text-xl font-bold text-emerald-400">{campaign.stats.inReplied}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Respuesta %</div>
                      <div className="text-xl font-bold text-green-400">{campaign.stats.responseRate.toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Created Date */}
                  <p className="text-xs text-slate-500">
                    📅 {new Date(campaign.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Campaign Modal */}
        <CreateCampaignModal
          isOpen={view.type === 'creating'}
          onClose={() => setView({ type: 'list' })}
          onCreate={handleCreateCampaign}
        />
      </div>
    );
  }

  // Render Search Generator View
  if (view.type === 'search' && selectedCampaign) {
    return (
      <>
        <SearchGenerator
          campaignName={selectedCampaign.name}
          onStart={(leadCount) => {
            alert(`Buscando ${leadCount} leads...`);
            setView({ type: 'dashboard', campaignId: selectedCampaign.id });
          }}
        />
      </>
    );
  }

  // Render Campaign Dashboard View
  if (view.type === 'dashboard' && selectedCampaign) {
    return (
      <div className="flex h-screen flex-col bg-slate-950">
        <CampaignDashboard
          campaign={selectedCampaign}
          onUpdateCampaign={handleUpdateCampaign}
          onOpenSearch={() => setView({ type: 'search', campaignId: selectedCampaign.id })}
          onBack={() => setView({ type: 'list' })}
        />
      </div>
    );
  }

  return null;
};


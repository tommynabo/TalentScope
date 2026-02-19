import React, { useState } from 'react';
import { Target, Plus, ChevronLeft } from 'lucide-react';
import { Campaign } from '../types/campaigns';
import { CampaignsList } from './CampaignsList';
import { CreateCampaignModal } from './CreateCampaignModal';
import { CampaignDashboard } from './CampaignDashboard';

interface MarketplaceRaidDashboardProps {
  onBack: () => void;
}

export const MarketplaceRaidDashboard: React.FC<MarketplaceRaidDashboardProps> = ({ onBack }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const handleCreateCampaign = (newCampaign: Campaign) => {
    setCampaigns([...campaigns, newCampaign]);
    setShowCreateModal(false);
  };

  const handleUpdateCampaign = (updated: Campaign) => {
    setCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaigns(campaigns.filter(c => c.id !== campaignId));
  };

  // If campaign selected, show campaign dashboard (full view)
  if (selectedCampaign) {
    return (
      <div className="flex h-screen bg-slate-950">
        {/* Sidebar: Campaign List */}
        <div className="w-80 border-r border-slate-700 bg-slate-900 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-700">
            <button
              onClick={() => setSelectedCampaign(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-4"
            >
              <ChevronLeft className="h-5 w-5" />
              Atrás
            </button>
            <h2 className="text-xl font-bold text-white">Campañas</h2>
            <p className="text-slate-400 text-sm mt-1">Elige una para editar</p>
          </div>

          {/* Campaign List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1">
              {campaigns.map(campaign => (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedCampaign?.id === campaign.id
                      ? 'bg-emerald-600/20 border border-emerald-600 text-white'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-medium truncate">{campaign.name}</div>
                  <div className="text-xs text-slate-500 truncate">{campaign.platform}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    📊 {campaign.stats.total} candidatos
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* New Campaign Button */}
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="h-5 w-5" />
              Nueva Campaña
            </button>
          </div>
        </div>

        {/* Main Content: Campaign Dashboard */}
        <div className="flex-1 overflow-hidden">
          <CampaignDashboard
            campaign={selectedCampaign}
            onUpdateCampaign={(updated) => {
              handleUpdateCampaign(updated);
              setSelectedCampaign(updated);
            }}
            onBack={() => setSelectedCampaign(null)}
          />
        </div>
      </div>
    );
  }

  // Main campaigns list view
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
          onClick={() => setShowCreateModal(true)}
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
              onClick={() => setShowCreateModal(true)}
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
                onClick={() => setSelectedCampaign(campaign)}
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
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCampaign}
      />
    </div>
  );
};


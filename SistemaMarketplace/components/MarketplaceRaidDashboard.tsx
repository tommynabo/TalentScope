import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, ChevronLeft, Trash2, Search, Globe } from 'lucide-react';
import { Campaign } from '../types/campaigns';
import { CreateCampaignModal } from './CreateCampaignModal';

interface MarketplaceRaidDashboardProps {
  onBack: () => void;
}

const CAMPAIGNS_STORAGE_KEY = 'marketplace_campaigns_v1';

export const MarketplaceRaidDashboard: React.FC<MarketplaceRaidDashboardProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try {
      const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Persist campaigns to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
  }, [campaigns]);

  const handleCreateCampaign = (newCampaign: Campaign) => {
    setCampaigns([...campaigns, newCampaign]);
    setShowCreateModal(false);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta campaña?')) {
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
    }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-5 md:mb-6">
        <button
          onClick={onBack}
          className="p-1 md:p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
        >
          <ChevronLeft className="h-4 md:h-5 w-4 md:w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-400" />
            Marketplace Raid
          </h1>
          <p className="text-slate-400 text-xs md:text-sm">Gestiona tus campañas de búsqueda en Upwork y Fiverr.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 md:px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium shadow-lg shadow-emerald-900/20 text-xs md:text-sm flex-shrink-0"
        >
          <Plus className="h-3.5 md:h-4 w-3.5 md:w-4" /> <span className="hidden sm:inline">Nueva Campaña</span>
        </button>
      </div>

      {/* Campaign Grid */}
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Target className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm mb-2">No hay campañas creadas aún.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-emerald-400 hover:text-emerald-300 text-xs mt-2"
          >
            Crea tu primera campaña para comenzar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => navigate(`/marketplace-raid/${campaign.id}`)}
              className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-950/30 rounded-xl text-emerald-400 border border-emerald-900/50">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-800 border border-slate-700">
                    {campaign.platform}
                  </span>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${campaign.status === 'active' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' :
                      campaign.status === 'paused' ? 'bg-yellow-950/30 text-yellow-400 border-yellow-900/50' :
                        'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                    {campaign.status === 'active' ? 'ACTIVA' : campaign.status === 'paused' ? 'PAUSA' : 'COMPLETADA'}
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{campaign.name}</h3>
              <p className="text-sm text-slate-400 mb-6 line-clamp-2">
                Keywords: {campaign.searchTerms.keyword || 'Sin keywords'}
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">Total</div>
                  <div className="text-lg font-bold text-white">{campaign.stats.total}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">Contactados</div>
                  <div className="text-lg font-bold text-blue-400">{campaign.stats.inContacted}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">Respondieron</div>
                  <div className="text-lg font-bold text-emerald-400">{campaign.stats.inReplied}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">Respuesta %</div>
                  <div className="text-lg font-bold text-green-400">{campaign.stats.responseRate.toFixed(0)}%</div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Search className="h-4 w-4" />
                  <span className="text-xs">📅 {new Date(campaign.createdAt).toLocaleDateString('es-ES')}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCampaign(campaign.id);
                  }}
                  className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCampaign}
      />
    </div>
  );
};

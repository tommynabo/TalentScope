import React, { useState } from 'react';
import { Target, Plus } from 'lucide-react';
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

  // If campaign selected, show campaign dashboard
  if (selectedCampaign) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Target className="h-7 w-7 text-emerald-400" />
              Marketplace Raid
            </h2>
            <p className="text-slate-400 text-sm mt-1">Gestiona tus campañas de búsqueda de talento</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="h-5 w-5" />
              Nueva Campaña
            </button>
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <CampaignsList
            campaigns={campaigns}
            onOpenCampaign={setSelectedCampaign}
            onDeleteCampaign={handleDeleteCampaign}
          />
        </div>
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


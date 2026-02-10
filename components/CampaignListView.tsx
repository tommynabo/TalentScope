
import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Search, Trash2, Plus, X } from 'lucide-react';
import { Campaign } from '../types/database';
import { CampaignService } from '../lib/services';
import Toast from './Toast';

interface CampaignListViewProps {
  platform: string;
  onSelectCampaign: (campaign: Campaign) => void;
  onBack: () => void;
  onCreate: () => void;
}

const CampaignListView: React.FC<CampaignListViewProps> = ({ platform, onSelectCampaign, onBack, onCreate }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  useEffect(() => {
    loadCampaigns();
  }, [platform]);

  const loadCampaigns = async () => {
    setLoading(true);
    const data = await CampaignService.getAll();
    // Filter by platform if needed, but for now show all as 'LinkedIn' is the main one
    setCampaigns(data);
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this campaign?')) {
      await CampaignService.delete(id);
      loadCampaigns();
      setToast({ show: true, message: 'Campaign deleted.' });
    }
  };

  const handleCreate = async () => {
    if (!newCampaignTitle.trim()) return;

    try {
      await CampaignService.create({
        title: newCampaignTitle,
        status: 'Running',
        platform: 'LinkedIn',
        description: 'New campaign',
        target_role: 'General'
      });
      setToast({ show: true, message: 'Campaign created!' });
      setShowCreateModal(false);
      setNewCampaignTitle('');
      loadCampaigns();
    } catch (e) {
      console.error(e);
      setToast({ show: true, message: 'Error creating campaign.' });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6 md:mb-8">
        <button
          onClick={onBack}
          className="p-1.5 md:p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 md:h-6 w-5 md:w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{platform} Campaigns</h1>
          <p className="text-slate-400 text-sm">Gestiona tus campañas de reclutamiento activo.</p>
        </div>
        <button
          onClick={onCreate}
          className="ml-auto bg-cyan-600 hover:bg-cyan-500 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-cyan-900/20 text-sm md:text-base flex-shrink-0"
        >
          <Plus className="h-4 md:h-5 w-4 md:w-5" /> <span className="hidden sm:inline">New Campaign</span>
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-center py-20">Loading campaigns...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => onSelectCampaign(campaign)}
              className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-cyan-950/30 rounded-xl text-cyan-400 border border-cyan-900/50">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${campaign.status === 'Running' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' :
                  campaign.status === 'Completed' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                    'bg-yellow-950/30 text-yellow-400 border-yellow-900/50'
                  }`}>
                  {campaign.status.toUpperCase()}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{campaign.title}</h3>
              <p className="text-sm text-slate-400 mb-6 line-clamp-2">{campaign.description || "No description"}</p>

              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Search className="h-4 w-4" />
                  <span>{campaign.target_role || "General Audience"}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, campaign.id)}
                  className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Campaign</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white"><X className="h-6 w-6" /></button>
            </div>
            <input
              type="text"
              value={newCampaignTitle}
              onChange={(e) => setNewCampaignTitle(e.target.value)}
              placeholder="Campaign Name (e.g. Senior React Devs)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6 focus:border-cyan-500 outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handleCreate} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold">Create</button>
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
    </div>
  );
};

export default CampaignListView;
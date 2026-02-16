import React, { useState } from 'react';
import { Github, X, Plus, Search, Trash2, ArrowLeft } from 'lucide-react';
import { GitHubCodeScan } from './GitHubCodeScan';
import Toast from './Toast';

export interface SearchCampaign {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  source: 'github';
  status: 'Running' | 'Completed' | 'Draft';
  target_role?: string;
}

interface GitHubScanManagerProps {
  onClose?: () => void;
}

export const GitHubScanManager: React.FC<GitHubScanManagerProps> = ({ onClose }) => {
  const [campaigns, setCampaigns] = useState<SearchCampaign[]>([
    {
      id: '1',
      title: 'Product Engineers - Flutter',
      description: 'Búsqueda de Product Engineers especializados en Flutter',
      created_at: new Date().toISOString(),
      source: 'github',
      status: 'Running',
      target_role: 'Product Engineer'
    },
    {
      id: '2',
      title: 'Smart Contract Developers',
      description: 'Developers con experiencia en Solidity y Web3',
      created_at: new Date().toISOString(),
      source: 'github',
      status: 'Completed',
      target_role: 'Blockchain Dev'
    }
  ]);
  const [activeCampaign, setActiveCampaign] = useState<SearchCampaign | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar campaña?')) {
      setCampaigns(campaigns.filter(c => c.id !== id));
      setToast({ show: true, message: 'Campaña eliminada' });
    }
  };

  const handleCreate = () => {
    if (!newCampaignTitle.trim()) return;
    const newId = Date.now().toString();
    setCampaigns([{
      id: newId,
      title: newCampaignTitle,
      description: '',
      created_at: new Date().toISOString(),
      source: 'github',
      status: 'Draft',
      target_role: 'General'
    }, ...campaigns]);
    setToast({ show: true, message: 'Campaña creada!' });
    setShowCreateModal(false);
    setNewCampaignTitle('');
  };

  if (activeCampaign) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveCampaign(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Campañas
        </button>
        <GitHubCodeScan 
          campaignId={activeCampaign.id}
          onCampaignCreated={() => {
            setActiveCampaign(null);
            setToast({ show: true, message: 'Búsqueda iniciada!' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 lg:p-6 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-5 md:mb-6">
        <div className="flex-1">
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-white tracking-tight">GitHub Campañas</h1>
          <p className="text-slate-400 text-xs md:text-sm">Gestiona tus búsquedas de código y desarrolladores.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto bg-orange-600 hover:bg-orange-500 text-white px-2.5 md:px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium shadow-lg shadow-orange-900/20 text-xs md:text-sm flex-shrink-0"
        >
          <Plus className="h-3.5 md:h-4 w-3.5 md:w-4" /> <span className="hidden sm:inline">New</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            onClick={() => setActiveCampaign(campaign)}
            className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-orange-500/50 hover:bg-slate-900/80 transition-all relative"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-950/30 rounded-xl text-orange-400 border border-orange-900/50">
                <Github className="h-6 w-6" />
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                campaign.status === 'Running' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' :
                campaign.status === 'Completed' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                'bg-yellow-950/30 text-yellow-400 border-yellow-900/50'
              }`}>
                {campaign.status.toUpperCase()}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">{campaign.title}</h3>
            <p className="text-sm text-slate-400 mb-6 line-clamp-2">{campaign.description || "Sin descripción"}</p>

            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <span>{campaign.target_role || "General"}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(campaign.id);
                }}
                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nueva Campaña GitHub</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white"><X className="h-6 w-6" /></button>
            </div>
            <input
              type="text"
              value={newCampaignTitle}
              onChange={(e) => setNewCampaignTitle(e.target.value)}
              placeholder="Nombre campaña (ej: Senior React Devs)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6 focus:border-orange-500 outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={handleCreate} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold">Crear</button>
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
    </div>
  );
};

import React from 'react';
import { Trash2, ChevronRight } from 'lucide-react';
import { Campaign } from '../types/campaigns';

interface CampaignsListProps {
  campaigns: Campaign[];
  onOpenCampaign: (campaign: Campaign) => void;
  onDeleteCampaign: (campaignId: string) => void;
}

export const CampaignsList: React.FC<CampaignsListProps> = ({
  campaigns,
  onOpenCampaign,
  onDeleteCampaign,
}) => {
  if (campaigns.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-400 text-lg">No hay campañas creadas</div>
        <p className="text-slate-500 text-sm mt-2">Crea una nueva campaña para comenzar</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-700">
      {campaigns.map(campaign => (
        <div
          key={campaign.id}
          className="p-4 hover:bg-slate-800/30 transition-colors cursor-pointer group"
          onClick={() => onOpenCampaign(campaign)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-bold text-white text-lg">{campaign.name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  campaign.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                  campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>
                  {campaign.status === 'active' ? 'Activa' :
                   campaign.status === 'paused' ? 'Pausa' :
                   'Completada'}
                </span>
                <span className="px-2 py-1 rounded text-xs text-slate-400 bg-slate-800">
                  {campaign.platform === 'upwork' ? 'Upwork' : 'Fiverr'}
                </span>
              </div>

              <p className="text-slate-400 text-sm mb-3">
                Keyword: <span className="text-slate-300 font-medium">{campaign.searchTerms.keyword}</span>
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Total Candidatos</div>
                  <div className="text-2xl font-bold text-slate-200">{campaign.stats.total}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Contactados</div>
                  <div className="text-2xl font-bold text-blue-400">{campaign.stats.inContacted}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Respondieron</div>
                  <div className="text-2xl font-bold text-emerald-400">{campaign.stats.inReplied}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Tasa Respuesta</div>
                  <div className="text-2xl font-bold text-green-400">
                    {campaign.stats.responseRate.toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Creada el {new Date(campaign.createdAt).toLocaleDateString('es-ES')}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar campaña "${campaign.name}"?`)) {
                    onDeleteCampaign(campaign.id);
                  }
                }}
                className="p-2 rounded hover:bg-red-600/20 text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Eliminar campaña"
              >
                <Trash2 className="h-5 w-5" />
              </button>

              <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-slate-300" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

import React from 'react';
import { Campaign } from '../types';
import { MOCK_CAMPAIGNS } from '../constants';
import { Plus, ArrowRight, Activity, PauseCircle, PlayCircle, Clock } from 'lucide-react';

interface CampaignListViewProps {
  platform: string;
  onSelectCampaign: (campaign: Campaign) => void;
  onBack: () => void;
}

const CampaignListView: React.FC<CampaignListViewProps> = ({ platform, onSelectCampaign, onBack }) => {
  const filteredCampaigns = MOCK_CAMPAIGNS.filter(c => c.platform === platform);

  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-2 transition-colors">
            ← Volver al Tablero
          </button>
          <h1 className="text-3xl font-bold text-white">Campañas de {platform}</h1>
          <p className="text-slate-400">Gestiona tus búsquedas activas y flujos de trabajo.</p>
        </div>
        <button className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-900/20">
          <Plus className="h-5 w-5" /> Nueva Campaña
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredCampaigns.map((campaign) => (
          <div 
            key={campaign.id}
            onClick={() => onSelectCampaign(campaign)}
            className="group bg-slate-900/40 border border-slate-800 hover:border-cyan-500/30 rounded-2xl p-6 cursor-pointer hover:bg-slate-900/60 transition-all duration-300 relative overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 group-hover:bg-cyan-500 transition-colors"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors">{campaign.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1
                    ${campaign.status === 'Running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      campaign.status === 'Paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                      'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {campaign.status === 'Running' ? <PlayCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
                    {campaign.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm flex items-center gap-2">
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">Rol: {campaign.role}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3"/> Creado el {campaign.createdAt}</span>
                </p>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Enviados</p>
                  <p className="text-xl font-bold text-white">{campaign.stats.sent}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Respuesta</p>
                  <p className={`text-xl font-bold ${campaign.stats.responseRate > 10 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {campaign.stats.responseRate}%
                  </p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-xs text-cyan-400 uppercase tracking-wider mb-1">Leads (Hot)</p>
                  <p className="text-xl font-bold text-cyan-400">{campaign.stats.leads}</p>
                </div>
                <div className="pl-4 border-l border-slate-800">
                  <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredCampaigns.length === 0 && (
          <div className="text-center py-12 bg-slate-900/30 border border-slate-800 border-dashed rounded-2xl">
            <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No hay campañas activas</h3>
            <p className="text-slate-500 mb-4">Inicia una nueva búsqueda para comenzar.</p>
            <button className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">Crear primera campaña &rarr;</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignListView;
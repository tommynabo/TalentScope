import React from 'react';
import { MOCK_CANDIDATES } from '../constants';
import { Candidate, Campaign } from '../types';
import { ChevronLeft, Linkedin, Send, MessageSquare, Calendar, BrainCircuit } from 'lucide-react';

interface DetailViewProps {
  campaign: Campaign;
  onBack: () => void;
}

const DetailView: React.FC<DetailViewProps> = ({ campaign, onBack }) => {
  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
      {/* Header & Nav */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 hover:text-cyan-400 text-slate-400 transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Linkedin className="h-6 w-6 text-blue-500" />
            {campaign.title}
          </h2>
          <p className="text-slate-400 text-sm">Rol: <span className="text-cyan-400">{campaign.role}</span> • Estado: <span className="text-slate-300">{campaign.status}</span></p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-400 text-sm font-medium">Alcance Total</p>
            <Send className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-3xl font-bold text-white">{campaign.stats?.sent || 0}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-blue-500 h-full w-[70%]"></div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-400 text-sm font-medium">Tasa de Respuesta</p>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-3xl font-bold text-white">{campaign.stats?.responseRate || 0}%</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-cyan-500 h-full" style={{ width: `${campaign.stats?.responseRate || 0}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-cyan-500/20 p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <div className="flex justify-between items-start mb-2">
            <p className="text-cyan-100 text-sm font-medium">Interesados (Hot)</p>
            <Calendar className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-bold text-cyan-400">{campaign.stats?.leads || 0}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-400 to-white h-full w-[45%]"></div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
          <h3 className="font-semibold text-white">Pipeline de Candidatos</h3>
          <button className="px-3 py-1.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors">
            Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="px-6 py-4">Candidato</th>
                <th className="px-6 py-4">Rol Actual</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    <BrainCircuit className="h-3 w-3" /> Análisis AI
                  </div>
                </th>
                <th className="px-6 py-4">Symmetry Score</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {MOCK_CANDIDATES.map((candidate: Candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={candidate.avatar} alt={candidate.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-800" />
                      <div>
                        <p className="font-medium text-white">{candidate.name}</p>
                        <p className="text-xs text-slate-500">{candidate.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-300">{candidate.role}</p>
                    <p className="text-xs text-slate-500">@ {candidate.company}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={candidate.status} />
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                      {candidate.aiAnalysis}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${candidate.matchScore > 90 ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : candidate.matchScore > 80 ? 'bg-cyan-500' : 'bg-slate-500'}`}
                          style={{ width: `${candidate.matchScore}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs font-bold ${candidate.matchScore > 90 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {candidate.matchScore}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                      Ver Perfil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  // Mapeo de estados para mostrar en español
  const statusMap: Record<string, string> = {
    'Contacted': 'Contactado',
    'Responded': 'Respondió',
    'Scheduled': 'Agendado',
    'Offer Sent': 'Oferta Enviada',
    'Pool': 'En Reserva'
  };

  const styles: Record<string, string> = {
    'Contacted': 'bg-slate-800 text-slate-400 border-slate-700',
    'Responded': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Scheduled': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Offer Sent': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'Pool': 'bg-slate-800 text-slate-500 border-slate-700 dashed',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles['Contacted']}`}>
      {statusMap[status] || status}
    </span>
  );
};

export default DetailView;
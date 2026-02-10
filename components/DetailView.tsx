import React, { useState, useEffect, useRef } from 'react';
import { Candidate, Campaign } from '../types/database';
import { ChevronLeft, Linkedin, Send, MessageSquare, Calendar, BrainCircuit, Search, Play, Loader2, ExternalLink, Terminal, ChevronDown, ChevronUp, X, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { searchEngine } from '../lib/SearchEngine';
import { CampaignService, CandidateService } from '../lib/services';
import Scheduler from './Scheduler';
import Toast from './Toast';

interface DetailViewProps {
  campaign: Campaign;
  onBack: () => void;
}

const DetailView: React.FC<DetailViewProps> = ({ campaign, onBack }) => {
  const [candidates, setCandidates] = useState<(Candidate & { status_in_campaign?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [leadCount, setLeadCount] = useState(10);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load existing candidates
  useEffect(() => {
    loadCandidates();
  }, [campaign.id]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await CampaignService.getCandidatesByCampaign(campaign.id);
      setCandidates(data);
    } catch (e) {
      console.error("Error loading candidates:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSearch = async () => {
    setSearching(true);
    setLogs([]);
    setShowLogs(true);

    try {
      const source = campaign.platform === 'Communities' || campaign.platform === 'Freelance' ? 'gmail' : 'linkedin';

      await searchEngine.startSearch(
        campaign.target_role || 'Developer',
        source,
        leadCount,
        (msg) => setLogs(prev => [...prev, msg]),
        async (newCandidates) => {
          const savePromises = newCandidates.map(async (c) => {
            try {
              const savedCandidate = await CandidateService.create(c);
              await CampaignService.addCandidateToCampaign(campaign.id, savedCandidate.id);
            } catch (err) {
              console.error("Failed to save candidate", c.email, err);
            }
          });

          await Promise.all(savePromises);
          await loadCandidates();

          setSearching(false);
          setToast({ show: true, message: `¡${newCandidates.length} nuevos candidatos encontrados!` });
        }
      );
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ Error crítico: ${e.message}`]);
      setToast({ show: true, message: 'Error en la búsqueda: ' + e.message });
      setSearching(false);
    }
  };

  const handleScheduleChange = async (enabled: boolean, time: string, leads: number) => {
    // console.log("Horario actualizado:", { enabled, time, leads });
    // TODO: Save to DB
  };

  // Helper to safely parse AI analysis
  const parseAnalysis = (analysis: string | null) => {
    if (!analysis) return null;
    try {
      return JSON.parse(analysis);
    } catch (e) {
      return { summary: analysis }; // Fallback to plain string
    }
  };

  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col relative">
      {/* Header & Nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
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
            <p className="text-slate-400 text-sm">Rol: <span className="text-cyan-400">{campaign.target_role}</span> • Estado: <span className="text-slate-300">{campaign.status}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <span className="text-slate-400 text-sm">Cantidad:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={leadCount}
              onChange={(e) => setLeadCount(Number(e.target.value))}
              className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-center focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={handleRunSearch}
            disabled={searching}
            className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            {searching ? 'Buscando...' : 'Ejecutar Búsqueda Manual'}
          </button>
        </div>
      </div>

      {/* Live Logs Section */}
      {(searching || logs.length > 0) && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-4 py-2 bg-slate-900/50 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Terminal className="h-4 w-4 text-cyan-500" />
              Registro de Búsqueda ({logs.length} líneas)
            </div>
            {showLogs ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {showLogs && (
            <div className="p-4 h-48 overflow-y-auto font-mono text-xs text-slate-400 flex flex-col gap-1">
              {logs.map((log, i) => (
                <div key={i} className="border-l-2 border-slate-800 pl-2 py-0.5">
                  <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-emerald-400' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Scheduler Card */}
        <div className="lg:col-span-1">
          <Scheduler
            onScheduleChange={handleScheduleChange}
            initialEnabled={false}
            initialLeads={10}
          />
        </div>

        {/* Stats Bar */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex justify-between items-start mb-2">
              <p className="text-slate-400 text-sm font-medium">Alcance Total</p>
              <Send className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-3xl font-bold text-white">{campaign.settings?.stats?.sent || 0}</p>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-500 h-full w-[70%]"></div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex justify-between items-start mb-2">
              <p className="text-slate-400 text-sm font-medium">Tasa de Respuesta</p>
              <MessageSquare className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-3xl font-bold text-white">{campaign.settings?.stats?.responseRate || 0}%</p>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-cyan-500 h-full" style={{ width: `${campaign.settings?.stats?.responseRate || 0}%` }}></div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-cyan-500/20 p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
            <div className="flex justify-between items-start mb-2">
              <p className="text-cyan-100 text-sm font-medium">Interesados (Hot)</p>
              <Calendar className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-cyan-400">{campaign.settings?.stats?.leads || 0}</p>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-white h-full w-[45%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
          <h3 className="font-semibold text-white">Pipeline de Candidatos ({candidates.length})</h3>
          <button
            onClick={() => {
              const headers = ['Name', 'Role', 'Company', 'Email', 'LinkedIn', 'Score', 'Message', 'Analysis'];
              const csvContent = [
                headers.join(','),
                ...candidates.map(c => {
                  const analysis = parseAnalysis(c.ai_analysis);
                  const message = analysis?.outreach_message || '';
                  const summary = analysis?.summary || '';

                  return [
                    `"${c.full_name}"`,
                    `"${c.job_title}"`,
                    `"${c.current_company}"`,
                    `"${c.email || ''}"`,
                    `"${c.linkedin_url || ''}"`,
                    `"${c.symmetry_score || 0}"`,
                    `"${message.replace(/"/g, '""')}"`, // Escape quotes
                    `"${summary.replace(/"/g, '""')}"`
                  ].join(',');
                })
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `talentscope_export_${campaign.id}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}
            className="px-3 py-1.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
          >
            Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <p>No se encontraron candidatos.</p>
              <button onClick={handleRunSearch} className="text-cyan-400 hover:text-cyan-300 text-sm mt-2">Ejecutar búsqueda para comenzar</button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="px-6 py-4">Candidato</th>
                  <th className="px-6 py-4">Rol Actual</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Mensaje Personalizado</th>
                  <th className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <BrainCircuit className="h-3 w-3" /> Score
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.full_name)}&background=0F172A&color=94A3B8`}
                          alt={candidate.full_name}
                          className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-800"
                        />
                        <div>
                          <p className="font-medium text-white">{candidate.full_name}</p>
                          <p className="text-xs text-slate-500">{candidate.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-300">{candidate.job_title}</p>
                      <p className="text-xs text-slate-500">@ {candidate.current_company}</p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={candidate.status_in_campaign || 'Pool'} />
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const analysis = parseAnalysis(candidate.ai_analysis);
                        const message = analysis?.outreach_message || '';
                        return message ? (
                          <div className="max-w-sm">
                            <p className="text-sm text-slate-300 line-clamp-2" title={message}>
                              {message}
                            </p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(message);
                                setToast({ show: true, message: '✅ Mensaje copiado!' });
                              }}
                              className="text-xs text-cyan-400 hover:text-cyan-300 mt-1"
                            >
                              Copiar
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">No disponible</span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      {candidate.symmetry_score !== undefined && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${candidate.symmetry_score > 90 ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : candidate.symmetry_score > 80 ? 'bg-cyan-500' : 'bg-slate-500'}`}
                              style={{ width: `${candidate.symmetry_score}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-bold ${candidate.symmetry_score > 90 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {candidate.symmetry_score}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCandidate(candidate)}
                          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                        >
                          <BrainCircuit className="h-3 w-3" /> Ver
                        </button>
                        <a
                          href={candidate.linkedin_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Analysis Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-cyan-500" />
                Análisis Deep Research
              </h3>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={selectedCandidate.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedCandidate.full_name)}&background=0F172A&color=94A3B8`}
                  alt={selectedCandidate.full_name}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-cyan-500/50"
                />
                <div>
                  <h4 className="text-xl font-bold text-white">{selectedCandidate.full_name}</h4>
                  <p className="text-slate-400 text-sm">{selectedCandidate.job_title} @ {selectedCandidate.current_company}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Score: {selectedCandidate.symmetry_score}%</span>
                  </div>
                </div>
              </div>

              {(() => {
                const analysis = parseAnalysis(selectedCandidate.ai_analysis);
                if (!analysis) return <p className="text-slate-500 italic">No hay análisis detallado disponible.</p>;

                // If it's old string format
                if (typeof analysis === 'string' || (!analysis.psychological_profile && analysis.summary)) {
                  return (
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                      <p className="text-slate-300 leading-relaxed">{analysis.summary || analysis}</p>
                    </div>
                  )
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2 text-blue-400 font-semibold text-sm">
                        <BrainCircuit className="h-4 w-4" />
                        PERFIL PSICOLÓGICO
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {analysis.psychological_profile}
                      </p>
                    </div>

                    <div className="bg-slate-800/30 p-4 rounded-xl border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
                        <TrendingUp className="h-4 w-4" />
                        MOMENTO EMPRESARIAL
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {analysis.business_moment}
                      </p>
                    </div>

                    <div className="bg-slate-800/30 p-4 rounded-xl border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold text-sm">
                        <Target className="h-4 w-4" />
                        ÁNGULO DE VENTA
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {analysis.sales_angle}
                      </p>
                    </div>

                    <div className="bg-slate-800/30 p-4 rounded-xl border border-pink-500/20">
                      <div className="flex items-center gap-2 mb-2 text-pink-400 font-semibold text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        CUELLO DE BOTELLA
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {analysis.bottleneck}
                      </p>
                    </div>

                    <div className="col-span-1 md:col-span-2 mt-2">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Habilidades Clave</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.skills?.map((skill: string, idx: number) => (
                          <span key={idx} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-md text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                      <div className="flex items-center gap-2 mb-2 text-purple-400 font-semibold text-sm">
                        <Send className="h-4 w-4" />
                        MENSAJE PERSONALIZADO (DM)
                      </div>
                      <p className="text-slate-200 text-sm leading-relaxed italic">
                        "{analysis.outreach_message || `¡Hola ${selectedCandidate.full_name}! Tenemos roles perfectos para ti.`}"
                      </p>
                      <button
                        onClick={() => {
                          const msg = analysis.outreach_message || `¡Hola ${selectedCandidate.full_name}! Tenemos roles perfectos para ti.`;
                          navigator.clipboard.writeText(msg);
                          setToast({ show: true, message: '✅ Mensaje copiado al portapapeles!' });
                        }}
                        className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-all"
                      >
                        📋 Copiar Mensaje
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
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
    'Hired': 'Contratado',
    'Rejected': 'Rechazado',
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
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles['Pool']}`}>
      {statusMap[status] || status}
    </span>
  );
};

export default DetailView;
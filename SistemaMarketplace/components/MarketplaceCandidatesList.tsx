import React, { useState, useMemo } from 'react';
import { Download, Calendar, ChevronDown, X } from 'lucide-react';
import { EnrichedCandidate, MarketplaceRaid } from '../types/marketplace';
import { MarketplaceCSVExport } from '../utils/csvExport';

interface MarketplaceCandidatesListProps {
  raid: MarketplaceRaid;
  candidates: EnrichedCandidate[];
  onBack: () => void;
}

export const MarketplaceCandidatesList: React.FC<MarketplaceCandidatesListProps> = ({
  raid,
  candidates,
  onBack,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<EnrichedCandidate | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedExport, setSelectedExport] = useState<'all' | 'enrichment' | 'contacts'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const handleExport = () => {
    if (!dateRange.start || !dateRange.end) {
      setToast({ show: true, message: '⚠️ Selecciona un rango de fechas' });
      return;
    }

    const startDate = new Date(dateRange.start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    const filtered = candidates.filter(c => {
      const cDate = new Date(c.scrapedAt);
      return cDate >= startDate && cDate <= endDate;
    });

    if (filtered.length === 0) {
      setToast({ show: true, message: '⚠️ No hay candidatos en este rango' });
      return;
    }

    try {
      if (selectedExport === 'all') {
        MarketplaceCSVExport.exportCandidates(raid, filtered);
      } else if (selectedExport === 'enrichment') {
        MarketplaceCSVExport.exportEnrichmentReport(raid, filtered);
      } else if (selectedExport === 'contacts') {
        if (raid.campaigns.length > 0) {
          MarketplaceCSVExport.exportContactList(raid.campaigns[0], filtered);
        }
      }

      setToast({
        show: true,
        message: `✅ CSV exportado con ${filtered.length} candidatos`,
      });
      setShowExportOptions(false);
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
    } catch (error) {
      setToast({ show: true, message: '❌ Error al exportar CSV' });
    }
  };

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const dateA = new Date(a.scrapedAt).getTime();
      const dateB = new Date(b.scrapedAt).getTime();
      if (dateB !== dateA) return dateB - dateA; // Most recent first
      return (b.jobSuccessRate || 0) - (a.jobSuccessRate || 0);
    });
  }, [candidates]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Volver
        </button>
        <h2 className="text-2xl font-bold text-white">Lista de Candidatos</h2>
        <div className="relative">
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>

          {showExportOptions && (
            <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 w-80">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Tipo de Exportación
                  </label>
                  <select
                    value={selectedExport}
                    onChange={(e) => setSelectedExport(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  >
                    <option value="all">Todos los datos</option>
                    <option value="enrichment">Reporte de enriquecimiento</option>
                    <option value="contacts">Lista de contactos</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Descargar
                  </button>
                  <button
                    onClick={() => setShowExportOptions(false)}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-100 z-50">
          {toast.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Nombre</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Plataforma</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Título</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Tarifa/h</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Success %</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Emails</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedCandidates.map(candidate => (
                <tr
                  key={candidate.id}
                  className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-white">{candidate.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{candidate.platform}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{candidate.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-300 font-medium">${candidate.hourlyRate.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-emerald-400">
                      {candidate.jobSuccessRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {candidate.emails.length > 0 ? `${candidate.emails.length} found` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {candidate.linkedInUrl ? (
                      <a
                        href={candidate.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Ver Perfil
                      </a>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm">Total</div>
          <div className="text-2xl font-bold text-white">{sortedCandidates.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm">Con Email</div>
          <div className="text-2xl font-bold text-emerald-400">
            {sortedCandidates.filter(c => c.emails.length > 0).length}
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm">Con LinkedIn</div>
          <div className="text-2xl font-bold text-blue-400">
            {sortedCandidates.filter(c => c.linkedInUrl).length}
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm">Score Promedio</div>
          <div className="text-2xl font-bold text-cyan-400">
            {(
              sortedCandidates.reduce((sum, c) => sum + c.identityConfidenceScore, 0) /
              sortedCandidates.length
            ).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal for quick 'Ver' view (concise, scan-friendly)
const CandidateQuickView: React.FC<{ candidate: EnrichedCandidate | null; onClose: () => void }> = ({ candidate, onClose }) => {
  if (!candidate) return null;

  const analysis = {
    psychological_profile: candidate.psychologicalProfile || 'Innovador y orientado a resultados.',
    business_moment: candidate.businessMoment || 'Enfocado en liderar el diseño de productos innovadores.',
    sales_angle: candidate.salesAngle || 'Aprovechar su pasión por la innovación para introducir nuevas soluciones.',
    bottleneck: candidate.bottleneck || 'Necesidad de mantenerse al día con las últimas tendencias tecnológicas.'
  };

  const invitation = candidate.walead_messages?.icebreaker || `Hola ${candidate.name}, vi que lideras el diseño de productos, ¡me encantaría conectar y compartir ideas sobre innovación!`;
  const postAcceptance = candidate.walead_messages?.followup_message || `Hola ${candidate.name}, gracias por aceptar mi conexión. He estado siguiendo el trabajo innovador que realizas y creo que hay oportunidades interesantes para colaborar en proyectos que impulsen el desarrollo de productos.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 relative">
          <div className="flex items-center gap-2 text-blue-400">
            <span className="text-xl">✨</span>
            <h3 className="text-md font-semibold tracking-wide">Análisis Deep Research</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Candidate Info Header */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg">
              {candidate.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{candidate.name}</h2>
              </div>
              <p className="text-sm text-slate-400">{candidate.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-slate-800/80 text-slate-300 text-xs px-2 py-0.5 rounded-md border border-slate-700/50">
                  Score: {candidate.identityConfidenceScore ? Math.round(candidate.identityConfidenceScore * 100) : 75}%
                </span>
                <a href={candidate.linkedInUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                  Ver Perfil @{candidate.platform}
                </a>
              </div>
            </div>
          </div>

          {/* Deep Research Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Psychological Profile */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-blue-500/20 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-400">🧠</span>
                <p className="text-xs font-bold text-blue-400 tracking-wider uppercase">Perfil Psicológico</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.psychological_profile}</p>
            </div>

            {/* Business Moment */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-emerald-500/20 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-400">📈</span>
                <p className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Momento Empresarial</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.business_moment}</p>
            </div>

            {/* Sales Angle */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-yellow-500/20 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400">🎯</span>
                <p className="text-xs font-bold text-yellow-400 tracking-wider uppercase">Ángulo de Venta</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.sales_angle}</p>
            </div>

            {/* Bottleneck */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-pink-500/20 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-pink-400">⚠️</span>
                <p className="text-xs font-bold text-pink-400 tracking-wider uppercase">Cuello de Botella</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.bottleneck}</p>
            </div>
          </div>

          {/* Key Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3">Habilidades Clave</p>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.slice(0, 5).map((skill, idx) => (
                  <span key={idx} className="bg-slate-800/80 text-slate-300 text-xs px-3 py-1.5 rounded-md border border-slate-700/50">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-sm transition-colors">
              <span>✏️</span> Editar Mensajes
            </button>
          </div>

          {/* Outreach Messages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Invitation */}
            <div className="p-5 rounded-xl bg-blue-900/10 border border-blue-500/30 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-blue-400">✉️</span>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">1</span>
                <p className="text-xs font-bold text-blue-400 tracking-wider uppercase">Invitación Inicial</p>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed flex-1">"{invitation}"</p>
              <button
                onClick={() => { navigator.clipboard.writeText(invitation); }}
                className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
              >
                <span>📋</span> Copiar
              </button>
            </div>

            {/* Post-Acceptance */}
            <div className="p-5 rounded-xl bg-emerald-900/10 border border-emerald-500/30 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-emerald-400">💬</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded">2</span>
                <p className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Post-Aceptación</p>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed flex-1">"{postAcceptance}"</p>
              <button
                onClick={() => { navigator.clipboard.writeText(postAcceptance); }}
                className="mt-4 w-full flex-grow-0 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
              >
                <span>📋</span> Copiar
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceCandidatesList;

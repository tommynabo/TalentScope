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
    return [...candidates].sort((a, b) => b.jobSuccessRate - a.jobSuccessRate);
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

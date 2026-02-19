import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { Campaign, EnrichedCandidateInCampaign } from '../types/campaigns';
import { MarketplaceCSVExport } from '../utils/csvExport';

interface PipelineListProps {
  campaign: Campaign;
  onUpdateCandidate: (candidate: EnrichedCandidateInCampaign, newLane: string) => void;
}

export const PipelineList: React.FC<PipelineListProps> = ({ campaign, onUpdateCandidate }) => {
  const [sortBy, setSortBy] = useState<'name' | 'rate' | 'success' | 'added'>('added');
  const [filterLane, setFilterLane] = useState<string | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const laneLabels: Record<string, string> = {
    todo: 'Por Contactar',
    contacted: 'Contactado',
    replied: 'Respondió',
    rejected: 'Rechazó',
    hired: 'Contratado',
  };

  const laneBg: Record<string, string> = {
    todo: 'bg-slate-500',
    contacted: 'bg-blue-500',
    replied: 'bg-emerald-500',
    rejected: 'bg-red-500',
    hired: 'bg-purple-500',
  };

  const sortedCandidates = [...campaign.candidates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'rate':
        return b.hourlyRate - a.hourlyRate;
      case 'success':
        return b.jobSuccessRate - a.jobSuccessRate;
      case 'added':
      default:
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  const filtered = filterLane
    ? sortedCandidates.filter(c => c.kanbanLane === filterLane)
    : sortedCandidates;

  const handleExport = () => {
    if (!dateRange.start || !dateRange.end) {
      alert('Selecciona rango de fechas');
      return;
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    const exportCandidates = filtered.filter(c => {
      const date = new Date(c.addedAt);
      return date >= startDate && date <= endDate;
    });

    if (exportCandidates.length === 0) {
      alert('No hay candidatos en ese rango');
      return;
    }

    // Convertir a EnrichedCandidate format para exportar
    const enrichedFormat = exportCandidates.map(c => ({
      id: c.candidateId,
      name: c.name,
      platform: c.platform,
      platformUsername: '',
      profileUrl: c.linkedInUrl || '',
      title: '',
      country: '',
      hourlyRate: c.hourlyRate,
      jobSuccessRate: c.jobSuccessRate,
      certifications: [],
      bio: `Pipeline: ${laneLabels[c.kanbanLane]}`,
      scrapedAt: c.addedAt,
      linkedInUrl: c.linkedInUrl,
      emails: c.email ? [c.email] : [],
      photoValidated: false,
      identityConfidenceScore: 0.7,
    }));

    const mockRaid = {
      raidName: campaign.name,
    };

    const mockCampaign = {
      id: campaign.id,
      name: campaign.name,
      description: '',
      targetRole: '',
      companyName: '',
      messageTemplate: '',
      platforms: 'Email' as const,
      createdAt: campaign.createdAt,
      totalCandidates: enrichedFormat.length,
      sentCount: 0,
      stats: { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalReplied: 0 },
    };

    MarketplaceCSVExport.exportContactList(mockCampaign, enrichedFormat);
    setShowExportOptions(false);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header with sorts and filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm"
          >
            <option value="added">Agregado</option>
            <option value="name">Nombre</option>
            <option value="rate">Tarifa</option>
            <option value="success">Success %</option>
          </select>

          <select
            value={filterLane || ''}
            onChange={(e) => setFilterLane(e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm"
          >
            <option value="">Todos</option>
            <option value="todo">Por Contactar</option>
            <option value="contacted">Contactado</option>
            <option value="replied">Respondió</option>
            <option value="rejected">Rechazó</option>
            <option value="hired">Contratado</option>
          </select>
        </div>

        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>

          {showExportOptions && (
            <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-4 w-80">
              <h4 className="font-semibold text-slate-200 mb-3">Exportar CSV por Fechas</h4>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Desde</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Hasta</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded transition-colors"
                >
                  Descargar
                </button>
                <button
                  onClick={() => setShowExportOptions(false)}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Tarifa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Success %</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map(candidate => (
                <tr
                  key={candidate.candidateId}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <select
                      value={candidate.kanbanLane}
                      onChange={(e) => onUpdateCandidate(candidate, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-medium text-white border-0 cursor-pointer ${
                        laneBg[candidate.kanbanLane]
                      }`}
                    >
                      {Object.entries(laneLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-200">{candidate.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{candidate.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-medium">
                    ${candidate.hourlyRate.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-400 font-medium">
                    {candidate.jobSuccessRate.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {candidate.linkedInUrl ? (
                      <a
                        href={candidate.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Ver
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
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(laneLabels).map(([lane, label]) => {
          const count = campaign.candidates.filter(c => c.kanbanLane === lane).length;
          return (
            <div key={lane} className={`p-3 rounded-lg text-center ${laneBg[lane]}`}>
              <div className="text-xs text-white/70 mb-1">{label}</div>
              <div className="text-2xl font-bold text-white">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Target, Download } from 'lucide-react';
import { MarketplaceRaid, ScrapingFilter, EnrichedCandidate } from '../types/marketplace';
import { MarketplaceSearchAndFilters } from './MarketplaceSearchAndFilters';
import { MarketplaceCandidatesList } from './MarketplaceCandidatesList';
import { FreeEnrichmentService } from '../services/freeEnrichmentService';
import { MarketplaceCSVExport } from '../utils/csvExport';

interface MarketplaceRaidDashboardProps {
  onBack: () => void;
}

export const MarketplaceRaidDashboard: React.FC<MarketplaceRaidDashboardProps> = ({ onBack }) => {
  const [raid, setRaid] = useState<MarketplaceRaid | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'candidates' | 'enrichment' | 'export'>('search');
  const [enrichmentService] = useState(() => new FreeEnrichmentService());
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (filter: ScrapingFilter) => {
    setError('');
    try {
      const mockCandidates = Array.from({ length: 15 }, (_, i) => ({
        id: `candidate-${i}`,
        name: `Juan ${String.fromCharCode(65 + (i % 26))}${i}`,
        platform: filter.platforms[i % filter.platforms.length],
        platformUsername: `developer${i}`,
        profileUrl: `https://upwork.com/freelancers/dev${i}`,
        title: `Senior ${filter.keyword} Developer`,
        country: ['España', 'Argentina', 'México'][i % 3],
        hourlyRate: filter.minHourlyRate + Math.random() * 60,
        jobSuccessRate: filter.minJobSuccessRate + Math.random() * 15,
        certifications: filter.certifications,
        bio: `Experienced ${filter.keyword} developer`,
        scrapedAt: new Date().toISOString(),
      }));

      const newRaid: MarketplaceRaid = {
        id: crypto.randomUUID(),
        raidName: `${filter.keyword} Raid ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        status: 'Candidatos encontrados',
        scrapedCandidates: mockCandidates,
        enrichedCandidates: [],
        campaigns: [],
        outreachRecords: [],
        scrapingProgress: {
          total: mockCandidates.length,
          completed: mockCandidates.length,
          failed: 0,
        },
        enrichmentProgress: {
          total: 0,
          completed: 0,
          failed: 0,
        },
        stats: {
          totalScraped: mockCandidates.length,
          totalEnriched: 0,
          totalContacted: 0,
        },
      };

      setRaid(newRaid);
      setActiveTab('enrichment');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEnrichment = async () => {
    if (!raid) return;
    setEnriching(true);

    try {
      const enriched: EnrichedCandidate[] = [];

      for (const candidate of raid.scrapedCandidates) {
        const enrichedCandidate = await enrichmentService.enrichCandidate(candidate);
        enriched.push(enrichedCandidate);
        await new Promise(r => setTimeout(r, 100));
      }

      const updatedRaid: MarketplaceRaid = {
        ...raid,
        enrichedCandidates: enriched,
        enrichmentProgress: {
          total: enriched.length,
          completed: enriched.length,
          failed: 0,
        },
        stats: {
          ...raid.stats,
          totalEnriched: enriched.length,
        },
        status: 'Listo para exportar',
      };

      setRaid(updatedRaid);
      setActiveTab('candidates');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnriching(false);
    }
  };

  const handleExportForOutreach = () => {
    if (!raid || raid.enrichedCandidates.length === 0) {
      setError('No hay candidatos enriquecidos');
      return;
    }

    const campaign = {
      id: 'temp',
      name: raid.raidName,
      description: '',
      targetRole: '',
      companyName: '',
      messageTemplate: '',
      platforms: 'Email' as const,
      createdAt: new Date().toISOString(),
      totalCandidates: 0,
      sentCount: 0,
      stats: { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalReplied: 0 },
    };

    MarketplaceCSVExport.exportContactList(campaign, raid.enrichedCandidates);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Target className="h-7 w-7 text-emerald-400" />
              Marketplace Raid
            </h2>
            {raid && <p className="text-slate-400 text-sm mt-1">{raid.raidName}</p>}
          </div>
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700 flex bg-slate-800/30">
          {[
            { id: 'search', label: 'Búsqueda', icon: '🔍' },
            { id: 'enrichment', label: 'Enriquecimiento', icon: '🧠' },
            { id: 'candidates', label: 'Candidatos', icon: '👥' },
            { id: 'export', label: 'Exportar', icon: '📥' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-6 py-4 font-medium text-center border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <MarketplaceSearchAndFilters onSearch={handleSearch} />
            </div>
          )}

          {activeTab === 'enrichment' && raid && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-sm">Candidatos Scrapeados</div>
                  <div className="text-3xl font-bold text-emerald-400 mt-2">
                    {raid.stats.totalScraped}
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-sm">Enriquecidos</div>
                  <div className="text-3xl font-bold text-cyan-400 mt-2">
                    {raid.stats.totalEnriched}
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-sm">Estado</div>
                  <div className="text-sm text-slate-300 mt-2">{raid.status}</div>
                </div>
              </div>

              {raid.stats.totalEnriched === 0 && (
                <button
                  onClick={handleEnrichment}
                  disabled={enriching}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {enriching ? 'Enriqueciendo...' : 'Iniciar Enriquecimiento (IA Gratuita)'}
                </button>
              )}

              {raid.stats.totalEnriched > 0 && (
                <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4 text-emerald-300">
                  ✅ Candidatos enriquecidos con éxito
                </div>
              )}
            </div>
          )}

          {activeTab === 'candidates' && raid && raid.enrichedCandidates.length > 0 && (
            <MarketplaceCandidatesList
              raid={raid}
              candidates={raid.enrichedCandidates}
              onBack={() => setActiveTab('search')}
            />
          )}

          {activeTab === 'export' && raid && raid.enrichedCandidates.length > 0 && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Download className="h-5 w-5 text-emerald-400" />
                  Exportar para Contacto Manual
                </h3>
                <p className="text-slate-400 mb-4">
                  Descarga la lista de contactos enriquecida para contactar manualmente
                </p>

                <button
                  onClick={handleExportForOutreach}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Descargar CSV - Contactos Enriquecidos
                </button>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      MarketplaceCSVExport.exportCandidates(raid, raid.enrichedCandidates);
                    }}
                    className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Todos los Datos
                  </button>
                  <button
                    onClick={() => {
                      MarketplaceCSVExport.exportEnrichmentReport(raid, raid.enrichedCandidates);
                    }}
                    className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Reporte Enriquecimiento
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">📋 Próximos Pasos</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>1. Descarga el CSV con contactos</li>
                  <li>2. Abre en LinkedIn o Outlook</li>
                  <li>3. Envía mensajes personalizados</li>
                  <li>4. Trackea respuestas manualmente</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

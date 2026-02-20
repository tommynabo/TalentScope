import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft, Target, Send, MessageSquare, Calendar,
  Search, Play, Loader2, ExternalLink, Terminal,
  ChevronDown, ChevronUp, X, Columns, List, Download, Trash2,
  DollarSign, Award, Globe, User
} from 'lucide-react';
import { Campaign, EnrichedCandidateInCampaign } from '../types/campaigns';
import { KanbanBoard } from './KanbanBoard';
import { ManualEnrichmentModal } from './ManualEnrichmentModal';
import { MarketplaceRaidService } from '../services/marketplaceRaidService';
import { ScrapingFilter, FreelancePlatform } from '../types/marketplace';

import Toast from '../../components/Toast';

// ─── Sort types ─────────────────────────────────────────────────────────
type SortField = 'addedAt' | 'jobSuccessRate' | 'name' | 'hourlyRate';
type SortDirection = 'asc' | 'desc';

interface CampaignDashboardProps {
  campaign: Campaign;
  onUpdateCampaign: (campaign: Campaign) => void;
  onBack: () => void;
}

export const CampaignDashboard: React.FC<CampaignDashboardProps> = ({
  campaign,
  onUpdateCampaign,
  onBack,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ field: 'addedAt', direction: 'desc' });
  const [selectedCandidate, setSelectedCandidate] = useState<EnrichedCandidateInCampaign | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Search state (simulated for now — backend logic untouched)
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [leadCount, setLeadCount] = useState(50);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // ─── Sort logic ───────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { field, direction: 'desc' };
    });
  };

  const sortedCandidates = useMemo(() => {
    const sorted = [...campaign.candidates].sort((a, b) => {
      let cmp = 0;
      if (sortConfig.field === 'addedAt') {
        const dateA = new Date(a.addedAt).getTime();
        const dateB = new Date(b.addedAt).getTime();
        cmp = dateA - dateB;
      } else if (sortConfig.field === 'jobSuccessRate') {
        cmp = a.jobSuccessRate - b.jobSuccessRate;
      } else if (sortConfig.field === 'hourlyRate') {
        cmp = a.hourlyRate - b.hourlyRate;
      } else if (sortConfig.field === 'name') {
        cmp = a.name.localeCompare(b.name);
      }
      return sortConfig.direction === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [campaign.candidates, sortConfig]);

  // ─── Date grouping ────────────────────────────────────────────────────
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';

    return target.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  };

  const groupedCandidates = useMemo(() => {
    const groups: { label: string; count: number; candidates: EnrichedCandidateInCampaign[] }[] = [];
    let currentKey = '';

    for (const c of sortedCandidates) {
      const dateStr = c.addedAt;
      const date = new Date(dateStr);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      if (dayKey !== currentKey) {
        currentKey = dayKey;
        groups.push({ label: formatDateLabel(dateStr), count: 0, candidates: [] });
      }

      const group = groups[groups.length - 1];
      group.candidates.push(c);
      group.count++;
    }

    return groups;
  }, [sortedCandidates]);

  // ─── Candidate actions ────────────────────────────────────────────────
  const handleUpdateCandidate = (candidate: EnrichedCandidateInCampaign, newLane: string) => {
    const updated = campaign.candidates.map(c =>
      c.candidateId === candidate.candidateId
        ? { ...c, kanbanLane: newLane as any }
        : c
    );

    const stats = {
      total: updated.length,
      inTodo: updated.filter(c => c.kanbanLane === 'todo').length,
      inContacted: updated.filter(c => c.kanbanLane === 'contacted').length,
      inReplied: updated.filter(c => c.kanbanLane === 'replied').length,
      inRejected: updated.filter(c => c.kanbanLane === 'rejected').length,
      inHired: updated.filter(c => c.kanbanLane === 'hired').length,
      contactRate: (updated.filter(c => c.kanbanLane !== 'todo').length / updated.length) * 100 || 0,
      responseRate: (updated.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updated.length) * 100 || 0,
    };

    onUpdateCampaign({ ...campaign, candidates: updated, stats });
    setToast({ show: true, message: '✅ Estado actualizado' });
  };

  const handleAddCandidate = (candidateData: Omit<EnrichedCandidateInCampaign, 'candidateId'>) => {
    const newCandidate: EnrichedCandidateInCampaign = {
      ...candidateData,
      candidateId: `manual-${Date.now()}`,
    };

    const updated = [...campaign.candidates, newCandidate];
    const stats = {
      total: updated.length,
      inTodo: updated.filter(c => c.kanbanLane === 'todo').length,
      inContacted: updated.filter(c => c.kanbanLane === 'contacted').length,
      inReplied: updated.filter(c => c.kanbanLane === 'replied').length,
      inRejected: updated.filter(c => c.kanbanLane === 'rejected').length,
      inHired: updated.filter(c => c.kanbanLane === 'hired').length,
      contactRate: (updated.filter(c => c.kanbanLane !== 'todo').length / updated.length) * 100 || 0,
      responseRate: (updated.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updated.length) * 100 || 0,
    };

    onUpdateCampaign({ ...campaign, candidates: updated, stats });
    setShowAddModal(false);
    setToast({ show: true, message: '✅ Candidato añadido' });
  };

  // ─── Search with Real Services ─────────────────────────────────────────
  const handleRunSearch = async () => {
    setSearching(true);
    setLogs([]);
    setShowLogs(true);

    try {
      setLogs(prev => [...prev, `🔍 Iniciando búsqueda de ${leadCount} leads en ${campaign.platform}...`]);
      setLogs(prev => [...prev, `📋 Keywords: ${campaign.searchTerms.keyword}`]);
      setLogs(prev => [...prev, `💰 Tarifa: $${campaign.searchTerms.minHourlyRate}-$${campaign.searchTerms.maxHourlyRate || '∞'}/h`]);
      setLogs(prev => [...prev, `✅ Job Success Rate mínimo: ${campaign.searchTerms.minJobSuccessRate}%`]);
      setLogs(prev => [...prev, `⏳ Conectando con APIs de scraping...`]);

      // Get API keys from environment - REAL KEYS, NOT MOCK
      const apifyKey = import.meta.env.VITE_APIFY_API_KEY;
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Log which mode we're in
      if (!apifyKey || apifyKey === 'mock') {
        setLogs(prev => [...prev, `⚠️ MODO SIMULACIÓN: No hay API key de Apify configurada`]);
      } else if (apifyKey) {
        setLogs(prev => [...prev, `✅ SCRAPING REAL: Apify API configurada (${apifyKey.substring(0, 15)}...)`]);
      }

      if (!openaiKey || openaiKey === 'mock') {
        setLogs(prev => [...prev, `⚠️ ENRIQUECIMIENTO MOCK: No hay API key de OpenAI configurada`]);
      } else if (openaiKey) {
        setLogs(prev => [...prev, `✅ ENRIQUECIMIENTO REAL: OpenAI API configurada (sk-proj-...)`]);
      }

      // Initialize service with real keys AND Supabase
      const raidService = MarketplaceRaidService.getInstance(apifyKey, openaiKey, supabaseUrl, supabaseKey);

      setLogs(prev => [...prev, `✅ Servicio marketplace inicializado`]);

      // Validate connections
      setLogs(prev => [...prev, `🔗 Validando conexiones a APIs...`]);
      const connections = await raidService.validateAllConnections();

      if (connections.apify) {
        setLogs(prev => [...prev, `✅✅✅ APIFY CONECTADO - SCRAPING EN VIVO`]);
      } else {
        setLogs(prev => [...prev, `❌ Apify no responde - verifica tu API key y los Actor IDs configurados en BD`]);
        setLogs(prev => [...prev, `📋 SOLUCIÓN: Ve a Supabase y actualiza los Actor IDs en la tabla 'apify_config'`]);
        setLogs(prev => [...prev, `📖 Lee: SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md para instrucciones completas`]);
        setLogs(prev => [...prev, `⛔ Búsqueda cancelada: no se pueden obtener candidatos sin conexión a Apify`]);
        setSearching(false);
        return;
      }

      if (connections.openai) {
        setLogs(prev => [...prev, `✅✅✅ OPENAI CONECTADO - ENRIQUECIMIENTO EN VIVO`]);
      } else {
        setLogs(prev => [...prev, `⚠️ OpenAI no conectado - los candidatos se añadirán sin enriquecimiento IA`]);
      }

      // Create scraping filter from campaign search terms
      const filter: ScrapingFilter = {
        keyword: campaign.searchTerms.keyword,
        minHourlyRate: campaign.searchTerms.minHourlyRate,
        minJobSuccessRate: campaign.searchTerms.minJobSuccessRate,
        certifications: campaign.searchTerms.certifications || [],
        platforms: [campaign.platform as FreelancePlatform],
      };

      setLogs(prev => [...prev, `📊 FASE 1: Scraping en ${campaign.platform.toUpperCase()}...`]);

      // Start raid
      const raid = await raidService.startRaid(`Campaign: ${campaign.name}`, filter);

      setLogs(prev => [...prev, `🆔 Raid ID: ${raid.id.substring(0, 12)}...`]);

      // Execute scraping
      const raidAfterScraping = await raidService.executeScraping(raid.id, filter);
      if (!raidAfterScraping) {
        setLogs(prev => [...prev, `❌ Error en scraping`]);
        setSearching(false);
        return;
      }

      const scrapedCount = raidAfterScraping.scrapedCandidates.length;

      // Check if we actually got candidates
      if (scrapedCount === 0) {
        setLogs(prev => [...prev, `❌ No se encontraron candidatos`]);
        setLogs(prev => [...prev, `⚠️ MOTIVOS POSIBLES:`]);
        setLogs(prev => [...prev, `   1. Los Actor IDs en la BD de Supabase no son correctos`]);
        setLogs(prev => [...prev, `   2. La API key de Apify no tiene permisos o créditos suficientes`]);
        setLogs(prev => [...prev, `   3. El actor especificado no existe o está inactivo en tu cuenta de Apify`]);
        setLogs(prev => [...prev, `📋 SOLUCIÓN: Actualiza los Actor IDs en Supabase tabla 'apify_config'`]);
        setLogs(prev => [...prev, `📖 Guía completa: SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md`]);
        setSearching(false);
        return;
      }

      setLogs(prev => [...prev, `🎯 Scraping completado: ${scrapedCount} candidatos REALES encontrados de ${campaign.platform}`]);

      setLogs(prev => [...prev, `📊 FASE 2: Enriquecimiento de datos con IA...`]);

      // Execute enrichment
      const raidAfterEnrichment = await raidService.executeEnrichment(raid.id);
      if (!raidAfterEnrichment) {
        setLogs(prev => [...prev, `❌ Error en enriquecimiento`]);
        setSearching(false);
        return;
      }

      const enrichedCount = raidAfterEnrichment.enrichedCandidates.length;
      const isRealEnrichment = connections.openai;
      setLogs(prev => [...prev, `${isRealEnrichment ? '🤖' : '🧠'} Enriquecimiento completado: ${enrichedCount} candidatos ${isRealEnrichment ? 'ENRIQUECIDOS CON OpenAI' : 'CON EMAILS GENERADOS'}`]);

      // Convert enriched candidates to campaign format
      const newCandidates: EnrichedCandidateInCampaign[] = raidAfterEnrichment.enrichedCandidates.map((enriched, index) => ({
        candidateId: enriched.id,
        name: enriched.name,
        email: enriched.emails?.[0] || enriched.platformUsername + '@unknown.com',
        linkedInUrl: enriched.linkedInUrl,
        platform: enriched.platform,
        hourlyRate: enriched.hourlyRate,
        jobSuccessRate: enriched.jobSuccessRate,
        addedAt: enriched.scrapedAt || new Date().toISOString(),
        kanbanLane: 'todo' as const,
      }));

      // Add to campaign
      const updatedCandidates = [...campaign.candidates, ...newCandidates];
      const stats = {
        total: updatedCandidates.length,
        inTodo: updatedCandidates.filter(c => c.kanbanLane === 'todo').length,
        inContacted: updatedCandidates.filter(c => c.kanbanLane === 'contacted').length,
        inReplied: updatedCandidates.filter(c => c.kanbanLane === 'replied').length,
        inRejected: updatedCandidates.filter(c => c.kanbanLane === 'rejected').length,
        inHired: updatedCandidates.filter(c => c.kanbanLane === 'hired').length,
        contactRate: (updatedCandidates.filter(c => c.kanbanLane !== 'todo').length / updatedCandidates.length) * 100 || 0,
        responseRate: (updatedCandidates.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updatedCandidates.length) * 100 || 0,
      };

      onUpdateCampaign({ ...campaign, candidates: updatedCandidates, stats });

      setLogs(prev => [...prev, `✅ ${newCandidates.length} candidatos REALES añadidos al pipeline exitosamente`]);
      setLogs(prev => [...prev, `🚀 Búsqueda completada con éxito`]);
      setToast({ show: true, message: `✅ ${newCandidates.length} nuevos candidatos REALES añadidos` });
    } catch (error) {
      console.error('Search error:', error);
      setLogs(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setToast({ show: true, message: '❌ Error en la búsqueda' });
    } finally {
      setSearching(false);
    }
  };

  // ─── Clear all candidates ──────────────────────────────────────────────
  const handleClearAllCandidates = () => {
    if (campaign.candidates.length === 0) {
      setToast({ show: true, message: 'No hay candidatos para limpiar' });
      return;
    }

    if (!confirm(`⚠️ ¿Seguro de que quieres BORRAR todos los ${campaign.candidates.length} candidatos? Esta acción no se puede deshacer.`)) {
      return;
    }

    const stats = {
      total: 0,
      inTodo: 0,
      inContacted: 0,
      inReplied: 0,
      inRejected: 0,
      inHired: 0,
      contactRate: 0,
      responseRate: 0,
    };

    onUpdateCampaign({ ...campaign, candidates: [], stats });
    setToast({ show: true, message: `✅ ${campaign.candidates.length} candidatos borrados` });
  };

  const handleStopSearch = () => {
    setSearching(false);
    setLogs(prev => [...prev, '⏹️ Búsqueda detenida por el usuario.']);
    setToast({ show: true, message: 'Búsqueda detenida.' });
  };

  // ─── Export ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const { start, end } = dateRange;
    if (!start || !end) return;

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const filtered = campaign.candidates.filter(c => {
      const cDate = new Date(c.addedAt);
      return cDate >= startDate && cDate <= endDate;
    });

    if (filtered.length === 0) {
      setToast({ show: true, message: '⚠️ No hay candidatos para exportar en este rango' });
      return;
    }

    // Build CSV with marketplace-specific fields
    const headers = ['NOMBRE', 'PLATAFORMA', 'EMAIL', 'TARIFA_HORA', 'SUCCESS_RATE', 'LINKEDIN', 'ESTADO', 'FECHA'];
    const laneLabels: Record<string, string> = {
      todo: 'Por Contactar', contacted: 'Contactado', replied: 'Respondió', rejected: 'Rechazó', hired: 'Contratado'
    };

    const csvContent = [
      headers.join(','),
      ...filtered.map(c => [
        `"${c.name}"`,
        `"${c.platform}"`,
        `"${c.email || ''}"`,
        `"$${c.hourlyRate.toFixed(0)}"`,
        `"${c.jobSuccessRate.toFixed(0)}%"`,
        `"${c.linkedInUrl || ''}"`,
        `"${laneLabels[c.kanbanLane] || c.kanbanLane}"`,
        `"${c.addedAt ? c.addedAt.split('T')[0] : ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `marketplace_export_${campaign.id}_${start}_${end}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({ show: true, message: `✅ CSV exportado con ${filtered.length} candidatos` });
      setShowExportOptions(false);
    }
  };

  // ─── Lane helpers ─────────────────────────────────────────────────────
  const laneLabels: Record<string, string> = {
    todo: 'Por Contactar', contacted: 'Contactado', replied: 'Respondió', rejected: 'Rechazó', hired: 'Contratado'
  };
  const laneStyles: Record<string, string> = {
    todo: 'bg-slate-800 text-slate-500 border-slate-700',
    contacted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    replied: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    hired: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  // Added today count
  const addedToday = campaign.candidates.filter(c => {
    const d = new Date(c.addedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="p-3 md:p-4 lg:p-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col relative">
      {/* ═══ Header & Nav ═══════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-3 mb-3">
        <div className="flex items-center gap-1.5 lg:gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="p-1 lg:p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:text-emerald-400 text-slate-400 transition-all flex-shrink-0"
          >
            <ChevronLeft className="h-4 lg:h-5 w-4 lg:w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center gap-1.5 lg:gap-2 truncate">
              <Target className="h-4 lg:h-5 w-4 lg:w-5 text-emerald-400 flex-shrink-0" />
              <span className="truncate">{campaign.name}</span>
            </h2>
            <p className="text-slate-400 text-xs line-clamp-1">
              Plataforma: <span className="text-emerald-400">{campaign.platform}</span> • Keywords: <span className="text-slate-300">{campaign.searchTerms.keyword}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 lg:gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 lg:px-2.5 py-1 lg:py-1.5">
            <span className="text-slate-400 text-xs hidden sm:inline">Cant:</span>
            <input
              type="number"
              min="1"
              max="500"
              value={leadCount}
              onChange={(e) => setLeadCount(Number(e.target.value))}
              className="w-11 lg:w-14 bg-slate-800 border border-slate-700 rounded px-1 lg:px-1.5 py-0.5 text-white text-xs text-center focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={searching ? handleStopSearch : handleRunSearch}
            className={`px-2.5 lg:px-5 py-1 lg:py-2 ${searching ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'} text-white rounded-lg text-xs shadow-lg ${searching ? 'shadow-red-900/20' : 'shadow-emerald-900/20'} transition-all flex items-center gap-1 flex-shrink-0 whitespace-nowrap`}
          >
            {searching ? <X className="h-3 lg:h-4 w-3 lg:w-4" /> : <Play className="h-3 lg:h-4 w-3 lg:w-4" />}
            <span className="hidden sm:inline text-xs">{searching ? 'Detener' : 'Buscar'}</span>
            <span className="sm:hidden">{searching ? '⏹' : '🔍'}</span>
          </button>
        </div>
      </div>

      {/* ═══ Live Logs Section ══════════════════════════════════════════ */}
      {(searching || logs.length > 0) && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-4 py-2 bg-slate-900/50 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Terminal className="h-4 w-4 text-emerald-500" />
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

      {/* ═══ Stats Bar ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-3 mb-4 lg:mb-6">
        <div className="bg-slate-900/50 border border-slate-800 p-2.5 lg:p-3 rounded-lg backdrop-blur-sm">
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-slate-400 text-xs font-medium">Total Candidatos</p>
            <Send className="h-3 lg:h-3.5 w-3 lg:w-3.5 text-slate-500" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white">{campaign.stats.total}</p>
          <div className="w-full bg-slate-800 h-0.5 rounded-full mt-1.5 lg:mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full w-[70%]"></div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-2.5 lg:p-3 rounded-lg backdrop-blur-sm">
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-slate-400 text-xs font-medium">Tasa de Respuesta</p>
            <MessageSquare className="h-3 lg:h-3.5 w-3 lg:w-3.5 text-slate-500" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white">{campaign.stats.responseRate.toFixed(0)}%</p>
          <div className="w-full bg-slate-800 h-0.5 rounded-full mt-1.5 lg:mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${campaign.stats.responseRate}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-emerald-500/20 p-2.5 lg:p-3 rounded-lg backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <div className="flex justify-between items-start mb-1.5">
            <p className="text-emerald-100 text-xs font-medium">Añadidos Hoy</p>
            <Calendar className="h-3 lg:h-3.5 w-3 lg:w-3.5 text-emerald-400" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-emerald-400">{addedToday}</p>
          <div className="w-full bg-slate-800 h-0.5 rounded-full mt-1.5 lg:mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-400 to-white h-full w-[45%]"></div>
          </div>
        </div>
      </div>

      {/* ═══ Main Pipeline Table ════════════════════════════════════════ */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden flex flex-col min-h-[400px]">
        {/* Header with View Toggle & Export */}
        <div className="px-3 py-2 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 transition-all">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <h3 className="font-semibold text-sm text-white whitespace-nowrap">Pipeline ({campaign.candidates.length})</h3>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vista de Lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vista Kanban"
              >
                <Columns className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Export Date Range & Button */}
            <div className={`flex items-center gap-2 transition-all overflow-hidden ${showExportOptions ? 'w-full opacity-100' : 'w-auto'}`}>
              {showExportOptions ? (
                <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1 animate-in slide-in-from-right-4 fade-in duration-200">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-transparent text-xs text-white border-0 p-1 focus:ring-0 w-24"
                  />
                  <span className="text-slate-500 text-xs">-</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-transparent text-xs text-white border-0 p-1 focus:ring-0 w-24"
                  />
                  <button
                    onClick={handleExport}
                    className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"
                    title="Descargar CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setShowExportOptions(false)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowExportOptions(true)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Exportar</span>
                </button>
              )}

              {/* Clear all candidates button */}
              {campaign.candidates.length > 0 && (
                <button
                  onClick={handleClearAllCandidates}
                  className="px-2.5 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                  title={`Borrar los ${campaign.candidates.length} candidatos`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Limpiar ({campaign.candidates.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {viewMode === 'kanban' ? (
          <div className="flex-1 overflow-hidden bg-slate-900/40 relative">
            <KanbanBoard campaign={campaign} onUpdateCandidate={handleUpdateCandidate} />
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            {campaign.candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Search className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">No se encontraron candidatos.</p>
                <button onClick={handleRunSearch} className="text-emerald-400 hover:text-emerald-300 text-xs mt-2">Ejecutar búsqueda para comenzar</button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th
                      className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                      onClick={() => toggleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Candidato
                        {sortConfig.field === 'name' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-emerald-400" /> : <ChevronUp className="h-3 w-3 text-emerald-400" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                      onClick={() => toggleSort('hourlyRate')}
                    >
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Tarifa
                        {sortConfig.field === 'hourlyRate' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-emerald-400" /> : <ChevronUp className="h-3 w-3 text-emerald-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 lg:px-4 py-2">Estado</th>
                    <th className="px-3 lg:px-4 py-2">Email</th>
                    <th
                      className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                      onClick={() => toggleSort('jobSuccessRate')}
                    >
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3" /> Success
                        {sortConfig.field === 'jobSuccessRate' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-emerald-400" /> : <ChevronUp className="h-3 w-3 text-emerald-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 lg:px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCandidates.map((group) => (
                    <React.Fragment key={group.label}>
                      {/* Date Divider Row */}
                      <tr>
                        <td colSpan={6} className="px-0 py-0">
                          <div className="flex items-center gap-3 px-3 lg:px-4 py-1.5 bg-emerald-950/20 border-y border-emerald-500/15 backdrop-blur-sm">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-emerald-400/70" />
                              <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 via-emerald-400/20 to-transparent"></div>
                            <span className="text-[10px] font-medium text-emerald-300/70 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              {group.count} {group.count === 1 ? 'lead' : 'leads'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Candidate Rows */}
                      {group.candidates.map((candidate) => (
                        <tr key={candidate.candidateId} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                          <td className="px-3 lg:px-4 py-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=0F172A&color=94A3B8`}
                                alt={candidate.name}
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-800"
                              />
                              <div className="min-w-0">
                                <p className="font-medium text-white text-xs lg:text-sm truncate">{candidate.name}</p>
                                <p className="text-xs text-slate-500 hidden sm:block">{candidate.platform}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 lg:px-4 py-2">
                            <p className="text-xs lg:text-sm text-emerald-300 font-medium">${candidate.hourlyRate.toFixed(0)}/h</p>
                          </td>
                          <td className="px-3 lg:px-4 py-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${laneStyles[candidate.kanbanLane] || laneStyles['todo']}`}>
                              {laneLabels[candidate.kanbanLane] || candidate.kanbanLane}
                            </span>
                          </td>
                          <td className="px-3 lg:px-4 py-2">
                            <p className="text-xs text-slate-400 truncate max-w-[150px]">{candidate.email || 'N/A'}</p>
                          </td>
                          <td className="px-3 lg:px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${candidate.jobSuccessRate > 90 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : candidate.jobSuccessRate > 80 ? 'bg-emerald-500' : 'bg-slate-500'}`}
                                  style={{ width: `${candidate.jobSuccessRate}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-bold ${candidate.jobSuccessRate > 90 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {candidate.jobSuccessRate.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 lg:px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setSelectedCandidate(candidate)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-700 px-1.5 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                              >
                                <User className="h-3 w-3" /> <span className="hidden sm:inline">Ver</span>
                              </button>
                              {candidate.linkedInUrl && (
                                <a
                                  href={candidate.linkedInUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 px-1.5 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ═══ Candidate Detail Modal ═════════════════════════════════════ */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-3 py-2.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                Perfil del Freelancer
              </h3>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedCandidate.name)}&background=0F172A&color=94A3B8`}
                  alt={selectedCandidate.name}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-500/50"
                />
                <div>
                  <h4 className="text-base font-bold text-white">{selectedCandidate.name}</h4>
                  <p className="text-slate-400 text-xs">{selectedCandidate.platform} • ${selectedCandidate.hourlyRate.toFixed(0)}/h</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Success: {selectedCandidate.jobSuccessRate.toFixed(0)}%</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${laneStyles[selectedCandidate.kanbanLane] || laneStyles['todo']}`}>
                      {laneLabels[selectedCandidate.kanbanLane] || selectedCandidate.kanbanLane}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Details */}
                <div className="bg-slate-800/30 p-4 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
                    <Globe className="h-4 w-4" />
                    INFORMACIÓN
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <p><span className="text-slate-500">Plataforma:</span> {selectedCandidate.platform}</p>
                    <p><span className="text-slate-500">Tarifa:</span> ${selectedCandidate.hourlyRate.toFixed(0)}/hora</p>
                    <p><span className="text-slate-500">Job Success:</span> {selectedCandidate.jobSuccessRate.toFixed(0)}%</p>
                    <p><span className="text-slate-500">Email:</span> {selectedCandidate.email || 'No disponible'}</p>
                    <p><span className="text-slate-500">Añadido:</span> {new Date(selectedCandidate.addedAt).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>

                {/* Contact & Actions */}
                <div className="bg-slate-800/30 p-4 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2 text-blue-400 font-semibold text-sm">
                    <MessageSquare className="h-4 w-4" />
                    CONTACTO
                  </div>
                  <div className="space-y-3">
                    {selectedCandidate.email && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Email</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-300 truncate">{selectedCandidate.email}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedCandidate.email);
                              setToast({ show: true, message: '✅ Email copiado!' });
                            }}
                            className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs hover:bg-blue-600/30"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedCandidate.linkedInUrl && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">LinkedIn</p>
                        <a
                          href={selectedCandidate.linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir perfil
                        </a>
                      </div>
                    )}

                    {/* Lane Selector */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Cambiar estado</p>
                      <select
                        value={selectedCandidate.kanbanLane}
                        onChange={(e) => {
                          handleUpdateCandidate(selectedCandidate, e.target.value);
                          setSelectedCandidate({ ...selectedCandidate, kanbanLane: e.target.value as any });
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm"
                      >
                        {Object.entries(laneLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {selectedCandidate.notes && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Notas</p>
                        <p className="text-sm text-slate-300">{selectedCandidate.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />

      {/* Add Manual Candidate Modal */}
      <ManualEnrichmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={handleAddCandidate}
      />
    </div>
  );
};

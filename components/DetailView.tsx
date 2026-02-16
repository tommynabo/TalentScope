import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Candidate, Campaign, CandidateStatus } from '../types/database';
import { ChevronLeft, Linkedin, Send, MessageSquare, Calendar, BrainCircuit, Search, Play, Loader2, ExternalLink, Terminal, ChevronDown, ChevronUp, X, Target, TrendingUp, AlertTriangle, Columns, List, Download } from 'lucide-react';
import { searchEngine } from '../lib/SearchEngine';
import { CampaignService, CandidateService } from '../lib/services';
import { normalizeLinkedInUrl } from '../lib/normalization';
import { AnalyticsService } from '../lib/analytics';
import ScoreBreakdownCard from './ScoreBreakdownCard';
import Scheduler from './Scheduler';
import Toast from './Toast';
import KanbanBoard from './KanbanBoard';
import { saveSearchSnapshot, loadSearchSnapshot, clearSearchSnapshot } from '../lib/useSessionState';
import { TabGuard } from '../lib/TabGuard';
import { Square } from 'lucide-react';

type SortField = 'added_at' | 'symmetry_score' | 'full_name';
type SortDirection = 'asc' | 'desc';
type CandidateWithMeta = Candidate & { status_in_campaign?: string; added_at?: string };

interface DetailViewProps {
  campaign: Campaign;
  onBack: () => void;
}

const DetailView: React.FC<DetailViewProps> = ({ campaign: initialCampaign, onBack }) => {
  // ─── Restore snapshot if available (survives page reloads) ─────────
  const snapshot = loadSearchSnapshot(initialCampaign.id);

  const [campaign, setCampaign] = useState(initialCampaign);
  const [candidates, setCandidates] = useState<CandidateWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [leadCount, setLeadCount] = useState(snapshot?.leadCount ?? 10);
  const [logs, setLogs] = useState<string[]>(snapshot?.logs ?? []);
  const [showLogs, setShowLogs] = useState(snapshot?.logs ? snapshot.logs.length > 0 : false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ field: 'added_at', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Show recovery toast if we restored from a snapshot
  useEffect(() => {
    if (snapshot && snapshot.logs.length > 0) {
      setToast({ show: true, message: '🔄 Estado de búsqueda anterior restaurado.' });
      // Clear the snapshot after restoring
      clearSearchSnapshot(initialCampaign.id);
    }
  }, []); // Only on mount

  // ─── Persist search state to sessionStorage periodically ──────────
  useEffect(() => {
    // Save snapshot every time logs or candidates change during search
    if (logs.length > 0 || candidates.length > 0) {
      saveSearchSnapshot(initialCampaign.id, {
        candidates: [], // Don't duplicate candidate data, they're in DB
        logs,
        searching,
        leadCount
      });
    }
  }, [logs, searching, leadCount, initialCampaign.id]);

  // Mark search as active/inactive for TabGuard beforeunload protection
  useEffect(() => {
    TabGuard.setSearchActive(searching);
    return () => TabGuard.setSearchActive(false);
  }, [searching]);

  // Prevent tab from being discarded/frozen while search is running
  useEffect(() => {
    if (!searching) return;

    // Web Lock API: prevents browser from discarding the tab in background
    let lockResolver: (() => void) | null = null;
    if ('locks' in navigator) {
      (navigator as any).locks.request('talentscope-search-lock', () => {
        return new Promise<void>((resolve) => {
          lockResolver = resolve;
        });
      });
    }

    // Keep-alive ping: prevents browser from throttling/suspending the tab
    const keepAlive = setInterval(() => {
      // Minimal work to keep JS event loop active
      void document.hidden;
    }, 5000);

    return () => {
      if (lockResolver) lockResolver();
      clearInterval(keepAlive);
    };
  }, [searching]);

  // Update local campaign state when prop changes
  useEffect(() => {
    setCampaign(initialCampaign);
  }, [initialCampaign]);

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

  const reloadCampaign = async () => {
    try {
      console.log('[reloadCampaign] Fetching updated campaign data...');
      const updated = await CampaignService.getById(campaign.id);
      console.log('[reloadCampaign] Received updated campaign:', updated.settings?.stats);
      setCampaign(updated);
      console.log('[reloadCampaign] Campaign state updated');
    } catch (e) {
      console.error("[reloadCampaign] Error:", e);
    }
  };

  // Toggle sort - atomic update so repeated clicks always work
  const toggleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { field, direction: 'desc' };
    });
  };

  // Format a date string into a human-readable label
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

  // Sort candidates
  const sortedCandidates = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => {
      let cmp = 0;
      if (sortConfig.field === 'added_at') {
        const dateA = new Date(a.added_at || a.created_at).getTime();
        const dateB = new Date(b.added_at || b.created_at).getTime();
        cmp = dateA - dateB;
      } else if (sortConfig.field === 'symmetry_score') {
        cmp = (a.symmetry_score || 0) - (b.symmetry_score || 0);
      } else if (sortConfig.field === 'full_name') {
        cmp = a.full_name.localeCompare(b.full_name);
      }
      return sortConfig.direction === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [candidates, sortConfig]);

  // Group sorted candidates by date for divider rows
  const groupedCandidates = useMemo(() => {
    const groups: { label: string; count: number; candidates: CandidateWithMeta[] }[] = [];
    let currentKey = '';

    for (const c of sortedCandidates) {
      const dateStr = c.added_at || c.created_at;
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

  const handleRunSearch = async () => {
    setSearching(true);
    setLogs([]);
    setShowLogs(true);

    try {
      // Determine source based on platform. 
      // 'LinkedIn' -> Standard LinkedIn Search
      // 'GitHub' -> GitHub Cross-Ref Strategy
      // 'Communities' -> Community Scouting Strategy
      const source = campaign.platform === 'Communities' || campaign.platform === 'Freelance' ? 'communities' :
        campaign.platform === 'GitHub' ? 'github' : 'linkedin';

      const searchOptions = {
        language: campaign.settings?.language || 'Spanish',
        maxAge: campaign.settings?.max_age || 30,
        platform: campaign.platform,
        filters: campaign.settings?.search_filters,
        scoreThreshold: campaign.settings?.score_threshold
      };

      await searchEngine.startSearch(
        campaign.target_role || 'Developer',
        source as any,
        leadCount,
        searchOptions,
        (msg) => setLogs(prev => [...prev, msg]),
        async (newCandidates) => {
          try {
            console.log(`[DetailView] Processing ${newCandidates.length} new candidates...`);
            
            // 1. Save candidates to database
            const savePromises = newCandidates.map(async (c) => {
              try {
                const savedCandidate = await CandidateService.create(c);
                await CampaignService.addCandidateToCampaign(campaign.id, savedCandidate.id);
              } catch (err) {
                console.error("Failed to save candidate", c.email, err);
              }
            });

            await Promise.all(savePromises);
            console.log(`[DetailView] Saved ${newCandidates.length} candidates to database`);

            // 2. Update global analytics BEFORE other operations
            try {
              console.log('[DetailView] Updating global analytics...');
              await AnalyticsService.trackLeadsGenerated(newCandidates.length);
              console.log('[DetailView] Global analytics updated successfully');
            } catch (err) {
              console.error('[DetailView] Failed to update global analytics', err);
              setLogs(prev => [...prev, `❌ Error updating dashboard stats: ${(err as any).message}`]);
            }

            // 3. Update campaign stats
            try {
              console.log('[DetailView] Updating campaign stats...');
              await CampaignService.updateStats(campaign.id);
              console.log('[DetailView] Stats updated, reloading campaign...');
              await reloadCampaign(); // Reload campaign to get updated stats
              console.log('[DetailView] Campaign reloaded with new stats:', campaign.settings?.stats);
            } catch (err) {
              console.error("[DetailView] Failed to update campaign stats", err);
            }

            // 4. Reload candidates list
            try {
              await loadCandidates();
            } catch (err) {
              console.error("[DetailView] Failed to load candidates", err);
            }

            setSearching(false);
            setToast({ show: true, message: `¡${newCandidates.length} nuevos candidatos encontrados!` });
          } catch (error) {
            console.error('[DetailView] Unexpected error in search callback', error);
            setSearching(false);
            setToast({ show: true, message: '❌ Error procesando candidatos' });
          }
        }
      );
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ Error crítico: ${e.message}`]);
      setToast({ show: true, message: 'Error en la búsqueda: ' + e.message });
      setSearching(false);
    }
  };

  const handleStopSearch = () => {
    searchEngine.stop();
    setSearching(false);
    setLogs(prev => [...prev, '⏹️ Búsqueda detenida por el usuario.']);
    setToast({ show: true, message: 'Búsqueda detenida.' });
    TabGuard.setSearchActive(false);
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

  const handleStatusChange = async (candidateId: string, newStatus: CandidateStatus) => {
    // Optimistic update
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, status_in_campaign: newStatus } : c
    ));
    
    try {
      await CampaignService.updateCandidateStatus(campaign.id, candidateId, newStatus);
      setToast({ show: true, message: `✅ Estado actualizado` });
    } catch (error) {
      console.error("Failed to update status", error);
      setToast({ show: true, message: `❌ Error al actualizar estado` });
      loadCandidates(); // Revert on error
    }
  };

  const handleExport = () => {
    const { start, end } = dateRange;
    if (!start || !end) return;

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const filtered = candidates.filter(c => {
      const dateStr = c.added_at || c.created_at;
      if (!dateStr) return false;
      const cDate = new Date(dateStr);
      return cDate >= startDate && cDate <= endDate;
    });

    if (filtered.length === 0) {
      setToast({ show: true, message: '⚠️ No hay candidatos para exportar en este rango' });
      return;
    }

    const headers = ['FIRST_NAME', 'LAST_NAME', 'ROL', 'EMPRESA', 'EMAIL', 'LINKEDIN', 'SCORE', 'ICEBREAKER', 'FOLLOWUP', 'MENSAJE', 'ANALISIS', 'STATUS', 'FECHA'];
    
    const csvContent = [
      headers.join(','),
      ...filtered.map(c => {
        const analysis = parseAnalysis(c.ai_analysis);
        const icebreaker = analysis?.icebreaker || '';
        const followup = analysis?.followup_message || '';
        const message = analysis?.outreach_message || '';
        const summary = analysis?.summary || '';
        
        const nameParts = (c.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return [
          `"${firstName}"`,
          `"${lastName}"`,
          `"${c.job_title || ''}"`,
          `"${c.current_company || ''}"`,
          `"${c.email || ''}"`,
          `"${normalizeLinkedInUrl(c.linkedin_url)}"`,
          `"${c.symmetry_score || 0}"`,
          `"${icebreaker.replace(/"/g, '""')}"`,
          `"${followup.replace(/"/g, '""')}"`,
          `"${message.replace(/"/g, '""')}"`,
          `"${summary.replace(/"/g, '""')}"`,
          `"${c.status_in_campaign || 'Pool'}"`,
          `"${c.added_at ? c.added_at.split('T')[0] : ''}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `talentscope_export_${campaign.id}_${start}_${end}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setToast({ 
        show: true, 
        message: `✅ CSV exportado con ${filtered.length} prospectos`
      });
      setShowExportOptions(false);
    }
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col relative">
      {/* Header & Nav */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-3 mb-3">
        <div className="flex items-center gap-1.5 lg:gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="p-1 lg:p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 hover:text-cyan-400 text-slate-400 transition-all flex-shrink-0"
          >
            <ChevronLeft className="h-4 lg:h-5 w-4 lg:w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center gap-1.5 lg:gap-2 truncate">
              <Linkedin className="h-4 lg:h-5 w-4 lg:w-5 text-blue-500 flex-shrink-0" />
              <span className="truncate">{campaign.title}</span>
            </h2>
            <p className="text-slate-400 text-xs line-clamp-1">Rol: <span className="text-cyan-400">{campaign.target_role}</span> • Estado: <span className="text-slate-300">{campaign.status}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 lg:gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 lg:px-2.5 py-1 lg:py-1.5">
            <span className="text-slate-400 text-xs hidden sm:inline">Cant:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={leadCount}
              onChange={(e) => setLeadCount(Number(e.target.value))}
              className="w-11 lg:w-14 bg-slate-800 border border-slate-700 rounded px-1 lg:px-1.5 py-0.5 text-white text-xs text-center focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={searching ? handleStopSearch : handleRunSearch}
            disabled={false}
            className={`px-2.5 lg:px-5 py-1 lg:py-2 ${searching ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'} text-white rounded-lg text-xs shadow-lg ${searching ? 'shadow-red-900/20' : 'shadow-cyan-900/20'} transition-all flex items-center gap-1 flex-shrink-0 whitespace-nowrap`}
          >
            {searching ? <Square className="h-3 lg:h-4 w-3 lg:w-4" /> : <Play className="h-3 lg:h-4 w-3 lg:w-4" />}
            <span className="hidden sm:inline text-xs">{searching ? 'Detener' : 'Buscar'}</span>
            <span className="sm:hidden">{searching ? '⏹' : '🔍'}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-4 mb-4 lg:mb-6">
        {/* Scheduler Card */}
        <div className="lg:col-span-1">
          <Scheduler
            onScheduleChange={handleScheduleChange}
            initialEnabled={false}
            initialLeads={10}
          />
        </div>

        {/* Stats Bar */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-3">
          <div className="bg-slate-900/50 border border-slate-800 p-2.5 lg:p-3 rounded-lg backdrop-blur-sm">
            <div className="flex justify-between items-start mb-1.5">
              <p className="text-slate-400 text-xs font-medium">Alcance Total</p>
              <Send className="h-3 lg:h-3.5 w-3 lg:w-3.5 text-slate-500" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-white">{campaign.settings?.stats?.sent || 0}</p>
            <div className="w-full bg-slate-800 h-0.5 rounded-full mt-1.5 lg:mt-2 overflow-hidden">
              <div className="bg-blue-500 h-full w-[70%]"></div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-2.5 lg:p-3 rounded-lg backdrop-blur-sm">
            <div className="flex justify-between items-start mb-1.5">
              <p className="text-slate-400 text-xs font-medium">Tasa de Respuesta</p>
              <MessageSquare className="h-3 lg:h-3.5 w-3 lg:w-3.5 text-slate-500" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-white">{campaign.settings?.stats?.responseRate || 0}%</p>
            <div className="w-full bg-slate-800 h-0.5 rounded-full mt-1.5 lg:mt-2 overflow-hidden">
              <div className="bg-cyan-500 h-full" style={{ width: `${campaign.settings?.stats?.responseRate || 0}%` }}></div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-cyan-500/20 p-2.5 lg:p-3 rounded-lg backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
            <div className="flex justify-between items-start mb-1.5">
              <p className="text-cyan-100 text-xs font-medium">Añadidos Hoy</p>
              <Calendar className="h-3 lg:h-3.5 w-3 lg:w-3.5 text-cyan-400" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-cyan-400">{campaign.settings?.stats?.addedToday || 0}</p>
            <div className="w-full bg-slate-800 h-0.5 rounded-full mt-1.5 lg:mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-white h-full w-[45%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden flex flex-col min-h-[400px]">
        {/* Header with View Toggle & Export */}
        <div className="px-3 py-2 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 transition-all">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <h3 className="font-semibold text-sm text-white whitespace-nowrap">Pipeline ({candidates.length})</h3>
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-700 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vista de Lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-slate-700 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
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
                    className="p-1 hover:bg-cyan-500/20 rounded text-cyan-400"
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
                  className="px-2.5 py-1.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Exportar</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {viewMode === 'kanban' ? (
             <div className="flex-1 overflow-hidden bg-slate-900/40 relative">
               <KanbanBoard candidates={candidates} onStatusChange={handleStatusChange} />
             </div>
        ) : (
        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Search className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">No se encontraron candidatos.</p>
              <button onClick={handleRunSearch} className="text-cyan-400 hover:text-cyan-300 text-xs mt-2">Ejecutar búsqueda para comenzar</button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <th
                    className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => toggleSort('full_name')}
                  >
                    <div className="flex items-center gap-1">
                      Candidato
                      {sortConfig.field === 'full_name' && (
                        sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-cyan-400" /> : <ChevronUp className="h-3 w-3 text-cyan-400" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 lg:px-4 py-2">Rol Actual</th>
                  <th className="px-3 lg:px-4 py-2">Estado</th>
                  <th className="px-3 lg:px-4 py-2">Mensaje</th>
                  <th
                    className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                    onClick={() => toggleSort('symmetry_score')}
                  >
                    <div className="flex items-center gap-1">
                      <BrainCircuit className="h-3 w-3" /> Score
                      {sortConfig.field === 'symmetry_score' && (
                        sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-cyan-400" /> : <ChevronUp className="h-3 w-3 text-cyan-400" />
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
                        <div className="flex items-center gap-3 px-3 lg:px-4 py-1.5 bg-blue-950/20 border-y border-blue-500/15 backdrop-blur-sm">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-blue-400/70" />
                            <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 via-blue-400/20 to-transparent"></div>
                          <span className="text-[10px] font-medium text-blue-300/70 bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-500/20">
                            {group.count} {group.count === 1 ? 'lead' : 'leads'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Candidate Rows for this group */}
                    {group.candidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                        <td className="px-3 lg:px-4 py-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.full_name)}&background=0F172A&color=94A3B8`}
                              alt={candidate.full_name}
                              className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-800"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-white text-xs lg:text-sm truncate">{candidate.full_name}</p>
                              <p className="text-xs text-slate-500 hidden sm:block">{candidate.location}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 lg:px-4 py-2">
                          <p className="text-xs lg:text-sm text-slate-300">{candidate.job_title}</p>
                          <p className="text-xs text-slate-500 hidden md:block">@ {candidate.current_company}</p>
                        </td>
                        <td className="px-3 lg:px-4 py-2">
                          <StatusBadge status={candidate.status_in_campaign || 'Pool'} />
                        </td>
                        <td className="px-3 lg:px-4 py-2">
                          {(() => {
                            const analysis = parseAnalysis(candidate.ai_analysis);
                            const message = analysis?.outreach_message || '';
                            return message ? (
                              <div className="max-w-xs">
                                <p className="text-xs text-slate-300 line-clamp-2" title={message}>
                                  {message}
                                </p>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(message);
                                    setToast({ show: true, message: '✅ Mensaje copiado!' });
                                  }}
                                  className="text-xs text-cyan-400 hover:text-cyan-300 mt-0.5"
                                >
                                  Copiar
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">No disponible</span>
                            );
                          })()}
                        </td>
                        <td className="px-3 lg:px-4 py-2">
                          {candidate.symmetry_score !== undefined && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
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
                        <td className="px-3 lg:px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedCandidate(candidate)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-700 px-1.5 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                            >
                              <BrainCircuit className="h-3 w-3" /> <span className="hidden sm:inline">Ver</span>
                            </button>
                            <a
                              href={candidate.linkedin_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 px-1.5 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
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

      {/* Analysis Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-3 py-2.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-500" />
                Análisis Deep Research
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
                  src={selectedCandidate.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedCandidate.full_name)}&background=0F172A&color=94A3B8`}
                  alt={selectedCandidate.full_name}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-cyan-500/50"
                />
                <div>
                  <h4 className="text-base font-bold text-white">{selectedCandidate.full_name}</h4>
                  <p className="text-slate-400 text-xs">{selectedCandidate.job_title} @ {selectedCandidate.current_company}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Score: {selectedCandidate.symmetry_score}%</span>
                  </div>
                </div>
              </div>

              {/* NEW: Score Breakdown Card */}
              {selectedCandidate.score_breakdown && (
                <div className="mb-4">
                  <ScoreBreakdownCard
                    score={selectedCandidate.symmetry_score || 0}
                    breakdown={selectedCandidate.score_breakdown}
                    candidateName={selectedCandidate.full_name}
                  />
                </div>
              )}

              {(() => {
                const analysis = parseAnalysis(selectedCandidate.ai_analysis);
                if (!analysis) return <p className="text-slate-500 italic">No hay análisis detallado disponible.</p>;

                // If it's old string format
                if (typeof analysis === 'string' || (!analysis.psychological_profile && analysis.summary)) {
                  return (
                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                      <p className="text-slate-300 text-xs leading-relaxed">{analysis.summary || analysis}</p>
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

                    <div className="col-span-1 md:col-span-2 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ICEBREAKER Column */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-2 text-blue-400 font-semibold text-sm">
                          <Send className="h-4 w-4" />
                          ICEBREAKER (LinkedIn)
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed italic mb-3">
                          "{analysis.icebreaker || `Hola ${selectedCandidate.full_name}, me encantaría conectar contigo.`}"
                        </p>
                        <button
                          onClick={() => {
                            const msg = analysis.icebreaker || `Hola ${selectedCandidate.full_name}, me encantaría conectar contigo.`;
                            navigator.clipboard.writeText(msg);
                            setToast({ show: true, message: '✅ ICEBREAKER copiado!' });
                          }}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all"
                        >
                          📋 Copiar
                        </button>
                      </div>

                      {/* FOLLOWUP Column */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
                          <MessageSquare className="h-4 w-4" />
                          FOLLOWUP (Completo)
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed italic mb-3">
                          "{analysis.followup_message || `${selectedCandidate.full_name}, tras revisar tu perfil sabemos que eres el candidato ideal.`}"
                        </p>
                        <button
                          onClick={() => {
                            const msg = analysis.followup_message || `${selectedCandidate.full_name}, tras revisar tu perfil sabemos que eres el candidato ideal.`;
                            navigator.clipboard.writeText(msg);
                            setToast({ show: true, message: '✅ FOLLOWUP copiado!' });
                          }}
                          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all"
                        >
                          📋 Copiar
                        </button>
                      </div>
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
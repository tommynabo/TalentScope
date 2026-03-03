import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft, Target, Send, MessageSquare, Calendar,
  Search, Play, Loader2, ExternalLink, Terminal,
  ChevronDown, ChevronUp, X, Columns, List, Download, Trash2,
  DollarSign, Award, Globe, User, Brain, Briefcase, AlertCircle, Wrench
} from 'lucide-react';
import { Campaign, EnrichedCandidateInCampaign } from '../types/campaigns';
import { KanbanBoard } from './KanbanBoard';
import { ManualEnrichmentModal } from './ManualEnrichmentModal';
import { MarketplaceRaidService } from '../services/marketplaceRaidService';
import { dedupService } from '../services/marketplaceDeduplicationService';
import { ScrapingFilter, FreelancePlatform } from '../types/marketplace';

import Toast from '../../components/Toast';
import UserSelectionModal from '../../components/UserSelectionModal';
import { MarketplaceCandidatePersistence } from '../services/marketplaceCandidatePersistence';
import { supabase } from '../../lib/supabase';
import { OutreachUser, generateOutreachMessages, extractSpecialty } from '../../lib/messageGenerator';

// ─── Sort types ─────────────────────────────────────────────────────────
type SortField = 'addedAt' | 'jobSuccessRate' | 'name' | 'hourlyRate' | 'talentScore';
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
  // Helper function to normalize URLs
  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      let normalized = parsed.hostname || '';
      if (normalized.startsWith('www.')) {
        normalized = normalized.slice(4);
      }
      normalized += parsed.pathname;
      return normalized.toLowerCase().replace(/\/$/, '');
    } catch {
      return url.toLowerCase().trim();
    }
  };

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ field: 'talentScore', direction: 'desc' });
  const [selectedCandidate, setSelectedCandidate] = useState<EnrichedCandidateInCampaign | null>(null);
  const [isEditingMessages, setIsEditingMessages] = useState(false);
  const [editedIcebreaker, setEditedIcebreaker] = useState('');
  const [editedFollowup, setEditedFollowup] = useState('');

  useEffect(() => {
    if (selectedCandidate) {
      setIsEditingMessages(false);
      setEditedIcebreaker(selectedCandidate.walead_messages?.icebreaker || `Hola ${selectedCandidate.name}, vi tu trabajo, ¡me encantaría conectar y compartir ideas sobre innovación!`);
      setEditedFollowup(selectedCandidate.walead_messages?.followup_message || `Hola ${selectedCandidate.name}, gracias por aceptar mi conexión. He estado siguiendo tu trabajo y creo que hay oportunidades interesantes para colaborar.`);
    }
  }, [selectedCandidate?.candidateId]);

  const handleSaveMessages = () => {
    if (!selectedCandidate) return;

    const updatedCandidate = {
      ...selectedCandidate,
      walead_messages: {
        icebreaker: editedIcebreaker,
        followup_message: editedFollowup
      }
    };

    const updated = campaign.candidates.map(c =>
      c.candidateId === updatedCandidate.candidateId ? updatedCandidate : c
    );

    onUpdateCampaign({ ...campaign, candidates: updated });
    setSelectedCandidate(updatedCandidate);
    setIsEditingMessages(false);
    setToast({ show: true, message: '✅ Mensajes guardados' });
  };
  const [toast, setToast] = useState({ show: false, message: '' });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OutreachUser>('mauro');
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
      } else if (sortConfig.field === 'talentScore') {
        cmp = (a.talentScore || 0) - (b.talentScore || 0);
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
    const groupsMap = new Map<string, { label: string; dateVal: number; count: number; candidates: EnrichedCandidateInCampaign[] }>();

    for (const c of sortedCandidates) {
      const dateStr = c.addedAt;
      const date = new Date(dateStr);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!groupsMap.has(dayKey)) {
        const dateVal = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        groupsMap.set(dayKey, {
          label: formatDateLabel(dateStr),
          dateVal,
          count: 0,
          candidates: []
        });
      }

      const group = groupsMap.get(dayKey)!;
      group.candidates.push(c);
      group.count++;
    }

    return Array.from(groupsMap.values()).sort((a, b) => b.dateVal - a.dateVal);
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
    // Crear línea separadora en lugar de limpiar todo
    setLogs(prev => {
      const newLogs = [...prev];
      if (newLogs.length > 0) {
        newLogs.push(`\n${'═'.repeat(60)}\n🔄 NUEVA BÚSQUEDA INICIADA\n${'═'.repeat(60)}\n`);
      }
      return newLogs;
    });
    setShowLogs(true);

    try {
      setLogs(prev => [...prev, `🔍 Iniciando búsqueda de ${leadCount} leads en ${campaign.platform}...`]);
      setLogs(prev => [...prev, `📋 Keywords: ${campaign.searchTerms.keyword}`]);
      setLogs(prev => [...prev, `💰 Tarifa: $${campaign.searchTerms.minHourlyRate}-$${campaign.searchTerms.maxHourlyRate || '∞'}/h`]);
      setLogs(prev => [...prev, `✅ Job Success Rate mínimo: ${campaign.searchTerms.minJobSuccessRate}%`]);
      setLogs(prev => [...prev, `⏳ Conectando con APIs de scraping...`]);

      // Get API keys from environment
      // Usa VITE_APIFY_MARKETPLACE_API_KEY si existe, si no usa VITE_APIFY_API_KEY
      const apifyMarketplaceKey = import.meta.env.VITE_APIFY_MARKETPLACE_API_KEY || import.meta.env.VITE_APIFY_API_KEY;
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Log which mode we're in
      if (!apifyMarketplaceKey || apifyMarketplaceKey === 'mock') {
        setLogs(prev => [...prev, `⚠️ MODO SIMULACIÓN: No hay API key de Apify configurada`]);
      } else if (apifyMarketplaceKey) {
        setLogs(prev => [...prev, `✅ SCRAPING REAL: Apify API Marketplace configurada (${apifyMarketplaceKey.substring(0, 15)}...)`]);
      }

      if (!openaiKey || openaiKey === 'mock') {
        setLogs(prev => [...prev, `⚠️ ENRIQUECIMIENTO MOCK: No hay API key de OpenAI configurada`]);
      } else if (openaiKey) {
        setLogs(prev => [...prev, `✅ ENRIQUECIMIENTO REAL: OpenAI API configurada (sk-proj-...)`]);
      }

      // Initialize service with MARKETPLACE API KEY
      const raidService = MarketplaceRaidService.getInstance(apifyMarketplaceKey, openaiKey, supabaseUrl, supabaseKey);

      setLogs(prev => [...prev, `✅ Servicio marketplace inicializado`]);

      // ⭐ CRITICAL: Initialize deduplication service with existing candidates from campaign
      if (campaign.candidates.length > 0) {
        // Convert campaign candidates back to ScrapedCandidate format for dedup registration
        const existingScraped = campaign.candidates.map(c => ({
          id: c.candidateId,
          name: c.name,
          platform: c.platform,
          platformUsername: c.name.toLowerCase().replace(/\s+/g, '-'),
          profileUrl: c.linkedInUrl || `https://${c.platform.toLowerCase()}.com/${c.name}`,
          title: '',
          country: '',
          hourlyRate: c.hourlyRate,
          jobSuccessRate: c.jobSuccessRate,
          certifications: [],
          bio: '',
          scrapedAt: c.addedAt,
          talentScore: c.talentScore,
          skills: [],
          badges: [],
          yearsExperience: 0,
          email: c.email,
        }));
        dedupService.registerCandidates(existingScraped);
      }

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
      // Pass ALL existing identifiers: LinkedIn URLs, emails, AND names
      // so dedup can catch duplicates BEFORE expensive enrichment
      const allExistingUrls = [
        ...campaign.candidates.map(c => c.linkedInUrl).filter(Boolean) as string[],
        ...campaign.candidates.map(c => c.candidateId).filter(id => id.startsWith('http')),
      ];
      const filter: ScrapingFilter = {
        keyword: campaign.searchTerms.keyword,
        minHourlyRate: campaign.searchTerms.minHourlyRate,
        minJobSuccessRate: campaign.searchTerms.minJobSuccessRate,
        certifications: campaign.searchTerms.certifications || [],
        platforms: [campaign.platform as FreelancePlatform],
        languages: campaign.searchTerms.languages || ['es'], // Default: español (hispanohablantes)
        maxResults: leadCount,
        // Pass existing candidates so scraper skips them (ALL identifiers)
        existingProfileUrls: allExistingUrls,
        existingEmails: campaign.candidates.map(c => c.email).filter(Boolean) as string[],
        existingNames: campaign.candidates.map(c => c.name).filter(Boolean),
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
        talentScore: (enriched as any).talentScore || 0,
        addedAt: enriched.scrapedAt || new Date().toISOString(),
        kanbanLane: 'todo' as const,
        // Include deep AI analysis
        psychologicalProfile: (enriched as any).psychologicalProfile,
        businessMoment: (enriched as any).businessMoment,
        salesAngle: (enriched as any).salesAngle,
        bottleneck: (enriched as any).bottleneck,
        walead_messages: (enriched as any).walead_messages,
      }));

      // Safety check: Filter out any candidates that somehow slipped through
      // (The scraper should have already filtered these out)
      const dedupedNewCandidates = newCandidates.filter(candidate => {
        const alreadyExists = campaign.candidates.some(c => {
          // Normalize URLs for comparison
          if (c.linkedInUrl && candidate.linkedInUrl) {
            const normalizedC = normalizeUrl(c.linkedInUrl);
            const normalizedCandidate = normalizeUrl(candidate.linkedInUrl);
            if (normalizedC && normalizedCandidate && normalizedC === normalizedCandidate) {
              console.warn(`⏭️ Safety filter: Duplicate URL ${normalizedC}`);
              return true;
            }
          }
          // Compare emails
          if (c.email && candidate.email && c.email.toLowerCase() === candidate.email.toLowerCase()) {
            console.warn(`⏭️ Safety filter: Duplicate email ${c.email}`);
            return true;
          }
          // Compare names
          if (c.name.toLowerCase().trim() === candidate.name.toLowerCase().trim()) {
            console.warn(`⏭️ Safety filter: Duplicate name ${c.name}`);
            return true;
          }
          return false;
        });

        return !alreadyExists;
      });

      if (dedupedNewCandidates.length === 0) {
        setLogs(prev => [...prev, `⚠️ No new candidates found - all results already exist in campaign`]);
        setSearching(false);
        return;
      }

      // Add to campaign
      const updatedCandidates = [...campaign.candidates, ...dedupedNewCandidates];
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

      setLogs(prev => [...prev, `✅ ${dedupedNewCandidates.length} candidatos REALES añadidos al pipeline exitosamente`]);

      // 💾 Persist to Supabase for Buzones > Candidatos
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;
        if (currentUserId) {
          setLogs(prev => [...prev, `💾 Guardando candidatos en Supabase...`]);
          const saved = await MarketplaceCandidatePersistence.saveCandidates(
            campaign.id,
            campaign.name,
            campaign.platform,
            dedupedNewCandidates,
            currentUserId
          );
          if (saved) {
            setLogs(prev => [...prev, `✅ Candidatos guardados en Supabase → aparecerán en Buzones > Candidatos`]);
          } else {
            setLogs(prev => [...prev, `⚠️ No se pudieron guardar en Supabase (solo en localStorage)`]);
          }
        } else {
          setLogs(prev => [...prev, `⚠️ Sin sesión de usuario → candidatos solo en localStorage`]);
        }
      } catch (persistError) {
        console.warn('[MarketplacePersistence] Error:', persistError);
        setLogs(prev => [...prev, `⚠️ Error al guardar en Supabase (candidatos disponibles en localStorage)`]);
      }

      setLogs(prev => [...prev, `🚀 Búsqueda completada con éxito`]);
      setToast({ show: true, message: `✅ ${dedupedNewCandidates.length} nuevos candidatos enriquecidos añadidos` });
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

    // Show user selection modal
    setShowUserSelection(true);
  };

  const handleExportWithUser = (userOverride: OutreachUser) => {
    const activeUser = userOverride;
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

    // Helper: escape CSV value
    const esc = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;  

    // Split by contact type (LinkedIn vs Email)
    const linkedinCandidates = filtered.filter(c => c.linkedInUrl && c.linkedInUrl.trim().length > 0);
    const emailOnlyCandidates = filtered.filter(c =>
      c.email && c.email.trim().length > 0 &&
      (!c.linkedInUrl || c.linkedInUrl.trim().length === 0)
    );

    const headers = ['FIRST_NAME', 'LAST_NAME', 'ROL', 'PLATAFORMA', 'EMAIL', 'LINKEDIN', 'TARIFA_HORA', 'SUCCESS_RATE', 'TALENT_SCORE', 'INVITACION_INICIAL', 'POST_ACEPTACION', 'ANALISIS', 'STATUS', 'FECHA'];

    const laneLabels: Record<string, string> = {
      todo: 'Por Contactar', contacted: 'Contactado', replied: 'Respondió', rejected: 'Rechazó', hired: 'Contratado'
    };

    const buildCSV = (items: EnrichedCandidateInCampaign[]) => {
      const rows = items.map(c => {
        const nameParts = (c.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const specialty = extractSpecialty(c.platform);
        const personalized = generateOutreachMessages(
          c.name || '',
          specialty,
          activeUser,
          {
            icebreaker: c.walead_messages?.icebreaker,
            followup_message: c.walead_messages?.followup_message
          }
        );

        const analysis = [c.businessMoment, c.salesAngle, c.bottleneck].filter(Boolean).join(' | ') || '';

        return [
          esc(firstName), esc(lastName), esc(c.platform), esc(c.platform),
          esc(c.email || ''), esc(c.linkedInUrl || ''),
          `"$${c.hourlyRate.toFixed(0)}"`, `"${c.jobSuccessRate.toFixed(0)}%"`,
          `"${c.talentScore || 0}"`,
          esc(personalized.icebreaker), esc(personalized.followup_message),
          esc(analysis),
          esc(laneLabels[c.kanbanLane] || c.kanbanLane),
          esc(c.addedAt ? c.addedAt.split('T')[0] : '')
        ].join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    };

    const dateTag = `${start}_${end}`;

    // Download LinkedIn CSV
    if (linkedinCandidates.length > 0) {
      const csvContent = buildCSV(linkedinCandidates);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `LINKEDIN_marketplace_${campaign.id}_${dateTag}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Download Email CSV
    if (emailOnlyCandidates.length > 0) {
      setTimeout(() => {
        const csvContent = buildCSV(emailOnlyCandidates);
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `EMAIL_marketplace_${campaign.id}_${dateTag}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 500);
    }

    // Toast with breakdown
    const parts: string[] = [];
    if (linkedinCandidates.length > 0) parts.push(`${linkedinCandidates.length} LinkedIn`);
    if (emailOnlyCandidates.length > 0) parts.push(`${emailOnlyCandidates.length} Email`);
    const noContact = filtered.length - linkedinCandidates.length - emailOnlyCandidates.length;
    if (noContact > 0) parts.push(`${noContact} sin contacto`);

    setToast({ show: true, message: `✅ Exportados ${filtered.length} candidatos → ${parts.join(' + ')} (mensajes de ${activeUser === 'mauro' ? 'Mauro' : 'Nyo'})` });
    setShowExportOptions(false);
    setShowUserSelection(false);
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
                    <th className="px-3 lg:px-4 py-2">Contacto</th>
                    <th
                      className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                      onClick={() => toggleSort('talentScore')}
                    >
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" /> Score
                        {sortConfig.field === 'talentScore' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-emerald-400" /> : <ChevronUp className="h-3 w-3 text-emerald-400" />
                        )}
                      </div>
                    </th>
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
                        <td colSpan={7} className="px-0 py-0">
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
                            <div className="flex flex-col gap-1">
                              {candidate.email ? <span className="text-xs text-slate-400 truncate max-w-[150px]" title={candidate.email}>{candidate.email}</span> : <span className="text-xs text-slate-600 truncate max-w-[150px]">Sin email</span>}
                              {candidate.linkedInUrl && (
                                <a href={candidate.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] flex items-center gap-1">
                                  Ver LinkedIn
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-3 lg:px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${(candidate.talentScore || 0) >= 70 ? 'bg-gradient-to-r from-emerald-400 to-teal-300' : (candidate.talentScore || 0) >= 50 ? 'bg-emerald-500' : (candidate.talentScore || 0) >= 30 ? 'bg-yellow-500' : 'bg-slate-500'}`}
                                  style={{ width: `${Math.min(candidate.talentScore || 0, 100)}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-bold ${(candidate.talentScore || 0) >= 70 ? 'text-emerald-400' : (candidate.talentScore || 0) >= 50 ? 'text-teal-400' : 'text-slate-400'}`}>
                                {(candidate.talentScore || 0).toFixed(0)}
                              </span>
                            </div>
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

      {/* ═══ Candidate Detail Modal (Deep Research Redesign) ════════════════════ */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 relative">
              <div className="flex items-center gap-2 text-blue-400">
                <span className="text-xl">✨</span>
                <h3 className="text-md font-semibold tracking-wide">Análisis Deep Research</h3>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {/* Candidate Info Header */}
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg">
                  {selectedCandidate.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedCandidate.name}</h2>
                  </div>
                  <p className="text-sm text-slate-400">{selectedCandidate.title || 'Freelancer'} • {selectedCandidate.platform}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="bg-slate-800/80 text-emerald-400 text-xs px-2 py-0.5 rounded-md border border-slate-700/50">
                      Success: {selectedCandidate.jobSuccessRate.toFixed(0)}%
                    </span>
                    <span className="bg-slate-800/80 text-slate-300 text-xs px-2 py-0.5 rounded-md border border-slate-700/50">
                      Score: {selectedCandidate.talentScore ? Math.round(selectedCandidate.talentScore) : 75}
                    </span>
                    {selectedCandidate.linkedInUrl && (
                      <a href={selectedCandidate.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                        Ver Perfil @🔗
                      </a>
                    )}
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
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.psychologicalProfile || 'Innovador y orientado a resultados.'}</p>
                </div>

                {/* Business Moment */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-emerald-500/20 shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-emerald-400">📈</span>
                    <p className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Momento Empresarial</p>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.businessMoment || 'Enfocado en liderar el diseño de productos innovadores.'}</p>
                </div>

                {/* Sales Angle */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-yellow-500/20 shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-400">🎯</span>
                    <p className="text-xs font-bold text-yellow-400 tracking-wider uppercase">Ángulo de Venta</p>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.salesAngle || 'Aprovechar su pasión por la innovación para introducir nuevas soluciones.'}</p>
                </div>

                {/* Bottleneck */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-pink-500/20 shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-pink-400">⚠️</span>
                    <p className="text-xs font-bold text-pink-400 tracking-wider uppercase">Cuello de Botella</p>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.bottleneck || 'Necesidad de mantenerse al día con las últimas tendencias.'}</p>
                </div>
              </div>

              {/* Lane Selector */}
              {/* Removed by request */}

              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 text-xs">Información generada por la IA de enriquecimiento.</span>
                {isEditingMessages ? (
                  <button onClick={handleSaveMessages} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors">
                    <span>💾</span> Guardar
                  </button>
                ) : (
                  <button onClick={() => setIsEditingMessages(true)} className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-sm transition-colors">
                    <span>✏️</span> Editar Mensajes
                  </button>
                )}
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
                  {isEditingMessages ? (
                    <textarea
                      value={editedIcebreaker}
                      onChange={(e) => setEditedIcebreaker(e.target.value)}
                      className="w-full flex-1 bg-slate-900 border border-blue-500/50 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-blue-400 min-h-[120px]"
                    />
                  ) : (
                    <p className="text-sm text-slate-200 leading-relaxed flex-1">
                      "{selectedCandidate.walead_messages?.icebreaker || `Hola ${selectedCandidate.name}, vi tu trabajo, ¡me encantaría conectar y compartir ideas sobre innovación!`}"
                    </p>
                  )}
                  {!isEditingMessages && (
                    <button
                      onClick={() => {
                        const msg = selectedCandidate.walead_messages?.icebreaker || `Hola ${selectedCandidate.name}, vi tu trabajo, ¡me encantaría conectar y compartir ideas sobre innovación!`;
                        navigator.clipboard.writeText(msg);
                        setToast({ show: true, message: 'Invitación copiada al portapapeles' });
                      }}
                      className="mt-4 w-full flex-grow-0 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
                    >
                      <span>📋</span> Copiar
                    </button>
                  )}
                </div>

                {/* Post-Acceptance */}
                <div className="p-5 rounded-xl bg-emerald-900/10 border border-emerald-500/30 flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-emerald-400">💬</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded">2</span>
                    <p className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Post-Aceptación</p>
                  </div>
                  {isEditingMessages ? (
                    <textarea
                      value={editedFollowup}
                      onChange={(e) => setEditedFollowup(e.target.value)}
                      className="w-full flex-1 bg-slate-900 border border-emerald-500/50 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-emerald-400 min-h-[120px]"
                    />
                  ) : (
                    <p className="text-sm text-slate-200 leading-relaxed flex-1">
                      "{selectedCandidate.walead_messages?.followup_message || `Hola ${selectedCandidate.name}, gracias por aceptar mi conexión. He estado siguiendo tu trabajo y creo que hay oportunidades interesantes para colaborar.`}"
                    </p>
                  )}
                  {!isEditingMessages && (
                    <button
                      onClick={() => {
                        const msg = selectedCandidate.walead_messages?.followup_message || `Hola ${selectedCandidate.name}, gracias por aceptar mi conexión. He estado siguiendo tu trabajo y creo que hay oportunidades interesantes para colaborar.`;
                        navigator.clipboard.writeText(msg);
                        setToast({ show: true, message: 'Mensaje de seguimiento copiado al portapapeles' });
                      }}
                      className="mt-4 w-full flex-grow-0 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
                    >
                      <span>📋</span> Copiar
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />

      {/* User Selection Modal */}
      <UserSelectionModal
        isOpen={showUserSelection}
        onSelect={(user) => {
          setSelectedUser(user);
          setShowUserSelection(false);
          handleExportWithUser(user);
        }}
        onClose={() => setShowUserSelection(false)}
      />

      {/* Add Manual Candidate Modal */}
      <ManualEnrichmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={handleAddCandidate}
      />
    </div>
  );
};

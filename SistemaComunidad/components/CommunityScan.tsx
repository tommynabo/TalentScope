import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Terminal, Users, TrendingUp, Download, ArrowLeft, ChevronLeft, Globe, ChevronDown, ChevronUp, SlidersHorizontal, List } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CommunityCandidate, CommunityFilterCriteria, CommunityPlatform, CommunitySearchProgress, CommunityCampaign } from '../types/community';
import { CommunitySearchEngine as CommunitySearchEngineV2 } from '../lib/CommunitySearchEngineV2';
import { CommunityCandidatePersistence } from '../lib/communityCandidatePersistence';
import { CommunityFilterConfig } from './CommunityFilterConfig';
import { CommunityCandidatesPipeline } from './CommunityCandidatesPipeline';
import { supabase } from '../../lib/supabase';

const CAMPAIGNS_KEY = 'community_campaigns_v1';

interface CommunityScanProps {
    campaignId?: string;
}

export const CommunityScan: React.FC<CommunityScanProps> = ({ campaignId: propCampaignId }) => {
    const { campaignId: urlCampaignId } = useParams();
    const navigate = useNavigate();
    const campaignId = propCampaignId || urlCampaignId || '';

    const [campaign, setCampaign] = useState<CommunityCampaign | null>(null);
    const [candidates, setCandidates] = useState<CommunityCandidate[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [progress, setProgress] = useState<CommunitySearchProgress | null>(null);
    const [criteria, setCriteria] = useState<CommunityFilterCriteria>({
        platforms: [CommunityPlatform.Discord],
        keywords: ['flutter'],
        maxResults: 100,
    });

    const logsEndRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CommunitySearchEngineV2 | null>(null);

    // Load campaign from localStorage
    useEffect(() => {
        if (!campaignId) return;
        try {
            const stored = localStorage.getItem(CAMPAIGNS_KEY);
            if (stored) {
                const campaigns: CommunityCampaign[] = JSON.parse(stored);
                const found = campaigns.find(c => c.id === campaignId);
                if (found) {
                    setCampaign(found);
                    setCriteria(found.searchCriteria);
                    setCandidates(found.candidates || []);
                }
            }
        } catch {
            console.warn('Could not load campaign');
        }
    }, [campaignId]);

    // Auto-scroll logs
    useEffect(() => {
        if (showLogs) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, showLogs]);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const handleStart = async () => {
        setIsSearching(true);
        setLogs([]);
        setShowLogs(true);
        setShowFilters(false);
        addLog('🚀 Iniciando Community Infiltrator...');

        // Get user ID
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || 'anonymous';

        // Instantiate V2 engine and store ref for stop()
        const engine = new CommunitySearchEngineV2();
        engineRef.current = engine;

        engine.startCommunitySearch(
            criteria.keywords.join(' '),
            criteria.maxResults || 100,
            {
                filters: criteria,
                campaignId,
                userId,
            },
            // onLog
            (message) => addLog(message),
            // onProgress
            (p) => setProgress(p),
            // onComplete
            async (results) => {
                setIsSearching(false);
                addLog(`\n📋 Total: ${results.length} candidatos encontrados`);

                // Append new results, but prevent duplicates locally by ID/Username+Platform
                const newCandidates = [...candidates];
                let addedCount = 0;
                results.forEach(c => {
                    const exists = newCandidates.some(existing => existing.username === c.username && existing.platform === c.platform);
                    if (!exists) {
                        newCandidates.push({
                            ...c,
                            kanbanLane: 'discovered' as const,
                            addedAt: new Date().toISOString(),
                        });
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    setCandidates(newCandidates);
                }

                // Save to campaign
                if (campaign && campaignId) {
                    const updatedCampaign = {
                        ...campaign,
                        candidates: newCandidates,
                        stats: {
                            total: newCandidates.length,
                            excellentMatch: newCandidates.filter(c => c.talentScore >= 80).length,
                            goodMatch: newCandidates.filter(c => c.talentScore >= 60).length,
                            withEmail: newCandidates.filter(c => !!c.email).length,
                            withLinkedIn: newCandidates.filter(c => !!c.linkedInUrl).length,
                            withGitHub: newCandidates.filter(c => !!c.githubUrl).length,
                            avgScore: newCandidates.length > 0
                                ? Math.round(newCandidates.reduce((s, c) => s + c.talentScore, 0) / newCandidates.length)
                                : 0,
                            maxScore: newCandidates.length > 0 ? Math.max(...newCandidates.map(c => c.talentScore)) : 0,
                            lastScannedAt: new Date().toISOString(),
                        },
                    };

                    // Save to localStorage
                    try {
                        const stored = localStorage.getItem(CAMPAIGNS_KEY);
                        const campaigns: CommunityCampaign[] = stored ? JSON.parse(stored) : [];
                        const updated = campaigns.map(c => c.id === campaignId ? updatedCampaign : c);
                        localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(updated));
                        setCampaign(updatedCampaign);
                    } catch {
                        addLog('⚠️ Could not save to localStorage');
                    }

                    // Save to Supabase
                    if (results.length > 0) {
                        addLog('💾 Guardando en Supabase...');
                        const saved = await CommunityCandidatePersistence.saveCandidates(
                            campaignId, results, userId
                        );
                        addLog(saved ? `✅ ${addedCount} nuevos candidatos guardados exitosamente` : '⚠️ Error parcial al guardar en DB');
                    }
                }
            }
        );
    };

    const handleStop = () => {
        engineRef.current?.stop();
        setIsSearching(false);
        addLog('⛔ Búsqueda detenida por el usuario');
    };

    const handleExportCSV = () => {
        if (candidates.length === 0) return;

        const headers = ['Username', 'Display Name', 'Platform', 'Score', 'Messages', 'Q&A', 'Projects', 'Email', 'GitHub', 'LinkedIn', 'Profile URL'];
        const rows = candidates.map(c => [
            c.username,
            c.displayName,
            c.platform,
            c.talentScore,
            c.messageCount,
            c.questionsAnswered,
            (c.projectLinks?.length || 0) + (c.repoLinks?.length || 0),
            c.email || '',
            c.githubUrl || '',
            c.linkedInUrl || '',
            c.profileUrl,
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `community_${campaignId}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-3 md:p-4 lg:p-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col relative w-full overflow-y-auto">
            {/* Header & Nav */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-3 mb-4">
                <div className="flex items-center gap-1.5 lg:gap-3 flex-1 min-w-0">
                    <button
                        onClick={() => navigate('/comunidades')}
                        className="p-1 lg:p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-violet-500 hover:text-violet-400 text-slate-400 transition-all flex-shrink-0"
                    >
                        <ChevronLeft className="h-4 lg:h-5 w-4 lg:w-5" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-lg lg:text-xl font-bold text-white flex items-center gap-1.5 lg:gap-2 truncate">
                            <Users className="h-4 lg:h-5 w-4 lg:w-5 text-violet-500 flex-shrink-0" />
                            <span className="truncate">{campaign?.name || 'Community Scan'}</span>
                        </h2>
                        <p className="text-slate-400 text-xs line-clamp-1">
                            Plataformas: <span className="text-violet-400">{criteria.platforms.join(', ')}</span> •
                            Keywords: <span className="text-slate-300">{criteria.keywords.join(', ')}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 lg:gap-3 flex-shrink-0">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-2.5 lg:px-4 py-1 lg:py-2 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 ${showFilters ? 'bg-violet-600/20 text-violet-300 border-violet-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}`}
                    >
                        <SlidersHorizontal className="h-3 lg:h-4 w-3 lg:w-4" />
                        <span className="hidden sm:inline">Filtros</span>
                    </button>

                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 lg:px-2.5 py-1 lg:py-1.5">
                        <span className="text-slate-400 text-xs hidden sm:inline">Max:</span>
                        <input
                            type="number"
                            min="10"
                            max="500"
                            value={criteria.maxResults || 100}
                            onChange={(e) => setCriteria({ ...criteria, maxResults: Number(e.target.value) })}
                            className="w-12 lg:w-16 bg-slate-800 border border-slate-700 rounded px-1 lg:px-1.5 py-0.5 text-white text-xs text-center focus:outline-none focus:border-violet-500"
                            disabled={isSearching}
                        />
                    </div>

                    <button
                        onClick={isSearching ? handleStop : handleStart}
                        className={`px-2.5 lg:px-5 py-1 lg:py-2 ${isSearching ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500'} text-white rounded-lg text-xs shadow-lg ${isSearching ? 'shadow-red-900/20' : 'shadow-violet-900/20'} transition-all flex items-center gap-1 flex-shrink-0 whitespace-nowrap`}
                    >
                        {isSearching ? <Square className="h-3 lg:h-4 w-3 lg:w-4" /> : <Play className="h-3 lg:h-4 w-3 lg:w-4" />}
                        <span className="hidden sm:inline text-xs">{isSearching ? 'Detener' : 'Escanear Comunidades'}</span>
                        <span className="sm:hidden">{isSearching ? '⏹' : '🔍'}</span>
                    </button>

                    {candidates.length > 0 && (
                        <button
                            onClick={handleExportCSV}
                            className="px-2.5 lg:px-3 py-1 lg:py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 transition-colors flex items-center justify-center p-2"
                            title="Exportar CSV"
                        >
                            <Download className="h-3 lg:h-4 w-3 lg:w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Dropdown */}
            {showFilters && (
                <div className="mb-4">
                    <CommunityFilterConfig
                        criteria={criteria}
                        onChange={setCriteria}
                        disabled={isSearching}
                    />
                </div>
            )}

            {/* Live Logs Section */}
            {(isSearching || logs.length > 0) && (
                <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex-shrink-0">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="w-full flex items-center justify-between px-4 py-2 bg-slate-900/50 hover:bg-slate-900 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Terminal className="h-4 w-4 text-violet-500" />
                            Registro de Escaneo ({logs.length} líneas)
                            {isSearching && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-600/20 rounded-full text-[10px] text-emerald-400 border border-emerald-500/30 ml-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                    Scanning...
                                </span>
                            )}
                        </div>
                        {showLogs ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </button>

                    {showLogs && (
                        <div className="p-4 h-48 overflow-y-auto font-mono text-xs text-slate-400 flex flex-col gap-1">
                            {logs.map((log, i) => (
                                <div key={i} className={`border-l-2 border-slate-800 pl-2 py-0.5 ${log.includes('[ERROR]') ? 'text-red-400' :
                                        log.includes('✅') ? 'text-emerald-400' :
                                            log.includes('⚠️') ? 'text-amber-400' :
                                                log.includes('═══') ? 'text-violet-400 font-bold' :
                                                    log.includes('📊') || log.includes('📈') ? 'text-cyan-400' :
                                                        'text-slate-400'
                                    }`}>
                                    {log}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Area - Candidates Pipeline */}
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="px-3 py-3 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 transition-all sticky top-0 z-10 backdrop-blur-md">
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                        <h3 className="font-semibold text-sm text-white whitespace-nowrap flex items-center gap-2">
                            <List className="h-4 w-4 text-violet-400" />
                            Pipeline de Candidatos ({candidates.length})
                        </h3>
                    </div>

                    {campaign && candidates.length > 0 && (
                        <div className="text-xs text-slate-400 flex gap-4">
                            <span>Score Promedio: <strong className="text-white">{campaign.stats?.avgScore || 0}</strong></span>
                            <span>Excelentes: <strong className="text-emerald-400">{campaign.stats?.excellentMatch || 0}</strong></span>
                        </div>
                    )}
                </div>

                {/* Pipeline content */}
                <div className="p-4">
                    <CommunityCandidatesPipeline
                        candidates={candidates}
                        campaignId={campaignId}
                    />
                </div>
            </div>
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Terminal, Users, TrendingUp, Download, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CommunityCandidate, CommunityFilterCriteria, CommunityPlatform, CommunitySearchProgress, CommunityCampaign } from '../types/community';
import { communitySearchEngine } from '../lib/CommunitySearchEngine';
import { CommunityCandidatePersistence } from '../lib/communityCandidatePersistence';
import { CommunityFilterConfig } from './CommunityFilterConfig';
import { CommunityCampaignDashboard } from './CommunityCampaignDashboard';
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
    const [activeView, setActiveView] = useState<'scan' | 'dashboard'>('scan');
    const [progress, setProgress] = useState<CommunitySearchProgress | null>(null);
    const [criteria, setCriteria] = useState<CommunityFilterCriteria>({
        platforms: [CommunityPlatform.Discord],
        keywords: ['flutter'],
        maxResults: 100,
    });

    const logEndRef = useRef<HTMLDivElement>(null);

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
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const handleStart = async () => {
        setIsSearching(true);
        setLogs([]);
        addLog('🚀 Iniciando Community Infiltrator...');

        // Get user ID
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || 'anonymous';

        communitySearchEngine.startCommunitySearch(
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
                setCandidates(results);
                addLog(`\n📋 Total: ${results.length} candidatos encontrados`);

                // Save to campaign
                if (campaign && campaignId) {
                    const updatedCampaign = {
                        ...campaign,
                        candidates: results.map(c => ({
                            ...c,
                            kanbanLane: 'discovered' as const,
                            addedAt: new Date().toISOString(),
                        })),
                        stats: {
                            total: results.length,
                            excellentMatch: results.filter(c => c.talentScore >= 80).length,
                            goodMatch: results.filter(c => c.talentScore >= 60).length,
                            withEmail: results.filter(c => !!c.email).length,
                            withLinkedIn: results.filter(c => !!c.linkedInUrl).length,
                            withGitHub: results.filter(c => !!c.githubUrl).length,
                            avgScore: results.length > 0
                                ? Math.round(results.reduce((s, c) => s + c.talentScore, 0) / results.length)
                                : 0,
                            maxScore: results.length > 0 ? Math.max(...results.map(c => c.talentScore)) : 0,
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
                        addLog(saved ? '✅ Guardado exitoso' : '⚠️ Error parcial al guardar');
                    }
                }
            }
        );
    };

    const handleStop = () => {
        communitySearchEngine.stop();
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
        <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/comunidades')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{campaign?.name || 'Community Scan'}</h1>
                        <p className="text-sm text-slate-400">
                            {criteria.platforms.join(', ')} · {criteria.keywords.join(', ')}
                        </p>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setActiveView('scan')}
                        className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${activeView === 'scan' ? 'bg-violet-600/20 text-violet-300' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <Terminal className="h-4 w-4 inline mr-1" />
                        Scan
                    </button>
                    <button
                        onClick={() => setActiveView('dashboard')}
                        className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${activeView === 'dashboard' ? 'bg-violet-600/20 text-violet-300' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <TrendingUp className="h-4 w-4 inline mr-1" />
                        Dashboard
                    </button>
                </div>
            </div>

            {activeView === 'dashboard' && campaign ? (
                <CommunityCampaignDashboard
                    campaignId={campaignId}
                    campaignTitle={campaign.name}
                    candidates={candidates}
                    onRefresh={() => setActiveView('scan')}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Controls + Filters */}
                    <div className="space-y-4">
                        {/* Start/Stop */}
                        <div className="flex gap-3">
                            {!isSearching ? (
                                <button
                                    onClick={handleStart}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-white font-bold transition-all shadow-lg shadow-violet-900/30 active:scale-95"
                                >
                                    <Play className="h-5 w-5" />
                                    Iniciar Scan
                                </button>
                            ) : (
                                <button
                                    onClick={handleStop}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold transition-all active:scale-95"
                                >
                                    <Square className="h-5 w-5" />
                                    Detener
                                </button>
                            )}

                            {candidates.length > 0 && (
                                <button
                                    onClick={handleExportCSV}
                                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors"
                                    title="Exportar CSV"
                                >
                                    <Download className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-white font-mono">{candidates.length}</p>
                                <p className="text-[10px] text-slate-500 uppercase">Encontrados</p>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-emerald-400 font-mono">
                                    {candidates.filter(c => c.talentScore >= 80).length}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase">Quality ≥80</p>
                            </div>
                        </div>

                        {/* Filter Config */}
                        <CommunityFilterConfig
                            criteria={criteria}
                            onChange={setCriteria}
                            disabled={isSearching}
                        />
                    </div>

                    {/* Right: Log Console */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden h-[600px] flex flex-col">
                            {/* Console Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                                <div className="flex items-center gap-2">
                                    <Terminal className="h-4 w-4 text-violet-400" />
                                    <span className="text-sm font-medium text-white">Console</span>
                                    {isSearching && (
                                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-600/20 rounded-full text-xs text-emerald-400 border border-emerald-500/30">
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                            Scanning...
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500">{logs.length} lines</span>
                            </div>

                            {/* Log Content */}
                            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                                {logs.length === 0 ? (
                                    <div className="text-slate-600 text-center mt-20">
                                        <Terminal className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                        <p>Presiona "Iniciar Scan" para comenzar...</p>
                                        <p className="mt-1 text-slate-700">Los logs aparecerán aquí en tiempo real</p>
                                    </div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className={`py-0.5 ${log.includes('[ERROR]') ? 'text-red-400' :
                                                log.includes('✅') ? 'text-emerald-400' :
                                                    log.includes('⚠️') ? 'text-amber-400' :
                                                        log.includes('═══') ? 'text-violet-400 font-bold' :
                                                            log.includes('📊') || log.includes('📈') ? 'text-cyan-400' :
                                                                'text-slate-400'
                                            }`}>
                                            {log}
                                        </div>
                                    ))
                                )}
                                <div ref={logEndRef} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

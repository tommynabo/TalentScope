import React, { useState, useEffect, useRef } from 'react';
import { Search, Star, GitBranch, Users, Code2, Trophy, ExternalLink, Loader, Plus, Link2, List, Columns3, Grid3x3, X, Download, Calendar } from 'lucide-react';
import { GitHubMetrics, GitHubFilterCriteria } from '../../types/database';
import { GitHubGraphQLSearchEngine } from '../lib/GitHubGraphQLSearchEngine';
import { GitHubCandidate } from '../../types/database';
import { GitHubFilterConfig } from './GitHubFilterConfig';
import { ApifyCrossSearchService } from '../../lib/apifyCrossSearchService';
import { PRESET_PRODUCT_ENGINEERS } from '../../lib/githubPresets';
import { GitHubCandidatesCards } from './GitHubCandidatesCards';
import { GitHubCandidatesPipeline } from './GitHubCandidatesPipeline';
import { GitHubCandidatesKanban } from './GitHubCandidatesKanban';
import { GitHubCandidatePersistence } from '../../lib/githubCandidatePersistence';
import { supabase } from '../../lib/supabase';
import Toast from '../../components/Toast';
import UserSelectionModal from '../../components/UserSelectionModal';
import { OutreachUser, generateOutreachMessages, extractSpecialty } from '../../lib/messageGenerator';

interface GitHubCodeScanProps {
    campaignId?: string;
    initialCriteria?: GitHubFilterCriteria;
}

type ViewMode = 'cards' | 'pipeline' | 'kanban';

export const GitHubCodeScan: React.FC<GitHubCodeScanProps> = ({ campaignId, initialCriteria }) => {
    const [candidates, setCandidates] = useState<GitHubMetrics[]>([]);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showFilterConfig, setShowFilterConfig] = useState(false);
    const [showLogs, setShowLogs] = useState(true); // Always show logs during execution
    const [criteria, setCriteria] = useState<GitHubFilterCriteria | null>(null);
    const [maxResults, setMaxResults] = useState(30);
    const [viewMode, setViewMode] = useState<ViewMode>('pipeline'); // Default to pipeline
    const [userId, setUserId] = useState<string>('');
    const [isStoppable, setIsStoppable] = useState(false); // Track if search can be stopped
    const engineRef = useRef<GitHubGraphQLSearchEngine | null>(null);
    const isSearchingRef = useRef(false); // Mirror of loading state that survives React batching
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [showUserSelection, setShowUserSelection] = useState(false);
    const [selectedUser, setSelectedUser] = useState<OutreachUser>('mauro');
    const [toast, setToast] = useState({ show: false, message: '' });
    const [exportDateRange, setExportDateRange] = useState<{ start: string; end: string }>({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Load criteria from campaign settings or fallback to preset
    useEffect(() => {
        if (initialCriteria) {
            setCriteria(initialCriteria);
        } else {
            setCriteria(PRESET_PRODUCT_ENGINEERS);
        }

        // Load previous logs from localStorage (persists across tab changes)
        loadPersistentLogs();

        // Get current user and load candidates from SUPABASE or Memory
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
                setUserId(session.user.id);

                // Load from Supabase if campaign context available
                if (campaignId) {
                    // Try to load from Supabase
                    GitHubCandidatePersistence.getCampaignCandidates(campaignId, session.user.id)
                        .then(restored => {
                            if (restored && restored.length > 0) {
                                setCandidates(restored);
                                console.log(`✅ Loaded ${restored.length} candidates from Supabase`);
                            } else {
                                // Fallback to localStorage
                                const localStorageKey = `github_candidates_${campaignId}`;
                                try {
                                    const stored = localStorage.getItem(localStorageKey);
                                    if (stored) {
                                        const candidates = JSON.parse(stored);
                                        setCandidates(candidates);
                                        console.log(`✅ Loaded ${candidates.length} candidates from localStorage`);
                                    }
                                } catch (err) {
                                    console.warn('Failed to load from localStorage');
                                }
                            }
                        })
                        .catch(err => {
                            console.warn('Supabase query failed, trying localStorage...');
                            // Fallback to localStorage
                            const localStorageKey = `github_candidates_${campaignId}`;
                            try {
                                const stored = localStorage.getItem(localStorageKey);
                                if (stored) {
                                    const candidates = JSON.parse(stored);
                                    setCandidates(candidates);
                                    console.log(`✅ Loaded ${candidates.length} candidates from localStorage`);
                                }
                            } catch (err) {
                                console.warn('Failed to load from localStorage');
                            }
                        });
                } else {
                    console.log('No campaign context');
                }
            }
        });

        // Listen for visibility changes to sync logs ONLY when a search is actively running
        // GUARD: Don't fire when idle to prevent tab-switch re-renders
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;

            // Only restore logs if a search was running
            const isActive = isSearchingRef.current || engineRef.current?.getIsRunning();
            if (!isActive) {
                // Check localStorage fallback
                const savedState = localStorage.getItem(`github_search_state_${campaignId}`);
                if (!savedState) return;
                try {
                    const state = JSON.parse(savedState);
                    if (!state.isRunning || Date.now() - state.timestamp >= 600000) return;
                } catch (err) {
                    return;
                }
            }

            // Restore logs from persistent storage
            loadPersistentLogs();

            // Restore search state if needed
            if (isSearchingRef.current || engineRef.current?.getIsRunning()) {
                setLoading(true);
                setIsStoppable(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [campaignId]);

    // ⚡ Web Locks: prevent browser from discarding/freezing the tab during search
    useEffect(() => {
        if (!loading) return;
        let lockResolver: (() => void) | null = null;
        if ('locks' in navigator) {
            (navigator as any).locks.request('github-search-lock', () => {
                return new Promise<void>((resolve) => {
                    lockResolver = resolve;
                });
            });
        }
        // Keep-alive ping to prevent throttling
        const keepAlive = setInterval(() => { void document.hidden; }, 3000);
        return () => {
            if (lockResolver) lockResolver();
            clearInterval(keepAlive);
        };
    }, [loading]);

    // ⚡ Periodic log sync: re-read from localStorage every 2s while searching
    useEffect(() => {
        if (!loading) return;
        const syncInterval = setInterval(() => {
            if (isSearchingRef.current) {
                loadPersistentLogs();
            }
        }, 2000);
        return () => clearInterval(syncInterval);
    }, [loading]);

    const handleLogMessage = (message: string) => {
        setLogs(prev => {
            const newLogs = [...prev, message];
            // Persist to both sessionStorage (fast) and localStorage (persistent)
            sessionStorage.setItem(`github_logs_${campaignId}`, JSON.stringify(newLogs));
            localStorage.setItem(`github_logs_persistent_${campaignId}`, JSON.stringify(newLogs));
            return newLogs;
        });
    };

    const loadPersistentLogs = () => {
        try {
            // Try localStorage first (more reliable for tab switches)
            const logsKey = `github_logs_persistent_${campaignId}`;
            const persistent = localStorage.getItem(logsKey);
            if (persistent) {
                const parsedLogs = JSON.parse(persistent);
                if (Array.isArray(parsedLogs)) {
                    setLogs(parsedLogs);
                    return;
                }
            }
        } catch (err) {
            console.warn('Failed to load persistent logs:', err);
        }

        // Fallback to sessionStorage
        try {
            const sessionLogsKey = `github_logs_${campaignId}`;
            const sessionLogs = sessionStorage.getItem(sessionLogsKey);
            if (sessionLogs) {
                const parsedLogs = JSON.parse(sessionLogs);
                if (Array.isArray(parsedLogs)) {
                    setLogs(parsedLogs);
                }
            }
        } catch (err) {
            console.warn('Failed to load session logs:', err);
        }
    };

    const savePersistentState = () => {
        try {
            localStorage.setItem(`github_search_state_${campaignId}`, JSON.stringify({
                isRunning: loading,
                isStoppable: isStoppable,
                maxResults: maxResults,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.warn('Failed to save search state:', err);
        }
    };

    // Save state whenever loading or isStoppable changes
    useEffect(() => {
        savePersistentState();
    }, [loading, isStoppable, maxResults]);

    const handleStopSearch = () => {
        engineRef.current?.stop('User clicked stop button');
        isSearchingRef.current = false;
        setLoading(false);
        setIsStoppable(false);
        handleLogMessage('🛑 Búsqueda detenida por el usuario');
    };

    const handleStartSearch = async () => {
        if (!criteria) {
            alert('Please configure filter criteria first');
            return;
        }

        if (!campaignId || !userId) {
            alert('Campaign context required for persistent search');
            return;
        }

        isSearchingRef.current = true;
        setLoading(true);
        setIsStoppable(true);
        setLogs([]);
        setShowLogs(true);

        // Instantiate the new OO engine and store the ref for stop() calls
        const engine = new GitHubGraphQLSearchEngine();
        engineRef.current = engine;

        // Build keyword query from criteria (engine adds location: prefixes itself)
        const queryParts: string[] = [];
        if (criteria.languages?.length) queryParts.push(criteria.languages[0]);
        if (criteria.keywords?.length) queryParts.push(`"${criteria.keywords[0]}"`);
        if (criteria.target_role) queryParts.push(`"${criteria.target_role}"`);
        const searchQuery = queryParts.join(' ') || 'developer';

        try {
            await engine.startGitHubSearch(
                searchQuery,
                maxResults,
                { campaignId, userId, githubFilters: criteria },
                handleLogMessage,
                (results: GitHubCandidate[]) => {
                    // Map GitHubCandidate[] → GitHubMetrics[], merging avatar/name from the top-level
                    const metrics = results.map(c => ({
                        ...(c.github_metrics as GitHubMetrics),
                        name: c.full_name ?? undefined,
                        avatar_url: c.avatar_url ?? undefined,
                    })) as GitHubMetrics[];

                    // Merge with existing localStorage candidates (dedup by github_username)
                    const localStorageKey = `github_candidates_${campaignId}`;
                    let previousCandidates: GitHubMetrics[] = [];
                    try {
                        const stored = localStorage.getItem(localStorageKey);
                        if (stored) {
                            previousCandidates = JSON.parse(stored);
                            handleLogMessage(`📦 Found ${previousCandidates.length} previous candidates in localStorage`);
                        }
                    } catch {
                        handleLogMessage('⚠️ Could not read previous candidates from storage');
                    }

                    const allCandidates = [...previousCandidates];
                    let newCount = 0;
                    for (const m of metrics) {
                        if (!allCandidates.some(e => e.github_username.toLowerCase() === m.github_username.toLowerCase())) {
                            allCandidates.push(m);
                            newCount++;
                        }
                    }

                    handleLogMessage(`✨ Found ${results.length} developers via GraphQL`);
                    handleLogMessage(`✅ Added ${newCount} new (${results.length - newCount} duplicates)`);
                    handleLogMessage(`📊 Total accumulated: ${allCandidates.length} developers`);

                    try { localStorage.setItem(localStorageKey, JSON.stringify(allCandidates)); } catch {}
                    setCandidates([...allCandidates]);
                },
            );
        } catch (error: any) {
            handleLogMessage(`❌ Error: ${error.message}`);
            console.error('Search error:', error);
        } finally {
            isSearchingRef.current = false;
            setLoading(false);
            setIsStoppable(false);
        }
    };

    const handleStartCrossSearch = async () => {
        if (!criteria || candidates.length === 0) {
            alert('Please run a GitHub search first');
            return;
        }

        setLoading(true);
        setLogs(prev => [...prev, '🔗 Starting GitHub ↔ LinkedIn cross-search...']);

        try {
            const crossSearchService = new ApifyCrossSearchService();
            handleLogMessage('🔗 Phase 1: Searching LinkedIn profiles for each developer...');

            const linkedResults = await crossSearchService.batchSearchLinkedInProfiles(
                candidates,
                {
                    search_email: true,
                    search_username: true,
                    search_name_fuzzy: true,
                    min_confidence: 70
                }
            );

            const linkedCount = linkedResults.filter(r => r.link_status === 'linked').length;
            handleLogMessage(`✅ Cross-search completed! ${linkedCount}/${linkedResults.length} profiles linked`);
        } catch (error: any) {
            handleLogMessage(`❌ Cross-search error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getScoreBadgeColor = (score: number) => {
        if (score >= 85) return 'bg-gradient-to-r from-green-900 to-emerald-900 border border-green-600 text-green-200';
        if (score >= 75) return 'bg-gradient-to-r from-blue-900 to-cyan-900 border border-blue-600 text-blue-200';
        if (score >= 65) return 'bg-gradient-to-r from-yellow-900 to-orange-900 border border-yellow-600 text-yellow-200';
        return 'bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-600 text-slate-200';
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const handleGitHubExport = (activeUser: OutreachUser) => {
        const { start, end } = exportDateRange;
        if (!start || !end) return;

        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        const filtered = candidates.filter(c => {
            const dateStr = (c as any).added_at || c.created_at || new Date().toISOString();
            const cDate = new Date(dateStr);
            return cDate >= startDate && cDate <= endDate;
        });

        if (filtered.length === 0) {
            setToast({ show: true, message: '⚠️ No hay desarrolladores para exportar en este rango' });
            return;
        }

        // Smart Split: LinkedIn vs Email
        const linkedinCandidates = filtered.filter(c => c.linkedin_url && c.linkedin_url.trim().length > 0);
        const emailCandidates = filtered.filter(c =>
            c.mentioned_email && c.mentioned_email.trim().length > 0 &&
            (!c.linkedin_url || c.linkedin_url.trim().length === 0)
        );

        const esc = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

        const downloadCSV = (data: GitHubMetrics[], filename: string) => {
            const headers = [
                'FIRST_NAME', 'LAST_NAME', 'ROL', 'EMAIL', 'LINKEDIN', 'GITHUB',
                'SCORE', 'INVITACION_INICIAL', 'POST_ACEPTACION', 'ANALISIS',
                'LENGUAJE', 'SEGUIDORES', 'REPOS', 'ÚLTIMO_COMMIT', 'FECHA'
            ];
            const csvContent = [
                headers.join(','),
                ...data.map(c => {
                    const nameParts = (c.name || c.github_username || '').split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';

                    const lang = c.most_used_language || '';
                    const lowerLang = lang.toLowerCase();
                    let rol = `${lang} Developer`;
                    if (['react', 'typescript', 'javascript', 'vue'].some(t => lowerLang.includes(t))) rol = 'Frontend Engineer';
                    else if (['python', 'django', 'flask'].some(t => lowerLang.includes(t))) rol = 'Backend Engineer';
                    else if (['dart', 'flutter', 'kotlin', 'swift'].some(t => lowerLang.includes(t))) rol = 'Mobile Engineer';
                    else if (['rust', 'go', 'c++', 'c'].some(t => lowerLang === t)) rol = 'Systems Engineer';

                    const specialty = extractSpecialty(rol, [], { most_used_language: lang });
                    const personalized = generateOutreachMessages(
                        c.name || c.github_username || '',
                        specialty,
                        activeUser,
                        {
                            icebreaker: c.outreach_icebreaker,
                            followup_message: c.outreach_followup,
                            second_followup: c.outreach_pitch
                        }
                    );

                    const analysis = c.ai_summary?.join(' | ') || c.analysis_business || '';
                    const lastCommit = c.last_commit_date ? c.last_commit_date.split('T')[0] : 'N/A';
                    const added = (c as any).added_at ? (c as any).added_at.split('T')[0] : new Date().toISOString().split('T')[0];

                    return [
                        esc(firstName), esc(lastName), esc(rol),
                        esc(c.mentioned_email || ''), esc(c.linkedin_url || ''),
                        esc(`https://github.com/${c.github_username}`),
                        `"${Math.round(c.github_score)}"`,
                        esc(personalized.icebreaker), esc(personalized.followup_message),
                        esc(analysis), esc(lang),
                        `"${c.followers}"`, `"${c.public_repos}"`,
                        esc(lastCommit), esc(added)
                    ].join(',');
                })
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        const dateTag = `${start}_${end}`;

        if (linkedinCandidates.length > 0) {
            downloadCSV(linkedinCandidates, `LINKEDIN_github_${campaignId}_${dateTag}.csv`);
        }

        if (emailCandidates.length > 0) {
            setTimeout(() => {
                downloadCSV(emailCandidates, `EMAIL_github_${campaignId}_${dateTag}.csv`);
            }, 500);
        }

        const parts: string[] = [];
        if (linkedinCandidates.length > 0) parts.push(`${linkedinCandidates.length} LinkedIn`);
        if (emailCandidates.length > 0) parts.push(`${emailCandidates.length} Email`);
        const noContact = filtered.length - linkedinCandidates.length - emailCandidates.length;
        if (noContact > 0) parts.push(`${noContact} sin contacto`);

        setToast({
            show: true,
            message: `✅ Exportados ${filtered.length} devs → ${parts.join(' + ')} (mensajes de ${activeUser === 'mauro' ? 'Mauro' : 'Nyo'})`
        });
        setShowExportOptions(false);
    };

    return (
        <div className="space-y-6">
            {/* Header - Simplified */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Búsqueda en GitHub</h2>
                    <p className="text-slate-400 text-sm mt-1">Descubre desarrolladores por calidad de código</p>
                </div>
                <button
                    onClick={() => setShowFilterConfig(!showFilterConfig)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition text-sm"
                >
                    {showFilterConfig ? '🔍 Ocultar' : '⚙️ Filtros'}
                </button>
            </div>

            {/* Filter Configuration */}
            {showFilterConfig && (
                <div className="transition-all duration-300">
                    <GitHubFilterConfig
                        onSave={(newCriteria) => {
                            setCriteria(newCriteria);
                            setShowFilterConfig(false);
                        }}
                    />
                </div>
            )}

            {criteria && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                    {!showFilterConfig ? (
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Criterios Configurados</h3>
                            <p className="text-slate-400 text-sm">
                                {criteria.languages.join(', ')} • Score ≥ {criteria.score_threshold} •
                                {criteria.require_app_store_link ? ' App Store Required' : ' Any App Type'}
                            </p>
                        </div>
                    ) : (
                        <div className="text-orange-400 font-medium pb-2">Editando filtros...</div>
                    )}

                    <div className="flex flex-wrap gap-3 items-center pt-2">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-300">Límite:</label>
                            <input
                                type="number"
                                value={maxResults}
                                onChange={(e) => setMaxResults(parseInt(e.target.value))}
                                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
                                min="10"
                                max="100"
                                disabled={loading}
                            />
                        </div>
                        {(loading || isSearchingRef.current) ? (
                            <button
                                onClick={handleStopSearch}
                                className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 rounded-lg text-white font-semibold transition flex items-center gap-2"
                            >
                                <X className="h-5 w-5" />
                                Detener
                            </button>
                        ) : (
                            <button
                                onClick={handleStartSearch}
                                disabled={loading}
                                className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 rounded-lg text-white font-semibold transition flex items-center gap-2"
                            >
                                <Search className="h-5 w-5" />
                                Iniciar Búsqueda
                            </button>
                        )}

                        {!loading && (
                            <button
                                onClick={() => setShowFilterConfig(!showFilterConfig)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300"
                            >
                                {showFilterConfig ? 'Cerrar' : 'Editar'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Logs Panel */}
            {showLogs && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-60 overflow-y-auto font-mono text-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-orange-400 font-semibold">Logs de Búsqueda</h4>
                        <button
                            onClick={() => {
                                if (!loading) {
                                    setShowLogs(false);
                                    // Clear logs from sessionStorage when closed
                                    sessionStorage.removeItem(`github_logs_${campaignId}`);
                                }
                            }}
                            disabled={loading}
                            className={`text-slate-500 hover:text-slate-400 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={loading ? 'No puedes cerrar logs durante la búsqueda' : 'Cerrar logs'}
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {logs.map((log, idx) => (
                            <div key={idx} className="text-slate-300 py-0.5">{log}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Results Section */}
            {candidates.length > 0 && (
                <div className="space-y-4">
                    {/* Results Header with View Mode Toggle */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">
                            Resultados: {candidates.length} Desarrolladores
                        </h2>
                        <div className="flex items-center gap-3">
                            {/* View Mode Toggle */}
                            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'cards' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    title="Vista de Cards"
                                >
                                    <Grid3x3 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('pipeline')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'pipeline' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    title="Vista Pipeline"
                                >
                                    <List className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('kanban')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    title="Vista Kanban"
                                >
                                    <Columns3 className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Export CSV Button */}
                            {candidates.length > 0 && (
                                <div className="flex items-center gap-2">
                                    {showExportOptions ? (
                                        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1 animate-in slide-in-from-right-4 fade-in duration-200">
                                            <input
                                                type="date"
                                                value={exportDateRange.start}
                                                onChange={(e) => setExportDateRange(prev => ({ ...prev, start: e.target.value }))}
                                                className="bg-transparent text-xs text-white border-0 p-1 focus:ring-0 w-24"
                                            />
                                            <span className="text-slate-500 text-xs">-</span>
                                            <input
                                                type="date"
                                                value={exportDateRange.end}
                                                onChange={(e) => setExportDateRange(prev => ({ ...prev, end: e.target.value }))}
                                                className="bg-transparent text-xs text-white border-0 p-1 focus:ring-0 w-24"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (!exportDateRange.start || !exportDateRange.end) return;
                                                    setShowUserSelection(true);
                                                }}
                                                className="p-1 hover:bg-orange-500/20 rounded text-orange-400"
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
                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition text-sm flex items-center gap-2"
                                            title="Exportar CSV con selección de usuario"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="hidden sm:inline">Exportar CSV</span>
                                            <span className="sm:hidden">CSV</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results Content */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                        {viewMode === 'cards' ? (
                            <div className="p-6">
                                <GitHubCandidatesCards
                                    candidates={candidates}
                                    formatNumber={formatNumber}
                                    getScoreBadgeColor={getScoreBadgeColor}
                                    onAddToCampaign={(candidate) => {
                                        console.log('Add to campaign:', candidate);
                                        // TODO: Implement add to campaign logic
                                    }}
                                />
                            </div>
                        ) : viewMode === 'pipeline' ? (
                            <div className="overflow-x-auto min-h-96">
                                <GitHubCandidatesPipeline
                                    candidates={candidates}
                                    formatNumber={formatNumber}
                                    getScoreBadgeColor={getScoreBadgeColor}
                                    campaignId={campaignId}
                                />
                            </div>
                        ) : (
                            <div className="min-h-96">
                                <GitHubCandidatesKanban
                                    candidates={candidates}
                                    onStatusChange={(username, status) => {
                                        console.log('Status changed:', username, status);
                                        // TODO: Save status to database
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && candidates.length === 0 && criteria && (
                <div className="text-center py-16">
                    <Code2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Sin búsquedas realizadas</p>
                    <p className="text-slate-500 text-sm mt-2">Haz clic en "Iniciar Búsqueda" para encontrar desarrolladores</p>
                </div>
            )}

            {!loading && candidates.length === 0 && !criteria && (
                <div className="text-center py-16">
                    <Trophy className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Configura tus criterios de búsqueda</p>
                    <p className="text-slate-500 text-sm mt-2">Establece filtros para encontrar desarrolladores que se adapten a tus necesidades</p>
                </div>
            )}

            <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />

            <UserSelectionModal
                isOpen={showUserSelection}
                onSelect={(user) => {
                    setSelectedUser(user);
                    setShowUserSelection(false);
                    handleGitHubExport(user);
                }}
                onClose={() => setShowUserSelection(false)}
            />
        </div>
    );
};

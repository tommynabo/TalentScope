import React, { useState, useEffect } from 'react';
import { Search, Star, GitBranch, Users, Code2, Trophy, ExternalLink, Loader, Plus, Link2, List, Columns3, Grid3x3, X, Download } from 'lucide-react';
import { GitHubMetrics, GitHubFilterCriteria } from '../types/database';
import { githubService, GitHubLogCallback } from '../lib/githubService';
import { GitHubFilterConfig } from './GitHubFilterConfig';
import { ApifyCrossSearchService } from '../lib/apifyCrossSearchService';
import { PRESET_PRODUCT_ENGINEERS } from '../lib/githubPresets';
import { GitHubCandidatesCards } from './GitHubCandidatesCards';
import { GitHubCandidatesPipeline } from './GitHubCandidatesPipeline';
import { GitHubCandidatesKanban } from './GitHubCandidatesKanban';
import { GitHubSearchService } from '../lib/githubSearchService';
import { GitHubCandidatePersistence } from '../lib/githubCandidatePersistence';
import { supabase } from '../lib/supabase';

interface GitHubCodeScanProps {
    campaignId?: string;
}

type ViewMode = 'cards' | 'pipeline' | 'kanban';

export const GitHubCodeScan: React.FC<GitHubCodeScanProps> = ({ campaignId }) => {
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

    // Load Product Engineers preset and restore candidates from Supabase
    useEffect(() => {
        setCriteria(PRESET_PRODUCT_ENGINEERS);
        
        // Load previous logs from sessionStorage
        const previousLogs = sessionStorage.getItem(`github_logs_${campaignId}`);
        if (previousLogs) {
            try {
                const parsedLogs = JSON.parse(previousLogs);
                setLogs(parsedLogs);
            } catch (err) {
                console.warn('Failed to restore logs:', err);
            }
        }
        
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
    }, [campaignId]);

    const handleLogMessage: GitHubLogCallback = (message: string) => {
        setLogs(prev => {
            const newLogs = [...prev, message];
            // Persist logs to sessionStorage
            sessionStorage.setItem(`github_logs_${campaignId}`, JSON.stringify(newLogs));
            return newLogs;
        });
    };

    const handleStopSearch = () => {
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

        setLoading(true);
        setIsStoppable(true);
        setLogs([]);
        setShowLogs(true);

        try {
            handleLogMessage('🔄 Loading existing candidates from Supabase...');
            
            // Search with campaign context - persistence happens automatically in githubService
            const results = await githubService.searchDevelopers(
                criteria,
                maxResults,
                handleLogMessage,
                campaignId,  // Pass campaign context
                userId       // Pass user context
            );

            handleLogMessage(`\n🔗 Syncing results...`);

            // Get current candidates from localStorage as source of truth
            const localStorageKey = `github_candidates_${campaignId}`;
            let previousCandidates: GitHubMetrics[] = [];
            
            try {
                const stored = localStorage.getItem(localStorageKey);
                if (stored) {
                    previousCandidates = JSON.parse(stored);
                    handleLogMessage(`📦 Found ${previousCandidates.length} previous candidates in localStorage`);
                }
            } catch (err) {
                console.warn('Failed to load from localStorage');
                handleLogMessage(`⚠️ Could not load previous candidates from storage`);
            }

            // Combine: previous + new, with deduplication by username
            const allCandidates = [...previousCandidates];
            let newCount = 0;
            
            for (const candidate of results) {
                const exists = allCandidates.some(c => c.github_username.toLowerCase() === candidate.github_username.toLowerCase());
                if (!exists) {
                    allCandidates.push(candidate);
                    newCount++;
                }
            }

            handleLogMessage(`✨ Found ${results.length} developers in GitHub search`);
            handleLogMessage(`✅ Added ${newCount} new (${results.length - newCount} were duplicates)`);
            handleLogMessage(`📊 Total accumulated: ${allCandidates.length} developers`);

            // Save all to localStorage
            localStorage.setItem(localStorageKey, JSON.stringify(allCandidates));
            handleLogMessage(`💾 Synced ${allCandidates.length} candidates to localStorage`);

            // Update state with all candidates
            setCandidates([...allCandidates]); // Force new array reference to ensure re-render
            
            if (allCandidates.length > 0) {
                handleLogMessage(`✅ Ready to view ${allCandidates.length} developers`);
            }

        } catch (error: any) {
            handleLogMessage(`❌ Error: ${error.message}`);
            console.error('Search error:', error);
        } finally {
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

            {criteria && !showFilterConfig && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Criterios Configurados</h3>
                            <p className="text-slate-400 text-sm">
                                {criteria.languages.join(', ')} • Score ≥ {criteria.score_threshold} • 
                                {criteria.require_app_store_link ? ' App Store Required' : ' Any App Type'}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <input
                                type="number"
                                value={maxResults}
                                onChange={(e) => setMaxResults(parseInt(e.target.value))}
                                placeholder="Max results"
                                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
                                min="10"
                                max="100"
                                disabled={loading}
                            />
                            {loading ? (
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
                            {candidates.length > 0 && (
                                <button
                                    onClick={handleStartCrossSearch}
                                    disabled={loading}
                                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 rounded-lg text-white font-semibold transition flex items-center gap-2"
                                    title="Link GitHub results with LinkedIn profiles"
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="h-5 w-5 animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            <Link2 className="h-5 w-5" />
                                            Cross-Search
                                        </>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setShowFilterConfig(true)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300"
                            >
                                Editar
                            </button>
                        </div>
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
                            
                            {/* View Full Pipeline Button */}
                            {candidates.length > 0 && (
                                <button
                                    onClick={() => {
                                        // Save current candidates to sessionStorage
                                        sessionStorage.setItem(`github_candidates_${campaignId}`, JSON.stringify(candidates));
                                        // Navigate or show full view here
                                        window.location.hash = `#/github-pipeline/${campaignId}`;
                                    }}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition text-sm flex items-center gap-2"
                                    title="Ver pipeline completo con exportación CSV"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Pipeline Completo</span>
                                    <span className="sm:hidden">Pipeline</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results Content */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-96 text-slate-500">
                                <Loader className="h-6 w-6 animate-spin text-orange-500 mr-2" />
                                Cargando candidatos...
                            </div>
                        ) : viewMode === 'cards' ? (
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
        </div>
    );
};

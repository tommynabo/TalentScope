import React, { useState, useEffect } from 'react';
import { Search, Star, GitBranch, Users, Code2, Trophy, ExternalLink, Loader, Plus, Link2 } from 'lucide-react';
import { GitHubMetrics, GitHubFilterCriteria } from '../types/database';
import { githubService, GitHubLogCallback } from '../lib/githubService';
import { GitHubFilterConfig } from './GitHubFilterConfig';
import { ApifyCrossSearchService } from '../lib/apifyCrossSearchService';
import { PRESET_PRODUCT_ENGINEERS } from '../lib/githubPresets';

interface GitHubCodeScanProps {
    campaignId?: string;
    onCampaignCreated?: (campaign: { id: string; title: string; created_at: string; source: string }) => void;
}

export const GitHubCodeScan: React.FC<GitHubCodeScanProps> = ({ campaignId, onCampaignCreated }) => {
    const [candidates, setCandidates] = useState<GitHubMetrics[]>([]);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showFilterConfig, setShowFilterConfig] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [criteria, setCriteria] = useState<GitHubFilterCriteria | null>(null);
    const [maxResults, setMaxResults] = useState(30);

    // Load Product Engineers preset by default
    useEffect(() => {
        setCriteria(PRESET_PRODUCT_ENGINEERS);
    }, []);

    const handleLogMessage: GitHubLogCallback = (message: string) => {
        setLogs(prev => [...prev, message]);
    };

    const handleStartSearch = async () => {
        if (!criteria) {
            alert('Please configure filter criteria first');
            return;
        }

        setLoading(true);
        setCandidates([]);
        setLogs([]);
        setShowLogs(true);

        try {
            const results = await githubService.searchDevelopers(
                criteria,
                maxResults,
                handleLogMessage
            );

            setCandidates(results);
            handleLogMessage(`✨ Search completed! Found ${results.length} qualified developers`);
            
            // Notify campaign creation
            if (onCampaignCreated) {
                onCampaignCreated({
                    id: `campaign-${Date.now()}`,
                    title: `GitHub Search - ${criteria.languages.join(', ')}`,
                    created_at: new Date().toISOString(),
                    source: 'github'
                });
            }
        } catch (error: any) {
            handleLogMessage(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
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

            // Notify campaign creation
            if (onCampaignCreated) {
                onCampaignCreated({
                    id: `campaign-${Date.now()}`,
                    title: `Cross-Search - ${criteria.languages.join(', ')} (${linkedCount} linked)`,
                    created_at: new Date().toISOString(),
                    source: 'github-linkedin'
                });
            }
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-850 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                            <Code2 className="h-10 w-10 text-cyan-400" />
                            GitHub Code Scan
                        </h1>
                        <p className="text-slate-400 mt-2">Find proven "Builders" with shipped products</p>
                    </div>
                    <button
                        onClick={() => setShowFilterConfig(!showFilterConfig)}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-semibold transition"
                    >
                        {showFilterConfig ? '🔍 Hide Filters' : '⚙️ Show Filters'}
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
                                <h3 className="text-lg font-semibold text-white mb-2">Search Configuration Ready</h3>
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
                                    className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
                                    min="10"
                                    max="100"
                                />
                                <button
                                    onClick={handleStartSearch}
                                    disabled={loading}
                                    className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 rounded-lg text-white font-semibold transition flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="h-5 w-5 animate-spin" />
                                            Searching...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="h-5 w-5" />
                                            Start Search
                                        </>
                                    )}
                                </button>
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
                                    Edit
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Logs Panel */}
                {showLogs && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-60 overflow-y-auto font-mono text-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-cyan-400 font-semibold">Search Logs</h4>
                            <button
                                onClick={() => setShowLogs(false)}
                                className="text-slate-500 hover:text-slate-400"
                            >
                                ✕
                            </button>
                        </div>
                        {logs.map((log, idx) => (
                            <div key={idx} className="text-slate-300 py-0.5">{log}</div>
                        ))}
                    </div>
                )}

                {/* Results Grid */}
                {candidates.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">
                                Results: {candidates.length} Developers Found
                            </h2>
                            <button
                                onClick={() => {
                                    // TODO: Export to campaign or save search
                                    console.log('Export clicked', candidates);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-semibold transition"
                            >
                                <Plus className="h-4 w-4 inline mr-2" />
                                Add to Campaign
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {candidates.map((candidate) => (
                                <CandidateCard
                                    key={candidate.github_username}
                                    candidate={candidate}
                                    scoreColor={getScoreBadgeColor(candidate.github_score)}
                                    formatNumber={formatNumber}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && candidates.length === 0 && criteria && (
                    <div className="text-center py-16">
                        <Code2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">No searches performed yet</p>
                        <p className="text-slate-500 text-sm mt-2">Click "Start Search" to find developers</p>
                    </div>
                )}

                {!loading && candidates.length === 0 && !criteria && (
                    <div className="text-center py-16">
                        <Trophy className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">Configure your search criteria</p>
                        <p className="text-slate-500 text-sm mt-2">Set up filters to find developers that match your needs</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface CandidateCardProps {
    candidate: GitHubMetrics;
    scoreColor: string;
    formatNumber: (num: number) => string;
}

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, scoreColor, formatNumber }) => (
    <a
        href={candidate.github_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group bg-gradient-to-br from-slate-900 to-slate-800/50 border border-slate-700 hover:border-cyan-500 rounded-xl p-6 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
    >
        {/* Header with Score */}
        <div className="flex items-start justify-between mb-4">
            <div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition">
                    @{candidate.github_username}
                </h3>
                {candidate.personal_website && (
                    <a
                        href={candidate.personal_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-xs"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {candidate.personal_website}
                    </a>
                )}
            </div>
            <div className={`px-3 py-1 rounded-lg text-lg font-bold ${scoreColor}`}>
                {candidate.github_score}
            </div>
        </div>

        {/* App Store Badge - THE CRITICAL SIGNAL */}
        {candidate.has_app_store_link && (
            <div className="mb-4 inline-block">
                <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 px-3 py-1 rounded-full text-xs font-semibold text-purple-200 flex items-center gap-2">
                    <Trophy className="h-3 w-3" />
                    App Published ⭐
                </div>
            </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricBadge
                icon={<Star className="h-4 w-4" />}
                label="Stars"
                value={formatNumber(candidate.total_stars_received)}
            />
            <MetricBadge
                icon={<Users className="h-4 w-4" />}
                label="Followers"
                value={formatNumber(candidate.followers)}
            />
            <MetricBadge
                icon={<GitBranch className="h-4 w-4" />}
                label="Originality"
                value={`${Math.round(candidate.originality_ratio)}%`}
            />
            <MetricBadge
                icon={<Code2 className="h-4 w-4" />}
                label="Language"
                value={candidate.most_used_language}
            />
        </div>

        {/* Activity Info */}
        <div className="space-y-2 text-sm">
            <div className="flex justify-between">
                <span className="text-slate-500">Public Repos:</span>
                <span className="text-slate-300 font-semibold">{candidate.public_repos}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-slate-500">Originality:</span>
                <span className="text-slate-300 font-semibold">{candidate.original_repos_count} / {candidate.original_repos_count + candidate.fork_repos_count}</span>
            </div>
            {candidate.last_commit_date && (
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Last Commit:</span>
                    <span className="text-slate-300">
                        {new Date(candidate.last_commit_date).toLocaleDateString()}
                    </span>
                </div>
            )}
            {candidate.mentioned_email && (
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Email:</span>
                    <span className="text-slate-300 truncate">{candidate.mentioned_email}</span>
                </div>
            )}
        </div>

        {/* Score Breakdown */}
        <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-2 font-semibold">Score Breakdown</p>
            <div className="space-y-1">
                <ScoreBar
                    label="Repository"
                    value={candidate.score_breakdown.repository_quality}
                    max={25}
                />
                <ScoreBar
                    label="Activity"
                    value={candidate.score_breakdown.code_activity}
                    max={20}
                />
                <ScoreBar
                    label="Community"
                    value={candidate.score_breakdown.community_presence}
                    max={20}
                />
                <ScoreBar
                    label="App Shipping"
                    value={candidate.score_breakdown.app_shipping}
                    max={20}
                    highlight={candidate.has_app_store_link}
                />
            </div>
        </div>

        {/* View on GitHub Button */}
        <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2 text-cyan-400 group-hover:text-cyan-300">
            <ExternalLink className="h-4 w-4" />
            <span className="text-sm font-semibold">View on GitHub</span>
        </div>
    </a>
);

interface MetricBadgeProps {
    icon: React.ReactNode;
    label: string;
    value: string;
}

const MetricBadge: React.FC<MetricBadgeProps> = ({ icon, label, value }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-center">
        <div className="text-slate-400 text-xs flex items-center justify-center gap-1 mb-1">
            {icon}
            {label}
        </div>
        <div className="text-cyan-400 font-bold text-sm">{value}</div>
    </div>
);

interface ScoreBarProps {
    label: string;
    value: number;
    max: number;
    highlight?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, max, highlight }) => (
    <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-12 truncate">{label}</span>
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all ${
                    highlight ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${(value / max) * 100}%` }}
            />
        </div>
        <span className="text-xs text-slate-400 w-6 text-right">{value}</span>
    </div>
);

import React, { useState, useEffect } from 'react';
import { GitBranch, Star, Users, Code2, TrendingUp, RefreshCw, LinkedinIcon, ExternalLink, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { GitHubMetrics } from '../../types/database';

interface GitHubCampaignDashboardProps {
    campaignId: string;
    campaignTitle: string;
    onClose: () => void;
}

interface CampaignStats {
    totalCandidates: number;
    excellentMatch: number;
    withAppStore: number;
    avgScore: number;
    maxScore: number;
    withEmail: number;
    linkedinEnriched: number;
    crossLinked: number;
    lastScannedAt: string;
}

export const GitHubCampaignDashboard: React.FC<GitHubCampaignDashboardProps> = ({
    campaignId,
    campaignTitle,
    onClose
}) => {
    const [stats, setStats] = useState<CampaignStats | null>(null);
    const [candidates, setCandidates] = useState<GitHubMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'enrichment'>('overview');

    useEffect(() => {
        loadCampaignData();
    }, [campaignId]);

    const loadCampaignData = async () => {
        setLoading(true);
        try {
            // TODO: Cargar datos desde Supabase
            // const { data: stats } = await supabase
            //   .from('github_campaign_stats')
            //   .select('*')
            //   .eq('campaign_id', campaignId)
            //   .single();
            
            setStats({
                totalCandidates: 0,
                excellentMatch: 0,
                withAppStore: 0,
                avgScore: 0,
                maxScore: 0,
                withEmail: 0,
                linkedinEnriched: 0,
                crossLinked: 0,
                lastScannedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error loading campaign data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 w-full max-w-2xl">
                    <div className="flex flex-col items-center gap-4">
                        <Loader className="h-12 w-12 text-cyan-400 animate-spin" />
                        <p className="text-slate-300">Loading campaign data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Code2 className="h-7 w-7 text-cyan-400" />
                            {campaignTitle}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">GitHub Code Scan Campaign Dashboard</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-2xl font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-700 flex">
                    {(['overview', 'candidates', 'enrichment'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-4 font-medium transition border-b-2 ${
                                activeTab === tab
                                    ? 'text-cyan-400 border-cyan-500'
                                    : 'text-slate-400 border-transparent hover:text-slate-300'
                            }`}
                        >
                            {tab === 'overview' && '📊 Overview'}
                            {tab === 'candidates' && '👥 Candidates'}
                            {tab === 'enrichment' && '🔗 LinkedIn Cross-Link'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'overview' && stats && (
                        <OverviewTab stats={stats} onRefresh={loadCampaignData} />
                    )}

                    {activeTab === 'candidates' && (
                        <CandidatesTab campaignId={campaignId} candidates={candidates} />
                    )}

                    {activeTab === 'enrichment' && (
                        <EnrichmentTab campaignId={campaignId} />
                    )}
                </div>
            </div>
        </div>
    );
};

interface OverviewTabProps {
    stats: CampaignStats;
    onRefresh: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ stats, onRefresh }) => (
    <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
                icon={<Users className="h-5 w-5" />}
                label="Total Candidates"
                value={stats.totalCandidates}
                trend={+12}
                color="blue"
            />
            <KPICard
                icon={<Star className="h-5 w-5" />}
                label="Excellent Match (≥80)"
                value={stats.excellentMatch}
                percentage={(stats.excellentMatch / Math.max(stats.totalCandidates, 1)) * 100}
                color="emerald"
            />
            <KPICard
                icon={<GitBranch className="h-5 w-5" />}
                label="App Published"
                value={stats.withAppStore}
                percentage={(stats.withAppStore / Math.max(stats.totalCandidates, 1)) * 100}
                color="purple"
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Average Score"
                value={`${Math.round(stats.avgScore)}/100`}
                color="cyan"
            />
            <KPICard
                icon={<LinkedinIcon className="h-5 w-5" />}
                label="LinkedIn Enriched"
                value={stats.linkedinEnriched}
                percentage={(stats.linkedinEnriched / Math.max(stats.totalCandidates, 1)) * 100}
                color="blue"
            />
            <KPICard
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Cross-Linked"
                value={stats.crossLinked}
                percentage={(stats.crossLinked / Math.max(stats.linkedinEnriched, 1)) * 100}
                color="emerald"
            />
        </div>

        {/* Chart Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScoreDistributionChart stats={stats} />
            <SourceBreakdownChart />
        </div>

        {/* Last Updated */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-400">
                    Last scanned: {new Date(stats.lastScannedAt).toLocaleString()}
                </span>
            </div>
            <button
                onClick={() => location.reload()}
                className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/50 text-cyan-400 text-sm rounded-lg transition"
            >
                Refresh
            </button>
        </div>
    </div>
);

interface CandidatesTabProps {
    campaignId: string;
    candidates: GitHubMetrics[];
}

const CandidatesTab: React.FC<CandidatesTabProps> = ({ campaignId, candidates }) => (
    <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">GitHub Candidates</h3>
            <div className="flex gap-2">
                <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">
                    <option>All Scores</option>
                    <option>Score ≥80</option>
                    <option>Score ≥70</option>
                    <option>With App Store</option>
                </select>
            </div>
        </div>

        {candidates.length === 0 ? (
            <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No candidates loaded yet</p>
            </div>
        ) : (
            <div className="space-y-3">
                {candidates.slice(0, 10).map((candidate) => (
                    <CandidateRow key={candidate.github_username} candidate={candidate} />
                ))}
            </div>
        )}
    </div>
);

interface EnrichmentTabProps {
    campaignId: string;
}

const EnrichmentTab: React.FC<EnrichmentTabProps> = ({ campaignId }) => (
    <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-500/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <LinkedinIcon className="h-5 w-5 text-blue-400" />
                GitHub ↔ LinkedIn Cross-Link
            </h3>
            <p className="text-slate-400 text-sm">
                Automatically match GitHub profiles with LinkedIn profiles using name, email, and username signals.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EnrichmentCard
                icon={<GitBranch className="h-5 w-5" />}
                title="GitHub → LinkedIn"
                description="Find LinkedIn profiles from GitHub username"
                status="active"
                metrics={{ matched: 142, pending: 58, failed: 8 }}
            />
            <EnrichmentCard
                icon={<LinkedinIcon className="h-5 w-5" />}
                title="LinkedIn → GitHub"
                description="Find GitHub repos mentioned in LinkedIn profiles"
                status="active"
                metrics={{ matched: 156, pending: 52, failed: 12 }}
            />
        </div>

        {/* Enrichment Data Sample */}
        <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-800/50 border-b border-slate-700">
                        <th className="px-4 py-3 text-left text-slate-300">GitHub</th>
                        <th className="px-4 py-3 text-left text-slate-300">LinkedIn</th>
                        <th className="px-4 py-3 text-left text-slate-300">Match Score</th>
                        <th className="px-4 py-3 text-left text-slate-300">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {[...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-slate-700 hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-300">@developer_{i}</td>
                            <td className="px-4 py-3 text-blue-400">Developer {i}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-slate-700 rounded h-2">
                                        <div className="bg-emerald-500 h-2 rounded" style={{ width: `${85 + Math.random() * 15}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400">{90 + i}%</span>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">✓ Linked</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

interface KPICardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    trend?: number;
    percentage?: number;
    color: 'blue' | 'emerald' | 'purple' | 'cyan';
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, trend, percentage, color }) => {
    const colorClasses = {
        blue: 'from-blue-900/30 to-blue-800/30 border-blue-600/50 text-blue-400',
        emerald: 'from-emerald-900/30 to-emerald-800/30 border-emerald-600/50 text-emerald-400',
        purple: 'from-purple-900/30 to-purple-800/30 border-purple-600/50 text-purple-400',
        cyan: 'from-cyan-900/30 to-cyan-800/30 border-cyan-600/50 text-cyan-400'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-400 text-sm mb-1">{label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    {percentage !== undefined && (
                        <p className="text-xs text-slate-400 mt-1">{percentage.toFixed(1)}% of total</p>
                    )}
                    {trend !== undefined && (
                        <p className={`text-xs mt-1 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trend > 0 ? '+' : ''}{trend}% vs last week
                        </p>
                    )}
                </div>
                <div className="text-2xl opacity-50">{icon}</div>
            </div>
        </div>
    );
};

interface CandidateRowProps {
    candidate: GitHubMetrics;
}

const CandidateRow: React.FC<CandidateRowProps> = ({ candidate }) => (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:border-cyan-500/50 transition">
        <div className="flex items-center gap-4 flex-1">
            <div>
                <a
                    href={candidate.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-2"
                >
                    @{candidate.github_username}
                    <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-sm text-slate-400 mt-1">
                    {candidate.followers} followers • {candidate.total_stars_received} stars
                </p>
            </div>
        </div>

        <div className="flex items-center gap-4">
            {candidate.has_app_store_link && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">⭐ App Published</span>
            )}

            <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{candidate.github_score}</p>
                <p className="text-xs text-slate-400">/100</p>
            </div>

            <button className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-400 text-xs rounded-lg transition">
                Link LinkedIn
            </button>
        </div>
    </div>
);

interface ScoreDistributionChartProps {
    stats: CampaignStats;
}

const ScoreDistributionChart: React.FC<ScoreDistributionChartProps> = ({ stats }) => (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-4">Score Distribution</h4>
        <div className="space-y-3">
            {[
                { range: '80-100', count: stats.excellentMatch, color: 'bg-emerald-500' },
                { range: '60-79', count: Math.floor(stats.totalCandidates * 0.4), color: 'bg-cyan-500' },
                { range: '40-59', count: Math.floor(stats.totalCandidates * 0.3), color: 'bg-yellow-500' },
                { range: '<40', count: Math.floor(stats.totalCandidates * 0.1), color: 'bg-red-500' }
            ].map(({ range, count, color }) => (
                <div key={range}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{range}</span>
                        <span className="text-xs font-semibold text-slate-300">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`${color} h-full`}
                            style={{
                                width: `${(count / Math.max(stats.totalCandidates, 1)) * 100}%`
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const SourceBreakdownChart: React.FC = () => (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-4">Data Sources</h4>
        <div className="space-y-3">
            {[
                { label: 'GitHub Only', value: 45, color: 'bg-slate-400' },
                { label: 'LinkedIn Linked', value: 142, color: 'bg-blue-500' },
                { label: 'Full Enriched', value: 98, color: 'bg-emerald-500' }
            ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-xs text-slate-300">{label}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{value}</span>
                </div>
            ))}
        </div>
    </div>
);

interface EnrichmentCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    status: 'active' | 'paused' | 'error';
    metrics: { matched: number; pending: number; failed: number };
}

const EnrichmentCard: React.FC<EnrichmentCardProps> = ({ icon, title, description, status, metrics }) => (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
                {icon}
                <div>
                    <h4 className="font-semibold text-white text-sm">{title}</h4>
                    <p className="text-xs text-slate-400">{description}</p>
                </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : ''
            }`}>
                {status === 'active' ? '✓ Active' : status}
            </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-emerald-500/20 rounded p-2">
                <p className="text-emerald-400 font-semibold">{metrics.matched}</p>
                <p className="text-slate-400">Matched</p>
            </div>
            <div className="bg-yellow-500/20 rounded p-2">
                <p className="text-yellow-400 font-semibold">{metrics.pending}</p>
                <p className="text-slate-400">Pending</p>
            </div>
            <div className="bg-red-500/20 rounded p-2">
                <p className="text-red-400 font-semibold">{metrics.failed}</p>
                <p className="text-slate-400">Failed</p>
            </div>
        </div>
    </div>
);

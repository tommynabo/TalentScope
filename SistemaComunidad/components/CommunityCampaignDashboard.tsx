import React, { useState, useEffect } from 'react';
import { Users, Star, TrendingUp, Mail, Linkedin, Github, RefreshCw } from 'lucide-react';
import { CommunityCandidate, CommunityCampaign, CommunityPlatform } from '../types/community';
import { CommunityCandidatesPipeline } from './CommunityCandidatesPipeline';

interface CommunityCampaignDashboardProps {
    campaignId: string;
    campaignTitle: string;
    candidates: CommunityCandidate[];
    onRefresh?: () => void;
}

interface CampaignStats {
    totalCandidates: number;
    excellentMatch: number;
    withEmail: number;
    withLinkedIn: number;
    withGitHub: number;
    avgScore: number;
    maxScore: number;
    platformBreakdown: Record<string, number>;
}

function computeStats(candidates: CommunityCandidate[]): CampaignStats {
    const total = candidates.length;
    if (total === 0) {
        return { totalCandidates: 0, excellentMatch: 0, withEmail: 0, withLinkedIn: 0, withGitHub: 0, avgScore: 0, maxScore: 0, platformBreakdown: {} };
    }

    const scores = candidates.map(c => c.talentScore || 0);
    const platformBreakdown: Record<string, number> = {};
    candidates.forEach(c => {
        platformBreakdown[c.platform] = (platformBreakdown[c.platform] || 0) + 1;
    });

    return {
        totalCandidates: total,
        excellentMatch: candidates.filter(c => c.talentScore >= 80).length,
        withEmail: candidates.filter(c => !!c.email).length,
        withLinkedIn: candidates.filter(c => !!c.linkedInUrl).length,
        withGitHub: candidates.filter(c => !!c.githubUrl || !!c.githubUsername).length,
        avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / total),
        maxScore: Math.max(...scores),
        platformBreakdown,
    };
}

const PLATFORM_COLORS: Record<string, string> = {
    [CommunityPlatform.Discord]: 'bg-indigo-500',
    [CommunityPlatform.Reddit]: 'bg-orange-500',
    [CommunityPlatform.Skool]: 'bg-emerald-500',
    [CommunityPlatform.GitHubDiscussions]: 'bg-purple-500',
};

export const CommunityCampaignDashboard: React.FC<CommunityCampaignDashboardProps> = ({
    campaignId,
    campaignTitle,
    candidates,
    onRefresh,
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'enrichment'>('overview');
    const stats = computeStats(candidates);

    const tabs = [
        { key: 'overview', label: 'Resumen', icon: TrendingUp },
        { key: 'pipeline', label: `Candidatos (${candidates.length})`, icon: Users },
        { key: 'enrichment', label: 'Enriquecimiento', icon: Mail },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">{campaignTitle}</h2>
                    <p className="text-sm text-slate-400">Dashboard de campaña · {stats.totalCandidates} miembros encontrados</p>
                </div>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        title="Actualizar datos"
                    >
                        <RefreshCw className="h-4 w-4 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                            ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <OverviewTab stats={stats} />
            )}

            {activeTab === 'pipeline' && (
                <CommunityCandidatesPipeline
                    candidates={candidates}
                    campaignId={campaignId}
                />
            )}

            {activeTab === 'enrichment' && (
                <EnrichmentTab stats={stats} />
            )}
        </div>
    );
};

// ─── Overview Tab ────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: CampaignStats }> = ({ stats }) => {
    const kpiCards = [
        { icon: Users, label: 'Total Descubiertos', value: stats.totalCandidates, color: 'violet' as const },
        { icon: Star, label: 'Excelentes (≥80)', value: stats.excellentMatch, color: 'emerald' as const },
        { icon: Mail, label: 'Con Email', value: stats.withEmail, color: 'cyan' as const },
        { icon: TrendingUp, label: 'Score Promedio', value: stats.avgScore, color: 'amber' as const },
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((kpi, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg bg-${kpi.color}-600/15`}>
                                <kpi.icon className={`h-5 w-5 text-${kpi.color}-400`} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-white font-mono">{kpi.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
                    </div>
                ))}
            </div>

            {/* Platform Breakdown */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Distribución por Plataforma</h3>
                <div className="space-y-3">
                    {Object.entries(stats.platformBreakdown).map(([platform, count]) => {
                        const countNum = Number(count);
                        const percentage = stats.totalCandidates > 0
                            ? Math.round((countNum / stats.totalCandidates) * 100)
                            : 0;

                        return (
                            <div key={platform} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-300">{platform}</span>
                                    <span className="text-slate-400">{countNum} ({percentage}%)</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${PLATFORM_COLORS[platform] || 'bg-violet-500'}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(stats.platformBreakdown).length === 0 && (
                        <p className="text-sm text-slate-500">Sin datos aún</p>
                    )}
                </div>
            </div>

            {/* Cross-Linking Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
                    <Github className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                    <p className="text-xl font-bold text-white">{stats.withGitHub}</p>
                    <p className="text-xs text-slate-500">GitHub vinculado</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
                    <Linkedin className="h-6 w-6 mx-auto mb-2 text-blue-400" />
                    <p className="text-xl font-bold text-white">{stats.withLinkedIn}</p>
                    <p className="text-xs text-slate-500">LinkedIn vinculado</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
                    <Mail className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
                    <p className="text-xl font-bold text-white">{stats.withEmail}</p>
                    <p className="text-xs text-slate-500">Email encontrado</p>
                </div>
            </div>
        </div>
    );
};

// ─── Enrichment Tab ──────────────────────────────────────────────────────────

const EnrichmentTab: React.FC<{ stats: CampaignStats }> = ({ stats }) => {
    const enrichmentCards = [
        {
            title: 'GitHub Cross-Link',
            description: 'Vincular usernames de comunidad con perfiles de GitHub',
            icon: Github,
            status: 'ready' as const,
            found: stats.withGitHub,
            pending: stats.totalCandidates - stats.withGitHub,
        },
        {
            title: 'LinkedIn Discovery',
            description: 'Encontrar perfiles de LinkedIn usando Clay/Apify',
            icon: Linkedin,
            status: 'ready' as const,
            found: stats.withLinkedIn,
            pending: stats.totalCandidates - stats.withLinkedIn,
        },
        {
            title: 'Email Finder',
            description: 'Descubrir emails profesionales de los candidatos',
            icon: Mail,
            status: 'ready' as const,
            found: stats.withEmail,
            pending: stats.totalCandidates - stats.withEmail,
        },
    ];

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-400">
                Enriquecimiento de perfiles: cruza datos de comunidades con GitHub, LinkedIn y email para contactar candidatos.
            </p>

            {enrichmentCards.map((card, i) => (
                <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800 rounded-lg">
                                <card.icon className="h-5 w-5 text-slate-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-white">{card.title}</h4>
                                <p className="text-xs text-slate-500">{card.description}</p>
                            </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Ready
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-slate-950/40 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-emerald-400">{card.found}</p>
                            <p className="text-[10px] text-slate-500">Encontrados</p>
                        </div>
                        <div className="bg-slate-950/40 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-slate-400">{card.pending}</p>
                            <p className="text-[10px] text-slate-500">Pendientes</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

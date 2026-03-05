import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, Sparkles, ArrowRight, Clock, Star, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CommunityCampaign, CommunityFilterCriteria, CommunityPlatform } from '../types/community';
import { CommunityCreateCampaignModal } from './CommunityCreateCampaignModal';

const CAMPAIGNS_KEY = 'community_campaigns_v1';

const PLATFORM_ICONS: Record<string, string> = {
    [CommunityPlatform.Discord]: '🎮',
    [CommunityPlatform.Reddit]: '🔴',
    [CommunityPlatform.Skool]: '🎓',
    [CommunityPlatform.GitHubDiscussions]: '💻',
};

export const CommunityCampaignList: React.FC = () => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<CommunityCampaign[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Load campaigns from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(CAMPAIGNS_KEY);
            if (stored) setCampaigns(JSON.parse(stored));
        } catch {
            setCampaigns([]);
        }
    }, []);

    // Save campaigns to localStorage
    const saveCampaigns = (updated: CommunityCampaign[]) => {
        setCampaigns(updated);
        localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(updated));
    };

    const handleCreate = (name: string, criteria: CommunityFilterCriteria) => {
        const newCampaign: CommunityCampaign = {
            id: crypto.randomUUID(),
            name,
            platforms: criteria.platforms,
            status: 'active',
            createdAt: new Date().toISOString(),
            searchCriteria: criteria,
            candidates: [],
            stats: {
                total: 0,
                excellentMatch: 0,
                goodMatch: 0,
                withEmail: 0,
                withLinkedIn: 0,
                withGitHub: 0,
                avgScore: 0,
                maxScore: 0,
            },
        };

        saveCampaigns([newCampaign, ...campaigns]);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('¿Eliminar esta campaña?')) {
            saveCampaigns(campaigns.filter(c => c.id !== id));
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    };

    return (
        <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-violet-600/20 rounded-xl border border-violet-500/20">
                            <Users className="h-6 w-6 text-violet-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white">Community Infiltrator</h1>
                    </div>
                    <p className="text-slate-400">
                        Detecta A-Players en sus ecosistemas naturales: Discord, Skool, Reddit
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-white font-bold transition-all shadow-lg shadow-violet-900/30 active:scale-95"
                >
                    <Plus className="h-5 w-5" />
                    Nueva Campaña
                </button>
            </div>

            {/* Campaign Grid */}
            {campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-6 bg-violet-600/10 rounded-3xl mb-6 border border-violet-500/20">
                        <Sparkles className="h-16 w-16 text-violet-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Sin campañas activas</h3>
                    <p className="text-slate-400 mb-6 max-w-md">
                        Crea tu primera campaña para empezar a buscar talento en comunidades técnicas.
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-bold transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                        Crear Primera Campaña
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map(campaign => (
                        <div
                            key={campaign.id}
                            onClick={() => navigate(`/comunidades/${campaign.id}`)}
                            className="group relative bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6 cursor-pointer hover:border-violet-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] transition-all duration-300 overflow-hidden"
                        >
                            {/* Status Badge */}
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <button
                                    onClick={(e) => handleDelete(e, campaign.id)}
                                    className="p-1.5 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-400" />
                                </button>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${campaign.status === 'active'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : campaign.status === 'paused'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : 'bg-slate-600/20 text-slate-400 border border-slate-600/30'
                                    }`}>
                                    {campaign.status === 'active' ? '● Active' : campaign.status === 'paused' ? '⏸ Paused' : '✓ Done'}
                                </span>
                            </div>

                            {/* Platform Icons */}
                            <div className="flex gap-2 mb-4">
                                {campaign.platforms.map(p => (
                                    <span key={p} className="text-2xl" title={p}>{PLATFORM_ICONS[p] || '📋'}</span>
                                ))}
                            </div>

                            {/* Campaign Info */}
                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-violet-200 transition-colors line-clamp-1">
                                {campaign.name}
                            </h3>
                            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(campaign.createdAt)}
                            </p>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-3 mb-5 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white font-mono">{campaign.stats.total}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">Found</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-emerald-400 font-mono">{campaign.stats.excellentMatch}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">Quality</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-cyan-400 font-mono">{campaign.stats.avgScore}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">Avg Score</p>
                                </div>
                            </div>

                            {/* Keywords Preview */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {(campaign.searchCriteria.keywords || []).slice(0, 4).map(kw => (
                                    <span key={kw} className="px-2 py-0.5 bg-violet-600/15 border border-violet-500/20 rounded-full text-[10px] text-violet-300 font-medium">
                                        {kw}
                                    </span>
                                ))}
                                {(campaign.searchCriteria.keywords || []).length > 4 && (
                                    <span className="px-2 py-0.5 text-[10px] text-slate-500">
                                        +{campaign.searchCriteria.keywords.length - 4}
                                    </span>
                                )}
                            </div>

                            {/* Open Button */}
                            <button className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 font-medium transition-all group-hover:bg-violet-600/20 group-hover:border-violet-500/30 group-hover:text-violet-300">
                                Abrir Campaña <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <CommunityCreateCampaignModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Linkedin, Github, Globe, Users, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { CampaignService } from '../lib/services';
import { GitHubCampaignService } from '../lib/githubCampaignService';
import { Campaign } from '../types/database';
import { GitHubCampaign } from '../lib/githubCampaignService';

// ─── Normalized campaign for display ────────────────────────────────────────

interface UnifiedCampaign {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    system: 'LinkedIn' | 'GitHub' | 'Marketplace' | 'Comunidad';
    targetRole?: string;
    candidateCount?: number;
    navigateTo: string;
}

// ─── System badge config ────────────────────────────────────────────────────

const SYSTEM_CONFIG = {
    LinkedIn: {
        icon: <Linkedin className="h-4 w-4" />,
        color: 'text-blue-400 bg-blue-600/15 border-blue-500/25',
        glow: 'hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.12)]',
        dot: 'bg-blue-400',
        createPath: '/tablero/linkedin',
    },
    GitHub: {
        icon: <Github className="h-4 w-4" />,
        color: 'text-orange-400 bg-orange-600/15 border-orange-500/25',
        glow: 'hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.12)]',
        dot: 'bg-orange-400',
        createPath: '/tablero/github',
    },
    Marketplace: {
        icon: <Globe className="h-4 w-4" />,
        color: 'text-emerald-400 bg-emerald-600/15 border-emerald-500/25',
        glow: 'hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(52,211,153,0.12)]',
        dot: 'bg-emerald-400',
        createPath: '/marketplace-raid',
    },
    Comunidad: {
        icon: <Users className="h-4 w-4" />,
        color: 'text-violet-400 bg-violet-600/15 border-violet-500/25',
        glow: 'hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.12)]',
        dot: 'bg-violet-400',
        createPath: '/comunidades',
    },
};

function statusBadge(status: string) {
    const s = status?.toLowerCase();
    if (s === 'running' || s === 'active') {
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50';
    }
    if (s === 'paused') {
        return 'bg-amber-950/40 text-amber-400 border-amber-900/50';
    }
    return 'bg-slate-800 text-slate-400 border-slate-700';
}

function statusLabel(status: string) {
    const s = status?.toLowerCase();
    if (s === 'running' || s === 'active') return 'Activa';
    if (s === 'paused') return 'Pausada';
    if (s === 'completed') return 'Completada';
    if (s === 'draft') return 'Borrador';
    return status;
}

// ─── Component ───────────────────────────────────────────────────────────────

const AllCampaignsView: React.FC = () => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<UnifiedCampaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAllCampaigns();
    }, []);

    const loadAllCampaigns = async () => {
        setLoading(true);
        const unified: UnifiedCampaign[] = [];

        // ── 1. LinkedIn campaigns (Supabase: campaigns table) ──────────────
        try {
            const linkedinCampaigns: Campaign[] = await CampaignService.getAll();
            for (const c of linkedinCampaigns) {
                unified.push({
                    id: c.id,
                    name: c.title || 'Sin nombre',
                    status: c.status || 'Draft',
                    createdAt: c.created_at,
                    system: 'LinkedIn',
                    targetRole: c.target_role,
                    navigateTo: `/tablero/linkedin/${c.id}`,
                });
            }
        } catch (e) {
            console.warn('[AllCampaigns] LinkedIn fetch failed:', e);
        }

        // ── 2. GitHub campaigns (Supabase: campaigns_github table) ────────
        try {
            const githubCampaigns: GitHubCampaign[] = await GitHubCampaignService.getAll();
            for (const c of githubCampaigns) {
                unified.push({
                    id: c.id,
                    name: c.title || 'Sin nombre',
                    status: c.status || 'Draft',
                    createdAt: c.created_at,
                    system: 'GitHub',
                    targetRole: c.target_role,
                    navigateTo: `/tablero/github/${c.id}`,
                });
            }
        } catch (e) {
            console.warn('[AllCampaigns] GitHub fetch failed:', e);
        }

        // ── 3. Marketplace campaigns (localStorage) ────────────────────────
        try {
            const stored = localStorage.getItem('marketplace_campaigns_v1');
            if (stored) {
                const mkCampaigns = JSON.parse(stored) as any[];
                for (const c of mkCampaigns) {
                    unified.push({
                        id: c.id,
                        name: c.name || 'Sin nombre',
                        status: c.status || 'active',
                        createdAt: c.createdAt,
                        system: 'Marketplace',
                        candidateCount: c.candidates?.length ?? 0,
                        navigateTo: `/marketplace-raid/${c.id}`,
                    });
                }
            }
        } catch (e) {
            console.warn('[AllCampaigns] Marketplace localStorage failed:', e);
        }

        // ── 4. Community campaigns (localStorage) ──────────────────────────
        try {
            const stored = localStorage.getItem('community_campaigns_v1');
            if (stored) {
                const commCampaigns = JSON.parse(stored) as any[];
                for (const c of commCampaigns) {
                    unified.push({
                        id: c.id,
                        name: c.name || 'Sin nombre',
                        status: c.status || 'active',
                        createdAt: c.createdAt,
                        system: 'Comunidad',
                        candidateCount: c.candidates?.length ?? 0,
                        navigateTo: `/comunidades/${c.id}`,
                    });
                }
            }
        } catch (e) {
            console.warn('[AllCampaigns] Community localStorage failed:', e);
        }

        // Sort by createdAt descending
        unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setCampaigns(unified);
        setLoading(false);
    };

    // Group active vs completed
    const activeCampaigns = campaigns.filter(c => {
        const s = c.status.toLowerCase();
        return s === 'running' || s === 'active' || s === 'draft';
    });
    const completedCampaigns = campaigns.filter(c => {
        const s = c.status.toLowerCase();
        return s === 'completed' || s === 'paused';
    });

    // Count per system
    const countBySystem = (system: UnifiedCampaign['system']) =>
        campaigns.filter(c => c.system === system).length;

    return (
        <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Tablero</h1>
                    <p className="text-slate-400 text-sm">Todas las campañas activas · Todos los sistemas</p>
                </div>

                {/* System Overview Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    {(['LinkedIn', 'GitHub', 'Marketplace', 'Comunidad'] as const).map(sys => (
                        <button
                            key={sys}
                            onClick={() => navigate(SYSTEM_CONFIG[sys].createPath)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:opacity-90 ${SYSTEM_CONFIG[sys].color}`}
                        >
                            {SYSTEM_CONFIG[sys].icon}
                            {sys}
                            <span className="ml-1 opacity-70">{countBySystem(sys)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cargando campañas...</span>
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-24 text-slate-500">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="font-semibold text-slate-300 mb-1">No hay campañas todavía</p>
                    <p className="text-sm">Crea una desde cualquier sistema en el Dashboard</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* ── Active campaigns ── */}
                    {activeCampaigns.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Campañas Activas</h2>
                                <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">{activeCampaigns.length}</span>
                                <div className="flex-1 border-t border-slate-800/50" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {activeCampaigns.map(c => (
                                    <CampaignCard key={`${c.system}-${c.id}`} campaign={c} onClick={() => navigate(c.navigateTo)} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── Completed / Paused campaigns ── */}
                    {completedCampaigns.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Completadas / Pausadas</h2>
                                <span className="text-xs bg-slate-800 text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">{completedCampaigns.length}</span>
                                <div className="flex-1 border-t border-slate-800/30" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {completedCampaigns.map(c => (
                                    <CampaignCard key={`${c.system}-${c.id}`} campaign={c} onClick={() => navigate(c.navigateTo)} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── Quick create row ── */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Nueva Campaña</h2>
                            <div className="flex-1 border-t border-slate-800/30" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(['LinkedIn', 'GitHub', 'Marketplace', 'Comunidad'] as const).map(sys => (
                                <button
                                    key={sys}
                                    onClick={() => navigate(SYSTEM_CONFIG[sys].createPath)}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${SYSTEM_CONFIG[sys].color} ${SYSTEM_CONFIG[sys].glow}`}
                                >
                                    <Plus className="h-4 w-4" />
                                    {sys}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

// ─── Campaign Card ───────────────────────────────────────────────────────────

interface CampaignCardProps {
    campaign: UnifiedCampaign;
    onClick: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onClick }) => {
    const cfg = SYSTEM_CONFIG[campaign.system];

    return (
        <div
            onClick={onClick}
            className={`group relative bg-slate-900/50 border border-slate-800 rounded-2xl p-5 cursor-pointer transition-all duration-200 ${cfg.glow}`}
        >
            {/* System badge */}
            <div className="flex items-center justify-between mb-4">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                    {cfg.icon}
                    {campaign.system}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(campaign.status)}`}>
                    {statusLabel(campaign.status)}
                </span>
            </div>

            {/* Campaign name */}
            <h3 className="text-base font-bold text-white mb-1 group-hover:text-cyan-100 transition-colors line-clamp-2">
                {campaign.name}
            </h3>
            {campaign.targetRole && (
                <p className="text-xs text-slate-500 mb-3">{campaign.targetRole}</p>
            )}
            {campaign.candidateCount !== undefined && (
                <p className="text-xs text-slate-500 mb-3">{campaign.candidateCount} candidatos</p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
                <span className="text-xs text-slate-600">
                    {new Date(campaign.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
            </div>
        </div>
    );
};

export default AllCampaignsView;

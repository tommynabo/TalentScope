import React, { useState } from 'react';
import { CommunityCandidate, CommunityPlatform } from '../types/community';
import { ExternalLink, Mail, Github, Linkedin, ChevronDown, ChevronUp, Globe, MessageSquare, Star, Code2 } from 'lucide-react';

interface CommunityCandidatesPipelineProps {
    candidates: CommunityCandidate[];
    campaignId?: string;
}

type SortField = 'talentScore' | 'messageCount' | 'helpfulnessScore' | 'questionsAnswered' | 'scrapedAt';
type SortDir = 'asc' | 'desc';

const PLATFORM_ICONS: Record<string, string> = {
    [CommunityPlatform.Discord]: '🎮',
    [CommunityPlatform.Reddit]: '🔴',
    [CommunityPlatform.Skool]: '🎓',
    [CommunityPlatform.GitHubDiscussions]: '💻',
};

function getTimeGroupLabel(dateKey: string): string {
    const date = new Date(dateKey);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '🟢 Hoy';
    if (diffDays === 1) return '🔵 Ayer';
    if (diffDays <= 7) return `📅 Hace ${diffDays} días`;
    if (diffDays <= 30) return `📅 Hace ${Math.floor(diffDays / 7)} semanas`;
    return `📅 ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
}

function toDateKey(dateString: string): string {
    try {
        return new Date(dateString).toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
}

function getScoreBadgeColor(score: number): string {
    if (score >= 80) return 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30';
    if (score >= 40) return 'bg-amber-600/20 text-amber-400 border-amber-500/30';
    return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
}

export const CommunityCandidatesPipeline: React.FC<CommunityCandidatesPipelineProps> = ({
    candidates,
    campaignId,
}) => {
    const [sortField, setSortField] = useState<SortField>('talentScore');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Sort candidates
    const sorted = [...candidates].sort((a, b) => {
        const aVal = (a as any)[sortField] || 0;
        const bVal = (b as any)[sortField] || 0;
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Group by date
    const grouped: Record<string, CommunityCandidate[]> = {};
    for (const c of sorted) {
        const key = toDateKey(c.scrapedAt);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
    }

    const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    const SortButton = ({ field, label }: { field: SortField; label: string }) => (
        <button
            onClick={() => toggleSort(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortField === field
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
        >
            {label}
            {sortField === field && (
                sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
            )}
        </button>
    );

    if (candidates.length === 0) {
        return (
            <div className="text-center py-16 text-slate-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay candidatos aún</p>
                <p className="text-sm mt-1">Inicia un scan para descubrir talento en comunidades</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Sort Controls */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 mr-1">Ordenar:</span>
                <SortButton field="talentScore" label="Score" />
                <SortButton field="messageCount" label="Mensajes" />
                <SortButton field="helpfulnessScore" label="Helpfulness" />
                <SortButton field="questionsAnswered" label="Q&A" />
                <SortButton field="scrapedAt" label="Fecha" />
                <span className="ml-auto text-xs text-slate-500">
                    {candidates.length} candidato{candidates.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Grouped Candidate Cards */}
            {dateKeys.map(dateKey => (
                <div key={dateKey}>
                    <div className="flex items-center gap-3 mb-3 mt-4">
                        <h3 className="text-sm font-semibold text-slate-300">{getTimeGroupLabel(dateKey)}</h3>
                        <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
                            {grouped[dateKey].length}
                        </span>
                        <div className="flex-1 border-t border-slate-800/50" />
                    </div>

                    <div className="space-y-2">
                        {grouped[dateKey].map(candidate => {
                            const isExpanded = expandedIds.has(candidate.id || candidate.username);

                            return (
                                <div
                                    key={candidate.id || `${candidate.platform}:${candidate.username}`}
                                    className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
                                >
                                    {/* Main Row */}
                                    <div
                                        onClick={() => toggleExpand(candidate.id || candidate.username)}
                                        className="flex items-center gap-4 p-4 cursor-pointer"
                                    >
                                        {/* Avatar / Platform */}
                                        <div className="relative">
                                            {candidate.avatarUrl ? (
                                                <img src={candidate.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-slate-700" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-lg">
                                                    {PLATFORM_ICONS[candidate.platform] || '👤'}
                                                </div>
                                            )}
                                            <span className="absolute -bottom-1 -right-1 text-xs" title={candidate.platform}>
                                                {PLATFORM_ICONS[candidate.platform]}
                                            </span>
                                        </div>

                                        {/* Name + Username */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">
                                                {candidate.displayName || candidate.username}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                @{candidate.username} · {candidate.communityName || candidate.platform}
                                            </p>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
                                            <span className="flex items-center gap-1" title="Mensajes">
                                                <MessageSquare className="h-3 w-3" />
                                                {candidate.messageCount}
                                            </span>
                                            <span className="flex items-center gap-1" title="Q&A respondidas">
                                                <Star className="h-3 w-3" />
                                                {candidate.questionsAnswered}
                                            </span>
                                            <span className="flex items-center gap-1" title="Proyectos">
                                                <Code2 className="h-3 w-3" />
                                                {(candidate.projectLinks?.length || 0) + (candidate.repoLinks?.length || 0)}
                                            </span>
                                        </div>

                                        {/* Score Badge */}
                                        <div className={`px-3 py-1 rounded-lg border text-xs font-bold ${getScoreBadgeColor(candidate.talentScore)}`}>
                                            {candidate.talentScore}
                                        </div>

                                        {/* Contact Icons */}
                                        <div className="flex items-center gap-1.5">
                                            {candidate.email && (
                                                <span className="p-1 bg-emerald-600/15 rounded" title={candidate.email}>
                                                    <Mail className="h-3 w-3 text-emerald-400" />
                                                </span>
                                            )}
                                            {candidate.githubUrl && (
                                                <a href={candidate.githubUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                                    className="p-1 bg-slate-700/50 rounded hover:bg-slate-700">
                                                    <Github className="h-3 w-3 text-slate-400" />
                                                </a>
                                            )}
                                            {candidate.linkedInUrl && (
                                                <a href={candidate.linkedInUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                                    className="p-1 bg-blue-600/15 rounded hover:bg-blue-600/30">
                                                    <Linkedin className="h-3 w-3 text-blue-400" />
                                                </a>
                                            )}
                                        </div>

                                        {/* Expand Icon */}
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                                    </div>

                                    {/* Expanded Section */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 border-t border-slate-800/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            {/* Bio */}
                                            {candidate.bio && (
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Bio</p>
                                                    <p className="text-sm text-slate-300 leading-relaxed">{candidate.bio}</p>
                                                </div>
                                            )}

                                            {/* Skills */}
                                            {candidate.skills?.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Skills</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {candidate.skills.map(s => (
                                                            <span key={s} className="px-2 py-0.5 bg-violet-600/15 border border-violet-500/20 rounded-full text-[10px] text-violet-300">
                                                                {s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Project Links */}
                                            {(candidate.projectLinks?.length > 0 || candidate.repoLinks?.length > 0) && (
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Proyectos compartidos</p>
                                                    <div className="space-y-1">
                                                        {[...(candidate.projectLinks || []), ...(candidate.repoLinks || [])].slice(0, 5).map((link, i) => (
                                                            <a key={i} href={link} target="_blank" rel="noreferrer"
                                                                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 truncate">
                                                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                                {link.length > 60 ? `${link.slice(0, 60)}...` : link}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Community Roles */}
                                            {candidate.communityRoles?.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-slate-500">Roles:</p>
                                                    {candidate.communityRoles.map(r => (
                                                        <span key={r} className="px-2 py-0.5 bg-amber-600/15 border border-amber-500/20 rounded-full text-[10px] text-amber-300">
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Score Breakdown */}
                                            {candidate.scoreBreakdown && (
                                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-white">{candidate.scoreBreakdown.activityLevel}</p>
                                                        <p className="text-[10px] text-slate-500">Activity</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-white">{candidate.scoreBreakdown.helpfulness}</p>
                                                        <p className="text-[10px] text-slate-500">Helpful</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-white">{candidate.scoreBreakdown.projectSharing}</p>
                                                        <p className="text-[10px] text-slate-500">Projects</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-white">{candidate.scoreBreakdown.reputation}</p>
                                                        <p className="text-[10px] text-slate-500">Reputation</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-white">{candidate.scoreBreakdown.skillsMatch}</p>
                                                        <p className="text-[10px] text-slate-500">Skills</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-white">{candidate.scoreBreakdown.recencyBonus}</p>
                                                        <p className="text-[10px] text-slate-500">Recency</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Profile Link */}
                                            <a
                                                href={candidate.profileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/15 border border-violet-500/20 rounded-lg text-xs text-violet-300 hover:bg-violet-600/30 transition-colors"
                                            >
                                                <Globe className="h-3 w-3" />
                                                Ver perfil en {candidate.platform}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

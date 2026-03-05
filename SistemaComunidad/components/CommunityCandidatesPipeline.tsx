import React, { useState } from 'react';
import { CommunityCandidate, CommunityPlatform } from '../types/community';
import { ExternalLink, Mail, Github, Linkedin, ChevronDown, ChevronUp, Globe, MessageSquare, Star, Code2, BrainCircuit, Send, Check } from 'lucide-react';
import Toast from '../../components/Toast';

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
    const [toast, setToast] = useState({ show: false, message: '' });
    const [localCandidates, setLocalCandidates] = useState<CommunityCandidate[]>(candidates);

    // Sync local candidates when props change
    React.useEffect(() => {
        setLocalCandidates(candidates);
    }, [candidates]);

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

    // Sort: primary by scrapedAt descending (newest first), secondary by talentScore
    const sorted = [...localCandidates].sort((a, b) => {
        // Always sort by full timestamp first (most recent at top)
        const aTime = new Date(a.scrapedAt).getTime() || 0;
        const bTime = new Date(b.scrapedAt).getTime() || 0;
        if (bTime !== aTime) return bTime - aTime;
        // Secondary sort: by the selected sortField
        const aVal = (a as any)[sortField] ?? 0;
        const bVal = (b as any)[sortField] ?? 0;
        if (sortField === 'scrapedAt') return sortDir === 'desc' ? bTime - aTime : aTime - bTime;
        return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

    // Group by date — within each group, order is already newest-first from sort above
    const grouped: Record<string, CommunityCandidate[]> = {};
    for (const c of sorted) {
        const key = toDateKey(c.scrapedAt);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
    }

    // Date groups sorted newest first
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
                    {localCandidates.length} candidato{localCandidates.length !== 1 ? 's' : ''}
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

                                        {/* Ver Button */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(candidate.id || candidate.username); }}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                            >
                                                <BrainCircuit className="h-4 w-4" /> <span className="hidden sm:inline">Ver Análisis</span>
                                                {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Section */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 border-t border-slate-800/50 space-y-4 animate-in slide-in-from-top-2 duration-200">

                                            {/* AI Analysis Grid (4 Rectangles) */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                                <div className="bg-slate-800/30 p-4 rounded-xl border border-blue-500/20">
                                                    <div className="flex items-center gap-2 mb-2 text-blue-400 font-semibold text-sm">
                                                        <BrainCircuit className="h-4 w-4" />
                                                        PERFIL PSICOLÓGICO
                                                    </div>
                                                    <p className="text-slate-300 text-sm leading-relaxed">
                                                        {candidate.analysisPsychological || "Perfil técnico enfocado en resolución de problemas. Valora la autonomía y la eficiencia en el código."}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-800/30 p-4 rounded-xl border border-emerald-500/20">
                                                    <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
                                                        <Star className="h-4 w-4" />
                                                        MOMENTO PROFESIONAL
                                                    </div>
                                                    <p className="text-slate-300 text-sm leading-relaxed">
                                                        {candidate.analysisBusinessMoment || `Activo en ${candidate.communityName || candidate.platform}. Probablemente receptivo a nuevos retos técnicos o colaboraciones open-source.`}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-800/30 p-4 rounded-xl border border-amber-500/20">
                                                    <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold text-sm">
                                                        <MessageSquare className="h-4 w-4" />
                                                        ÁNGULO DE CONEXIÓN
                                                    </div>
                                                    <p className="text-slate-300 text-sm leading-relaxed">
                                                        {candidate.analysisSalesAngle || "Aproximación directa basada en sus contribuciones recientes o tecnologías que domina."}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-800/30 p-4 rounded-xl border border-pink-500/20">
                                                    <div className="flex items-center gap-2 mb-2 text-pink-400 font-semibold text-sm">
                                                        <Code2 className="h-4 w-4" />
                                                        RESUMEN TÉCNICO
                                                    </div>
                                                    <p className="text-slate-300 text-sm leading-relaxed">
                                                        {candidate.aiSummary || candidate.bio || "Desarrollador involucrado en la comunidad, participando activamente en discusiones y aportando valor."}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Contact Info Section */}
                                            {candidate.contactInfo && candidate.contactInfo.type !== 'None' && (
                                                <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-xl p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            {candidate.contactInfo.type === 'Email' && (
                                                                <>
                                                                    <div className="p-2 bg-emerald-600/20 rounded-lg">
                                                                        <Mail className="h-5 w-5 text-emerald-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-slate-400">📧 Email encontrado</p>
                                                                        <p className="text-sm font-mono text-emerald-300">{candidate.contactInfo.value}</p>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {candidate.contactInfo.type === 'LinkedIn' && (
                                                                <>
                                                                    <div className="p-2 bg-blue-600/20 rounded-lg">
                                                                        <Linkedin className="h-5 w-5 text-blue-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-slate-400">💼 LinkedIn encontrado</p>
                                                                        <a href={candidate.contactInfo.value} target="_blank" rel="noreferrer" className="text-sm text-blue-300 hover:text-blue-200">
                                                                            Ver perfil LinkedIn
                                                                        </a>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {candidate.contactInfo.type === 'GitHub' && (
                                                                <>
                                                                    <div className="p-2 bg-slate-600/20 rounded-lg">
                                                                        <Github className="h-5 w-5 text-slate-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-slate-400">🐙 GitHub encontrado</p>
                                                                        <p className="text-sm text-slate-300">{candidate.contactInfo.value}</p>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        {candidate.autoAddedToGmail && (
                                                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded-lg">
                                                                <Check className="h-4 w-4 text-emerald-400" />
                                                                <span className="text-xs font-medium text-emerald-300">Auto-añadido</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* No Contact Info Message */}
                                            {(!candidate.contactInfo || candidate.contactInfo.type === 'None') && (
                                                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                                                    <p className="text-xs text-slate-400">
                                                        ℹ️ No se encontró información de contacto público durante la búsqueda
                                                    </p>
                                                </div>
                                            )}

                                            {/* Action Buttons (Profile + Limited Actions) */}
                                            <div className="flex gap-3 pt-2 flex-wrap">
                                                <a
                                                    href={candidate.profileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition-colors font-bold"
                                                >
                                                    <Globe className="h-3.5 w-3.5" />
                                                    Ver perfil en {candidate.platform}
                                                </a>

                                                {candidate.email && (
                                                    <a
                                                        href={`mailto:${candidate.email}`}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors font-bold"
                                                    >
                                                        <Mail className="h-3.5 w-3.5" />
                                                        Enviar email
                                                    </a>
                                                )}
                                            </div>

                                            {/* Messaging Blocks (3 Rectangles) */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                                                    <div className="flex items-center gap-2 mb-2 text-blue-400 font-semibold text-sm">
                                                        <Send className="h-4 w-4" />
                                                        1️⃣ INVITACIÓN INICIAL
                                                    </div>
                                                    <p className="text-slate-200 text-sm leading-relaxed italic mb-3 min-h-[60px]">
                                                        "{candidate.outreachIcebreaker || `Hola ${candidate.displayName || candidate.username}, he visto tu actividad en ${candidate.communityName || candidate.platform} y me ha parecido muy interesante. Me encantaría conectar y compartir ideas.`}"
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(candidate.outreachIcebreaker || `Hola ${candidate.displayName || candidate.username}, he visto tu actividad en ${candidate.communityName || candidate.platform} y me ha parecido muy interesante. Me encantaría conectar y compartir ideas.`);
                                                        }}
                                                        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all"
                                                    >
                                                        📋 Copiar
                                                    </button>
                                                </div>

                                                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                                                    <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
                                                        <MessageSquare className="h-4 w-4" />
                                                        2️⃣ POST-ACEPTACIÓN
                                                    </div>
                                                    <p className="text-slate-200 text-sm leading-relaxed italic mb-3 min-h-[60px]">
                                                        "{candidate.outreachPitch || `Gracias por conectar ${candidate.username}. En TalentScope estamos armando un equipo top y viendo tu stack creo que podría encajar con lo que buscas.`}"
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(candidate.outreachPitch || `Gracias por conectar ${candidate.username}. En TalentScope estamos armando un equipo top y viendo tu stack creo que podría encajar con lo que buscas.`);
                                                        }}
                                                        className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all"
                                                    >
                                                        📋 Copiar
                                                    </button>
                                                </div>

                                                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                                                    <div className="flex items-center gap-2 mb-2 text-purple-400 font-semibold text-sm">
                                                        <MessageSquare className="h-4 w-4" />
                                                        3️⃣ SEGUIMIENTO
                                                    </div>
                                                    <p className="text-slate-200 text-sm leading-relaxed italic mb-3 min-h-[60px]">
                                                        "{candidate.outreachFollowup || `¿Pudiste echarle un vistazo? Si estás abierto a escuchar propuestas podemos agendar 15 min esta semana.`}"
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(candidate.outreachFollowup || `¿Pudiste echarle un vistazo? Si estás abierto a escuchar propuestas podemos agendar 15 min esta semana.`);
                                                        }}
                                                        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-all"
                                                    >
                                                        📋 Copiar
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Legacy Details (Skills, Score Breakdown) */}
                                            <div className="pt-4 mt-4 border-t border-slate-800/50 flex flex-wrap gap-6">
                                                {/* Skills */}
                                                {candidate.skills?.length > 0 && (
                                                    <div className="flex-1 min-w-[200px]">
                                                        <p className="text-xs text-slate-500 mb-2">Skills Detectadas</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {candidate.skills.map(s => (
                                                                <span key={s} className="px-2 py-0.5 bg-violet-600/15 border border-violet-500/20 rounded-full text-[10px] text-violet-300">
                                                                    {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Score Breakdown */}
                                                {candidate.scoreBreakdown && (
                                                    <div className="flex-1 min-w-[300px]">
                                                        <p className="text-xs text-slate-500 mb-2">Desglose de Score</p>
                                                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
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
                                                    </div>
                                                )}
                                            </div>

                                            {/* Links Footer */}
                                            <div className="flex items-center gap-3 pt-2">
                                                <a
                                                    href={candidate.profileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/15 border border-violet-500/20 rounded-lg text-xs text-violet-300 hover:bg-violet-600/30 transition-colors"
                                                >
                                                    <Globe className="h-3 w-3" />
                                                    Ver perfil en {candidate.platform}
                                                </a>
                                                {(candidate.projectLinks?.length > 0 || candidate.repoLinks?.length > 0) && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500 items-center flex">Proyectos:</span>
                                                        {[...(candidate.projectLinks || []), ...(candidate.repoLinks || [])].slice(0, 3).map((link, i) => (
                                                            <a key={i} href={link} target="_blank" rel="noreferrer"
                                                                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-slate-800 rounded-md text-cyan-400 hover:text-cyan-300">
                                                                <ExternalLink className="h-3 w-3 flex-shrink-0" /> Link {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
        </div>
    );
};

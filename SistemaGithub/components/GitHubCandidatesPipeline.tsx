import React, { useState } from 'react';
import { GitHubMetrics } from '../../types/database';
import { ChevronUp, ChevronDown, ExternalLink, Trophy, Eye, X, Copy, Check, Calendar } from 'lucide-react';

interface GitHubCandidatesPipelineProps {
    candidates: GitHubMetrics[];
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
}

type SortField = 'github_username' | 'github_score' | 'followers' | 'public_repos' | 'total_contributions';
type SortDirection = 'asc' | 'desc';

export const GitHubCandidatesPipeline: React.FC<GitHubCandidatesPipelineProps> = ({
    candidates,
    formatNumber,
    getScoreBadgeColor
}) => {
    const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
        field: 'github_score',
        direction: 'asc'
    });

    const [selectedCandidate, setSelectedCandidate] = useState<GitHubMetrics | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const handleCopy = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const toggleSort = (field: SortField) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const sortedCandidates = [...candidates].sort((a, b) => {
        let aVal: any = a[sortConfig.field];
        let bVal: any = b[sortConfig.field];

        // Handle string comparisons
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = (bVal as string).toLowerCase();
        }

        if (aVal === bVal) return 0;
        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'desc' ? -comparison : comparison;
    });

    // Helper to format date labels
    const formatDateLabel = (dateStr: string): string => {
        if (!dateStr) return 'Fecha desconocida';
        const date = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';

        return target.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    };

    // Group candidates by date
    const groupedCandidates = React.useMemo(() => {
        const groups: { label: string; count: number; candidates: GitHubMetrics[] }[] = [];
        let currentKey = '';

        for (const c of sortedCandidates) {
            const dateStr = c.created_at || new Date().toISOString(); // Fallback to now if missing
            const date = new Date(dateStr);
            const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

            if (dayKey !== currentKey) {
                currentKey = dayKey;
                groups.push({ label: formatDateLabel(dateStr), count: 0, candidates: [] });
            }

            const group = groups[groups.length - 1];
            group.candidates.push(c);
            group.count++;
        }

        return groups;
    }, [sortedCandidates]);

    if (candidates.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-500">
                <p>No hay candidatos para mostrar</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto min-h-96">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-700 bg-slate-900/50">
                        <th
                            className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors select-none"
                            onClick={() => toggleSort('github_username')}
                        >
                            <div className="flex items-center gap-2">
                                Desarrollador
                                {sortConfig.field === 'github_username' && (
                                    sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                )}
                            </div>
                        </th>
                        <th className="px-4 py-3">Lenguajes</th>
                        <th
                            className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors select-none"
                            onClick={() => toggleSort('github_score')}
                        >
                            <div className="flex items-center gap-2">
                                Score
                                {sortConfig.field === 'github_score' && (
                                    sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                )}
                            </div>
                        </th>
                        <th
                            className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors select-none"
                            onClick={() => toggleSort('followers')}
                        >
                            <div className="flex items-center gap-2">
                                Seguidores
                                {sortConfig.field === 'followers' && (
                                    sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                )}
                            </div>
                        </th>
                        <th
                            className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors select-none"
                            onClick={() => toggleSort('public_repos')}
                        >
                            <div className="flex items-center gap-2">
                                Repositorios
                                {sortConfig.field === 'public_repos' && (
                                    sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                )}
                            </div>
                        </th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {groupedCandidates.map((group) => (
                        <React.Fragment key={group.label}>
                            {/* Date SECTION Row */}
                            <tr>
                                <td colSpan={6} className="px-0 py-0">
                                    <div className="flex items-center gap-3 px-4 py-2 bg-orange-950/20 border-y border-orange-500/10 backdrop-blur-sm mt-2 first:mt-0">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-orange-400/80" />
                                            <span className="text-xs font-bold text-orange-100/90 uppercase tracking-wider">{group.label}</span>
                                        </div>
                                        <div className="flex-1 h-px bg-gradient-to-r from-orange-500/20 via-orange-400/10 to-transparent"></div>
                                        <span className="text-[10px] font-bold text-orange-300/80 bg-orange-900/30 px-2.5 py-0.5 rounded-full border border-orange-500/20 shadow-sm">
                                            {group.count} leads
                                        </span>
                                    </div>
                                </td>
                            </tr>

                            {/* Candidate Rows */}
                            {group.candidates.map((candidate, idx) => (
                                <tr key={candidate.github_username} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                                    {/* Developer Name */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img
                                                    src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8`}
                                                    alt={candidate.github_username}
                                                    className="h-9 w-9 rounded-full ring-2 ring-slate-800 group-hover:ring-orange-500/30 transition-all"
                                                />
                                                {candidate.location && (
                                                    <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700" title={candidate.location}>
                                                        <span className="text-[10px]">🌍</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <a
                                                    href={`https://github.com/${candidate.github_username}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm font-bold text-white hover:text-orange-400 transition-colors flex items-center gap-1.5"
                                                >
                                                    {candidate.name || candidate.github_username}
                                                </a>
                                                <p className="text-xs text-slate-500 font-mono">@{candidate.github_username}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Languages */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {candidate.most_used_language && (
                                                <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">
                                                    {candidate.most_used_language}
                                                </span>
                                            )}
                                            {candidate.languages && candidate.languages.length > 1 && (
                                                <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-full">
                                                    +{candidate.languages.length - 1}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Score */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center">
                                            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${candidate.github_score >= 85
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                : candidate.github_score >= 75
                                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                                    : candidate.github_score >= 65
                                                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                                        : 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                                                }`}>
                                                {Math.round(candidate.github_score)}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Followers */}
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold text-slate-300">{formatNumber(candidate.followers ?? 0)}</span>
                                    </td>

                                    {/* Public Repos */}
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold text-slate-300">{candidate.public_repos}</span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3 text-right">
                                        <a
                                            href={`https://github.com/${candidate.github_username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-orange-400 hover:bg-slate-700 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                        <button
                                            onClick={() => {
                                                setSelectedCandidate(candidate);
                                                setShowModal(true);
                                            }}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 px-2 py-1 rounded-lg transition-colors border border-orange-500/20 hover:border-orange-500/40 ml-2"
                                        >
                                            <Eye className="h-3 w-3" />
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            {/* AI Research Modal */}
            {showModal && selectedCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedCandidate.avatar_url || `https://ui-avatars.com/api/?name=${selectedCandidate.github_username}&background=1e293b&color=94a3b8`}
                                    alt={selectedCandidate.github_username}
                                    className="h-12 w-12 rounded-full ring-2 ring-orange-500/20"
                                />
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        {selectedCandidate.name || selectedCandidate.github_username}
                                        <a href={`https://github.com/${selectedCandidate.github_username}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </h3>
                                    <p className="text-orange-400 text-sm font-medium">{selectedCandidate.bio || 'Desarrollador GitHub'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column: Stats & Summary */}
                            <div className="space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Score</div>
                                        <div className="text-2xl font-bold text-white">{Math.round(selectedCandidate.github_score)}</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Repos</div>
                                        <div className="text-2xl font-bold text-white">{selectedCandidate.public_repos}</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Followers</div>
                                        <div className="text-2xl font-bold text-white">{formatNumber(selectedCandidate.followers)}</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Language</div>
                                        <div className="text-lg font-bold text-orange-400 truncate">{selectedCandidate.most_used_language || 'N/A'}</div>
                                    </div>
                                </div>

                                {/* AI Summary - "Resumen de datos importantes" */}
                                <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-5">
                                    <h4 className="text-orange-400 font-semibold mb-4 flex items-center gap-2">
                                        <Trophy className="h-4 w-4" />
                                        Resumen de Datos Importantes
                                    </h4>
                                    <ul className="space-y-3">
                                        {(selectedCandidate.ai_summary && selectedCandidate.ai_summary.length > 0) ? (
                                            selectedCandidate.ai_summary.map((point, i) => (
                                                <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                                                    <span className="text-orange-500 mt-1">•</span>
                                                    {point}
                                                </li>
                                            ))
                                        ) : (
                                            // Fallback / Mock Data if no AI analysis yet
                                            <>
                                                <li className="flex items-start gap-2 text-slate-300 text-sm">
                                                    <span className="text-orange-500 mt-1">•</span>
                                                    Perfil con alta actividad reciente en repositorios {selectedCandidate.most_used_language || 'de código'}.
                                                </li>
                                                <li className="flex items-start gap-2 text-slate-300 text-sm">
                                                    <span className="text-orange-500 mt-1">•</span>
                                                    Mantiene un ratio de originalidad del {selectedCandidate.originality_ratio || 0}% en sus proyectos.
                                                </li>
                                                <li className="flex items-start gap-2 text-slate-300 text-sm">
                                                    <span className="text-orange-500 mt-1">•</span>
                                                    {selectedCandidate.contribution_streak > 0
                                                        ? `Racha de contribuciones activa de ${selectedCandidate.contribution_streak} días.`
                                                        : 'Contribuidor constante en proyectos open source.'}
                                                </li>
                                                {selectedCandidate.location && (
                                                    <li className="flex items-start gap-2 text-slate-300 text-sm">
                                                        <span className="text-orange-500 mt-1">•</span>
                                                        Ubicado en {selectedCandidate.location}, posible disponibilidad horaria compatible.
                                                    </li>
                                                )}
                                            </>
                                        )}
                                    </ul>
                                </div>
                            </div>

                            {/* Right Column: Outreach Messages */}
                            <div className="space-y-6">
                                <h4 className="text-white font-semibold flex items-center gap-2">
                                    <span className="h-6 w-1 bg-orange-500 rounded-full"></span>
                                    Mensajes Outreach
                                </h4>

                                {/* Message 1: Icebreaker / Connection */}
                                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 group hover:border-orange-500/30 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Opción 1: Conexión Técnica</div>
                                        <button
                                            onClick={() => handleCopy(selectedCandidate.outreach_icebreaker || `Hola ${selectedCandidate.name || selectedCandidate.github_username}, he visto tu trabajo en GitHub con ${selectedCandidate.most_used_language} y me ha impresionado la calidad de tus repositorios.`, 'msg1')}
                                            className="text-slate-400 hover:text-orange-400 transition-colors"
                                            title="Copiar mensaje"
                                        >
                                            {copiedField === 'msg1' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedCandidate.outreach_icebreaker || `Hola ${selectedCandidate.name || selectedCandidate.github_username}, he visto tu trabajo en GitHub con ${selectedCandidate.most_used_language} y me ha impresionado la calidad de tus repositorios.`}
                                    </p>
                                </div>

                                {/* Message 2: Pitch / Value Prop */}
                                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 group hover:border-orange-500/30 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Opción 2: Propuesta Directa</div>
                                        <button
                                            onClick={() => handleCopy(selectedCandidate.outreach_pitch || `Me encantaría charlar sobre cómo podrías aplicar tu experiencia en ${selectedCandidate.most_used_language} en proyectos de alto impacto. ¿Tienes 5 minutos?`, 'msg2')}
                                            className="text-slate-400 hover:text-orange-400 transition-colors"
                                            title="Copiar mensaje"
                                        >
                                            {copiedField === 'msg2' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedCandidate.outreach_pitch || `Me encantaría charlar sobre cómo podrías aplicar tu experiencia en ${selectedCandidate.most_used_language} en proyectos de alto impacto. ¿Tienes 5 minutos?`}
                                    </p>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
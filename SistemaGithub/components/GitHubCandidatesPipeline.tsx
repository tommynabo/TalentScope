import React, { useState } from 'react';
import { GitHubMetrics } from '../../types/database';
import { ExternalLink, Mail, BrainCircuit, Calendar, ChevronDown, ChevronUp, X, Copy, Check } from 'lucide-react';
import Toast from '../../components/Toast';

interface GitHubCandidatesPipelineProps {
    candidates: GitHubMetrics[];
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
    onViewCandidate?: (candidate: GitHubMetrics) => void;
    campaignId?: string;
}

type SortField = 'created_at' | 'github_score' | 'name';
type SortDir = 'asc' | 'desc';

/**
 * Returns a user-friendly label for a date key (YYYY-MM-DD).
 */
const getTimeGroupLabel = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();

    if (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    ) {
        return 'Hoy';
    }

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
};

/**
 * Converts a date string to a stable YYYY-MM-DD key for grouping.
 */
const toDateKey = (dateString: string): string => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const detectRole = (lang: string): string => {
    if (!lang) return 'Developer';
    const lower = lang.toLowerCase();
    if (['react', 'typescript', 'javascript', 'vue'].some(t => lower.includes(t))) return 'Frontend Engineer';
    if (['python', 'django', 'flask'].some(t => lower.includes(t))) return 'Backend Engineer';
    if (['dart', 'flutter', 'kotlin', 'swift'].some(t => lower.includes(t))) return 'Mobile Engineer';
    if (['rust', 'go', 'c++', 'c'].some(t => lower === t)) return 'Systems Engineer';
    return `${lang} Developer`;
};

export const GitHubCandidatesPipeline: React.FC<GitHubCandidatesPipelineProps> = ({
    candidates,
    formatNumber,
    getScoreBadgeColor,
    onViewCandidate,
    campaignId
}) => {
    const [sortConfig, setSortConfig] = useState<{ field: SortField; dir: SortDir }>({ field: 'created_at', dir: 'desc' });
    const [toast, setToast] = useState({ show: false, message: '' });
    const [analysisCandidate, setAnalysisCandidate] = useState<GitHubMetrics | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'messages'>('analysis');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const hasAnalysis = (c: GitHubMetrics) =>
        !!(c.analysis_psychological || c.analysis_business || c.analysis_sales_angle || c.analysis_bottleneck || (c.ai_summary && c.ai_summary.length > 0));

    const hasMessages = (c: GitHubMetrics) =>
        !!(c.outreach_icebreaker || c.outreach_pitch || c.outreach_followup);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const toggleSort = (field: SortField) => {
        setSortConfig(prev =>
            prev.field === field
                ? { field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
                : { field, dir: 'desc' }
        );
    };

    // Sort candidates
    const sortedCandidates = [...candidates].sort((a, b) => {
        let cmp = 0;
        if (sortConfig.field === 'created_at') {
            cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (sortConfig.field === 'github_score') {
            cmp = (a.github_score || 0) - (b.github_score || 0);
        } else if (sortConfig.field === 'name') {
            cmp = (a.name || a.github_username).localeCompare(b.name || b.github_username);
        }
        return sortConfig.dir === 'desc' ? -cmp : cmp;
    });

    // Group by date
    const groupedByDate = sortedCandidates.reduce((groups, c) => {
        const key = toDateKey(c.created_at);
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
        return groups;
    }, {} as Record<string, GitHubMetrics[]>);

    const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    if (candidates.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-500">
                <p>No hay candidatos para mostrar</p>
            </div>
        );
    }

    return (
        <>
        <div className="flex flex-col h-full">
            {/* Pipeline Header */}
            <div className="px-3 py-2 border-b border-slate-800 flex items-center bg-slate-900/60">
                <h3 className="font-semibold text-sm text-white whitespace-nowrap">Pipeline ({candidates.length})</h3>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                            <th
                                className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                                onClick={() => toggleSort('name')}
                            >
                                <div className="flex items-center gap-1">
                                    Desarrollador
                                    {sortConfig.field === 'name' && (
                                        sortConfig.dir === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                    )}
                                </div>
                            </th>
                            <th className="px-3 lg:px-4 py-2">Rol</th>
                            <th className="px-3 lg:px-4 py-2">Contacto</th>
                            <th className="px-3 lg:px-4 py-2">Mensaje</th>
                            <th
                                className="px-3 lg:px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                                onClick={() => toggleSort('github_score')}
                            >
                                <div className="flex items-center gap-1">
                                    <BrainCircuit className="h-3 w-3" /> Score
                                    {sortConfig.field === 'github_score' && (
                                        sortConfig.dir === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                    )}
                                </div>
                            </th>
                            <th className="px-3 lg:px-4 py-2 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDateKeys.map((dateKey) => {
                            const dayLeads = groupedByDate[dateKey];
                            const label = getTimeGroupLabel(dateKey);
                            return (
                                <React.Fragment key={dateKey}>
                                    {/* Date Divider */}
                                    <tr>
                                        <td colSpan={6} className="px-0 py-0">
                                            <div className="flex items-center gap-3 px-3 lg:px-4 py-1.5 bg-orange-950/20 border-y border-orange-500/15 backdrop-blur-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3 text-orange-400/70" />
                                                    <span className="text-xs font-semibold text-slate-300">{label}</span>
                                                </div>
                                                <div className="flex-1 h-px bg-gradient-to-r from-orange-500/30 via-orange-400/20 to-transparent"></div>
                                                <span className="text-[10px] font-medium text-orange-300/70 bg-orange-950/40 px-2 py-0.5 rounded-full border border-orange-500/20">
                                                    {dayLeads.length} {dayLeads.length === 1 ? 'dev' : 'devs'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Candidate Rows */}
                                    {dayLeads.map((candidate) => (
                                        <tr key={candidate.github_username} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                                            {/* Desarrollador */}
                                            <td className="px-3 lg:px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8`}
                                                        alt={candidate.github_username}
                                                        className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-800"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-white text-xs lg:text-sm truncate">
                                                            {candidate.name || `@${candidate.github_username}`}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {candidate.most_used_language || 'N/A'} • {formatNumber(candidate.followers)} followers
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Rol */}
                                            <td className="px-3 lg:px-4 py-2">
                                                <span className="text-xs font-medium text-orange-300">
                                                    {detectRole(candidate.most_used_language || '')}
                                                </span>
                                            </td>

                                            {/* Contacto */}
                                            <td className="px-3 lg:px-4 py-2">
                                                <div className="flex flex-col gap-0.5">
                                                    {candidate.mentioned_email ? (
                                                        <span className="text-xs text-slate-300 truncate max-w-[140px]" title={candidate.mentioned_email}>
                                                            📧 {candidate.mentioned_email}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-500">Sin email</span>
                                                    )}
                                                    {candidate.linkedin_url && (
                                                        <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[140px]">
                                                            🔗 LinkedIn
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Mensaje */}
                                            <td className="px-3 lg:px-4 py-2">
                                                {candidate.outreach_icebreaker ? (
                                                    <div className="max-w-xs">
                                                        <p className="text-xs text-slate-300 line-clamp-2" title={candidate.outreach_icebreaker}>
                                                            {candidate.outreach_icebreaker}
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(candidate.outreach_icebreaker || '');
                                                                setToast({ show: true, message: '✅ Mensaje copiado!' });
                                                            }}
                                                            className="text-xs text-orange-400 hover:text-orange-300 mt-0.5"
                                                        >
                                                            Copiar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">No disponible</span>
                                                )}
                                            </td>

                                            {/* Score */}
                                            <td className="px-3 lg:px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${candidate.github_score > 80 ? 'bg-gradient-to-r from-emerald-400 to-orange-400' : candidate.github_score > 60 ? 'bg-orange-500' : 'bg-slate-500'}`}
                                                            style={{ width: `${Math.min(candidate.github_score, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className={`text-xs font-bold ${candidate.github_score > 80 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                        {Math.round(candidate.github_score)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Acciones */}
                                            <td className="px-3 lg:px-4 py-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => { setAnalysisCandidate(candidate); setActiveTab('analysis'); }}
                                                        className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-1 rounded-lg transition-colors border border-transparent hover:bg-slate-700 hover:border-slate-600 ${
                                                            hasAnalysis(candidate) || hasMessages(candidate)
                                                                ? 'text-purple-400 hover:text-purple-300'
                                                                : 'text-slate-500 hover:text-slate-400'
                                                        }`}
                                                        title="Ver Análisis IA"
                                                    >
                                                        <BrainCircuit className="h-3 w-3" /> <span className="hidden sm:inline">Ver</span>
                                                    </button>
                                                    <a
                                                        href={`https://github.com/${candidate.github_username}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 px-1.5 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                    {candidate.mentioned_email && (
                                                        <a
                                                            href={`mailto:${candidate.mentioned_email}`}
                                                            className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                                            title={candidate.mentioned_email}
                                                        >
                                                            <Mail className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
        </div>

        {/* AI Analysis Modal */}
        {analysisCandidate && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAnalysisCandidate(null)}>
                <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <img src={analysisCandidate.avatar_url || `https://ui-avatars.com/api/?name=${analysisCandidate.github_username}&background=1e293b&color=94a3b8`} className="h-8 w-8 rounded-full ring-2 ring-purple-500/30" alt="" />
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    <BrainCircuit className="h-4 w-4 text-purple-400" /> @{analysisCandidate.github_username}
                                </h3>
                                <p className="text-xs text-slate-500">Análisis IA</p>
                            </div>
                        </div>
                        <button onClick={() => setAnalysisCandidate(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><X className="h-4 w-4" /></button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-800 flex-shrink-0">
                        <button onClick={() => setActiveTab('analysis')} className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'analysis' ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
                            🧠 Análisis
                        </button>
                        <button onClick={() => setActiveTab('messages')} className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'messages' ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
                            ✉️ Mensajes
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="overflow-y-auto p-5 space-y-3">
                        {activeTab === 'analysis' && (
                            <>
                                {analysisCandidate.analysis_psychological && (
                                    <div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                                        <h4 className="font-semibold text-orange-400 text-xs mb-1">🧠 Perfil Psicológico</h4>
                                        <p className="text-slate-300 text-sm">{analysisCandidate.analysis_psychological}</p>
                                    </div>
                                )}
                                {analysisCandidate.analysis_business && (
                                    <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                                        <h4 className="font-semibold text-blue-400 text-xs mb-1">📊 Momento de Negocio</h4>
                                        <p className="text-slate-300 text-sm">{analysisCandidate.analysis_business}</p>
                                    </div>
                                )}
                                {analysisCandidate.analysis_sales_angle && (
                                    <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                                        <h4 className="font-semibold text-purple-400 text-xs mb-1">🎯 Ángulo de Venta</h4>
                                        <p className="text-slate-300 text-sm">{analysisCandidate.analysis_sales_angle}</p>
                                    </div>
                                )}
                                {analysisCandidate.analysis_bottleneck && (
                                    <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                                        <h4 className="font-semibold text-emerald-400 text-xs mb-1">⚡ Cuello de Botella</h4>
                                        <p className="text-slate-300 text-sm">{analysisCandidate.analysis_bottleneck}</p>
                                    </div>
                                )}
                                {analysisCandidate.ai_summary && analysisCandidate.ai_summary.length > 0 && (
                                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                        <h4 className="font-semibold text-slate-300 text-xs mb-2">📋 Resumen IA</h4>
                                        <ul className="space-y-1">
                                            {analysisCandidate.ai_summary.map((point, i) => (
                                                <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                                    <span className="text-orange-400 mt-0.5">•</span> {point}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {!hasAnalysis(analysisCandidate) && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center">
                                        <p className="text-slate-400 text-sm">Sin análisis IA disponible.</p>
                                    </div>
                                )}
                            </>
                        )}
                        {activeTab === 'messages' && (
                            <>
                                {[
                                    { key: 'icebreaker', label: '👋 Primer Contacto', value: analysisCandidate.outreach_icebreaker, color: 'blue' },
                                    { key: 'pitch', label: '🚀 Post-Aceptación', value: analysisCandidate.outreach_pitch, color: 'purple' },
                                    { key: 'followup', label: '🔄 Follow-up', value: analysisCandidate.outreach_followup, color: 'emerald' },
                                ].map(({ key, label, value, color }) => value ? (
                                    <div key={key} className={`bg-${color}-500/10 p-3 rounded-lg border border-${color}-500/20`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <h4 className={`font-semibold text-${color}-400 text-xs`}>{label}</h4>
                                            <button
                                                onClick={() => copyToClipboard(value, key)}
                                                className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-500 hover:text-slate-300"
                                                title="Copiar"
                                            >
                                                {copiedKey === key ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{value}</p>
                                    </div>
                                ) : null)}
                                {!hasMessages(analysisCandidate) && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center">
                                        <p className="text-slate-400 text-sm">Sin mensajes generados aún.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
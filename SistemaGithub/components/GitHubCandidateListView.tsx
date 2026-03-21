import React, { useState, useEffect, useMemo } from 'react';
import { GitHubMetrics } from '../../types/database';
import { ChevronLeft, Calendar, ChevronDown, ChevronUp, Download, X, Loader2, ExternalLink, BrainCircuit, Copy, Check } from 'lucide-react';
import Toast from '../../components/Toast';
import UserSelectionModal from '../../components/UserSelectionModal';
import { OutreachUser, generateOutreachMessages, extractSpecialty } from '../../lib/messageGenerator';

interface GitHubCandidateListProps {
    campaignId?: string;
    onBack?: () => void;
}

type SortField = 'added_at' | 'github_score' | 'followers';
type SortDirection = 'asc' | 'desc';
type CandidateWithMeta = GitHubMetrics & { added_at?: string };

// Returns today's date as YYYY-MM-DD using the CLIENT'S local timezone (not UTC).
// Avoids the off-by-one-day bug that occurs when local time differs from UTC date.
const getLocalDateStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const GitHubCandidateList: React.FC<GitHubCandidateListProps> = ({ campaignId, onBack }) => {
    const [candidates, setCandidates] = useState<CandidateWithMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '' });
    const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ field: 'added_at', direction: 'desc' });
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [showUserSelection, setShowUserSelection] = useState(false);
    const [selectedUser, setSelectedUser] = useState<OutreachUser>('mauro');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: getLocalDateStr(),
        end: getLocalDateStr()
    });
    const [analysisCandidate, setAnalysisCandidate] = useState<CandidateWithMeta | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'messages'>('analysis');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const hasAnalysis = (c: CandidateWithMeta) =>
        !!(c.analysis_psychological || c.analysis_business || c.analysis_sales_angle || c.analysis_bottleneck || (c.ai_summary && c.ai_summary.length > 0));

    const hasMessages = (c: CandidateWithMeta) =>
        !!(c.outreach_icebreaker || c.outreach_pitch || c.outreach_followup);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    // Load candidates from sessionStorage on mount
    useEffect(() => {
        loadCandidates();
    }, [campaignId]);

    const loadCandidates = () => {
        try {
            const stored = sessionStorage.getItem(`github_candidates_${campaignId}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                setCandidates(parsed);
            }
        } catch (err) {
            console.error('Error loading candidates:', err);
        }
    };

    const formatDateLabel = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';

        return target.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    };

    const toggleSort = (field: SortField) => {
        setSortConfig(prev => {
            if (prev.field === field) {
                return { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
            }
            return { field, direction: 'desc' };
        });
    };

    const sortedCandidates = useMemo(() => {
        const sorted = [...candidates].sort((a, b) => {
            let cmp = 0;
            if (sortConfig.field === 'added_at') {
                const dateA = new Date(a.added_at || a.created_at).getTime();
                const dateB = new Date(b.added_at || b.created_at).getTime();
                cmp = dateA - dateB;
            } else if (sortConfig.field === 'github_score') {
                cmp = (a.github_score || 0) - (b.github_score || 0);
            } else if (sortConfig.field === 'followers') {
                cmp = (a.followers || 0) - (b.followers || 0);
            }
            return sortConfig.direction === 'desc' ? -cmp : cmp;
        });
        return sorted;
    }, [candidates, sortConfig]);

    const groupedCandidates = useMemo(() => {
        const groups: { label: string; count: number; candidates: CandidateWithMeta[] }[] = [];
        let currentKey = '';

        for (const c of sortedCandidates) {
            const dateStr = c.added_at || new Date().toISOString();
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

    const handleExport = (userOverride?: OutreachUser) => {
        const activeUser = userOverride || selectedUser;
        const { start, end } = dateRange;
        if (!start || !end) return;

        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        const filtered = candidates.filter(c => {
            const dateStr = c.added_at || new Date().toISOString();
            const cDate = new Date(dateStr);
            return cDate >= startDate && cDate <= endDate;
        });

        if (filtered.length === 0) {
            setToast({ show: true, message: '⚠️ No hay desarrolladores para exportar en este rango' });
            return;
        }

        // ═══ SMART SPLIT: LinkedIn vs Email ═══
        const linkedinCandidates = filtered.filter(c => c.linkedin_url && c.linkedin_url.trim().length > 0);
        const emailCandidates = filtered.filter(c =>
            c.mentioned_email && c.mentioned_email.trim().length > 0 &&
            (!c.linkedin_url || c.linkedin_url.trim().length === 0)
        );

        const dateTag = `${start}_${end}`;

        // Helper: escape CSV value
        const esc = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

        // Helper to build and download a CSV (LinkedIn-style complete data)
        const downloadCSV = (data: CandidateWithMeta[], filename: string) => {
            const headers = [
                'FIRST_NAME', 'LAST_NAME', 'ROL', 'EMAIL', 'LINKEDIN', 'GITHUB',
                'SCORE', 'INVITACION_INICIAL', 'POST_ACEPTACION', 'ANALISIS', 'LENGUAJE', 'SEGUIDORES', 'REPOS', 'ÚLTIMO_COMMIT', 'FECHA'
            ];
            const csvContent = [
                headers.join(','),
                ...data.map(c => {
                    // Split name into first/last
                    const nameParts = (c.name || c.github_username || '').split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';

                    // Detect role from language
                    const lang = c.most_used_language || '';
                    const lowerLang = lang.toLowerCase();
                    let rol = `${lang} Developer`;
                    if (['react', 'typescript', 'javascript', 'vue'].some(t => lowerLang.includes(t))) rol = 'Frontend Engineer';
                    else if (['python', 'django', 'flask'].some(t => lowerLang.includes(t))) rol = 'Backend Engineer';
                    else if (['dart', 'flutter', 'kotlin', 'swift'].some(t => lowerLang.includes(t))) rol = 'Mobile Engineer';
                    else if (['rust', 'go', 'c++', 'c'].some(t => lowerLang === t)) rol = 'Systems Engineer';

                    // Extract specialty
                    const specialty = extractSpecialty(rol, [], { most_used_language: lang });

                    // Generate personalized messages based on selected user
                    const personalized = generateOutreachMessages(
                        c.name || c.github_username || '',
                        specialty,
                        activeUser,
                        {
                            icebreaker: c.outreach_icebreaker,
                            followup_message: c.outreach_followup,
                            second_followup: c.outreach_pitch
                        }
                    );

                    // Analysis summary
                    const analysis = c.ai_summary?.join(' | ') || c.analysis_business || '';

                    const lastCommit = c.last_commit_date ? c.last_commit_date.split('T')[0] : 'N/A';
                    const added = c.added_at ? c.added_at.split('T')[0] : new Date().toISOString().split('T')[0];

                    // Helper: escape CSV value
                    const esc = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

                    return [
                        esc(firstName), esc(lastName), esc(rol),
                        esc(c.mentioned_email || ''), esc(c.linkedin_url || ''),
                        esc(`https://github.com/${c.github_username}`),
                        `"${Math.round(c.github_score)}"`,
                        esc(personalized.icebreaker), esc(personalized.followup_message), esc(analysis),
                        esc(lang), `"${c.followers}"`, `"${c.public_repos}"`,
                        esc(lastCommit), esc(added)
                    ].join(',');
                })
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };

        // Download LinkedIn CSV (if any)
        if (linkedinCandidates.length > 0) {
            downloadCSV(linkedinCandidates, `LINKEDIN_github_${campaignId}_${dateTag}.csv`);
        }

        // Download Email CSV (if any)
        if (emailCandidates.length > 0) {
            setTimeout(() => {
                downloadCSV(emailCandidates, `EMAIL_github_${campaignId}_${dateTag}.csv`);
            }, 500); // Small delay so browser doesn't block second download
        }

        // Toast with breakdown
        const parts: string[] = [];
        if (emailCandidates.length > 0) parts.push(`${emailCandidates.length} Email`);
        if (linkedinCandidates.length > 0) parts.push(`${linkedinCandidates.length} LinkedIn`);
        const noContact = filtered.length - linkedinCandidates.length - emailCandidates.length;
        if (noContact > 0) parts.push(`${noContact} sin contacto`);

        setToast({
            show: true,
            message: `✅ Exportados ${filtered.length} devs → ${parts.join(' + ')} (mensajes de ${activeUser === 'mauro' ? 'Mauro' : 'Nyo'})`
        });
        setShowExportOptions(false);
    };

    return (
        <div className="p-3 md:p-4 lg:p-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-orange-500 hover:text-orange-400 text-slate-400 transition-all"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-white">Pipeline GitHub</h2>
                        <p className="text-slate-400 text-sm">Resultados acumulados de búsqueda</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-orange-400">{candidates.length}</p>
                    <p className="text-slate-400 text-xs">desarrolladores</p>
                </div>
            </div>

            {/* Table Header with Export */}
            <div className="px-3 py-2 border-b border-slate-800 flex justify-between items-center gap-3 bg-slate-900/60 mb-4">
                <h3 className="font-semibold text-sm text-white">Resultados ({candidates.length})</h3>

                {/* Export Button */}
                <div className={`flex items-center gap-2 transition-all overflow-hidden ${showExportOptions ? 'w-auto opacity-100' : 'w-auto'}`}>
                    {showExportOptions ? (
                        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-1 animate-in slide-in-from-right-4 fade-in duration-200">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-transparent text-xs text-white border-0 p-1 focus:ring-0 w-24"
                            />
                            <span className="text-slate-500 text-xs">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-transparent text-xs text-white border-0 p-1 focus:ring-0 w-24"
                            />
                            <button
                                onClick={() => setShowUserSelection(true)}
                                className="p-1 hover:bg-orange-500/20 rounded text-orange-400"
                                title="Descargar CSV"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setShowExportOptions(false)}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowExportOptions(true)}
                            className="px-2.5 py-1.5 text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors flex items-center gap-1.5"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Exportar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-x-auto bg-slate-900/40 border border-slate-800 rounded-lg">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <p className="text-sm">Sin desarrolladores aún</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                                <th
                                    className="px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                                    onClick={() => toggleSort('followers')}
                                >
                                    <div className="flex items-center gap-1">
                                        Desarrollador
                                        {sortConfig.field === 'followers' && (
                                            sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-2">Email</th>
                                <th className="px-4 py-2">LinkedIn</th>
                                <th
                                    className="px-4 py-2 cursor-pointer hover:text-slate-300 transition-colors select-none"
                                    onClick={() => toggleSort('github_score')}
                                >
                                    <div className="flex items-center gap-1">
                                        Score
                                        {sortConfig.field === 'github_score' && (
                                            sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-2">Seguidores</th>
                                <th className="px-4 py-2">Repos</th>
                                <th className="px-4 py-2 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedCandidates.map((group) => (
                                <React.Fragment key={group.label}>
                                    {/* Date Divider Row */}
                                    <tr>
                                        <td colSpan={7} className="px-0 py-0">
                                            <div className="flex items-center gap-3 px-4 py-1.5 bg-orange-950/20 border-y border-orange-500/15 backdrop-blur-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3 text-orange-400/70" />
                                                    <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                                                </div>
                                                <div className="flex-1 h-px bg-gradient-to-r from-orange-500/30 via-orange-400/20 to-transparent"></div>
                                                <span className="text-[10px] font-medium text-orange-300/70 bg-orange-950/40 px-2 py-0.5 rounded-full border border-orange-500/20">
                                                    {group.count} {group.count === 1 ? 'dev' : 'devs'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Candidate Rows */}
                                    {group.candidates.map((candidate) => (
                                        <tr key={candidate.github_username} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-white text-xs lg:text-sm truncate">@{candidate.github_username}</p>
                                                        <p className="text-xs text-slate-500">{candidate.most_used_language}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <p className="text-xs lg:text-sm text-slate-300 truncate">{candidate.mentioned_email || '-'}</p>
                                            </td>
                                            <td className="px-4 py-2">
                                                {candidate.linkedin_url ? (
                                                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate">
                                                        LinkedIn ↗
                                                    </a>
                                                ) : (
                                                    <p className="text-xs text-slate-500">-</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-orange-400"
                                                            style={{ width: `${Math.min(candidate.github_score, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-300 min-w-fit">
                                                        {Math.round(candidate.github_score)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="text-xs font-bold text-slate-300">{candidate.followers}</span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="text-xs font-bold text-slate-300">{candidate.public_repos}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => { setAnalysisCandidate(candidate); setActiveTab('analysis'); }}
                                                        className={`inline-flex items-center gap-1 text-xs font-medium hover:bg-slate-700 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600 ${hasAnalysis(candidate) || hasMessages(candidate) ? 'text-purple-400 hover:text-purple-300' : 'text-slate-600 hover:text-slate-400'}`}
                                                        title="Ver Análisis IA"
                                                    >
                                                        <BrainCircuit className="h-3 w-3" />
                                                    </button>
                                                    <a
                                                        href={candidate.github_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-orange-400 hover:bg-slate-700 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />

            <UserSelectionModal
                isOpen={showUserSelection}
                onSelect={(user) => {
                    setSelectedUser(user);
                    setShowUserSelection(false);
                    handleExport(user);
                }}
                onClose={() => setShowUserSelection(false)}
            />

            {/* AI Analysis Modal */}
            {analysisCandidate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAnalysisCandidate(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-2">
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
                            <button onClick={() => setActiveTab('analysis')} className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'analysis' ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' : 'text-slate-500 hover:text-slate-300'}`}>🧠 Análisis</button>
                            <button onClick={() => setActiveTab('messages')} className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'messages' ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5' : 'text-slate-500 hover:text-slate-300'}`}>✉️ Mensajes</button>
                        </div>
                        {/* Tab Content */}
                        <div className="overflow-y-auto p-5 space-y-3">
                            {activeTab === 'analysis' && (
                                <>
                                    {analysisCandidate.analysis_psychological && (<div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/20"><h4 className="font-semibold text-orange-400 text-xs mb-1">🧠 Perfil Psicológico</h4><p className="text-slate-300 text-sm">{analysisCandidate.analysis_psychological}</p></div>)}
                                    {analysisCandidate.analysis_business && (<div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20"><h4 className="font-semibold text-blue-400 text-xs mb-1">📊 Momento de Negocio</h4><p className="text-slate-300 text-sm">{analysisCandidate.analysis_business}</p></div>)}
                                    {analysisCandidate.analysis_sales_angle && (<div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20"><h4 className="font-semibold text-purple-400 text-xs mb-1">🎯 Ángulo de Venta</h4><p className="text-slate-300 text-sm">{analysisCandidate.analysis_sales_angle}</p></div>)}
                                    {analysisCandidate.analysis_bottleneck && (<div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20"><h4 className="font-semibold text-emerald-400 text-xs mb-1">⚡ Cuello de Botella</h4><p className="text-slate-300 text-sm">{analysisCandidate.analysis_bottleneck}</p></div>)}
                                    {analysisCandidate.ai_summary && analysisCandidate.ai_summary.length > 0 && (<div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700"><h4 className="font-semibold text-slate-300 text-xs mb-2">📋 Resumen IA</h4><ul className="space-y-1">{analysisCandidate.ai_summary.map((point, i) => (<li key={i} className="text-sm text-slate-400 flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span> {point}</li>))}</ul></div>)}
                                    {!hasAnalysis(analysisCandidate) && (<div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center"><p className="text-slate-400 text-sm">Sin análisis IA disponible.</p></div>)}
                                </>
                            )}
                            {activeTab === 'messages' && (
                                <>
                                    {analysisCandidate.outreach_icebreaker && (<div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20"><div className="flex items-center justify-between mb-1.5"><h4 className="font-semibold text-blue-400 text-xs">👋 Primer Contacto</h4><button onClick={() => copyToClipboard(analysisCandidate!.outreach_icebreaker!, 'icebreaker')} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300">{copiedKey === 'icebreaker' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="text-slate-300 text-sm whitespace-pre-wrap">{analysisCandidate.outreach_icebreaker}</p></div>)}
                                    {analysisCandidate.outreach_pitch && (<div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20"><div className="flex items-center justify-between mb-1.5"><h4 className="font-semibold text-purple-400 text-xs">🚀 Post-Aceptación</h4><button onClick={() => copyToClipboard(analysisCandidate!.outreach_pitch!, 'pitch')} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300">{copiedKey === 'pitch' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="text-slate-300 text-sm whitespace-pre-wrap">{analysisCandidate.outreach_pitch}</p></div>)}
                                    {analysisCandidate.outreach_followup && (<div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20"><div className="flex items-center justify-between mb-1.5"><h4 className="font-semibold text-emerald-400 text-xs">🔄 Follow-up</h4><button onClick={() => copyToClipboard(analysisCandidate!.outreach_followup!, 'followup')} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300">{copiedKey === 'followup' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="text-slate-300 text-sm whitespace-pre-wrap">{analysisCandidate.outreach_followup}</p></div>)}
                                    {!hasMessages(analysisCandidate) && (<div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center"><p className="text-slate-400 text-sm">Sin mensajes generados aún.</p></div>)}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

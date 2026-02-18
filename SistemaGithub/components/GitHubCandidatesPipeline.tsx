import React, { useState } from 'react';
import { GitHubMetrics } from '../../types/database';
import { ChevronUp, ChevronDown, ExternalLink, Trophy, Eye, X, Copy, Check, Calendar, Linkedin, Mail, BrainCircuit, Target, TrendingUp, AlertTriangle, Zap, MessageSquare, Send, Save, Loader } from 'lucide-react';
import { GitHubCandidatePersistence } from '../../lib/githubCandidatePersistence';

interface GitHubCandidatesPipelineProps {
    candidates: GitHubMetrics[];
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
    campaignId?: string;
}

type SortField = 'github_username' | 'github_score' | 'followers' | 'public_repos' | 'total_contributions';
type SortDirection = 'asc' | 'desc';

export const GitHubCandidatesPipeline: React.FC<GitHubCandidatesPipelineProps> = ({
    candidates,
    formatNumber,
    getScoreBadgeColor,
    campaignId
}) => {
    const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
        field: 'github_score',
        direction: 'asc'
    });

    const [selectedCandidate, setSelectedCandidate] = useState<GitHubMetrics | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [messageModalOpen, setMessageModalOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<{
        type: 'icebreaker' | 'pitch' | 'followup';
        value: string;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const handleCopy = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleMessageEdit = (type: 'icebreaker' | 'pitch' | 'followup') => {
        if (!selectedCandidate) return;
        let value = '';
        if (type === 'icebreaker') value = selectedCandidate.outreach_icebreaker || '';
        if (type === 'pitch') value = selectedCandidate.outreach_pitch || '';
        if (type === 'followup') value = selectedCandidate.outreach_followup || 'Solo quería asegurarme de que viste mi mensaje anterior sobre...';

        setEditingMessage({ type, value });
        setMessageModalOpen(true);
    };

    const handleSaveMessage = async () => {
        if (!editingMessage || !selectedCandidate || !campaignId) return;

        setIsSaving(true);
        setSaveStatus('saving');

        try {
            const messagesToSave: any = {
                [editingMessage.type === 'icebreaker' ? 'outreach_icebreaker' : 
                 editingMessage.type === 'pitch' ? 'outreach_pitch' : 
                 'outreach_followup']: editingMessage.value
            };

            const success = await GitHubCandidatePersistence.saveOutreachMessages(
                campaignId,
                selectedCandidate.github_username,
                messagesToSave
            );

            if (success) {
                setSaveStatus('saved');
                // Update local candidate state
                if (editingMessage.type === 'icebreaker') {
                    selectedCandidate.outreach_icebreaker = editingMessage.value;
                } else if (editingMessage.type === 'pitch') {
                    selectedCandidate.outreach_pitch = editingMessage.value;
                } else {
                    selectedCandidate.outreach_followup = editingMessage.value;
                }
                
                // Close modal after successful save
                setTimeout(() => {
                    setMessageModalOpen(false);
                    setEditingMessage(null);
                    setSaveStatus('idle');
                }, 1500);
            } else {
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch (err) {
            console.error('Error saving message:', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
        }
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
            const dateStr = c.updated_at || c.created_at || new Date().toISOString(); // Use insertion date, not GitHub account creation
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
                        <th className="px-4 py-3">Contacto</th>
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

                                    {/* Contact Info (New Column) */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1.5">
                                            {candidate.linkedin_url ? (
                                                <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-blue-400 transition-colors">
                                                    <Linkedin className="h-3 w-3 text-blue-500" />
                                                    <span className="truncate max-w-[100px]">LinkedIn</span>
                                                </a>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <Linkedin className="h-3 w-3 opacity-50" />
                                                    <span>No disponible</span>
                                                </div>
                                            )}

                                            {candidate.mentioned_email ? (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-300 group/email cursor-pointer" onClick={() => { navigator.clipboard.writeText(candidate.mentioned_email || ''); alert('Email copiado'); }}>
                                                    <Mail className="h-3 w-3 text-slate-500 group-hover/email:text-orange-400 transition-colors" />
                                                    <span className="truncate max-w-[100px]">{candidate.mentioned_email}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <Mail className="h-3 w-3 opacity-50" />
                                                    <span>No email</span>
                                                </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-md"></div>
                                    <img
                                        src={selectedCandidate.avatar_url || `https://ui-avatars.com/api/?name=${selectedCandidate.github_username}&background=1e293b&color=94a3b8`}
                                        alt={selectedCandidate.github_username}
                                        className="relative h-14 w-14 rounded-full ring-2 ring-orange-500/50 object-cover"
                                    />
                                    <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-1 border border-slate-700">
                                        <span className="text-sm">🤖</span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        {selectedCandidate.name || selectedCandidate.github_username}
                                        <a href={`https://github.com/${selectedCandidate.github_username}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </h3>
                                    <p className="text-orange-400 text-sm font-medium flex items-center gap-2">
                                        {selectedCandidate.bio ? (selectedCandidate.bio.length > 60 ? selectedCandidate.bio.substring(0, 60) + '...' : selectedCandidate.bio) : 'Desarrollador GitHub'}
                                        <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                                            Score: {Math.round(selectedCandidate.github_score)}%
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">

                            {/* 4-Card Grid Analysis */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Card 1: Perfil Psicológico */}
                                <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl hover:border-orange-500/30 transition-all group">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">
                                        <BrainCircuit className="h-4 w-4" />
                                        Perfil Psicológico
                                    </h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        {selectedCandidate.analysis_psychological || "Perfil técnico enfocado en la calidad del código y la arquitectura escalable. Muestra tendencias hacia la resolución metódica de problemas y aprendizaje continuo."}
                                    </p>
                                </div>

                                {/* Card 2: Momento Empresarial */}
                                <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl hover:border-orange-500/30 transition-all group">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">
                                        <TrendingUp className="h-4 w-4" />
                                        Momento Empresarial
                                    </h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        {selectedCandidate.analysis_business || "Actualmente contribuyendo activamente, podría estar abierto a roles de mayor impacto técnico o liderazgo en proyectos greenfield."}
                                    </p>
                                </div>

                                {/* Card 3: Ángulo de Venta */}
                                <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl hover:border-orange-500/30 transition-all group">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase tracking-wider mb-3">
                                        <Target className="h-4 w-4" />
                                        Ángulo de Venta
                                    </h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        {selectedCandidate.analysis_sales_angle || `Resaltar la oportunidad de trabajar con tecnologías modernas como ${selectedCandidate.most_used_language} en un entorno de alto crecimiento.`}
                                    </p>
                                </div>

                                {/* Card 4: Cuello de Botella */}
                                <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl hover:border-orange-500/30 transition-all group">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-pink-400 uppercase tracking-wider mb-3">
                                        <AlertTriangle className="h-4 w-4" />
                                        Cuello de Botella
                                    </h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        {selectedCandidate.analysis_bottleneck || "Posible resistencia a cambiar de stack si no se ofrece suficiente autonomía técnica o retos de ingeniería complejos."}
                                    </p>
                                </div>
                            </div>

                            {/* Skills Row */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Habilidades Clave</h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedCandidate.languages?.map((lang) => (
                                        <span key={lang} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium">
                                            {lang}
                                        </span>
                                    ))}
                                    <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium">
                                        System Design
                                    </span>
                                    <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium">
                                        Clean Code
                                    </span>
                                </div>
                            </div>

                                {/* Messages Section */}
                            <div className="border-t border-slate-800 pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-base font-bold text-white">Estrategia de Outreach</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Message 1 */}
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col h-full hover:border-blue-500/30 transition-colors">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                                <Send className="h-4 w-4 text-blue-400" />
                                            </div>
                                            <span className="text-xs font-bold text-blue-400 uppercase">1. Invitación</span>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-4 line-clamp-4 hover:line-clamp-none">
                                            "{selectedCandidate.outreach_icebreaker || `Hola ${selectedCandidate.name || 'Antonio'}, impresionado con tu trabajo en ${selectedCandidate.most_used_language}...`}"
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleCopy(selectedCandidate.outreach_icebreaker || '', 'msg1')}
                                                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                                            >
                                                {copiedField === 'msg1' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                Copiar
                                            </button>
                                            <button
                                                onClick={() => handleMessageEdit('icebreaker')}
                                                className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs font-medium text-blue-400 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Ver/Editar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message 2 */}
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col h-full hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                                <MessageSquare className="h-4 w-4 text-emerald-400" />
                                            </div>
                                            <span className="text-xs font-bold text-emerald-400 uppercase">2. Post-Aceptación</span>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-4 line-clamp-4 hover:line-clamp-none">
                                            "{selectedCandidate.outreach_pitch || `Gracias por conectar. Me gustaría comentarte sobre un reto técnico en...`}"
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleCopy(selectedCandidate.outreach_pitch || '', 'msg2')}
                                                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                                            >
                                                {copiedField === 'msg2' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                Copiar
                                            </button>
                                            <button
                                                onClick={() => handleMessageEdit('pitch')}
                                                className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Ver/Editar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message 3 */}
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col h-full hover:border-purple-500/30 transition-colors">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-purple-500/10 rounded-lg">
                                                <Zap className="h-4 w-4 text-purple-400" />
                                            </div>
                                            <span className="text-xs font-bold text-purple-400 uppercase">3. Seguimiento</span>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-4 line-clamp-4 hover:line-clamp-none">
                                            "{selectedCandidate.outreach_followup || 'Solo quería asegurarme de que viste mi mensaje anterior sobre...'}"
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleCopy(selectedCandidate.outreach_followup || "Solo quería asegurarme de que viste mi mensaje anterior sobre...", 'msg3')}
                                                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                                            >
                                                {copiedField === 'msg3' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                Copiar
                                            </button>
                                            <button
                                                onClick={() => handleMessageEdit('followup')}
                                                className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-medium text-purple-400 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Ver/Editar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Modal - Expandible para ver/editar mensajes completos */}
            {messageModalOpen && editingMessage && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-2xl w-full my-8 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white">
                                    {editingMessage.type === 'icebreaker' && '1️⃣ Mensaje de Invitación'}
                                    {editingMessage.type === 'pitch' && '2️⃣ Mensaje Post-Aceptación'}
                                    {editingMessage.type === 'followup' && '3️⃣ Mensaje de Seguimiento'}
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">Ver y editar el mensaje completo para este candidato</p>
                            </div>
                            <button
                                onClick={() => {
                                    setMessageModalOpen(false);
                                    setEditingMessage(null);
                                }}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>

                        {/* Message Content */}
                        <div className="mb-6 bg-slate-950 border border-slate-800 rounded-lg p-6">
                            <textarea
                                value={editingMessage.value}
                                onChange={(e) =>
                                    setEditingMessage({ ...editingMessage, value: e.target.value })
                                }
                                className="w-full h-64 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 text-base leading-relaxed resize-none focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20"
                                placeholder="Escribe o edita el mensaje aquí..."
                            />
                            <p className="text-xs text-slate-500 mt-3">
                                {editingMessage.value.length} caracteres
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    handleCopy(editingMessage.value, 'modal-copy');
                                    setTimeout(() => setCopiedField(null), 2000);
                                }}
                                className="flex-1 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 rounded-lg text-green-400 font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                {copiedField === 'modal-copy' ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        ¡Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        Copiar Mensaje
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleSaveMessage}
                                disabled={isSaving || !campaignId}
                                className={`flex-1 py-3 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2 border ${
                                    !campaignId
                                        ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                                        : saveStatus === 'saved'
                                        ? 'bg-green-600/30 border-green-600/50 text-green-300'
                                        : saveStatus === 'error'
                                        ? 'bg-red-600/30 border-red-600/50 text-red-300'
                                        : 'bg-orange-600/20 hover:bg-orange-600/30 border-orange-600/50 text-orange-300'
                                }`}
                                title={!campaignId ? 'Abre desde un contexto de campaña para guardar' : ''}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader className="h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : saveStatus === 'saved' ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        ¡Guardado!
                                    </>
                                ) : saveStatus === 'error' ? (
                                    <>
                                        <X className="h-4 w-4" />
                                        Error de Guardado
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Info */}
                        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-blue-400 text-sm">
                                💡 <strong>Tip:</strong> Edita el mensaje y haz clic en "Guardar Cambios" para guardar en Supabase. O "Copiar Mensaje" para usarlo ahora.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
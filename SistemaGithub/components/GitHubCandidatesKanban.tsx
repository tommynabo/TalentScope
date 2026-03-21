import React, { useState, useEffect } from 'react';
import { GitHubMetrics } from '../../types/database';
import { Plus, GripVertical, BrainCircuit, X, Copy, Check } from 'lucide-react';

interface GitHubCandidatesKanbanProps {
    candidates: GitHubMetrics[];
    onStatusChange?: (candidateUsername: string, newStatus: string) => void;
}

type ContactStatus = 'Pool' | 'Contacted' | 'Responded' | 'Scheduled' | 'Offer Sent' | 'Hired' | 'Rejected';

const COLUMNS: { id: ContactStatus; label: string; color: string; bgColor: string }[] = [
    { id: 'Pool', label: 'En Reserva', color: 'bg-slate-500', bgColor: 'bg-slate-500/10' },
    { id: 'Contacted', label: 'Contactado', color: 'bg-blue-500', bgColor: 'bg-blue-500/10' },
    { id: 'Responded', label: 'Respondió', color: 'bg-yellow-500', bgColor: 'bg-yellow-500/10' },
    { id: 'Scheduled', label: 'Agendado', color: 'bg-purple-500', bgColor: 'bg-purple-500/10' },
    { id: 'Offer Sent', label: 'Oferta', color: 'bg-emerald-500', bgColor: 'bg-emerald-500/10' },
    { id: 'Hired', label: 'Contratado', color: 'bg-green-600', bgColor: 'bg-green-600/10' },
    { id: 'Rejected', label: 'Rechazado', color: 'bg-red-500', bgColor: 'bg-red-500/10' },
];

interface CandidateInBoard extends GitHubMetrics {
    status?: ContactStatus;
}

export const GitHubCandidatesKanban: React.FC<GitHubCandidatesKanbanProps> = ({
    candidates,
    onStatusChange
}) => {
    const [boardState, setBoardState] = useState<CandidateInBoard[]>(candidates.map(c => ({
        ...c,
        status: (c as any).status || 'Pool' as ContactStatus
    })));
    const [analysisCandidate, setAnalysisCandidate] = useState<CandidateInBoard | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'messages'>('analysis');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const hasAnalysis = (c: CandidateInBoard) =>
        !!(c.analysis_psychological || c.analysis_business || c.analysis_sales_angle || c.analysis_bottleneck || (c.ai_summary && c.ai_summary.length > 0));

    const hasMessages = (c: CandidateInBoard) =>
        !!(c.outreach_icebreaker || c.outreach_pitch || c.outreach_followup);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    useEffect(() => {
        setBoardState(candidates.map(c => ({
            ...c,
            status: (c as any).status || 'Pool' as ContactStatus
        })));
    }, [candidates]);

    const handleDragStart = (e: React.DragEvent, candidateUsername: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('candidateUsername', candidateUsername);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, status: ContactStatus) => {
        e.preventDefault();
        const candidateUsername = e.dataTransfer.getData('candidateUsername');
        
        if (candidateUsername) {
            setBoardState(prev =>
                prev.map(c =>
                    c.github_username === candidateUsername
                        ? { ...c, status }
                        : c
                )
            );
            onStatusChange?.(candidateUsername, status);
        }
    };

    const getColumnCandidates = (status: ContactStatus) => {
        return boardState.filter(c => c.status === status);
    };

    return (
        <>
        <div className="h-full overflow-x-auto">
            <div className="flex gap-4 p-4 min-w-max">
                {COLUMNS.map(column => {
                    const columnCandidates = getColumnCandidates(column.id);

                    return (
                        <div
                            key={column.id}
                            className="w-80 flex-shrink-0 flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"
                        >
                            {/* Column Header */}
                            <div className={`px-4 py-3 border-b border-slate-800 ${column.bgColor}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                                        <h3 className="font-semibold text-slate-200">{column.label}</h3>
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-800/50 px-2 py-1 rounded-full">
                                        {columnCandidates.length}
                                    </span>
                                </div>
                            </div>

                            {/* Column Body */}
                            <div
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, column.id)}
                                className="flex-1 p-3 overflow-y-auto space-y-3 hover:bg-slate-800/20 transition-colors"
                                style={{ minHeight: '400px' }}
                            >
                                {columnCandidates.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-600">
                                        <div className="text-center">
                                            <Plus className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                            <p className="text-xs">Arrastra candidatos aquí</p>
                                        </div>
                                    </div>
                                ) : (
                                    columnCandidates.map(candidate => (
                                        <div
                                            key={candidate.github_username}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, candidate.github_username)}
                                            className="p-3 bg-slate-800 border border-slate-700 rounded-lg hover:border-orange-500/50 cursor-move hover:shadow-md hover:shadow-orange-500/10 transition-all group"
                                        >
                                            {/* Drag Handle + Avatar + Name */}
                                            <div className="flex items-start gap-2 mb-2">
                                                <GripVertical className="h-3.5 w-3.5 text-slate-600 mt-0.5 flex-shrink-0 group-hover:text-slate-500" />
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    <img
                                                        src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8`}
                                                        alt={candidate.github_username}
                                                        className="h-8 w-8 rounded-full ring-2 ring-orange-500/20 flex-shrink-0"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <a
                                                            href={`https://github.com/${candidate.github_username}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold text-white hover:text-orange-400 block truncate"
                                                        >
                                                            {candidate.github_username}
                                                        </a>
                                                        {candidate.name && (
                                                            <p className="text-xs text-slate-500 truncate">{candidate.name}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bio */}
                                            {candidate.bio && (
                                                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{candidate.bio}</p>
                                            )}

                                            {/* Score + Language + AI button */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-orange-400">
                                                        {Math.round(candidate.github_score)}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAnalysisCandidate(candidate); setActiveTab('analysis'); }}
                                                        className={`p-0.5 transition-colors ${hasAnalysis(candidate) || hasMessages(candidate) ? 'text-purple-400 hover:text-purple-300' : 'text-slate-600 hover:text-slate-400'}`}
                                                        title="Ver Análisis IA"
                                                    >
                                                        <BrainCircuit className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                {candidate.most_used_language && (
                                                    <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">
                                                        {candidate.most_used_language}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
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
                                {analysisCandidate.outreach_icebreaker && (<div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20"><div className="flex items-center justify-between mb-1.5"><h4 className="font-semibold text-blue-400 text-xs">👋 Primer Contacto</h4><button onClick={() => copyToClipboard(analysisCandidate.outreach_icebreaker!, 'icebreaker')} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300">{copiedKey === 'icebreaker' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="text-slate-300 text-sm whitespace-pre-wrap">{analysisCandidate.outreach_icebreaker}</p></div>)}
                                {analysisCandidate.outreach_pitch && (<div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20"><div className="flex items-center justify-between mb-1.5"><h4 className="font-semibold text-purple-400 text-xs">🚀 Post-Aceptación</h4><button onClick={() => copyToClipboard(analysisCandidate.outreach_pitch!, 'pitch')} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300">{copiedKey === 'pitch' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="text-slate-300 text-sm whitespace-pre-wrap">{analysisCandidate.outreach_pitch}</p></div>)}
                                {analysisCandidate.outreach_followup && (<div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20"><div className="flex items-center justify-between mb-1.5"><h4 className="font-semibold text-emerald-400 text-xs">🔄 Follow-up</h4><button onClick={() => copyToClipboard(analysisCandidate.outreach_followup!, 'followup')} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300">{copiedKey === 'followup' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="text-slate-300 text-sm whitespace-pre-wrap">{analysisCandidate.outreach_followup}</p></div>)}
                                {!hasMessages(analysisCandidate) && (<div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center"><p className="text-slate-400 text-sm">Sin mensajes generados aún.</p></div>)}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
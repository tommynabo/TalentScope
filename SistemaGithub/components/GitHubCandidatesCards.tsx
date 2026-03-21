import React, { useState } from 'react';
import { GitHubMetrics } from '../../types/database';
import { Star, GitBranch, Users, Code2, Trophy, ExternalLink, Plus, BrainCircuit, X, Copy, Check } from 'lucide-react';

interface GitHubCandidatesCardsProps {
    candidates: GitHubMetrics[];
    onAddToCampaign?: (candidate: GitHubMetrics) => void;
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
}

export const GitHubCandidatesCards: React.FC<GitHubCandidatesCardsProps> = ({
    candidates,
    onAddToCampaign,
    formatNumber,
    getScoreBadgeColor
}) => {
    const [analysisCandidate, setAnalysisCandidate] = useState<GitHubMetrics | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'messages'>('analysis');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const hasAnalysis = (c: GitHubMetrics) =>
        !!(c.analysis_psychological || c.analysis_business || c.analysis_sales_angle || c.analysis_bottleneck || (c.ai_summary && c.ai_summary.length > 0));

    const hasMessages = (c: GitHubMetrics) =>
        !!(c.outreach_icebreaker || c.outreach_pitch || c.outreach_followup);

    return (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((candidate) => (
                <div
                    key={candidate.github_username}
                    className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10 group"
                >
                    {/* Header with Avatar */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                            <img
                                src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8`}
                                alt={candidate.github_username}
                                className="h-10 w-10 rounded-full ring-2 ring-orange-500/20"
                            />
                            <div className="flex-1 min-w-0">
                                <a
                                    href={`https://github.com/${candidate.github_username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-bold text-white hover:text-orange-400 block truncate group-hover:underline"
                                >
                                    {candidate.github_username}
                                </a>
                                {candidate.name && (
                                    <p className="text-xs text-slate-400 truncate">{candidate.name}</p>
                                )}
                            </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getScoreBadgeColor(candidate.github_score)}`}>
                            {Math.round(candidate.github_score)}
                        </div>
                    </div>

                    {/* Bio */}
                    {candidate.bio && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{candidate.bio}</p>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4 p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                        <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-slate-300">{formatNumber(candidate.followers)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-slate-300">{candidate.public_repos}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Code2 className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-slate-300">{candidate.total_contributions}</span>
                        </div>
                        {candidate.most_used_language && (
                            <div className="flex items-center gap-1.5">
                                <Trophy className="h-3.5 w-3.5 text-orange-400" />
                                <span className="text-xs text-slate-300 truncate">{candidate.most_used_language}</span>
                            </div>
                        )}
                    </div>

                    {/* Top Repos */}
                    {candidate.top_repositories && candidate.top_repositories.length > 0 && (
                        <div className="mb-4 p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                            <p className="text-xs font-semibold text-slate-300 mb-2">Proyectos</p>
                            <div className="space-y-1.5">
                                {candidate.top_repositories.slice(0, 3).map((repo, idx) => (
                                    <a
                                        key={idx}
                                        href={repo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-1.5 bg-slate-900/50 rounded hover:bg-orange-500/10 border border-slate-700/50 hover:border-orange-500/30 transition-all group/repo"
                                    >
                                        <Star className="h-3 w-3 text-orange-400 flex-shrink-0" />
                                        <span className="text-xs text-slate-400 group-hover/repo:text-orange-300 truncate">{repo.name}</span>
                                        <span className="text-xs text-slate-500 flex-shrink-0">{repo.stars}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                        <button
                            onClick={() => { setAnalysisCandidate(candidate); setActiveTab('analysis'); }}
                            className={`p-2 rounded-lg transition-colors ${hasAnalysis(candidate) || hasMessages(candidate) ? 'text-purple-400 hover:text-purple-300 hover:bg-slate-700' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700'}`}
                            title="Ver Análisis IA"
                        >
                            <BrainCircuit className="h-4 w-4" />
                        </button>
                        <a
                            href={`https://github.com/${candidate.github_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver Perfil
                        </a>
                        {onAddToCampaign && (
                            <button
                                onClick={() => onAddToCampaign(candidate)}
                                className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Agregar
                            </button>
                        )}
                    </div>
                </div>
            ))}
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
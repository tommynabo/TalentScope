import React, { useState } from 'react';
import { GitHubMetrics } from '../types/database';
import { ExternalLink, Mail, Linkedin, BrainCircuit, X } from 'lucide-react';

interface GitHubCandidatesCardsProps {
    candidates: GitHubMetrics[];
    onAddToCampaign?: (candidate: GitHubMetrics) => void;
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
}

export const GitHubCandidatesCards: React.FC<GitHubCandidatesCardsProps> = ({
    candidates,
    formatNumber,
    getScoreBadgeColor
}) => {
    const [analysisCandidate, setAnalysisCandidate] = useState<GitHubMetrics | null>(null);

    const hasAnalysis = (c: GitHubMetrics) =>
        !!(c.analysis_psychological || c.analysis_business || c.analysis_sales_angle || c.analysis_bottleneck || (c.ai_summary && c.ai_summary.length > 0));

    const getLanguageBadgeColor = (language: string): string => {
        const colors: Record<string, string> = {
            'JavaScript': 'bg-yellow-600 text-yellow-50',
            'TypeScript': 'bg-blue-600 text-blue-50',
            'Python': 'bg-blue-500 text-blue-50',
            'Java': 'bg-orange-600 text-orange-50',
            'C++': 'bg-purple-600 text-purple-50',
            'Go': 'bg-cyan-600 text-cyan-50',
            'Rust': 'bg-orange-700 text-orange-50',
            'Ruby': 'bg-red-600 text-red-50',
            'PHP': 'bg-purple-800 text-purple-50',
            'Swift': 'bg-orange-500 text-orange-50'
        };
        return colors[language] || 'bg-slate-700 text-slate-50';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                {/* Table Header */}
                <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">DESARROLLADOR</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">LENGUAJES</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">SCORE</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">SEGUIDORES</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">REPOSITORIOS</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">ACCIONES</th>
                    </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-slate-800">
                    {candidates.map((candidate) => (
                        <tr key={candidate.github_username} className="hover:bg-slate-800/30 transition-colors">
                            {/* Developer Column */}
                            <td className="px-4 py-4 text-sm">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8`}
                                        alt={candidate.github_username}
                                        className="h-8 w-8 rounded-full ring-2 ring-orange-500/20"
                                    />
                                    <div>
                                        <a
                                            href={`https://github.com/${candidate.github_username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-white font-medium hover:text-orange-400 transition-colors"
                                        >
                                            {candidate.github_username}
                                        </a>
                                        {candidate.name && (
                                            <p className="text-xs text-slate-500">{candidate.name}</p>
                                        )}
                                    </div>
                                </div>
                            </td>

                            {/* Languages Column */}
                            <td className="px-4 py-4 text-sm">
                                <div className="flex flex-wrap gap-1.5">
                                    {candidate.most_used_language && (
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getLanguageBadgeColor(candidate.most_used_language)}`}>
                                            {candidate.most_used_language}
                                        </span>
                                    )}
                                    {candidate.languages && candidate.languages.slice(0, 2).map((lang, idx) => (
                                        <span key={idx} className={`px-2.5 py-1 rounded-full text-xs font-medium ${getLanguageBadgeColor(lang)}`}>
                                            {lang}
                                        </span>
                                    ))}
                                </div>
                            </td>

                            {/* Score Column */}
                            <td className="px-4 py-4 text-center">
                                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getScoreBadgeColor(candidate.github_score)}`}>
                                    {Math.round(candidate.github_score)}
                                </span>
                            </td>

                            {/* Followers Column */}
                            <td className="px-4 py-4 text-center text-slate-300 text-sm">
                                {formatNumber(candidate.followers)}
                            </td>

                            {/* Repos Column */}
                            <td className="px-4 py-4 text-center text-slate-300 text-sm">
                                {candidate.public_repos}
                            </td>

                            {/* Actions Column */}
                            <td className="px-4 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    {hasAnalysis(candidate) && (
                                        <button
                                            onClick={() => setAnalysisCandidate(candidate)}
                                            className="p-2 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors"
                                            title="Ver Análisis IA"
                                        >
                                            <BrainCircuit className="h-4 w-4" />
                                        </button>
                                    )}
                                    <a
                                        href={`https://github.com/${candidate.github_username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Ver perfil GitHub"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                    {candidate.email && (
                                        <a
                                            href={`mailto:${candidate.email}`}
                                            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                                            title={`Enviar email a ${candidate.email}`}
                                        >
                                            <Mail className="h-4 w-4" />
                                        </a>
                                    )}
                                    {candidate.linkedin_profile && (
                                        <a
                                            href={candidate.linkedin_profile}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                                            title="Ir a LinkedIn"
                                        >
                                            <Linkedin className="h-4 w-4" />
                                        </a>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* AI Analysis Modal */}
            {analysisCandidate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAnalysisCandidate(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <BrainCircuit className="h-5 w-5 text-purple-400" /> AI Analysis — @{analysisCandidate.github_username}
                            </h3>
                            <button onClick={() => setAnalysisCandidate(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        </div>
                        {analysisCandidate.ai_summary && analysisCandidate.ai_summary.length > 0 && (
                            <div className="mt-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
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
                    </div>
                </div>
            )}
        </div>
    );
};
import React, { useState } from 'react';
import { GitHubMetrics } from '../types/database';
import { ChevronUp, ChevronDown, ExternalLink, Trophy, BrainCircuit, Mail } from 'lucide-react';

interface GitHubCandidatesPipelineProps {
    candidates: GitHubMetrics[];
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
    onViewCandidate?: (candidate: GitHubMetrics) => void;
}

const detectDeveloperRole = (metrics: GitHubMetrics): string => {
    const lang = metrics.most_used_language || 'Developer';
    if (!lang) return 'Developer';
    
    const lower = lang.toLowerCase();
    if (['react', 'typescript', 'javascript', 'vue'].some(t => lower.includes(t))) {
        return 'Frontend Engineer';
    } else if (['python', 'django', 'flask'].some(t => lower.includes(t))) {
        return 'Backend Engineer';
    } else if (['dart', 'flutter', 'kotlin'].some(t => lower.includes(t))) {
        return 'Mobile Engineer';
    } else if (['rust', 'go', 'c++'].some(t => lower.includes(t))) {
        return 'Systems Engineer';
    }
    return `${lang} Developer`;
};

const getQualityBadge = (score: number): { label: string; color: string } => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (score >= 70) return { label: 'Good', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    if (score >= 60) return { label: 'Fair', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    return { label: 'Fair', color: 'bg-slate-700 text-slate-300 border-slate-600' };
};

export const GitHubCandidatesPipeline: React.FC<GitHubCandidatesPipelineProps> = ({
    candidates,
    formatNumber,
    getScoreBadgeColor,
    onViewCandidate
}) => {
    const sortedCandidates = [...candidates].sort((a, b) => b.github_score - a.github_score);

    if (candidates.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-500">
                <p>No hay candidatos para mostrar</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 min-h-96">
            {sortedCandidates.map((candidate) => {
                const quality = getQualityBadge(candidate.github_score);
                const role = detectDeveloperRole(candidate);
                
                return (
                    <div
                        key={candidate.github_username}
                        className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 hover:bg-slate-900/60 transition-all hover:border-orange-500/30"
                    >
                        {/* Row 1: Candidate Name & Role */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <img
                                        src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8&bold=true`}
                                        alt={candidate.github_username}
                                        className="h-10 w-10 rounded-full ring-2 ring-orange-500/30"
                                    />
                                    <div>
                                        <h3 className="font-bold text-white text-sm hover:text-orange-400 transition-colors">
                                            {candidate.name || candidate.github_username}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            {candidate.bio ? candidate.bio.substring(0, 50) : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Role, Status, Stats */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                            {/* Role / Tech Stack */}
                            <div className="text-xs text-slate-300">
                                <span className="font-semibold text-orange-300">{role}</span>
                                <span className="text-slate-500"> / {candidate.most_used_language || 'N/A'}</span>
                                <br />
                                <span className="text-slate-500">@ GitHub Profile</span>
                            </div>

                            {/* Separator */}
                            <div className="h-8 w-px bg-slate-700/50"></div>

                            {/* Quality Status Badge */}
                            <div className={`px-2.5 py-1 rounded border text-xs font-medium ${quality.color}`}>
                                {quality.label}
                            </div>

                            {/* Metrics */}
                            <div className="text-xs text-slate-400 flex gap-3 ml-auto">
                                <div>
                                    <span className="font-bold text-white">{formatNumber(candidate.followers || 0)}</span>
                                    <span className="text-slate-500"> followers</span>
                                </div>
                                <div>
                                    <span className="font-bold text-white">{candidate.public_repos}</span>
                                    <span className="text-slate-500"> repos</span>
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Bio/Description & Score & Actions */}
                        <div className="flex items-center justify-between gap-4">
                            {/* Description/Bio */}
                            <div className="flex-1">
                                <p className="text-sm text-slate-300 line-clamp-2 italic">
                                    {candidate.bio && `"${candidate.bio.substring(0, 80)}..."`}
                                </p>
                            </div>

                            {/* Score */}
                            <div className="flex items-center gap-2 min-w-max">
                                <div className="flex-1 w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
                                        style={{ width: `${Math.min(candidate.github_score, 100)}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-bold text-orange-400 min-w-fit">
                                    {Math.round(candidate.github_score)}%
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                                {onViewCandidate && (
                                    <button
                                        onClick={() => onViewCandidate(candidate)}
                                        className="inline-flex items-center gap-2 text-xs font-semibold text-orange-400 hover:text-orange-300 hover:bg-orange-500/15 px-3 py-1.5 rounded-lg transition-all border border-orange-500/30 hover:border-orange-500/50"
                                    >
                                        <BrainCircuit className="h-4 w-4" />
                                        Ver
                                    </button>
                                )}
                                <a
                                    href={`https://github.com/${candidate.github_username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-orange-400 hover:bg-slate-800 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                                    title="GitHub Profile"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                {candidate.mentioned_email && (
                                    <a
                                        href={`mailto:${candidate.mentioned_email}`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-2 py-1.5 rounded-lg transition-colors border border-cyan-500/20 hover:border-cyan-500/40"
                                        title={candidate.mentioned_email}
                                    >
                                        <Mail className="h-3.5 w-3.5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
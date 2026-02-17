import React from 'react';
import { GitHubMetrics } from '../../types/database';
import { Star, GitBranch, Users, Code2, Trophy, ExternalLink, Plus } from 'lucide-react';

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
    return (
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
                        {/* Followers */}
                        <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-slate-300">{formatNumber(candidate.followers)}</span>
                        </div>

                        {/* Public Repos */}
                        <div className="flex items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-slate-300">{candidate.public_repos}</span>
                        </div>

                        {/* Contributions */}
                        <div className="flex items-center gap-1.5">
                            <Code2 className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-slate-300">{candidate.total_contributions}</span>
                        </div>

                        {/* Top Language */}
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
    );
};
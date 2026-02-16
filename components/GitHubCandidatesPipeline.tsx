import React, { useState } from 'react';
import { GitHubMetrics } from '../types/database';
import { ChevronUp, ChevronDown, ExternalLink, Trophy } from 'lucide-react';

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
        direction: 'desc'
    });

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

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-700 bg-slate-900/50">
                        <th
                            className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors select-none"
                            onClick={() => toggleSort('github_username')}
                        >
                            <div className="flex items-center gap-2">
                                Développeur
                                {sortConfig.field === 'github_username' && (
                                    sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                )}
                            </div>
                        </th>
                        <th className="px-4 py-3">Bio</th>
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
                        <th
                            className="px-4 py-3 cursor-pointer hover:text-slate-200 transition-colors select-none"
                            onClick={() => toggleSort('total_contributions')}
                        >
                            <div className="flex items-center gap-2">
                                Contribuciones
                                {sortConfig.field === 'total_contributions' && (
                                    sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3 text-orange-400" /> : <ChevronUp className="h-3 w-3 text-orange-400" />
                                )}
                            </div>
                        </th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedCandidates.map((candidate, idx) => (
                        <tr key={candidate.github_username} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${idx % 2 === 0 ? 'bg-slate-900/30' : ''}`}>
                            {/* Developer Name */}
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
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
                                            className="text-xs font-bold text-white hover:text-orange-400"
                                        >
                                            {candidate.github_username}
                                        </a>
                                        {candidate.name && (
                                            <p className="text-xs text-slate-500">{candidate.name}</p>
                                        )}
                                    </div>
                                </div>
                            </td>

                            {/* Bio */}
                            <td className="px-4 py-3">
                                <p className="text-xs text-slate-400 line-clamp-1">
                                    {candidate.bio || '—'}
                                </p>
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
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${candidate.github_score > 80 ? 'bg-gradient-to-r from-emerald-400 to-orange-400' : candidate.github_score > 60 ? 'bg-orange-500' : 'bg-slate-500'}`}
                                            style={{ width: `${Math.min(candidate.github_score, 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className={`text-xs font-bold min-w-fit ${getScoreBadgeColor(candidate.github_score)}`}>
                                        {Math.round(candidate.github_score)}
                                    </span>
                                </div>
                            </td>

                            {/* Followers */}
                            <td className="px-4 py-3">
                                <span className="text-xs font-bold text-slate-300">{formatNumber(candidate.followers)}</span>
                            </td>

                            {/* Public Repos */}
                            <td className="px-4 py-3">
                                <span className="text-xs font-bold text-slate-300">{candidate.public_repos}</span>
                            </td>

                            {/* Contributions */}
                            <td className="px-4 py-3">
                                <span className="text-xs font-bold text-slate-300">{formatNumber(candidate.total_contributions)}</span>
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
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
import React from 'react';
import { GitHubMetrics } from '../types/database';
import { ExternalLink, Mail, BrainCircuit } from 'lucide-react';

interface GitHubCandidatesPipelineProps {
    candidates: GitHubMetrics[];
    formatNumber: (num: number) => string;
    getScoreBadgeColor: (score: number) => string;
    onViewCandidate?: (candidate: GitHubMetrics) => void;
}

const getTimeGroupLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ayer';
    } else {
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    }
};
const getTimeGroupLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ayer';
    } else {
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    }
};

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
    // Group candidates by date (newest first)
    const candidatesByDate = candidates.reduce((groups, candidate) => {
        const date = new Date(candidate.created_at).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(candidate);
        return groups;
    }, {} as Record<string, GitHubMetrics[]>);

    // Sort dates (newest first)
    const sortedDates = Object.keys(candidatesByDate).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    if (candidates.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-500">
                <p>No hay candidatos para mostrar</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {sortedDates.map((dateStr) => {
                const date = new Date(dateStr);
                const dayLeads = candidatesByDate[dateStr];
                const label = getTimeGroupLabel(dateStr);

                return (
                    <div key={dateStr}>
                        {/* Date Header */}
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                                📅 {label}
                            </h3>
                            <span className="px-2.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-semibold rounded-full border border-orange-500/30">
                                {dayLeads.length} lead{dayLeads.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Candidates for this date */}
                        <div className="space-y-3">
                            {dayLeads.map((candidate) => (
                                <div
                                    key={candidate.github_username}
                                    className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:bg-slate-900/70 hover:border-orange-500/40 transition-all group"
                                >
                                    {/* Row 1: Avatar + Name/Bio + Status */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <img
                                            src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${candidate.github_username}&background=1e293b&color=94a3b8&bold=true`}
                                            alt={candidate.github_username}
                                            className="h-12 w-12 rounded-full ring-2 ring-orange-500/30 flex-shrink-0"
                                        />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-white text-sm">
                                                {candidate.name || candidate.github_username}
                                            </h4>
                                            <p className="text-xs text-slate-400 line-clamp-1">
                                                {candidate.bio && candidate.bio.substring(0, 60)}
                                            </p>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-xs font-semibold rounded border border-emerald-500/30 whitespace-nowrap">
                                            En Reserva
                                        </div>
                                    </div>

                                    {/* Row 2: Role + Language + Metrics */}
                                    <div className="flex items-center gap-2 mb-3 text-xs text-slate-400 flex-wrap">
                                        <span className="font-semibold text-orange-300">
                                            {candidate.most_used_language || 'Developer'} Engineer
                                        </span>
                                        <span>{candidate.most_used_language || 'N/A'}</span>
                                        <span>•</span>
                                        <span>
                                            <strong className="text-white">{formatNumber(candidate.followers || 0)}</strong> followers
                                        </span>
                                        <span>•</span>
                                        <span>
                                            <strong className="text-white">{candidate.public_repos}</strong> repos
                                        </span>
                                    </div>

                                    {/* Row 3: Message Preview + Score + Actions */}
                                    <div className="flex items-end gap-3">
                                        {/* Message Preview */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-300 italic line-clamp-2">
                                                {candidate.mentioned_email ? (
                                                    <>
                                                        📧 {candidate.mentioned_email}
                                                    </>
                                                ) : candidate.linkedin_url ? (
                                                    <>
                                                        🔗 {candidate.linkedin_url.split('/').pop()}
                                                    </>
                                                ) : (
                                                    <>
                                                        Hola @{candidate.github_username}, vi tu trabajo en GitHub...
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        {/* Score */}
                                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
                                                    style={{ width: `${Math.min(candidate.github_score, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm font-bold text-orange-400 min-w-fit">
                                                {Math.round(candidate.github_score)}%
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                            {onViewCandidate && (
                                                <button
                                                    onClick={() => onViewCandidate(candidate)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 hover:bg-orange-500/15 rounded-lg transition-all border border-orange-500/30 hover:border-orange-500/50 whitespace-nowrap"
                                                    title="Deep Research"
                                                >
                                                    <BrainCircuit className="h-3.5 w-3.5" />
                                                    Ver
                                                </button>
                                            )}
                                            <a
                                                href={`https://github.com/${candidate.github_username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                                                title="GitHub Profile"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                            {candidate.mentioned_email && (
                                                <a
                                                    href={`mailto:${candidate.mentioned_email}`}
                                                    className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors border border-cyan-500/20 hover:border-cyan-500/40"
                                                    title={candidate.mentioned_email}
                                                >
                                                    <Mail className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
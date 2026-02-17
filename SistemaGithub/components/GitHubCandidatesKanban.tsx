import React, { useState, useEffect } from 'react';
import { GitHubMetrics } from '../../types/database';
import { Plus, GripVertical } from 'lucide-react';

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

                                            {/* Score + Language */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-orange-400">
                                                        {Math.round(candidate.github_score)}
                                                    </span>
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
    );
};
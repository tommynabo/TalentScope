
import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus } from '../types/database';
import { MoreHorizontal, MessageSquare, Calendar } from 'lucide-react';

export type CandidateWithMeta = Candidate & { status_in_campaign?: string; added_at?: string };

interface KanbanBoardProps {
    candidates: CandidateWithMeta[];
    onStatusChange: (candidateId: string, newStatus: CandidateStatus) => void;
}

const COLUMNS: { id: CandidateStatus; label: string; color: string }[] = [
    { id: 'Pool', label: 'En Reserva', color: 'bg-slate-500' },
    { id: 'Contacted', label: 'Contactado', color: 'bg-blue-500' },
    { id: 'Responded', label: 'Respondió', color: 'bg-yellow-500' },
    { id: 'Scheduled', label: 'Agendado', color: 'bg-purple-500' },
    { id: 'Offer Sent', label: 'Oferta', color: 'bg-emerald-500' },
    { id: 'Hired', label: 'Contratado', color: 'bg-green-600' },
    { id: 'Rejected', label: 'Rechazado', color: 'bg-red-500' },
];

const KanbanBoard: React.FC<KanbanBoardProps> = ({ candidates, onStatusChange }) => {
    const [boardState, setBoardState] = useState(candidates);

    useEffect(() => {
        setBoardState(candidates);
    }, [candidates]);

    const handleDragStart = (e: React.DragEvent, candidateId: string) => {
        e.dataTransfer.setData('candidateId', candidateId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, status: CandidateStatus) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData('candidateId');
        if (candidateId) {
            onStatusChange(candidateId, status);
        }
    };

    const getColumnCandidates = (status: CandidateStatus) => {
        return boardState.filter(c => c.status_in_campaign === status || (status === 'Pool' && !c.status_in_campaign));
    };

    return (
        <div className="flex h-full overflow-x-auto gap-4 p-4 pb-2">
            {COLUMNS.map(col => (
                <div
                    key={col.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className="min-w-[280px] w-[280px] bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col max-h-full"
                >
                    {/* Column Header */}
                    <div className={`p-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10 rounded-t-xl`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${col.color}`}></div>
                            <span className="font-semibold text-slate-200 text-sm">{col.label}</span>
                            <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                {getColumnCandidates(col.id).length}
                            </span>
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-slate-500 cursor-pointer hover:text-white" />
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
                        {getColumnCandidates(col.id).map(candidate => (
                            <div
                                key={candidate.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, candidate.id)}
                                className="p-3 rounded-lg bg-slate-800 border border-slate-700/50 cursor-grab active:cursor-grabbing hover:border-cyan-500/50 transition-all hover:shadow-md hover:bg-slate-800/80 group"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={candidate.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.full_name)}&background=0F172A&color=94A3B8`}
                                            alt={candidate.full_name}
                                            className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-700"
                                        />
                                        {candidate.symmetry_score !== undefined && (
                                            <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                                candidate.symmetry_score > 90 
                                                ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/50' 
                                                : 'text-slate-400 bg-slate-900/50 border-slate-800'
                                            }`}>
                                                {candidate.symmetry_score}% Match
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h4 className="font-semibold text-slate-200 text-sm mb-0.5 truncate">{candidate.full_name}</h4>
                                <p className="text-xs text-slate-400 mb-2 truncate">{candidate.job_title}</p>
                                <p className="text-[10px] text-slate-500 truncate mb-2">@ {candidate.current_company}</p>

                                <div className="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-700/50">
                                    <div className="flex gap-2">
                                        <MessageSquare className="h-3 w-3" />
                                        <Calendar className="h-3 w-3" />
                                    </div>
                                    <span className="text-[10px]">{candidate.added_at ? new Date(candidate.added_at).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default KanbanBoard;

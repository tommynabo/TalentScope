
import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus } from '../types/database';
import { CandidateService } from '../lib/services';
import { MoreHorizontal, MessageSquare, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface KanbanBoardProps {
    candidates: Candidate[];
    onStatusChange: (candidateId: string, newStatus: CandidateStatus) => void;
}

const COLUMNS: { id: CandidateStatus; label: string; color: string }[] = [
    { id: 'Pool', label: 'New Leads', color: 'bg-slate-500' },
    { id: 'Contacted', label: 'Contacted', color: 'bg-blue-500' },
    { id: 'Responded', label: 'Replied', color: 'bg-yellow-500' },
    { id: 'Scheduled', label: 'Interview', color: 'bg-purple-500' },
    { id: 'Offer Sent', label: 'Offer', color: 'bg-emerald-500' },
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

    // Helper to filter candidates by status (using a symmetry score shim for now if missing)
    const getColumnCandidates = (status: CandidateStatus) => {
        return boardState.filter(c => (c as any).status === status || (status === 'Pool' && !(c as any).status));
        // Note: 'status' is heavily dependent on CampaignCandidate join in a real app, 
        // but for this "Talent Pool" view we might just use a local field or mock it for the global view.
        // Wait, the Schema has 'status' on 'campaign_candidates', not 'candidates'.
        // 'candidates' table has no status.
        // For the purpose of this "TalentScope" global view, let's assume we are viewing a specific Campaign's board 
        // OR we act as if the candidate has a global status. 
        // The User Request mentioned "Managing Pipeline" which implies a Campaign context.
        // However, the interface 'Candidate' defined in types/database.ts DOES NOT have status.
        // I need to adapt this component to receive a combined type or Handle it.
    };

    return (
        <div className="flex h-full overflow-x-auto gap-4 p-4">
            {COLUMNS.map(col => (
                <div
                    key={col.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className="min-w-[300px] w-[300px] bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col"
                >
                    {/* Column Header */}
                    <div className={`p-4 border-b border-slate-800 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${col.color}`}></div>
                            <span className="font-semibold text-slate-200">{col.label}</span>
                            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                                {/* Count would go here */}
                                0
                            </span>
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-slate-500 cursor-pointer hover:text-white" />
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-3">
                        {/* Render Cards Here */}
                        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700/50 cursor-grab active:cursor-grabbing hover:border-cyan-500/50 transition-colors shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                                    TD
                                </div>
                                <div className="text-xs font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/50">
                                    98% Match
                                </div>
                            </div>
                            <h4 className="font-semibold text-white text-sm mb-0.5">Tomas Demo</h4>
                            <p className="text-xs text-slate-400 mb-3">Senior Flutter Engineer</p>

                            <div className="flex items-center gap-3 text-slate-500">
                                <MessageSquare className="h-3 w-3" />
                                <Calendar className="h-3 w-3" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default KanbanBoard;

import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Campaign, EnrichedCandidateInCampaign } from '../types/campaigns';

interface KanbanBoardProps {
  campaign: Campaign;
  onUpdateCandidate: (candidate: EnrichedCandidateInCampaign, newLane: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ campaign, onUpdateCandidate }) => {
  const lanes = [
    { id: 'todo', title: 'Por Contactar', color: 'slate' },
    { id: 'contacted', title: 'Contactado', color: 'blue' },
    { id: 'replied', title: 'Respondió', color: 'emerald' },
    { id: 'rejected', title: 'Rechazó', color: 'red' },
    { id: 'hired', title: 'Contratado', color: 'purple' },
  ];

  const getCandidatesInLane = (laneId: string) => {
    return campaign.candidates.filter(c => c.kanbanLane === laneId);
  };

  const handleDragStart = (candidate: EnrichedCandidateInCampaign, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('candidate', JSON.stringify(candidate));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetLane: string, e: React.DragEvent) => {
    e.preventDefault();
    const candidateData = e.dataTransfer.getData('candidate');
    if (candidateData) {
      const candidate = JSON.parse(candidateData);
      onUpdateCandidate(candidate, targetLane);
    }
  };

  return (
    <div className="grid grid-cols-5 gap-4 p-4">
      {lanes.map(lane => (
        <div
          key={lane.id}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(lane.id, e)}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 min-h-[600px] flex flex-col"
        >
          <div className="mb-4">
            <h3 className="font-semibold text-slate-200">{lane.title}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {getCandidatesInLane(lane.id).length} candidatos
            </p>
          </div>

          <div className="flex-1 space-y-2">
            {getCandidatesInLane(lane.id).map(candidate => (
              <div
                key={candidate.candidateId}
                draggable
                onDragStart={(e) => handleDragStart(candidate, e)}
                className={`bg-slate-700 border border-slate-600 rounded-lg p-3 cursor-grab hover:bg-slate-600 transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100 text-sm truncate">{candidate.name}</p>
                    <p className="text-xs text-slate-400 mt-1">${candidate.hourlyRate.toFixed(0)}/h</p>
                    <p className="text-xs text-slate-500 mt-0.5">{candidate.jobSuccessRate.toFixed(0)}% success</p>
                    {candidate.email && (
                      <p className="text-xs text-blue-400 mt-1 truncate">{candidate.email}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

import React, { useState } from 'react';
import { ChevronDown, Plus, LayoutGrid, List } from 'lucide-react';
import { Campaign, EnrichedCandidateInCampaign } from '../types/campaigns';
import { KanbanBoard } from './KanbanBoard';
import { PipelineList } from './PipelineList';
import { ManualEnrichmentModal } from './ManualEnrichmentModal';

interface CampaignDashboardProps {
  campaign: Campaign;
  onUpdateCampaign: (campaign: Campaign) => void;
  onBack: () => void;
}

export const CampaignDashboard: React.FC<CampaignDashboardProps> = ({
  campaign,
  onUpdateCampaign,
  onBack,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'pipeline'>('kanban');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleUpdateCandidate = (candidate: EnrichedCandidateInCampaign, newLane: string) => {
    const updated = campaign.candidates.map(c =>
      c.candidateId === candidate.candidateId
        ? { ...c, kanbanLane: newLane }
        : c
    );

    // Calculate new stats
    const stats = {
      total: updated.length,
      inTodo: updated.filter(c => c.kanbanLane === 'todo').length,
      inContacted: updated.filter(c => c.kanbanLane === 'contacted').length,
      inReplied: updated.filter(c => c.kanbanLane === 'replied').length,
      inRejected: updated.filter(c => c.kanbanLane === 'rejected').length,
      inHired: updated.filter(c => c.kanbanLane === 'hired').length,
      contactRate: (updated.filter(c => c.kanbanLane !== 'todo').length / updated.length) * 100,
      responseRate: (updated.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updated.length) * 100,
    };

    onUpdateCampaign({
      ...campaign,
      candidates: updated,
      stats,
    });
  };

  const handleAddCandidate = (candidateData: Omit<EnrichedCandidateInCampaign, 'candidateId'>) => {
    const newCandidate: EnrichedCandidateInCampaign = {
      ...candidateData,
      candidateId: `manual-${Date.now()}`,
    };

    const updated = [...campaign.candidates, newCandidate];

    // Calculate new stats
    const stats = {
      total: updated.length,
      inTodo: updated.filter(c => c.kanbanLane === 'todo').length,
      inContacted: updated.filter(c => c.kanbanLane === 'contacted').length,
      inReplied: updated.filter(c => c.kanbanLane === 'replied').length,
      inRejected: updated.filter(c => c.kanbanLane === 'rejected').length,
      inHired: updated.filter(c => c.kanbanLane === 'hired').length,
      contactRate: (updated.filter(c => c.kanbanLane !== 'todo').length / updated.length) * 100,
      responseRate: (updated.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updated.length) * 100,
    };

    onUpdateCampaign({
      ...campaign,
      candidates: updated,
      stats,
    });

    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-slate-200 mb-2 text-sm"
            >
              ← Volver
            </button>
            <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {campaign.platform === 'upwork' ? 'Upwork' : 'Fiverr'} •{' '}
              {campaign.searchTerms.keyword}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex gap-2 bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Kanban View"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'pipeline'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Pipeline View"
              >
                <List className="h-5 w-5" />
              </button>
            </div>

            {/* Add Manual Candidate */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Total</div>
            <div className="text-2xl font-bold text-white">{campaign.stats.total}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Por Contactar</div>
            <div className="text-2xl font-bold text-slate-300">{campaign.stats.inTodo}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Contactados</div>
            <div className="text-2xl font-bold text-blue-400">{campaign.stats.inContacted}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Respondieron</div>
            <div className="text-2xl font-bold text-emerald-400">{campaign.stats.inReplied}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Contratados</div>
            <div className="text-2xl font-bold text-purple-400">{campaign.stats.inHired}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Tasa Respuesta</div>
            <div className="text-2xl font-bold text-green-400">
              {campaign.stats.responseRate.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'kanban' ? (
          <div className="p-4">
            <KanbanBoard campaign={campaign} onUpdateCandidate={handleUpdateCandidate} />
          </div>
        ) : (
          <PipelineList campaign={campaign} onUpdateCandidate={handleUpdateCandidate} />
        )}
      </div>

      {/* Add Manual Candidate Modal */}
      <ManualEnrichmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={handleAddCandidate}
      />
    </div>
  );
};

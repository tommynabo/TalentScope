import React, { useState } from 'react';
import { ChevronDown, Plus, LayoutGrid, List, Download } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'kanban' | 'pipeline'>('pipeline');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleUpdateCandidate = (candidate: EnrichedCandidateInCampaign, newLane: string) => {
    const updated = campaign.candidates.map(c =>
      c.candidateId === candidate.candidateId
        ? { ...c, kanbanLane: newLane as any }
        : c
    );

    const stats = {
      total: updated.length,
      inTodo: updated.filter(c => c.kanbanLane === 'todo').length,
      inContacted: updated.filter(c => c.kanbanLane === 'contacted').length,
      inReplied: updated.filter(c => c.kanbanLane === 'replied').length,
      inRejected: updated.filter(c => c.kanbanLane === 'rejected').length,
      inHired: updated.filter(c => c.kanbanLane === 'hired').length,
      contactRate: (updated.filter(c => c.kanbanLane !== 'todo').length / updated.length) * 100 || 0,
      responseRate: (updated.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updated.length) * 100 || 0,
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

    const stats = {
      total: updated.length,
      inTodo: updated.filter(c => c.kanbanLane === 'todo').length,
      inContacted: updated.filter(c => c.kanbanLane === 'contacted').length,
      inReplied: updated.filter(c => c.kanbanLane === 'replied').length,
      inRejected: updated.filter(c => c.kanbanLane === 'rejected').length,
      inHired: updated.filter(c => c.kanbanLane === 'hired').length,
      contactRate: (updated.filter(c => c.kanbanLane !== 'todo').length / updated.length) * 100 || 0,
      responseRate: (updated.filter(c => c.kanbanLane === 'replied' || c.kanbanLane === 'hired').length / updated.length) * 100 || 0,
    };

    onUpdateCampaign({
      ...campaign,
      candidates: updated,
      stats,
    });

    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white">{campaign.name}</h1>
            <p className="text-slate-400 text-sm mt-2">
              {campaign.platform} • {campaign.searchTerms.keyword || campaign.searchTerms.keywords?.join(', ')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2 bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('pipeline')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'pipeline'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Pipeline List"
              >
                <List className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Kanban Board"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Añadir
            </button>
          </div>
        </div>

        {/* Stats Row - Like the first image */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-xs mb-2">TOTAL</div>
            <div className="text-3xl font-bold text-white">{campaign.stats.total}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-xs mb-2">POR CONTACTAR</div>
            <div className="text-3xl font-bold text-slate-300">{campaign.stats.inTodo}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-xs mb-2">CONTACTADOS</div>
            <div className="text-3xl font-bold text-blue-400">{campaign.stats.inContacted}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-xs mb-2">RESPONDIERON</div>
            <div className="text-3xl font-bold text-emerald-400">{campaign.stats.inReplied}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-xs mb-2">TASA RESPUESTA</div>
            <div className="text-3xl font-bold text-green-400">{campaign.stats.responseRate.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'pipeline' ? (
          <PipelineList campaign={campaign} onUpdateCandidate={handleUpdateCandidate} />
        ) : (
          <div className="p-6">
            <KanbanBoard campaign={campaign} onUpdateCandidate={handleUpdateCandidate} />
          </div>
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

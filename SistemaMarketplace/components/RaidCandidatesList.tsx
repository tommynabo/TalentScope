import React, { useState } from 'react';
import { Search, Mail, Linkedin } from 'lucide-react';
import { MarketplaceRaid } from '../types/marketplace';

interface RaidCandidatesListProps {
  raid: MarketplaceRaid | null;
}

export const RaidCandidatesList: React.FC<RaidCandidatesListProps> = ({ raid }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'enriched' | 'contacted'>('all');

  if (!raid) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Crea un raid para ver candidatos
      </div>
    );
  }

  const filteredCandidates = raid.enrichedCandidates.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterTab === 'enriched') return matchesSearch && c.linkedInUrl;
    if (filterTab === 'contacted')
      return matchesSearch && raid.outreachRecords.some((r) => r.candidateId === c.id);
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm"
            />
          </div>

          <div className="flex gap-2 text-xs">
            {(['all', 'enriched', 'contacted'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  filterTab === tab
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {tab === 'all' ? 'Todos' : tab === 'enriched' ? 'Enriquecidos' : 'Contactados'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 space-y-2">
          {filteredCandidates.slice(0, 10).map((candidate) => (
            <div
              key={candidate.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm cursor-pointer hover:border-slate-600"
            >
              <div className="font-semibold text-slate-100">{candidate.name}</div>
              <div className="text-xs text-slate-400 mt-1">{candidate.title}</div>
              <div className="flex gap-2 mt-2">
                {candidate.emails.length > 0 && (
                  <Mail className="h-3.5 w-3.5 text-emerald-500" />
                )}
                {candidate.linkedInUrl && (
                  <Linkedin className="h-3.5 w-3.5 text-blue-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700 p-4 bg-slate-900/50">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-slate-400">
            Scrapeados: <span className="font-bold text-slate-100">{raid.stats.totalScraped}</span>
          </div>
          <div className="text-slate-400">
            Enriquecidos:{' '}
            <span className="font-bold text-slate-100">{raid.stats.totalEnriched}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

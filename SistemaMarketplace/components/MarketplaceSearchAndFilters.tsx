import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrapingFilter, FreelancePlatform } from '../types/marketplace';

interface MarketplaceSearchAndFiltersProps {
  initialFilter?: ScrapingFilter;
  onSearch: (filter: ScrapingFilter) => void;
}

export const MarketplaceSearchAndFilters: React.FC<MarketplaceSearchAndFiltersProps> = ({
  initialFilter,
  onSearch,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<ScrapingFilter>(
    initialFilter || {
      keyword: 'Flutter',
      minHourlyRate: 40,
      minJobSuccessRate: 85,
      platforms: ['Upwork'],
      certifications: ['Top Rated Plus'],
    }
  );

  const handleSearch = () => {
    onSearch(filter);
  };

  const togglePlatform = (platform: FreelancePlatform) => {
    setFilter(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">Búsqueda y Filtros</h3>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 border-t border-slate-700">
          {/* Keyword */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Keyword/Skill</label>
            <input
              type="text"
              value={filter.keyword}
              onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
              placeholder="ej: Flutter, React, Node.js"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Plataformas</label>
            <div className="flex gap-2">
              {(['Upwork', 'Fiverr'] as FreelancePlatform[]).map(platform => (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                    filter.platforms.includes(platform)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Rate */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-300">Tarifa Mínima: ${filter.minHourlyRate}</label>
            </div>
            <input
              type="range"
              min="20"
              max="200"
              value={filter.minHourlyRate}
              onChange={(e) => setFilter({ ...filter, minHourlyRate: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Job Success Rate */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-300">Job Success Rate: {filter.minJobSuccessRate}%</label>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={filter.minJobSuccessRate}
              onChange={(e) => setFilter({ ...filter, minJobSuccessRate: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Action */}
          <button
            onClick={handleSearch}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all"
          >
            Buscar Candidatos
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { MarketplaceRaid, ScrapingFilter, FreelancePlatform } from '../types/marketplace';

interface ScraperConfigProps {
  raid: MarketplaceRaid | null;
  onScrapingComplete: (name: string, filter: ScrapingFilter) => void;
  onError: (error: string) => void;
  isInitialSetup?: boolean;
}

export const ScraperConfig: React.FC<ScraperConfigProps> = ({
  raid,
  onScrapingComplete,
  onError,
  isInitialSetup = false,
}) => {
  const [raidName, setRaidName] = useState('Flutter Elite Squad');
  const [keyword, setKeyword] = useState('Flutter');
  const [minHourlyRate, setMinHourlyRate] = useState(40);
  const [minJobSuccessRate, setMinJobSuccessRate] = useState(90);
  const [platforms, setPlatforms] = useState<FreelancePlatform[]>(['Upwork']);
  const [certifications, setCertifications] = useState(['Top Rated Plus']);
  const [loading, setLoading] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');

  const handleStartScraping = async () => {
    if (!keyword.trim()) {
      onError('Por favor ingresa un keyword');
      return;
    }

    setLoading(true);
    setProcessStatus('Iniciando scraping...');

    try {
      await new Promise((r) => setTimeout(r, 800));
      setProcessStatus('Scrapeando plataformas...');
      await new Promise((r) => setTimeout(r, 1500));
      setProcessStatus('Procesando resultados...');
      await new Promise((r) => setTimeout(r, 1000));

      const filter: ScrapingFilter = {
        keyword,
        minHourlyRate,
        minJobSuccessRate,
        certifications,
        platforms,
      };

      onScrapingComplete(raidName, filter);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
      setProcessStatus('');
    }
  };

  const togglePlatform = (platform: FreelancePlatform) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  return (
    <div className="space-y-6">
      {isInitialSetup && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Nombre del Raid</label>
          <input
            type="text"
            value={raidName}
            onChange={(e) => setRaidName(e.target.value)}
            placeholder="ej: Flutter Elite Squad"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
          />
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Keyword/Skill</label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="ej: Flutter, React, Node.js"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <label className="block text-sm font-semibold text-slate-300 mb-3">Plataformas</label>
        <div className="flex gap-3">
          {(['Upwork', 'Fiverr'] as FreelancePlatform[]).map((platform) => (
            <button
              key={platform}
              onClick={() => togglePlatform(platform)}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                platforms.includes(platform)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-300">Tarifa Mínima</label>
          <span className="text-lg font-bold text-emerald-400">${minHourlyRate}</span>
        </div>
        <input
          type="range"
          min="20"
          max="200"
          value={minHourlyRate}
          onChange={(e) => setMinHourlyRate(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-300">Job Success Rate</label>
          <span className="text-lg font-bold text-blue-400">{minJobSuccessRate}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="100"
          value={minJobSuccessRate}
          onChange={(e) => setMinJobSuccessRate(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {processStatus && (
        <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 animate-spin flex-shrink-0"></div>
          <p className="text-blue-300 text-sm">{processStatus}</p>
        </div>
      )}

      <button
        onClick={handleStartScraping}
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
      >
        <Play className="h-5 w-5" />
        {isInitialSetup ? 'Crear Raid y Comenzar' : 'Iniciar Scraping'}
      </button>
    </div>
  );
};

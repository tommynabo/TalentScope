import React, { useState } from 'react';
import { ArrowRight, Zap, Users } from 'lucide-react';

interface SearchGeneratorProps {
  campaignName: string;
  onStart: (leadCount: number) => void;
}

export const SearchGenerator: React.FC<SearchGeneratorProps> = ({
  campaignName,
  onStart,
}) => {
  const [leadCount, setLeadCount] = useState(50);
  const [isSearching, setIsSearching] = useState(false);

  const handleStartSearch = async () => {
    setIsSearching(true);
    // Simulate search
    await new Promise(r => setTimeout(r, 1500));
    onStart(leadCount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full mb-6">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Generador de Búsqueda</h1>
          <p className="text-slate-400 text-lg">
            Campaña: <span className="font-semibold text-emerald-400">{campaignName}</span>
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-12 backdrop-blur-sm">
          {/* Lead Counter */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <label className="text-white font-semibold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Número de Leads
              </label>
              <span className="text-3xl font-bold text-emerald-400">{leadCount}</span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="10"
              max="500"
              value={leadCount}
              onChange={(e) => setLeadCount(parseInt(e.target.value))}
              disabled={isSearching}
              className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                  ((leadCount - 10) / (500 - 10)) * 100
                }%, #334155 ${((leadCount - 10) / (500 - 10)) * 100}%, #334155 100%)`
              }}
            />

            {/* Quick presets */}
            <div className="flex gap-3 mt-6 flex-wrap">
              {[25, 50, 100, 250, 500].map(num => (
                <button
                  key={num}
                  onClick={() => setLeadCount(num)}
                  disabled={isSearching}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    leadCount === num
                      ? 'bg-emerald-600 text-white scale-105'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-8">
            <p className="text-slate-300 text-sm">
              💡 <span className="font-semibold">Búsqueda estimada:</span> El sistema buscará {leadCount} leads que coincidan con los criterios de tu campaña.
            </p>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartSearch}
            disabled={isSearching || leadCount < 10}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
              isSearching
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 active:scale-95'
            }`}
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                Buscando... {Math.round((leadCount / 500) * 100)}%
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Iniciar Búsqueda
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Footer Info */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
            <div className="text-emerald-400 font-bold text-xl">{leadCount}</div>
            <div className="text-slate-500 text-sm mt-1">Leads a buscar</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
            <div className="text-blue-400 font-bold text-xl">~{Math.round(leadCount * 0.85)}</div>
            <div className="text-slate-500 text-sm mt-1">Esperados encontrados</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
            <div className="text-purple-400 font-bold text-xl">~{Math.round(leadCount * 0.6)}</div>
            <div className="text-slate-500 text-sm mt-1">Calidad alta</div>
          </div>
        </div>
      </div>
    </div>
  );
};

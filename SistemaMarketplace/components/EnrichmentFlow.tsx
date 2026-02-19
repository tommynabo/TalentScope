import React, { useState } from 'react';
import { Brain } from 'lucide-react';
import { MarketplaceRaid } from '../types/marketplace';

interface EnrichmentFlowProps {
  raid: MarketplaceRaid | null;
  onEnrichmentComplete: () => void;
  onError: (error: string) => void;
}

export const EnrichmentFlow: React.FC<EnrichmentFlowProps> = ({
  raid,
  onEnrichmentComplete,
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartEnrichment = async () => {
    if (!raid || raid.scrapedCandidates.length === 0) {
      onError('No hay candidatos para enriquecer');
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const total = raid.scrapedCandidates.length;
      for (let i = 0; i < total; i++) {
        await new Promise((r) => setTimeout(r, 100));
        setProgress(Math.round(((i + 1) / total) * 100));
      }
      onEnrichmentComplete();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          Clay Enrichment
        </h3>
        <p className="text-slate-400 text-sm">
          Se enriquecerán los datos de cada candidato con: LinkedIn profile, emails extraídos,
          validación de fotos e identity confidence score.
        </p>
      </div>

      {raid && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-semibold">Progreso: {progress}%</span>
            <span className="text-slate-400 text-sm">
              {Math.floor((progress / 100) * (raid.scrapedCandidates.length || 0))}/
              {raid.scrapedCandidates.length}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      <button
        onClick={handleStartEnrichment}
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl disabled:opacity-50"
      >
        {loading ? 'Enriqueciendo...' : 'Iniciar Enriquecimiento'}
      </button>
    </div>
  );
};

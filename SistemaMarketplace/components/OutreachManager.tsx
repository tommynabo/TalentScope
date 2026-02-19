import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { MarketplaceRaid, OutreachCampaign } from '../types/marketplace';

interface OutreachManagerProps {
  raid: MarketplaceRaid | null;
  onOutreachComplete: () => void;
  onError: (error: string) => void;
}

export const OutreachManager: React.FC<OutreachManagerProps> = ({
  raid,
  onOutreachComplete,
  onError,
}) => {
  const [campaignName, setCampaignName] = useState('Premium Contacts');
  const [messageTemplate, setMessageTemplate] = useState(
    "Hola {{firstName}}, te escribo porque vi tu perfil en {{platform}} y me impresionó tu experiencia en {{targetRole}}..."
  );
  const [platforms, setPlatforms] = useState<'LinkedIn' | 'Email' | 'Both'>('Both');
  const [loading, setLoading] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const handleStartOutreach = async () => {
    if (!raid || raid.enrichedCandidates.length === 0) {
      onError('No hay candidatos enriquecidos para contactar');
      return;
    }

    setLoading(true);
    setSentCount(0);

    try {
      const total = raid.enrichedCandidates.length;
      for (let i = 0; i < total; i++) {
        await new Promise((r) => setTimeout(r, 300));
        setSentCount(i + 1);
      }
      onOutreachComplete();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Nombre Campaña</label>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="ej: Premium Contacts"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Plantilla Mensaje</label>
        <textarea
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          rows={4}
          placeholder="Usa {{firstName}}, {{targetRole}}, {{platform}}"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <label className="block text-sm font-semibold text-slate-300 mb-3">Plataformas</label>
        <div className="flex gap-2">
          {(['LinkedIn', 'Email', 'Both'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatforms(p)}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                platforms === p ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300 font-semibold">Enviando...</span>
            <span className="text-slate-400 text-sm">
              {sentCount}/{raid?.enrichedCandidates.length || 0}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-cyan-600 h-3 rounded-full transition-all"
              style={{
                width: `${
                  raid ? (sentCount / raid.enrichedCandidates.length) * 100 : 0
                }%`,
              }}
            ></div>
          </div>
        </div>
      )}

      <button
        onClick={handleStartOutreach}
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Send className="h-5 w-5" />
        {loading ? 'Enviando...' : 'Iniciar Outreach'}
      </button>
    </div>
  );
};

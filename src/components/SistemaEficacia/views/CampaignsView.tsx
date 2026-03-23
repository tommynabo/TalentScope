import React, { useState, useEffect } from 'react';
import {
  LayoutList,
  Plus,
  Pause,
  Play,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Send,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import {
  eficaciaFetch,
  EficaciaCampaign,
  EficaciaApiError,
  isEficaciaConfigured,
} from '../../../lib/eficaciaApi';

// ─── Status badge config ───────────────────────────────────────────────────────
const CAMPAIGN_STATUS: Record<EficaciaCampaign['status'], { label: string; cls: string }> = {
  active:    { label: 'Activa',     cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  paused:    { label: 'Pausada',    cls: 'text-amber-400   bg-amber-500/10   border-amber-500/20'   },
  draft:     { label: 'Borrador',   cls: 'text-slate-400   bg-slate-500/10   border-slate-600/20'   },
  completed: { label: 'Completada', cls: 'text-blue-400    bg-blue-500/10    border-blue-500/20'    },
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
const Stat: React.FC<{ icon: React.ReactNode; value: number | string; label: string }> = ({
  icon, value, label
}) => (
  <div className="flex flex-col items-center gap-0.5">
    <div className="flex items-center gap-1 text-slate-300 text-sm font-semibold">
      {icon}
      {value}
    </div>
    <span className="text-xs text-slate-600">{label}</span>
  </div>
);

// ─── Campaign card ────────────────────────────────────────────────────────────
const CampaignCard: React.FC<{
  campaign: EficaciaCampaign;
  onToggle: (id: string, current: EficaciaCampaign['status']) => void;
  onDelete: (id: string) => void;
}> = ({ campaign, onToggle, onDelete }) => {
  const status = CAMPAIGN_STATUS[campaign.status];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5
                    hover:border-slate-700 transition-colors group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{campaign.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {campaign.steps.length} pasos · creada {new Date(campaign.created_at).toLocaleDateString('es-ES')}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-around py-3 border-y border-slate-800/60">
        <Stat
          icon={<Send        className="h-3.5 w-3.5 text-slate-500" />}
          value={campaign.stats.sent}
          label="Enviados"
        />
        <Stat
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />}
          value={`${campaign.stats.acceptance_rate.toFixed(1)}%`}
          label="Aceptación"
        />
        <Stat
          icon={<MessageSquare className="h-3.5 w-3.5 text-emerald-400" />}
          value={`${campaign.stats.reply_rate.toFixed(1)}%`}
          label="Respuestas"
        />
        <Stat
          icon={<TrendingUp   className="h-3.5 w-3.5 text-slate-500" />}
          value={campaign.stats.replied}
          label="Leads"
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between pt-3">
        <span className="text-xs text-slate-600">
          Actualizado: {new Date(campaign.updated_at).toLocaleDateString('es-ES')}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggle(campaign.id, campaign.status)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title={campaign.status === 'active' ? 'Pausar' : 'Activar'}
          >
            {campaign.status === 'active'
              ? <Pause className="h-4 w-4" />
              : <Play  className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onDelete(campaign.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar campaña"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create modal ─────────────────────────────────────────────────────────────
const CreateModal: React.FC<{ onClose: () => void; onCreate: () => void }> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await eficaciaFetch('/api/linkedin/campaigns', {
        method: 'POST',
        body:   { name: name.trim(), status: 'draft', steps: [] },
      });
      onCreate();
      onClose();
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al crear campaña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Nueva Campaña</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la campaña"
          maxLength={120}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white
                     placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors text-sm mb-4"
          autoFocus
        />
        {error && (
          <p className="text-red-400 text-sm mb-3 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500
                       disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm
                       font-medium transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const CampaignsView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<EficaciaCampaign[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eficaciaFetch<EficaciaCampaign[]>('/api/linkedin/campaigns');
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar campañas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEficaciaConfigured()) fetchCampaigns();
  }, []);

  const handleToggle = async (id: string, current: EficaciaCampaign['status']) => {
    const next = current === 'active' ? 'paused' : 'active';
    try {
      await eficaciaFetch(`/api/linkedin/campaigns/${id}`, {
        method: 'PATCH',
        body:   { status: next },
      });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: next } : c)),
      );
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al actualizar estado.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta campaña permanentemente?')) return;
    try {
      await eficaciaFetch(`/api/linkedin/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al eliminar campaña.');
    }
  };

  if (!isEficaciaConfigured()) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <LayoutList className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-slate-400 font-medium mb-1">EficacIA no configurado</p>
        <p className="text-slate-600 text-sm">Ve a la pestaña "Cuentas" para configurar el bridge.</p>
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <CreateModal onClose={() => setShowModal(false)} onCreate={fetchCampaigns} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Campañas LinkedIn</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCampaigns}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500
                         text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva campaña
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && !campaigns.length && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && campaigns.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 mb-4">
              <LayoutList className="h-10 w-10 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium mb-1">Sin campañas aún</p>
            <p className="text-slate-600 text-sm mb-4">Crea tu primera campaña de outreach en LinkedIn.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Crear primera campaña
            </button>
          </div>
        )}

        {/* Grid */}
        {campaigns.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default CampaignsView;

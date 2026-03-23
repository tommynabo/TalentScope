import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  ChevronRight,
  Clock,
  MessageSquare,
  Link2,
  Mail,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  eficaciaFetch,
  EficaciaSequence,
  EficaciaCampaignStep,
  EficaciaApiError,
  isEficaciaConfigured,
} from '../../../lib/eficaciaApi';

// ─── Step type config ─────────────────────────────────────────────────────────
const STEP_TYPE_CONFIG: Record<EficaciaCampaignStep['type'], { label: string; icon: React.ReactNode; cls: string }> = {
  connection_request: {
    label: 'Conexión',
    icon:  <Link2        className="h-3.5 w-3.5" />,
    cls:   'text-cyan-400    bg-cyan-500/10    border-cyan-500/20',
  },
  message: {
    label: 'Mensaje',
    icon:  <MessageSquare className="h-3.5 w-3.5" />,
    cls:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  inmail: {
    label: 'InMail',
    icon:  <Mail          className="h-3.5 w-3.5" />,
    cls:   'text-violet-400  bg-violet-500/10  border-violet-500/20',
  },
};

// ─── Sequence card ────────────────────────────────────────────────────────────
const SequenceCard: React.FC<{
  sequence: EficaciaSequence;
  onDelete: (id: string) => void;
}> = ({ sequence, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-5 text-left"
      >
        <div className="p-2 bg-slate-800 rounded-xl text-cyan-400 shrink-0">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{sequence.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {sequence.steps_count} paso{sequence.steps_count !== 1 ? 's' : ''} ·{' '}
            {sequence.campaigns_count} campaña{sequence.campaigns_count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(sequence.id); }}
            className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg transition-colors"
            title="Eliminar secuencia"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronRight
            className={`h-4 w-4 text-slate-600 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* Steps */}
      {expanded && sequence.steps.length > 0 && (
        <div className="border-t border-slate-800 px-5 py-4 space-y-3">
          {sequence.steps
            .sort((a, b) => a.order - b.order)
            .map((step, idx) => {
              const cfg = STEP_TYPE_CONFIG[step.type];
              return (
                <div key={step.id} className="flex gap-3">
                  {/* Timeline marker */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full border text-xs font-bold ${cfg.cls}`}>
                      {idx + 1}
                    </div>
                    {idx < sequence.steps.length - 1 && (
                      <div className="w-px h-full min-h-[24px] bg-slate-800 mt-1" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0 pb-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      {step.delay_days > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          +{step.delay_days} día{step.delay_days !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {step.template || <em className="text-slate-600">Sin plantilla</em>}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {expanded && sequence.steps.length === 0 && (
        <div className="border-t border-slate-800 px-5 py-6 text-center">
          <p className="text-sm text-slate-600">Esta secuencia no tiene pasos todavía.</p>
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const SequenceBuilderView: React.FC = () => {
  const [sequences, setSequences] = useState<EficaciaSequence[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [showForm, setShowForm]   = useState(false);

  const fetchSequences = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eficaciaFetch<EficaciaSequence[]>('/api/linkedin/sequences');
      setSequences(data);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar secuencias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEficaciaConfigured()) fetchSequences();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await eficaciaFetch<EficaciaSequence>('/api/linkedin/sequences', {
        method: 'POST',
        body:   { name: newName.trim(), steps: [] },
      });
      setSequences((prev) => [created, ...prev]);
      setNewName('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al crear secuencia.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta secuencia?')) return;
    try {
      await eficaciaFetch(`/api/linkedin/sequences/${id}`, { method: 'DELETE' });
      setSequences((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al eliminar.');
    }
  };

  if (!isEficaciaConfigured()) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <GitBranch className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-slate-400 font-medium mb-1">EficacIA no configurado</p>
        <p className="text-slate-600 text-sm">Ve a la pestaña "Cuentas" para configurar el bridge.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Sequence Builder</h2>
          <p className="text-sm text-slate-400 mt-0.5">Flujos de mensajes multi-paso para tus campañas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSequences}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500
                       text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva secuencia
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5 flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre de la secuencia"
            maxLength={100}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white
                       placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500
                       disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm
                       font-medium transition-colors"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && !sequences.length && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && sequences.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 mb-4">
            <GitBranch className="h-10 w-10 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium mb-1">Sin secuencias configuradas</p>
          <p className="text-slate-600 text-sm mb-4">
            Crea una secuencia multi-paso para automatizar tu outreach.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Crear primera secuencia
          </button>
        </div>
      )}

      {/* List */}
      {sequences.length > 0 && (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <SequenceCard key={seq.id} sequence={seq} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SequenceBuilderView;

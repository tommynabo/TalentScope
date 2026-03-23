import React, { useState, useEffect } from 'react';
import {
  Network,
  UserX,
  Clock,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {
  eficaciaFetch,
  EficaciaPendingConnection,
  EficaciaWithdrawResult,
  EficaciaApiError,
} from '../../../lib/eficaciaApi';

// ─── Pending connection row ────────────────────────────────────────────────────
const ConnectionRow: React.FC<{
  connection: EficaciaPendingConnection;
  selected:   boolean;
  onToggle:   () => void;
}> = ({ connection, selected, onToggle }) => {
  const isStale = connection.days_pending >= 21;

  return (
    <tr className={`border-b border-slate-800/60 transition-colors hover:bg-slate-800/20 ${selected ? 'bg-cyan-500/5' : ''}`}>
      <td className="px-4 py-3.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500
                     checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm font-medium text-white">{connection.name}</span>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${
            isStale
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}
        >
          <Clock className="h-3 w-3" />
          {connection.days_pending}d pendiente
        </span>
      </td>
      <td className="px-4 py-3.5 text-slate-500 text-xs">
        {new Date(connection.sent_at).toLocaleDateString('es-ES')}
      </td>
      <td className="px-4 py-3.5">
        <a
          href={connection.profile_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Perfil
        </a>
      </td>
    </tr>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const NetworkManager: React.FC = () => {
  const [pending, setPending]       = useState<EficaciaPendingConnection[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [result, setResult]         = useState<EficaciaWithdrawResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [minDays, setMinDays]       = useState(21);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await eficaciaFetch<EficaciaPendingConnection[]>(
        `/api/linkedin/pending-connections?min_days=${minDays}`,
      );
      setPending(data);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const toggleAll = () => {
    if (selected.size === pending.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  };

  const handleWithdraw = async (ids: string[]) => {
    if (ids.length === 0) return;
    const plural = ids.length > 1 ? `estas ${ids.length} solicitudes` : 'esta solicitud';
    if (!confirm(`¿Retirar ${plural}? Esta acción no se puede deshacer.`)) return;

    setWithdrawing(true);
    setError(null);
    setResult(null);
    try {
      const res = await eficaciaFetch<EficaciaWithdrawResult>(
        '/api/linkedin/withdraw-pending',
        { method: 'POST', body: { ids } },
      );
      setResult(res);
      // Remove withdrawn connections from local state
      setPending((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al retirar solicitudes.');
    } finally {
      setWithdrawing(false);
    }
  };

  const staleCount = pending.filter((p) => p.days_pending >= minDays).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Gestión de Red</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Retira solicitudes pendientes · Evita límites de LinkedIn
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Min days filter */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-xs text-slate-400">≥</span>
            <input
              type="number"
              value={minDays}
              onChange={(e) => setMinDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 bg-transparent text-sm text-white text-center focus:outline-none"
              min={1}
              max={365}
            />
            <span className="text-xs text-slate-500">días</span>
          </div>
          <button
            onClick={fetchPending}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700
                       text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Info / warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-950/30 border border-amber-500/20 rounded-xl">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-amber-300 font-medium mb-0.5">Límite de solicitudes de LinkedIn</p>
          <p className="text-amber-400/70">
            LinkedIn tiene un límite de ~200 solicitudes pendientes. Retira las solicitudes
            antiguas regularmente para no bloquear tu cuenta. Recomendado retirar las de +{minDays} días.
          </p>
        </div>
      </div>

      {/* Success banner */}
      {result && (
        <div className="flex items-start gap-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{result.message}</p>
            <p className="text-emerald-500/70 text-xs mt-0.5">
              {result.withdrawn} retiradas · {result.failed} fallidas
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
        </div>
      )}

      {/* Action bar (bulk) */}
      {!loading && pending.length > 0 && (
        <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.size === pending.length && pending.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 cursor-pointer"
            />
            <span className="text-sm text-slate-400">
              {selected.size > 0
                ? `${selected.size} de ${pending.length} seleccionadas`
                : `${pending.length} solicitudes pendientes · ${staleCount} antiguas (+${minDays}d)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => handleWithdraw([...selected])}
                disabled={withdrawing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500
                           disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm
                           font-medium transition-colors"
              >
                {withdrawing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2  className="h-4 w-4" />}
                Retirar seleccionadas ({selected.size})
              </button>
            )}
            {staleCount > 0 && selected.size === 0 && (
              <button
                onClick={() =>
                  handleWithdraw(
                    pending
                      .filter((p) => p.days_pending >= minDays)
                      .map((p) => p.id),
                  )
                }
                disabled={withdrawing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500
                           disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm
                           font-medium transition-colors"
              >
                {withdrawing
                  ? <Loader2   className="h-4 w-4 animate-spin" />
                  : <UserX     className="h-4 w-4" />}
                Retirar las +{minDays}d ({staleCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && pending.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 mb-4">
            <Network className="h-10 w-10 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium mb-1">Sin solicitudes pendientes</p>
          <p className="text-slate-600 text-sm">
            {result ? '¡Limpieza completada!' : `No hay solicitudes pendientes de +${minDays} días.`}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && pending.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === pending.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Contacto</th>
                <th className="px-4 py-3 text-left font-medium">Antigüedad</th>
                <th className="px-4 py-3 text-left font-medium">Fecha envío</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((conn) => (
                <ConnectionRow
                  key={conn.id}
                  connection={conn}
                  selected={selected.has(conn.id)}
                  onToggle={() => toggleOne(conn.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NetworkManager;

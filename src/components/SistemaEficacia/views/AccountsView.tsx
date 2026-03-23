import React, { useState, useEffect } from 'react';
import {
  UserCircle2, Plus, Trash2, CheckCircle2, AlertCircle, Loader2,
  Settings2, ExternalLink, Key, Globe,
} from 'lucide-react';
import {
  eficaciaFetch, getEficaciaConfig, saveEficaciaConfig,
  EficaciaAccount, EficaciaApiError,
} from '../../../lib/eficaciaApi';

// ─── Config panel ─────────────────────────────────────────────────────────────
const ConfigPanel: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const cfg = getEficaciaConfig();
  const [apiKey, setApiKey]   = useState(cfg.apiKey);
  const [baseUrl, setBaseUrl] = useState(cfg.baseUrl);
  const [saving, setSaving]   = useState(false);

  const handleSave = () => {
    setSaving(true);
    saveEficaciaConfig({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim() });
    setTimeout(() => { setSaving(false); onSaved(); }, 300);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Settings2 className="h-5 w-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">Configuración del Bridge</h3>
      </div>
      <p className="text-sm text-slate-400">
        Introduce la URL y API Key de tu instancia EficacIA. Se guardan localmente en tu navegador.
      </p>
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-2">
            <Globe className="h-4 w-4 text-slate-400" />
            URL Base
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.eficacia.app"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-2">
            <Key className="h-4 w-4 text-slate-400" />
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="eficacia_sk_..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !baseUrl.trim()}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium text-sm transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  );
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<EficaciaAccount['status'], { label: string; cls: string }> = {
  connected:    { label: 'Conectado',    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  disconnected: { label: 'Desconectado', cls: 'text-slate-400  bg-slate-500/10  border-slate-600/20'    },
  pending:      { label: 'Pendiente',    cls: 'text-amber-400  bg-amber-500/10  border-amber-500/20'    },
  error:        { label: 'Error',        cls: 'text-red-400    bg-red-500/10    border-red-500/20'      },
};

const StatusBadge: React.FC<{ status: EficaciaAccount['status'] }> = ({ status }) => {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
};

// ─── Main view ────────────────────────────────────────────────────────────────
const AccountsView: React.FC = () => {
  const [accounts, setAccounts]     = useState<EficaciaAccount[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const cfg = getEficaciaConfig();

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eficaciaFetch<EficaciaAccount[]>('/api/linkedin/accounts');
      setAccounts(data);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar cuentas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (cfg.baseUrl) fetchAccounts(); }, []);

  const handleConnectUnipile = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await eficaciaFetch<{ auth_url: string }>('/api/linkedin/accounts/connect', { method: 'POST' });
      if (res.auth_url) window.open(res.auth_url, '_blank', 'noopener,noreferrer');
      setTimeout(fetchAccounts, 3000);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al iniciar conexión.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres desconectar esta cuenta?')) return;
    try {
      await eficaciaFetch(`/api/linkedin/accounts/${id}`, { method: 'DELETE' });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al eliminar.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Cuentas Unipile</h2>
          <p className="text-slate-400 text-sm mt-0.5">Cuentas LinkedIn conectadas via Unipile</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Configuración</span>
          </button>
          <button
            onClick={handleConnectUnipile}
            disabled={connecting || !cfg.baseUrl}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Conectar Unipile
          </button>
        </div>
      </div>

      {showConfig && <ConfigPanel onSaved={() => { setShowConfig(false); fetchAccounts(); }} />}

      {/* Not configured */}
      {!cfg.baseUrl && !showConfig && (
        <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <Settings2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">EficacIA no está configurado</p>
          <p className="text-slate-500 text-sm mb-4">
            Pulsa «Configuración» para introducir la URL base y tu API Key.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Abrir Configuración
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
          Cargando cuentas...
        </div>
      )}

      {/* Grid */}
      {!loading && accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {account.avatar_url
                    ? <img src={account.avatar_url} alt={account.name} className="w-10 h-10 rounded-full object-cover" />
                    : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <UserCircle2 className="h-6 w-6" />
                      </div>
                    )
                  }
                  <div>
                    <p className="font-semibold text-white text-sm leading-tight">{account.name}</p>
                    {account.email && <p className="text-slate-500 text-xs mt-0.5">{account.email}</p>}
                  </div>
                </div>
                <StatusBadge status={account.status} />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <span className="text-xs text-slate-600 uppercase tracking-wider font-medium">{account.provider}</span>
                <div className="flex items-center gap-1">
                  {account.status === 'connected' && (
                    <a
                      href="https://app.unipile.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && cfg.baseUrl && accounts.length === 0 && !error && (
        <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <UserCircle2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">Sin cuentas conectadas</p>
          <p className="text-slate-500 text-sm mb-4">Conecta tu primera cuenta via Unipile para empezar.</p>
          <button
            onClick={handleConnectUnipile}
            disabled={connecting}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Conectar Unipile
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountsView;

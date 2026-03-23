/**
 * CampaignDetailView
 * ==================
 * Drill-down view for a single EficacIA campaign.
 * Rendered when the user clicks a card in CampaignsView.
 *
 * Internal tabs (custom Tailwind — Shadcn UI not installed in this project):
 *   · Candidatos — table of leads enrolled in the campaign
 *   · Secuencia  — SequenceBuilderView scoped to this campaign
 *   · Opciones   — daily limits, connected LinkedIn account
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  GitBranch,
  Settings,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
  Send,
  CheckCircle2,
  MessageSquare,
  Clock,
  Save,
} from 'lucide-react';
import {
  eficaciaFetch,
  EficaciaCampaign,
  EficaciaLead,
  EficaciaCampaignOptions,
  EficaciaApiError,
} from '../../../lib/eficaciaApi';
import SequenceBuilderView from './SequenceBuilderView';

// ─── Tab ids ──────────────────────────────────────────────────────────────────
type DetailTab = 'candidates' | 'sequence' | 'options';

const DETAIL_TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: 'candidates', label: 'Candidatos', icon: <Users     className="h-4 w-4" /> },
  { id: 'sequence',   label: 'Secuencia',  icon: <GitBranch className="h-4 w-4" /> },
  { id: 'options',    label: 'Opciones',   icon: <Settings  className="h-4 w-4" /> },
];

// ─── Lead status config ───────────────────────────────────────────────────────
const LEAD_STATUS: Record<EficaciaLead['status'], { label: string; cls: string }> = {
  pending:   { label: 'Pendiente',    cls: 'text-slate-400   bg-slate-500/10   border-slate-600/20'   },
  accepted:  { label: 'Aceptado',     cls: 'text-cyan-400    bg-cyan-500/10    border-cyan-500/20'    },
  replied:   { label: 'Respondido',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  bounced:   { label: 'Sin entrega',  cls: 'text-red-400     bg-red-500/10     border-red-500/20'     },
  opted_out: { label: 'Opt-out',      cls: 'text-amber-400   bg-amber-500/10   border-amber-500/20'   },
};

// ─── Campaign status badge ─────────────────────────────────────────────────────
const CAMPAIGN_STATUS: Record<EficaciaCampaign['status'], { label: string; cls: string }> = {
  active:    { label: 'Activa',     cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  paused:    { label: 'Pausada',    cls: 'text-amber-400   bg-amber-500/10   border-amber-500/20'   },
  draft:     { label: 'Borrador',   cls: 'text-slate-400   bg-slate-500/10   border-slate-600/20'   },
  completed: { label: 'Completada', cls: 'text-blue-400    bg-blue-500/10    border-blue-500/20'    },
};

// ─── Candidates tab ───────────────────────────────────────────────────────────
const CandidatesTab: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [leads, setLeads]     = useState<EficaciaLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eficaciaFetch<EficaciaLead[]>(
        `/api/linkedin/campaigns/${campaignId}/leads`,
      );
      setLeads(data);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar candidatos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [campaignId]);

  if (loading && !leads.length) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 mb-4">
          <Users className="h-10 w-10 text-slate-600" />
        </div>
        <p className="text-slate-400 font-medium mb-1">Sin candidatos todavía</p>
        <p className="text-slate-600 text-sm">Los leads aparecerán aquí una vez que la campaña esté activa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{leads.length} candidato{leads.length !== 1 ? 's' : ''}</p>
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                Candidato
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                Empresa
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                Estado
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                Última actividad
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {leads.map((lead) => {
              const stat = LEAD_STATUS[lead.status];
              return (
                <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Name + headline */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {lead.avatar_url ? (
                        <img src={lead.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-slate-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{lead.name}</p>
                        {lead.headline && (
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{lead.headline}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {lead.company ?? '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${stat.cls}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {stat.label}
                    </span>
                  </td>

                  {/* Last activity */}
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                    {lead.last_activity_at
                      ? new Date(lead.last_activity_at).toLocaleDateString('es-ES')
                      : '—'}
                  </td>

                  {/* LinkedIn link */}
                  <td className="px-4 py-3">
                    {lead.linkedin_url ? (
                      <a
                        href={lead.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver perfil
                      </a>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Options tab ──────────────────────────────────────────────────────────────
const OptionsTab: React.FC<{ campaign: EficaciaCampaign }> = ({ campaign }) => {
  const [opts, setOpts]       = useState<EficaciaCampaignOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);

  // Editable fields
  const [dailyConn, setDailyConn]       = useState(20);
  const [dailyMsg,  setDailyMsg]        = useState(50);
  const [accountId, setAccountId]       = useState('');
  const [weekends,  setWeekends]        = useState(false);

  const fetchOpts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eficaciaFetch<EficaciaCampaignOptions>(
        `/api/linkedin/campaigns/${campaign.id}/options`,
      );
      setOpts(data);
      setDailyConn(data.daily_connection_limit);
      setDailyMsg(data.daily_message_limit);
      setAccountId(data.account_id);
      setWeekends(data.send_on_weekends);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar opciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOpts(); }, [campaign.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await eficaciaFetch(`/api/linkedin/campaigns/${campaign.id}/options`, {
        method: 'PATCH',
        body:   {
          daily_connection_limit: dailyConn,
          daily_message_limit:    dailyMsg,
          account_id:             accountId,
          send_on_weekends:       weekends,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al guardar opciones.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Opciones guardadas correctamente.
        </div>
      )}

      {/* Límites diarios */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-5">
        <h4 className="text-sm font-semibold text-white">Límites diarios</h4>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
            <Send className="h-4 w-4 text-cyan-400" />
            Solicitudes de conexión / día
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={dailyConn}
            onChange={(e) => setDailyConn(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm
                       focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <p className="text-xs text-slate-600 mt-1">Recomendado: 10–30 para evitar restricciones de LinkedIn.</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            Mensajes de seguimiento / día
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={dailyMsg}
            onChange={(e) => setDailyMsg(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm
                       focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Cuenta LinkedIn */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-white">Cuenta LinkedIn conectada</h4>
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="ID de cuenta Unipile"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600
                     focus:outline-none focus:border-cyan-500 transition-colors"
        />
        <p className="text-xs text-slate-600">
          Puedes encontrar el ID en la pestaña "Cuentas" de este panel.
        </p>
      </div>

      {/* Horario */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={weekends}
            onChange={(e) => setWeekends(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 accent-cyan-500"
          />
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Clock className="h-4 w-4 text-slate-400" />
              Enviar en fin de semana
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Por defecto, los envíos solo ocurren de lunes a viernes.
            </p>
          </div>
        </label>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500
                   disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium text-sm transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Guardando...' : 'Guardar opciones'}
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface CampaignDetailViewProps {
  campaign: EficaciaCampaign;
  onBack:   () => void;
}

const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({ campaign, onBack }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('candidates');
  const status = CAMPAIGN_STATUS[campaign.status];

  const renderTab = () => {
    switch (activeTab) {
      case 'candidates': return <CandidatesTab campaignId={campaign.id} />;
      case 'sequence':   return <SequenceBuilderView campaignId={campaign.id} />;
      case 'options':    return <OptionsTab campaign={campaign} />;
      default:           return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── Back button + campaign header ──────────────────────────────────────── */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a campañas
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{campaign.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {campaign.steps.length} paso{campaign.steps.length !== 1 ? 's' : ''} · creada{' '}
              {new Date(campaign.created_at).toLocaleDateString('es-ES')}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-800">
          {[
            { icon: <Send className="h-3.5 w-3.5 text-slate-500" />, value: campaign.stats.sent, label: 'Enviados' },
            { icon: <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />, value: `${campaign.stats.acceptance_rate.toFixed(1)}%`, label: 'Aceptación' },
            { icon: <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />, value: `${campaign.stats.reply_rate.toFixed(1)}%`, label: 'Respuestas' },
          ].map(({ icon, value, label }) => (
            <div key={label} className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-semibold text-white">{value}</span>
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Inner tab bar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-1" aria-label="Secciones de campaña">
          {DETAIL_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 border-b-2 -mb-px',
                  isActive
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      <div key={activeTab} className="animate-in fade-in duration-200">
        {renderTab()}
      </div>
    </div>
  );
};

export default CampaignDetailView;

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Send,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  eficaciaFetch,
  EficaciaAnalytics,
  EficaciaApiError,
  isEficaciaConfigured,
} from '../../../lib/eficaciaApi';

// ─── Metric card ──────────────────────────────────────────────────────────────
const MetricCard: React.FC<{
  label:  string;
  value:  string | number;
  sub?:   string;
  icon:   React.ReactNode;
  accent: string;
}> = ({ label, value, sub, icon, accent }) => (
  <div className={`bg-slate-900/50 border rounded-2xl p-5 border-slate-800`}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-sm text-slate-400">{label}</p>
      <div className={`p-2 rounded-xl ${accent}`}>{icon}</div>
    </div>
    <p className="text-3xl font-bold text-white font-mono">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

// ─── Custom tooltip for recharts ──────────────────────────────────────────────
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-lg text-sm">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const EficaciaAnalyticsView: React.FC = () => {
  const [data, setData]       = useState<EficaciaAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await eficaciaFetch<EficaciaAnalytics>('/api/linkedin/analytics');
      setData(result);
    } catch (err) {
      setError(err instanceof EficaciaApiError ? err.message : 'Error al cargar analíticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEficaciaConfigured()) fetchAnalytics();
  }, []);

  if (!isEficaciaConfigured()) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="h-12 w-12 text-slate-700 mb-4" />
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
          <h2 className="text-xl font-bold text-white">Analíticas de LinkedIn</h2>
          <p className="text-sm text-slate-400 mt-0.5">Rendimiento de tus campañas de outreach</p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700
                     text-slate-300 rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Grid ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Enviados"
              value={data.total_sent.toLocaleString()}
              sub="Solicitudes de conexión"
              icon={<Send className="h-4 w-4" />}
              accent="bg-slate-800 text-slate-400"
            />
            <MetricCard
              label="Aceptados"
              value={data.total_accepted.toLocaleString()}
              sub={`${data.acceptance_rate.toFixed(1)}% de aceptación`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="bg-cyan-900/30 text-cyan-400"
            />
            <MetricCard
              label="Respuestas"
              value={data.total_replied.toLocaleString()}
              sub={`${data.reply_rate.toFixed(1)}% de respuesta`}
              icon={<MessageSquare className="h-4 w-4" />}
              accent="bg-emerald-900/30 text-emerald-400"
            />
            <MetricCard
              label="Tasa de Conversión"
              value={data.total_sent > 0
                ? `${((data.total_replied / data.total_sent) * 100).toFixed(1)}%`
                : '–'}
              sub="Enviados → Replied"
              icon={<TrendingUp className="h-4 w-4" />}
              accent="bg-violet-900/30 text-violet-400"
            />
          </div>

          {/* ── Daily chart ───────────────────────────────────────────────── */}
          {data.daily_stats.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-6">Actividad Diaria</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.daily_stats}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                    }
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                    formatter={(v) => v === 'sent' ? 'Enviados' : v === 'accepted' ? 'Aceptados' : 'Respondidos'}
                  />
                  <Bar dataKey="sent"     fill="#0ea5e9" radius={[3, 3, 0, 0]} name="sent"     />
                  <Bar dataKey="accepted" fill="#22d3ee" radius={[3, 3, 0, 0]} name="accepted" />
                  <Bar dataKey="replied"  fill="#34d399" radius={[3, 3, 0, 0]} name="replied"  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Top campaigns table ───────────────────────────────────────── */}
          {data.top_campaigns.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">Top Campañas</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="px-6 py-3 text-left font-medium">Campaña</th>
                    <th className="px-6 py-3 text-right font-medium">Enviados</th>
                    <th className="px-6 py-3 text-right font-medium">Aceptación</th>
                    <th className="px-6 py-3 text-right font-medium">Respuesta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_campaigns.map((tc) => (
                    <tr
                      key={tc.campaign_id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="px-6 py-3.5 text-white font-medium">{tc.campaign_name}</td>
                      <td className="px-6 py-3.5 text-right text-slate-400 font-mono">{tc.sent}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-cyan-400 font-mono font-medium">
                          {tc.acceptance_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-emerald-400 font-mono font-medium">
                          {tc.reply_rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EficaciaAnalyticsView;

import React, { useState } from 'react';
import { Linkedin, Github, Globe, Users, Lock, ArrowRight, Activity, Zap, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnalyticsService } from '../lib/analytics';
import { AnalyticsDaily } from '../types/database';
import { useStableData } from '../lib/useStableData';

interface DashboardViewProps {
  userName: string;
  onOpenLinkedin: () => void;
  onLockedClick: (moduleName: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ userName, onOpenLinkedin, onLockedClick }) => {
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  // useStableData: fetches on mount, caches for 5 min, silently refreshes when stale
  // NO visible flash/reload when switching tabs
  const { data: stats, loading, refresh } = useStableData<AnalyticsDaily>(
    'dashboard-stats',
    () => AnalyticsService.getDailyStats(),
    AnalyticsService.getEmptyStats(),
    { staleTTL: 5 * 60 * 1000 } // 5 minutes
  );

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Show GitHub Scan Manager if active
  // Note: Routing is now handled by App.tsx (/tablero/github)
  // This component only shows the Dashboard overview

  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Bienvenido, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{userName}</span>
          </h1>
          <p className="text-slate-400 text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span className="font-light">TalentScope S.O.S. v1.0 ::</span>
            <span className="text-emerald-400 font-medium">ONLINE</span>
          </p>
        </div>

        {/* Quick Stats Summary */}
        <div className="hidden md:flex items-center gap-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60 backdrop-blur-sm">
          <div className="text-center px-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Leads Hoy</p>
            <p className="text-2xl font-bold text-white font-mono">{stats.leads_generated}</p>
          </div>
          <div className="w-px h-8 bg-slate-800"></div>
          <div className="text-center px-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Contactados</p>
            <p className="text-2xl font-bold text-cyan-400 font-mono">{stats.emails_sent}</p>
          </div>
          <div className="w-px h-8 bg-slate-800"></div>
          <div className="text-center px-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Respuestas</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.replies_received}</p>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* ACTIVE CARD: LinkedIn */}
        <div
          onClick={onOpenLinkedin}
          className="group relative bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded-3xl p-6 cursor-pointer hover:border-cyan-400/60 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] transition-all duration-300 overflow-hidden transform hover:-translate-y-1"
        >
          {/* Background Tech Details */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light pointer-events-none"></div>

          <div className="absolute top-0 right-0 p-4 flex gap-2 items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleManualRefresh();
              }}
              disabled={refreshing}
              className="p-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              title="Actualizar stats"
            >
              <RefreshCw className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg shadow-cyan-900/10">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              <span className="text-xs font-semibold text-cyan-300 tracking-wide">ACTIVE NODE</span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-600/10 w-fit rounded-2xl text-blue-400 group-hover:text-blue-300 group-hover:scale-110 transition-all duration-300 border border-blue-500/10">
            <Linkedin className="h-10 w-10" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">LinkedIn Radar</h3>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Extracción masiva y segmentada de perfiles "A-Player" desde Sales Navigator.
          </p>

          <div className="bg-slate-950/50 rounded-2xl p-4 mb-8 border border-slate-800/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Scraped Today</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white font-mono">{loading ? '...' : stats.leads_generated}</p>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Live
              </span>
            </div>
          </div>

          <button className="w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/20 group-hover:shadow-cyan-500/30 active:scale-95">
            Iniciar Campaña <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* ACTIVE CARD: GitHub */}
        <div
          onClick={() => navigate('/tablero/github')}
          className="group relative bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-md border border-orange-500/30 rounded-3xl p-6 cursor-pointer hover:border-orange-400/60 hover:shadow-[0_0_40px_rgba(249,115,22,0.15)] transition-all duration-300 overflow-hidden transform hover:-translate-y-1"
        >
          {/* Background Tech Details */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light pointer-events-none"></div>

          <div className="absolute top-0 right-0 p-4 flex gap-2 items-center">
            <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-500/20 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg shadow-orange-900/10">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
              <span className="text-xs font-semibold text-orange-300 tracking-wide">ACTIVE NODE</span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-orange-600/10 w-fit rounded-2xl text-orange-400 group-hover:text-orange-300 group-hover:scale-110 transition-all duration-300 border border-orange-500/10">
            <Github className="h-10 w-10" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-100 transition-colors">GitHub Code Scan</h3>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Detección de talento basado en calidad de código y popularidad de repositorios.
          </p>

          <div className="bg-slate-950/50 rounded-2xl p-4 mb-8 border border-slate-800/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Estado</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold text-white">Conectado</p>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Ready
              </span>
            </div>
          </div>

          <button className="w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20 group-hover:shadow-orange-500/30 active:scale-95">
            Iniciar Búsqueda <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* LOCKED CARD: Freelance */}
        <div
          onClick={() => onLockedClick("Mercados Freelance")}
          className="group relative bg-slate-900/40 border border-slate-800 rounded-3xl p-6 cursor-pointer hover:bg-slate-800/60 transition-all duration-300 grayscale-[0.5] hover:grayscale-0"
        >
          <div className="absolute top-5 right-5 text-slate-600 group-hover:text-slate-500 transition-colors">
            <Lock className="h-6 w-6" />
          </div>

          <div className="mb-6 p-4 bg-slate-800/40 w-fit rounded-2xl text-slate-500 group-hover:text-emerald-400 transition-all border border-slate-700/30">
            <Globe className="h-10 w-10" />
          </div>

          <h3 className="text-xl font-bold text-slate-500 mb-2 group-hover:text-white transition-colors">Marketplace Raid</h3>
          <p className="text-sm text-slate-500 mb-8 group-hover:text-slate-400 transition-colors">
            Extracción de "Top Rated Plus" freelancers de alto valor en Upwork.
          </p>
          <div className="absolute inset-x-0 bottom-6 px-6 flex justify-center">
            <span className="text-xs font-bold font-mono text-cyan-600 bg-cyan-950/20 px-4 py-1.5 rounded-full border border-cyan-900/50 opacity-60 group-hover:opacity-100 transition-all">
              PHASE 2 :: SOON
            </span>
          </div>
        </div>

        {/* LOCKED CARD: Communities */}
        <div
          onClick={() => onLockedClick("Discord & Skool")}
          className="group relative bg-slate-900/40 border border-slate-800 rounded-3xl p-6 cursor-pointer hover:bg-slate-800/60 transition-all duration-300 grayscale-[0.5] hover:grayscale-0"
        >
          <div className="absolute top-5 right-5 text-slate-600 group-hover:text-slate-500 transition-colors">
            <Lock className="h-6 w-6" />
          </div>

          <div className="mb-6 p-4 bg-slate-800/40 w-fit rounded-2xl text-slate-500 group-hover:text-indigo-400 transition-all border border-slate-700/30">
            <Users className="h-10 w-10" />
          </div>

          <h3 className="text-xl font-bold text-slate-500 mb-2 group-hover:text-white transition-colors">Community Infiltrator</h3>
          <p className="text-sm text-slate-500 mb-8 group-hover:text-slate-400 transition-colors">
            Monitoreo y captación de miembros activos en servidores de Discord.
          </p>
          <div className="absolute inset-x-0 bottom-6 px-6 flex justify-center">
            <span className="text-xs font-bold font-mono text-cyan-600 bg-cyan-950/20 px-4 py-1.5 rounded-full border border-cyan-900/50 opacity-60 group-hover:opacity-100 transition-all">
              PHASE 2 :: SOON
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
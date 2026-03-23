import React, { useState, useEffect } from 'react';
import {
  LayoutList,
  Inbox,
  BarChart3,
  Network,
  UserCircle2,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { isEficaciaConfigured, initEficaciaKey, EficaciaCampaign } from '../../lib/eficaciaApi';
import { supabase }          from '../../../lib/supabase';
import CampaignsView         from './views/CampaignsView';
import CampaignDetailView    from './views/CampaignDetailView';
import UniboxView            from './views/UniboxView';
import EficaciaAnalyticsView from './views/EficaciaAnalyticsView';
import NetworkManager        from './views/NetworkManager';
import AccountsView          from './views/AccountsView';

// ─── Tab definition ────────────────────────────────────────────────────────────
type TabId = 'campaigns' | 'unibox' | 'analytics' | 'network' | 'accounts';

interface Tab {
  id:    TabId;
  label: string;
  icon:  React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'campaigns', label: 'Campañas',      icon: <LayoutList  className="h-4 w-4" /> },
  { id: 'unibox',    label: 'Unibox',        icon: <Inbox       className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analíticas',    icon: <BarChart3   className="h-4 w-4" /> },
  { id: 'network',   label: 'Gestión Red',   icon: <Network     className="h-4 w-4" /> },
  { id: 'accounts',  label: 'Cuentas',       icon: <UserCircle2 className="h-4 w-4" /> },
];

// ─── Component ────────────────────────────────────────────────────────────────
const EficaciaDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(
    isEficaciaConfigured() ? 'campaigns' : 'accounts',
  );

  // ── Shadow Accounts: auto-init the API key on mount ──────────────────────────
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError,   setKeyError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Only provision if the user has already configured the backend URL
      if (!isEficaciaConfigured()) return;

      setKeyLoading(true);
      setKeyError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setKeyError('No hay sesión activa. Por favor, inicia sesión de nuevo.');
          return;
        }
        await initEficaciaKey(session.access_token);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setKeyError(msg);
        }
      } finally {
        if (!cancelled) setKeyLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Campaign drill-down state ─────────────────────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = useState<EficaciaCampaign | null>(null);

  const handleSelectCampaign = (campaign: EficaciaCampaign) => {
    setSelectedCampaign(campaign);
  };

  const handleBackToCampaigns = () => {
    setSelectedCampaign(null);
  };

  // When the user changes tabs, clear any campaign drill-down
  const handleTabChange = (tab: TabId) => {
    setSelectedCampaign(null);
    setActiveTab(tab);
  };

  const renderActiveTab = () => {
    // If we're on the campaigns tab and a campaign is selected, show its detail view
    if (activeTab === 'campaigns' && selectedCampaign) {
      return (
        <CampaignDetailView
          campaign={selectedCampaign}
          onBack={handleBackToCampaigns}
        />
      );
    }

    switch (activeTab) {
      case 'campaigns': return <CampaignsView onSelect={handleSelectCampaign} />;
      case 'unibox':    return <UniboxView />;
      case 'analytics': return <EficaciaAnalyticsView />;
      case 'network':   return <NetworkManager />;
      case 'accounts':  return <AccountsView />;
      default:          return null;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-3">
        <div className="p-2.5 bg-cyan-900/30 rounded-xl text-cyan-400 border border-cyan-500/20">
          <Zap className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">EficacIA</h1>
          <p className="text-slate-400 text-sm mt-0.5">Motor de automatización LinkedIn · Bridge</p>
        </div>

        {/* Key init status indicator */}
        {keyLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Inicializando acceso…
          </div>
        )}
        {keyError && !keyLoading && (
          <div
            className="flex items-center gap-1.5 text-xs text-amber-400 max-w-xs truncate cursor-help"
            title={keyError}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Error de acceso · ve a Cuentas</span>
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 mb-6">
        <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-0" aria-label="EficacIA módulos">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab && !selectedCampaign;
            const isCampaignDrill = tab.id === 'campaigns' && !!selectedCampaign;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={[
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-px',
                  isActive || isCampaignDrill
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600',
                ].join(' ')}
                aria-current={(isActive || isCampaignDrill) ? 'page' : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div
        className="animate-in fade-in duration-200"
        key={selectedCampaign ? `detail-${selectedCampaign.id}` : activeTab}
      >
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default EficaciaDashboard;

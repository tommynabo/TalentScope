import React, { useState, useEffect } from 'react';
import {
  LayoutList,
  Inbox,
  BarChart3,
  Network,
  UserCircle2,
  Zap,
  Loader2,
} from 'lucide-react';
import { setupEficaciaAuth, EficaciaCampaign } from '../../lib/eficaciaApi';
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
  const [activeTab, setActiveTab] = useState<TabId>('campaigns');

  // ── Shadow Accounts: auto-init the API key on mount ──────────────────────────
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await setupEficaciaAuth(session.access_token);
        }
      } catch {
        // Views handle post-init errors independently
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Full-screen spinner while key is being provisioned ────────────────────────
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
        <p className="text-slate-400 text-sm">Iniciando motor de automatización...</p>
      </div>
    );
  }

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

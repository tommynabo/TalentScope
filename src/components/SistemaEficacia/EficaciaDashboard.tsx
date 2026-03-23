import React, { useState } from 'react';
import {
  LayoutList,
  GitBranch,
  Inbox,
  BarChart3,
  Network,
  UserCircle2,
  Zap,
} from 'lucide-react';
import { isEficaciaConfigured } from '../../lib/eficaciaApi';
import CampaignsView        from './views/CampaignsView';
import SequenceBuilderView  from './views/SequenceBuilderView';
import UniboxView           from './views/UniboxView';
import EficaciaAnalyticsView from './views/EficaciaAnalyticsView';
import NetworkManager       from './views/NetworkManager';
import AccountsView         from './views/AccountsView';

// ─── Tab definition ────────────────────────────────────────────────────────────
type TabId = 'campaigns' | 'sequences' | 'unibox' | 'analytics' | 'network' | 'accounts';

interface Tab {
  id:    TabId;
  label: string;
  icon:  React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'campaigns',  label: 'Campañas',        icon: <LayoutList   className="h-4 w-4" /> },
  { id: 'sequences',  label: 'Secuencias',       icon: <GitBranch    className="h-4 w-4" /> },
  { id: 'unibox',     label: 'Unibox',           icon: <Inbox        className="h-4 w-4" /> },
  { id: 'analytics',  label: 'Analíticas',       icon: <BarChart3    className="h-4 w-4" /> },
  { id: 'network',    label: 'Gestión de Red',   icon: <Network      className="h-4 w-4" /> },
  { id: 'accounts',   label: 'Cuentas',          icon: <UserCircle2  className="h-4 w-4" /> },
];

// ─── Component ────────────────────────────────────────────────────────────────
const EficaciaDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(
    isEficaciaConfigured() ? 'campaigns' : 'accounts',
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'campaigns':  return <CampaignsView />;
      case 'sequences':  return <SequenceBuilderView />;
      case 'unibox':     return <UniboxView />;
      case 'analytics':  return <EficaciaAnalyticsView />;
      case 'network':    return <NetworkManager />;
      case 'accounts':   return <AccountsView />;
      default:           return null;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-3">
        <div className="p-2.5 bg-cyan-900/30 rounded-xl text-cyan-400 border border-cyan-500/20">
          <Zap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">EficacIA</h1>
          <p className="text-slate-400 text-sm mt-0.5">Motor de automatización LinkedIn · Bridge</p>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 mb-6">
        <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-0" aria-label="EficacIA módulos">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-px',
                  isActive
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-200" key={activeTab}>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default EficaciaDashboard;

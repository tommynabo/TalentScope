import React from 'react';
import { LayoutDashboard, Users, Activity, Settings, Zap, LogOut } from 'lucide-react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onLogout }) => {
  const getButtonClass = (viewName: ViewMode) => {
    const isActive = currentView === viewName;
    return isActive
      ? "flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl bg-slate-900 text-cyan-400 border border-slate-800 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all"
      : "flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all";
  };

  return (
    <div className="hidden md:flex flex-col w-20 lg:w-64 h-screen border-r border-slate-800 bg-slate-950 sticky top-0">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-cyan-400">
          <Zap className="h-6 w-6" />
          <span className="hidden lg:block font-bold text-xl tracking-tight text-white">TALENTSCOPE</span>
        </div>
      </div>

      <nav className="flex-1 py-6 flex flex-col gap-2 px-2">
        <button
          onClick={() => onNavigate('dashboard')}
          className={getButtonClass('dashboard')}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Tablero</span>
        </button>

        <button
          onClick={() => onNavigate('talent-pool')}
          className={getButtonClass('talent-pool')}
        >
          <Users className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Talento</span>
        </button>

        <button
          onClick={() => onNavigate('analytics')}
          className={getButtonClass('analytics')}
        >
          <Activity className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Analíticas</span>
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={() => onNavigate('settings')}
          className={getButtonClass('settings')}
        >
          <Settings className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Configuración</span>
        </button>
        <button
          onClick={onLogout}
          className="flex items-center justify-center lg:justify-start gap-3 p-3 w-full rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Salir</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
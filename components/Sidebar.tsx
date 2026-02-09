
import React from 'react';
import { LayoutDashboard, Users, Activity, Settings, Zap, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/dashboard' && (currentPath === '/dashboard' || currentPath === '/')) return true;
    if (path === '/tablero' && currentPath.includes('/tablero')) return true;
    return currentPath.startsWith(path);
  };

  const getButtonClass = (path: string) => {
    return isActive(path)
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
          onClick={() => navigate('/dashboard')}
          className={getButtonClass('/dashboard')}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Dashboard</span>
        </button>

        <button
          onClick={() => navigate('/tablero/linkedin')}
          className={getButtonClass('/tablero')}
        >
          <LayoutDashboard className="h-5 w-5" />
          {/* "Tablero" usually maps to Campaigns/Pipeline in this context */}
          <span className="hidden lg:block font-medium">Tablero</span>
        </button>

        <button
          onClick={() => navigate('/talento')}
          className={getButtonClass('/talento')}
        >
          <Users className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Talento</span>
        </button>

        <button
          onClick={() => navigate('/analytics')}
          className={getButtonClass('/analytics')}
        >
          <Activity className="h-5 w-5" />
          <span className="hidden lg:block font-medium">Analíticas</span>
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={() => navigate('/settings')}
          className={getButtonClass('/settings')}
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
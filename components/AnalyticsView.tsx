import React from 'react';
import { Lock } from 'lucide-react';

const AnalyticsView: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex items-center justify-center p-8 animate-in fade-in zoom-in duration-500 bg-slate-950">
      <div className="flex flex-col items-center justify-center text-center max-w-2xl">
        <div className="bg-slate-900/80 p-10 rounded-full border border-slate-800 mb-8 shadow-[0_0_80px_rgba(34,211,238,0.3)] ring-1 ring-cyan-500/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
          <Lock className="h-20 w-20 text-cyan-500/50 relative z-10" />
        </div>
        <h1 className="text-4xl font-bold text-slate-500 mb-3">Analíticas Bloqueadas</h1>
          <p className="text-lg text-slate-600 max-w-lg mx-auto">
          El módulo de analíticas está desactivado temporalmente.
          <br />
          Contacta con el administrador para reactivarlo.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsView;
import React from 'react';
import { Lock } from 'lucide-react';

const AnalyticsView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="bg-slate-900/50 p-8 rounded-full border border-slate-800 mb-6 shadow-2xl shadow-cyan-900/10">
        <Lock className="h-16 w-16 text-slate-600" />
      </div>
      <h1 className="text-3xl font-bold text-slate-500 mb-2">Analíticas Bloqueadas</h1>
      <p className="text-slate-600 max-w-md">
        El módulo de analíticas está desactivado temporalmente.
        <br />
        Contacta con el administrador para reactivarlo.
      </p>
    </div>
  );
};

export default AnalyticsView;
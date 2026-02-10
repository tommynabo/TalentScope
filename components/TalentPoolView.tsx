import React from 'react';
import { Lock } from 'lucide-react';

const TalentPoolView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="bg-slate-900/50 p-8 rounded-full border border-slate-800 mb-6 shadow-2xl shadow-cyan-900/10">
        <Lock className="h-16 w-16 text-slate-600" />
      </div>
      <h1 className="text-3xl font-bold text-slate-500 mb-2">Módulo de Talento Bloqueado</h1>
      <p className="text-slate-600 max-w-md">
        Esta sección está reservada y actualmente no es accesible.
        <br />
        Contacta con el administrador para más información.
      </p>
    </div>
  );
};

export default TalentPoolView;
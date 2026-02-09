import React from 'react';
import { TrendingUp, Users, Clock, CheckCircle, ArrowUpRight, ArrowDownRight, PieChart, Activity } from 'lucide-react';

const AnalyticsView: React.FC = () => {
  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
         <h1 className="text-3xl font-bold text-white">Analíticas de Rendimiento</h1>
         <div className="flex gap-2">
            <button className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700">Últimos 7 Días</button>
            <button className="text-xs bg-cyan-900/30 text-cyan-400 px-3 py-1.5 rounded-lg border border-cyan-800">Últimos 30 Días</button>
         </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Tiempo de Contratación', value: '14 días', trend: '-2.5 días', isPositive: true, icon: Clock },
          { title: 'Costo por Contratación', value: '$1,240', trend: '-$150', isPositive: true, icon: TrendingUp },
          { title: 'Aceptación de Ofertas', value: '88%', trend: '+4%', isPositive: true, icon: CheckCircle },
          { title: 'Pipeline Activo', value: '142', trend: '+12', isPositive: true, icon: Users },
        ].map((stat, idx) => (
          <div key={idx} className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
             <div className="absolute -right-6 -top-6 bg-cyan-500/5 w-24 h-24 rounded-full group-hover:bg-cyan-500/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-slate-400 text-sm">{stat.title}</span>
              <stat.icon className="h-4 w-4 text-cyan-500" />
            </div>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-2xl font-bold text-white">{stat.value}</span>
              <span className={`text-xs flex items-center gap-0.5 mb-1 ${stat.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recruitment Funnel Visualized */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-white flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500"/> Velocidad del Pipeline</h3>
            <span className="text-xs text-slate-500">Promedio Global</span>
          </div>
          
          <div className="space-y-6">
             {/* Gradient Bar Visuals */}
            {[
              { label: 'Outreach Enviado', val: 1250, pct: 100, color: 'from-blue-900 to-blue-800' },
              { label: 'Respuestas', val: 155, pct: 60, color: 'from-blue-700 to-cyan-700' },
              { label: 'Entrevistas Agendadas', val: 42, pct: 40, color: 'from-cyan-600 to-cyan-500' },
              { label: 'Evaluación Técnica', val: 18, pct: 25, color: 'from-cyan-500 to-emerald-500' },
              { label: 'Ofertas Extendidas', val: 8, pct: 15, color: 'from-emerald-500 to-emerald-400' },
            ].map((step, i) => (
              <div key={i} className="relative">
                 <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-300">{step.label}</span>
                    <span className="text-sm font-bold text-white">{step.val}</span>
                 </div>
                 <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div 
                        className={`h-full bg-gradient-to-r ${step.color} rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${step.pct}%` }}
                    ></div>
                 </div>
              </div>
            ))}
          </div>
        </div>

        {/* Circular / Pie visualization for Sources */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-white flex items-center gap-2"><PieChart className="h-4 w-4 text-purple-500"/> Fuentes de Candidatos</h3>
          </div>
          
          <div className="flex-1 flex items-center justify-center gap-8">
             {/* Simulated Donut Chart using CSS conic-gradient */}
             <div className="relative w-48 h-48 rounded-full bg-slate-800 flex items-center justify-center"
                  style={{ background: 'conic-gradient(from 0deg, #06b6d4 0% 45%, #3b82f6 45% 70%, #8b5cf6 70% 85%, #10b981 85% 100%)'}}>
                  <div className="w-36 h-36 bg-slate-900 rounded-full flex flex-col items-center justify-center z-10">
                     <span className="text-3xl font-bold text-white">1,582</span>
                     <span className="text-xs text-slate-500">Total Candidatos</span>
                  </div>
             </div>
             
             <div className="space-y-4">
                {[
                   { label: 'LinkedIn', pct: '45%', color: 'bg-cyan-500' },
                   { label: 'GitHub', pct: '25%', color: 'bg-blue-500' },
                   { label: 'Referidos', pct: '15%', color: 'bg-violet-500' },
                   { label: 'Inbound', pct: '15%', color: 'bg-emerald-500' }
                ].map((s) => (
                   <div key={s.label} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${s.color}`}></div>
                      <div className="flex flex-col">
                         <span className="text-sm text-slate-300">{s.label}</span>
                         <span className="text-xs text-slate-500">{s.pct} contribución</span>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
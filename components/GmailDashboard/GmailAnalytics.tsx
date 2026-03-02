import React, { useState, useEffect } from 'react';
import { GmailService } from '../../lib/gmailService';
import { Activity, Send, Reply, AlertTriangle } from 'lucide-react';

const GmailAnalytics: React.FC = () => {
    const [stats, setStats] = useState({ totalSent: 0, totalReplied: 0, activeAccounts: 0, activeSequences: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        GmailService.getAnalyticsStats().then(s => {
            setStats(s);
            setLoading(false);
        }).catch(console.error);
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Cargando analíticas...</div>;
    }

    // Calculate reply rate safely
    const replyRate = stats.totalSent > 0 ? ((stats.totalReplied / stats.totalSent) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-6">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Enviados (Total)</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.totalSent}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Send className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Respuestas</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.totalReplied}</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <Reply className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Tasa de Respuesta</p>
                            <h3 className="text-3xl font-bold text-emerald-400 mt-2">{replyRate}%</h3>
                        </div>
                        <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Cuentas Activas</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.activeAccounts}</h3>
                        </div>
                        <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                            <AtSignIcon className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Placeholder for Charts / Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Rendimiento por Campaña</h3>
                    <div className="h-64 flex items-center justify-center border-t border-slate-800 border-dashed">
                        <p className="text-slate-500">No hay suficientes datos para generar gráficos.</p>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">Actividad Reciente</h3>
                        <AlertTriangle className="w-5 h-5 text-yellow-500/50" />
                    </div>
                    <div className="h-64 flex items-center justify-center border-t border-slate-800 border-dashed">
                        <p className="text-slate-500">Los registros de envío aparecerán aquí.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Quick fix for missing AtSign import inside just this file, without re-writing headers
const AtSignIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4.5 8.4"></path>
    </svg>
);

export default GmailAnalytics;

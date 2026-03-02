import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Mail, BarChart2, List, Settings, AtSign } from 'lucide-react';
import GmailAnalytics from './GmailAnalytics';
import GmailSequences from './GmailSequences';
import GmailAccounts from './GmailAccounts';

const GmailMainView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active tab from URL segment
    const pathSegment = location.pathname.split('/').pop() || 'analiticas';
    const activeTab = ['analiticas', 'secuencias-y-leads', 'cuentas'].includes(pathSegment) ? pathSegment : 'analiticas';

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                            <Mail className="h-8 w-8" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Gmail Outreach</h1>
                    </div>
                    <p className="text-slate-400 max-w-2xl">
                        Automatiza y escala tus envíos de correos electrónicos desde cuentas de Gmail conectadas.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-full mb-6 relative">
                <button
                    onClick={() => navigate('/buzones/analiticas')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === 'analiticas'
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                >
                    <BarChart2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Analíticas</span>
                </button>

                <button
                    onClick={() => navigate('/buzones/secuencias-y-leads')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === 'secuencias-y-leads'
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Secuencias y Leads</span>
                </button>

                <button
                    onClick={() => navigate('/buzones/cuentas')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === 'cuentas'
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                >
                    <AtSign className="w-4 h-4" />
                    <span className="hidden sm:inline">Cuentas Gmail</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto w-full pb-10">
                <Routes>
                    <Route path="analiticas" element={<GmailAnalytics />} />
                    <Route path="secuencias-y-leads" element={<GmailSequences />} />
                    <Route path="cuentas" element={<GmailAccounts />} />
                    {/* Fallback segment */}
                    <Route path="*" element={<Navigate to="analiticas" replace />} />
                </Routes>
            </div>
        </div>
    );
};

export default GmailMainView;

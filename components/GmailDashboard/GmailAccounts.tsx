import React, { useState, useEffect } from 'react';
import { GmailService, GmailAccount } from '../../lib/gmailService';
import { PlusCircle, Search, Mail, Trash2, CheckCircle, XCircle } from 'lucide-react';

const GmailAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState<GmailAccount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // First, check if we just returned from OAuth and capture the tokens
        GmailService.captureSessionAccount().then(() => {
            fetchAccounts();
        });
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const data = await GmailService.getAccounts();
            setAccounts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectAccount = async () => {
        try {
            setLoading(true);
            await GmailService.connectGoogleAccount();
        } catch (error) {
            console.error(error);
            alert('Error al iniciar la conexión con Google');
            setLoading(false);
        }
    };

    const handleDisconnect = async (id: string) => {
        if (!confirm('¿Seguro que quieres desconectar esta cuenta? No podrás enviar más correos con ella.')) return;
        try {
            await GmailService.disconnectAccount(id);
            await fetchAccounts();
        } catch (error) {
            console.error(error);
            alert('Error al desconectar');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white">Cuentas Conectadas</h2>
                    <p className="text-slate-400 text-sm mt-1">Conecta tus cuentas de Google para repartir el envío de correos (Round-Robin).</p>
                </div>
                <button
                    onClick={handleConnectAccount}
                    className="flex items-center gap-2 bg-white hover:bg-slate-200 text-slate-900 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                    <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Conectar Cuenta de Google</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {loading ? (
                    <div className="p-8 col-span-full text-center text-slate-500">Cargando cuentas...</div>
                ) : accounts.length === 0 ? (
                    <div className="p-12 col-span-full text-center text-slate-500 border border-slate-800 border-dashed rounded-xl">
                        <p>No tienes cuentas conectadas.</p>
                        <p className="mt-2 text-sm">Pulsa "Conectar Cuenta de Google" para autorizar el envío de correos.</p>
                    </div>
                ) : (
                    accounts.map(acc => (
                        <div key={acc.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-xl ${acc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-medium truncate" title={acc.email}>{acc.email}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {acc.status === 'active' ? (
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                            )}
                                            <span className={`text-xs ${acc.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {acc.status === 'active' ? 'Conectada & Activa' : 'Desconectada'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                {acc.status === 'active' && (
                                    <button
                                        onClick={() => handleDisconnect(acc.id)}
                                        className="text-slate-400 hover:text-red-400 text-sm flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Desconectar</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GmailAccounts;

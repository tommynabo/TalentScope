import React, { useState, useEffect } from 'react';
import { GmailService, GmailAccount } from '../../lib/gmailService';
import { PlusCircle, Search, Mail, Trash2, CheckCircle, XCircle } from 'lucide-react';

const GmailAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState<GmailAccount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAccounts();
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
            const mockEmail = prompt('Simulando Google OAuth. Introduce el email a conectar:', 'test@gmail.com');
            if (!mockEmail) return;

            await GmailService.mockConnectAccount(mockEmail);
            await fetchAccounts();
        } catch (error) {
            console.error(error);
            alert('Error connecting account');
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
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="w-4 h-4" />
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

import React, { useState } from 'react';
import { Save, User, CreditCard, UserPlus } from 'lucide-react';

interface SettingsViewProps {
    currentName: string;
    onNameChange: (newName: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentName, onNameChange }) => {
    const [name, setName] = useState(currentName);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API call or just update parent
        setTimeout(() => {
            onNameChange(name);
            setIsSaving(false);
        }, 500);
    };

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                <p className="text-slate-400">Manage your profile and preferences.</p>
            </div>

            <div className="space-y-6">
                {/* Profile Settings */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400">
                            <User className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Profile Configuration</h3>
                            <p className="text-sm text-slate-400">Update your dashboard display name.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Dashboard Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                                placeholder="Enter your name"
                            />
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-900/20 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Team Section (Placeholder) */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 opacity-75">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
                            <UserPlus className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-200">Team Management</h3>
                            <p className="text-sm text-slate-500">Invite new recruiters to your workspace.</p>
                        </div>
                        <span className="ml-auto text-xs font-mono bg-slate-800 text-slate-500 px-2 py-1 rounded border border-slate-700">COMING SOON</span>
                    </div>
                </div>
                {/* Billing Section (Placeholder) */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 opacity-75">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-900/30 rounded-lg text-emerald-400">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-200">Billing & Plan</h3>
                            <p className="text-sm text-slate-500">You are currently on the <span className="text-emerald-400 font-bold">Pro Plan</span>.</p>
                        </div>
                        <span className="ml-auto text-xs font-mono bg-slate-800 text-slate-500 px-2 py-1 rounded border border-slate-700">COMING SOON</span>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-900/10 border border-red-900/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-red-900/30 rounded-lg text-red-400">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-red-400">Zona de Peligro</h3>
                            <p className="text-sm text-red-400/70">Acciones destructivas e irreversibles.</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium">Resetear Sistema</h4>
                            <p className="text-sm text-slate-400">Elimina todas las campañas y candidatos, y restaura la Campaña 1.</p>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm('¿Estás seguro? Esto borrará TODOS los datos.')) {
                                    import('../lib/services').then(({ CampaignService }) => {
                                        CampaignService.resetAndSeed().then(() => {
                                            alert('Sistema reseteado.');
                                            window.location.reload();
                                        });
                                    });
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Resetear Datos
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;

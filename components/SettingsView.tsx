
import React, { useState } from 'react';
import { Save, Shield, Database, UserPlus, CreditCard, Bell } from 'lucide-react';

const SettingsView: React.FC = () => {
    const [apiKey, setApiKey] = useState('sk-proj-****************************');
    const [apifyKey, setApifyKey] = useState('apify_api_*************************');

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                <p className="text-slate-400">Manage your API keys, team, and preferences.</p>
            </div>

            <div className="space-y-6">
                {/* API Keys Section */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400">
                            <Shield className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">API Configuration</h3>
                            <p className="text-sm text-slate-400">Manage connection secrets for OpenAI and Apify.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">OpenAI API Key (GPT-4)</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Apify API Token</label>
                            <input
                                type="password"
                                value={apifyKey}
                                onChange={(e) => setApifyKey(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                            />
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-900/20">
                                <Save className="h-4 w-4" /> Save Changes
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
            </div>
        </div>
    );
};

export default SettingsView;

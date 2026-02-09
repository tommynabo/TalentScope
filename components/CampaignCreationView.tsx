
import React, { useState } from 'react';
import { ArrowLeft, Save, Briefcase, Code, Brain, Target, Trash2, AlertTriangle } from 'lucide-react';
import { CampaignService } from '../lib/services';
import Toast from './Toast';

interface CampaignCreationViewProps {
    onBack: () => void;
    onCampaignCreated: () => void;
}

const CampaignCreationView: React.FC<CampaignCreationViewProps> = ({ onBack, onCampaignCreated }) => {
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '' });

    // Form State matching "Campaña 1" RTF
    const [formData, setFormData] = useState({
        title: '',
        role: '',
        platform: 'LinkedIn',
        skills: '', // Comma separated
        experienceLevel: 'Senior',
        keywords: '',
        // "Factor Mauro" Toggles
        factorStartup: false,
        factorFounder: false,
        factorAppStore: false,
        factorOpenSource: false
    });

    const handleCreate = async () => {
        if (!formData.title || !formData.role) {
            setToast({ show: true, message: 'Please fill in the required fields.' });
            return;
        }

        setLoading(true);
        try {
            // Prepare JSONB settings for advanced criteria
            const settings = {
                skills: formData.skills.split(',').map(s => s.trim()),
                experience_level: formData.experienceLevel,
                keywords: formData.keywords,
                factors: {
                    startup_exp: formData.factorStartup,
                    founder_mindset: formData.factorFounder,
                    shipped_product: formData.factorAppStore,
                    open_source: formData.factorOpenSource
                }
            };

            await CampaignService.create({
                title: formData.title,
                target_role: formData.role, // Mapping 'Role' to 'role' in DB
                platform: formData.platform as any,
                status: 'Running',
                description: `Campaign for ${formData.role} with focused criteria.`,
                settings: settings
            });

            setToast({ show: true, message: 'Campaign created successfully!' });
            setTimeout(onCampaignCreated, 1500);
        } catch (e: any) {
            console.error(e);
            setToast({ show: true, message: 'Error creating campaign: ' + e.message });
            setLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        if (confirm("DANGER: This will delete ALL campaigns. Are you sure?")) {
            setLoading(true);
            try {
                await CampaignService.deleteAll();
                setToast({ show: true, message: 'All campaigns deleted.' });
            } catch (e: any) {
                setToast({ show: true, message: 'Error deleting: ' + e.message });
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <div className="p-6 md:p-8 animate-in slide-in-from-right duration-300 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">New Campaign</h1>
                    <p className="text-slate-400">Configure search parameters and "A-Player" signals.</p>
                </div>
                <div className="ml-auto flex gap-3">
                    <button
                        onClick={handleDeleteAll}
                        className="px-4 py-2 bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 rounded-lg flex items-center gap-2 transition-all"
                    >
                        <Trash2 className="h-4 w-4" /> Reset All
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Basic Info */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-cyan-400" /> Role Definition
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Campaign Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                                    placeholder="e.g. Senior Flutter Engineer Hunt"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Target Role</label>
                                    <input
                                        type="text"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                                        placeholder="e.g. Product Engineer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Experience Level</label>
                                    <select
                                        value={formData.experienceLevel}
                                        onChange={e => setFormData({ ...formData, experienceLevel: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                                    >
                                        <option value="Senior">Senior / Lead</option>
                                        <option value="Mid-Senior">Mid-Senior</option>
                                        <option value="Mid">Mid Level</option>
                                        <option value="Junior">Junior (Excluded)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Technical Requirements */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Code className="h-5 w-5 text-emerald-400" /> Hard Skills & Keywords
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Required Skills (Comma separated)</label>
                                <input
                                    type="text"
                                    value={formData.skills}
                                    onChange={e => setFormData({ ...formData, skills: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                                    placeholder="Flutter, Dart, Provider, Riverpod..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Search Keywords (Boolean String)</label>
                                <textarea
                                    value={formData.keywords}
                                    onChange={e => setFormData({ ...formData, keywords: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none h-24 font-mono text-sm"
                                    placeholder="(Flutter OR Dart) AND (Startup OR Founder)..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Factor Mauro */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Brain className="h-24 w-24 text-purple-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Target className="h-5 w-5 text-purple-400" /> "Factor Mauro" Scoring
                        </h3>
                        <p className="text-sm text-slate-400 mb-6">Define bonus points for "A-Player" signals.</p>

                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                                <span className="text-slate-200 font-medium">Startup Experience</span>
                                <input type="checkbox" checked={formData.factorStartup} onChange={e => setFormData({ ...formData, factorStartup: e.target.checked })} className="accent-purple-500 h-5 w-5" />
                            </label>
                            <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                                <span className="text-slate-200 font-medium">Founder / Co-Founder Mindset</span>
                                <input type="checkbox" checked={formData.factorFounder} onChange={e => setFormData({ ...formData, factorFounder: e.target.checked })} className="accent-purple-500 h-5 w-5" />
                            </label>
                            <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                                <span className="text-slate-200 font-medium">Shipped Product (App Store/Play Store)</span>
                                <input type="checkbox" checked={formData.factorAppStore} onChange={e => setFormData({ ...formData, factorAppStore: e.target.checked })} className="accent-purple-500 h-5 w-5" />
                            </label>
                            <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                                <span className="text-slate-200 font-medium">Open Source / GitHub Activity</span>
                                <input type="checkbox" checked={formData.factorOpenSource} onChange={e => setFormData({ ...formData, factorOpenSource: e.target.checked })} className="accent-purple-500 h-5 w-5" />
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <Save className="h-5 w-5" /> Launch Campaign
                            </>
                        )}
                    </button>
                </div>

                {/* Sidebar / Preview */}
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Live Preview</h4>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                            <div className="flex items-start justify-between mb-2">
                                <h5 className="font-bold text-white">{formData.title || 'Campaign Title'}</h5>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-900/50">RUNNING</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-4">{formData.role || 'Target Role'}</p>
                            <div className="space-y-2">
                                <div className="flex gap-2 text-xs">
                                    <span className="text-slate-400">Skills:</span>
                                    <span className="text-slate-200">{formData.skills || 'None'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-4">
                        <div className="flex gap-3">
                            <AlertTriangle className="h-5 w-5 text-blue-400 shrink-0" />
                            <div>
                                <p className="text-sm text-blue-300 font-medium mb-1">Pro Tip</p>
                                <p className="text-xs text-blue-400/80">
                                    Enabling "Shipped Product" will specifically look for links to App Store/Google Play in candidate profiles, increasing the quality of mobile engineer matches significantly.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
        </div>
    );
};

export default CampaignCreationView;

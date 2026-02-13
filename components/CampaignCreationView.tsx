
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Save, Briefcase, Code, Brain, Target, Trash2, AlertTriangle, Users, Zap } from 'lucide-react';
import { CampaignService } from '../lib/services';
import { SearchFilterCriteria } from '../types/database';
import { getDefaultFlutterFilters } from '../lib/scoring';
import Toast from './Toast';

interface CampaignCreationViewProps {
    onBack: () => void;
    onCampaignCreated: () => void;
}

const CampaignCreationView: React.FC<CampaignCreationViewProps> = ({ onBack, onCampaignCreated }) => {
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '' });

    // Form State - Basic Info
    const [basicData, setBasicData] = useState({
        title: '',
        role: 'Flutter Developer',
        platform: 'LinkedIn',
    });

    // Form State - NEW Flutter Developer Filters
    const [filterCriteria, setFilterCriteria] = useState<SearchFilterCriteria>(getDefaultFlutterFilters());

    // Advanced settings
    const [advancedSettings, setAdvancedSettings] = useState({
        keywords: '',
        language: 'Spanish',
        scoreThreshold: 70,
        highImportanceOnly: false
    });

    // Calculate score preview
    const scorePreview = useMemo(() => {
        let score = 0;
        // Age
        if (filterCriteria.min_age && filterCriteria.max_age) score += 1;
        // Engineering
        if (filterCriteria.has_engineering_degree) score += 1;
        // Technical XX criteria
        if (filterCriteria.has_published_apps) score += 2;
        if (filterCriteria.has_flutter_dart_exp) score += 2;
        if (filterCriteria.has_portfolio_online) score += 2;
        if (filterCriteria.open_source_contributor) score += 2;
        // Entrepreneurship
        if (filterCriteria.startup_early_stage_exp) score += 2;
        if (filterCriteria.founded_business) score += 1;
        // Complementary
        if (filterCriteria.backend_knowledge !== 'none') score += 1;
        if (filterCriteria.ui_ux_awareness) score += 1;
        if (filterCriteria.ai_experience) score += 1;
        
        return {
            maxPoints: score,
            maxTotal: 15,
            normalized: Math.round((score / 15) * 100)
        };
    }, [filterCriteria]);

    const handleCreate = async () => {
        if (!basicData.title || !basicData.role) {
            setToast({ show: true, message: 'Please fill in the required fields.' });
            return;
        }

        setLoading(true);
        try {
            // Prepare complete settings with search filters
            const settings = {
                search_filters: filterCriteria,
                score_threshold: advancedSettings.scoreThreshold,
                high_importance_only: advancedSettings.highImportanceOnly,
                keywords: advancedSettings.keywords,
                language: advancedSettings.language
            };

            await CampaignService.create({
                title: basicData.title,
                target_role: basicData.role,
                platform: basicData.platform as any,
                status: 'Running',
                description: `Flutter Developer campaign with advanced filtering criteria.`,
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
        <div className="p-3 md:p-4 lg:p-6 animate-in slide-in-from-right duration-300 max-w-7xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-5 md:mb-6">
                <button
                    onClick={onBack}
                    className="p-1 md:p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                >
                    <ArrowLeft className="h-4 md:h-5 w-4 md:w-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-white tracking-tight">New Campaign - Flutter Developer</h1>
                    <p className="text-slate-400 text-xs md:text-sm">Configure advanced search criteria with 11-point scoring system.</p>
                </div>
                <button
                    onClick={handleDeleteAll}
                    className="px-2.5 md:px-3.5 py-1.5 bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 rounded-lg flex items-center gap-1.5 transition-all text-xs md:text-sm flex-shrink-0"
                >
                    <Trash2 className="h-3.5 md:h-4 w-3.5 md:w-4" /> <span className="hidden sm:inline">Reset</span>
                </button>
            </div>

            <div className="space-y-6 pb-8">
                {/* SECTION 1: Campaign Basics */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-cyan-400" /> Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Campaign Title *</label>
                            <input
                                type="text"
                                value={basicData.title}
                                onChange={e => setBasicData({ ...basicData, title: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                                placeholder="e.g. Flutter Q1 2026 Search"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Target Role *</label>
                            <input
                                type="text"
                                value={basicData.role}
                                onChange={e => setBasicData({ ...basicData, role: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                                placeholder="e.g. Flutter Developer"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Platform</label>
                            <select
                                value={basicData.platform}
                                onChange={e => setBasicData({ ...basicData, platform: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                            >
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="GitHub">GitHub</option>
                                <option value="Freelance">Freelance</option>
                                <option value="Communities">Communities</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Demographic Criteria */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-400" /> Demographic Criteria
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Age Range: {filterCriteria.min_age} - {filterCriteria.max_age} years</label>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        min="18"
                                        max="65"
                                        value={filterCriteria.min_age}
                                        onChange={e => setFilterCriteria({ ...filterCriteria, min_age: parseInt(e.target.value) || 18 })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 outline-none text-sm"
                                    />
                                    <span className="text-xs text-slate-500 mt-1">Min Age</span>
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        min="18"
                                        max="65"
                                        value={filterCriteria.max_age}
                                        onChange={e => setFilterCriteria({ ...filterCriteria, max_age: parseInt(e.target.value) || 35 })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 outline-none text-sm"
                                    />
                                    <span className="text-xs text-slate-500 mt-1">Max Age</span>
                                </div>
                            </div>
                        </div>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-blue-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Engineering Degree</span>
                                <span className="text-xs text-slate-500 ml-2">Importance: X (1pt)</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.has_engineering_degree} onChange={e => setFilterCriteria({ ...filterCriteria, has_engineering_degree: e.target.checked })} className="accent-blue-500 h-5 w-5" />
                        </label>
                    </div>
                </div>

                {/* SECTION 3: Technical Skills (XX = HIGH IMPORTANCE) */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 border-emerald-500/30">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Code className="h-5 w-5 text-emerald-400" /> Technical Skills <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded ml-2">HIGH IMPORTANCE (XX)</span>
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">These criteria carry 2 points each and are core requirements.</p>
                    
                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Published Apps (iOS/Android)</span>
                                <span className="text-xs text-slate-500 ml-2">2 points</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.has_published_apps} onChange={e => setFilterCriteria({ ...filterCriteria, has_published_apps: e.target.checked })} className="accent-emerald-500 h-5 w-5" />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Flutter / Dart Experience</span>
                                <span className="text-xs text-slate-500 ml-2">2 points</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.has_flutter_dart_exp} onChange={e => setFilterCriteria({ ...filterCriteria, has_flutter_dart_exp: e.target.checked })} className="accent-emerald-500 h-5 w-5" />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Online Portfolio / Personal Website</span>
                                <span className="text-xs text-slate-500 ml-2">2 points</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.has_portfolio_online} onChange={e => setFilterCriteria({ ...filterCriteria, has_portfolio_online: e.target.checked })} className="accent-emerald-500 h-5 w-5" />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Open Source / GitHub Contributor</span>
                                <span className="text-xs text-slate-500 ml-2">2 points</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.open_source_contributor} onChange={e => setFilterCriteria({ ...filterCriteria, open_source_contributor: e.target.checked })} className="accent-emerald-500 h-5 w-5" />
                        </label>
                    </div>
                </div>

                {/* SECTION 4: Entrepreneurship */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-orange-400" /> Entrepreneurship & Startup Mindset
                    </h3>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-orange-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Early-Stage Startup Experience</span>
                                <span className="text-xs text-slate-500 ml-2">Importance: XX (2pts)</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.startup_early_stage_exp} onChange={e => setFilterCriteria({ ...filterCriteria, startup_early_stage_exp: e.target.checked })} className="accent-orange-500 h-5 w-5" />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-orange-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">Founded Business / SaaS / App / Agency</span>
                                <span className="text-xs text-slate-500 ml-2">Importance: X (1pt)</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.founded_business} onChange={e => setFilterCriteria({ ...filterCriteria, founded_business: e.target.checked })} className="accent-orange-500 h-5 w-5" />
                        </label>
                    </div>
                </div>

                {/* SECTION 5: Complementary Skills */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-400" /> Complementary Skills <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded ml-2">NICE-TO-HAVE (X)</span>
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">Each worth 1 point - bonus signals.</p>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Backend Knowledge</label>
                            <select
                                value={filterCriteria.backend_knowledge}
                                onChange={e => setFilterCriteria({ ...filterCriteria, backend_knowledge: e.target.value as any })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none text-sm"
                            >
                                <option value="none">Not Required</option>
                                <option value="firebase">Firebase / Firestore</option>
                                <option value="supabase">Supabase / PostgreSQL</option>
                                <option value="custom">Custom Backend (Node, Django, etc.)</option>
                            </select>
                        </div>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-yellow-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">UX/UI Design Awareness</span>
                                <span className="text-xs text-slate-500 ml-2">1 point</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.ui_ux_awareness} onChange={e => setFilterCriteria({ ...filterCriteria, ui_ux_awareness: e.target.checked })} className="accent-yellow-500 h-5 w-5" />
                        </label>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-yellow-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">AI / Machine Learning Experience</span>
                                <span className="text-xs text-slate-500 ml-2">1 point</span>
                            </div>
                            <input type="checkbox" checked={filterCriteria.ai_experience} onChange={e => setFilterCriteria({ ...filterCriteria, ai_experience: e.target.checked })} className="accent-yellow-500 h-5 w-5" />
                        </label>
                    </div>
                </div>

                {/* SECTION 6: Advanced Settings */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-400" /> Advanced Configuration
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Custom Keywords (Boolean Search)</label>
                            <textarea
                                value={advancedSettings.keywords}
                                onChange={e => setAdvancedSettings({ ...advancedSettings, keywords: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none h-20 font-mono text-sm"
                                placeholder="(Flutter OR Dart) AND NOT (junior OR intern)..."
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Language / Region</label>
                                <select
                                    value={advancedSettings.language}
                                    onChange={e => setAdvancedSettings({ ...advancedSettings, language: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none text-sm"
                                >
                                    <option value="Spanish">Spanish (LATAM & Spain)</option>
                                    <option value="English">English (Global)</option>
                                    <option value="Portuguese">Portuguese (Brazil)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Min. Match Score: {advancedSettings.scoreThreshold}</label>
                                <input
                                    type="range"
                                    min="60"
                                    max="100"
                                    value={advancedSettings.scoreThreshold}
                                    onChange={e => setAdvancedSettings({ ...advancedSettings, scoreThreshold: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        <label className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                            <div>
                                <span className="text-slate-200 font-medium">High Importance Only (XX criteria)</span>
                                <span className="text-xs text-slate-500 ml-2">Filter to only 2-point criteria</span>
                            </div>
                            <input type="checkbox" checked={advancedSettings.highImportanceOnly} onChange={e => setAdvancedSettings({ ...advancedSettings, highImportanceOnly: e.target.checked })} className="accent-purple-500 h-5 w-5" />
                        </label>
                    </div>
                </div>

                {/* Score Calculator Summary */}
                <div className="bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border border-cyan-500/30 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Score Calculator Preview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <p className="text-slate-400 text-sm mb-1">Enabled Criteria</p>
                            <p className="text-3xl font-bold text-cyan-400">{scorePreview.maxPoints}</p>
                            <p className="text-xs text-slate-500">out of 15 max points</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <p className="text-slate-400 text-sm mb-1">Normalized Score</p>
                            <p className="text-3xl font-bold text-emerald-400">{scorePreview.normalized}%</p>
                            <p className="text-xs text-slate-500">on 0-100 scale</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <p className="text-slate-400 text-sm mb-1">Threshold</p>
                            <p className="text-3xl font-bold text-yellow-400">{advancedSettings.scoreThreshold}</p>
                            <p className="text-xs text-slate-500">minimum required score</p>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mb-4"
                >
                    {loading ? 'Processing...' : (
                        <>
                            <Save className="h-5 w-5" /> Launch Campaign
                        </>
                    )}
                </button>
            </div>

            <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
        </div>
    );
};

export default CampaignCreationView;

import React, { useState } from 'react';
import { Search, Shield, Globe, Hash, MessageSquare, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { CommunityFilterCriteria, CommunityPlatform } from '../types/community';
import { COMMUNITY_PRESETS, getPreset } from '../lib/communityPresets';

interface CommunityFilterConfigProps {
    criteria: CommunityFilterCriteria;
    onChange: (criteria: CommunityFilterCriteria) => void;
    disabled?: boolean;
}

export const CommunityFilterConfig: React.FC<CommunityFilterConfigProps> = ({
    criteria,
    onChange,
    disabled = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const updateCriteria = (updates: Partial<CommunityFilterCriteria>) => {
        onChange({ ...criteria, ...updates });
    };

    const togglePlatform = (platform: CommunityPlatform) => {
        const platforms = criteria.platforms.includes(platform)
            ? criteria.platforms.filter(p => p !== platform)
            : [...criteria.platforms, platform];
        updateCriteria({ platforms });
    };

    const handlePresetChange = (presetKey: string) => {
        if (!presetKey) return;
        const preset = getPreset(presetKey);
        if (preset) onChange(preset);
    };

    return (
        <div className={`bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-semibold text-white">Filtros de búsqueda</span>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-800/50">
                    {/* Preset Selector */}
                    <div className="pt-3">
                        <label className="block text-xs text-slate-500 mb-1">Preset rápido</label>
                        <select
                            onChange={(e) => handlePresetChange(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                        >
                            <option value="">Seleccionar preset...</option>
                            {Object.entries(COMMUNITY_PRESETS).map(([key, preset]) => (
                                <option key={key} value={key}>{preset.icon} {preset.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Platforms */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-2">
                            <Globe className="h-3 w-3 inline mr-1" />
                            Plataformas
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: CommunityPlatform.Discord, label: '🎮 Discord' },
                                { value: CommunityPlatform.Reddit, label: '🔴 Reddit' },
                                { value: CommunityPlatform.Skool, label: '🎓 Skool' },
                                { value: CommunityPlatform.GitHubDiscussions, label: '💻 GitHub' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => togglePlatform(opt.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${criteria.platforms.includes(opt.value)
                                            ? 'bg-violet-600/20 border-violet-500/30 text-violet-300'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Activity Threshold */}
                    <div>
                        <label className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span><Shield className="h-3 w-3 inline mr-1" />Actividad mínima</span>
                            <span className="text-violet-400 font-mono">≥ {criteria.minActivityScore || 0}</span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={80}
                            value={criteria.minActivityScore || 0}
                            onChange={(e) => updateCriteria({ minActivityScore: Number(e.target.value) })}
                            className="w-full accent-violet-500"
                        />
                    </div>

                    {/* Min Messages */}
                    <div>
                        <label className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span><MessageSquare className="h-3 w-3 inline mr-1" />Mensajes mínimos</span>
                            <span className="text-violet-400 font-mono">{criteria.minMessageCount || 0}</span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={criteria.minMessageCount || 0}
                            onChange={(e) => updateCriteria({ minMessageCount: Number(e.target.value) })}
                            className="w-full accent-violet-500"
                        />
                    </div>

                    {/* Max Results */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Max resultados</label>
                        <select
                            value={criteria.maxResults || 100}
                            onChange={(e) => updateCriteria({ maxResults: Number(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                        >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                        </select>
                    </div>

                    {/* Spanish Filter */}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-xs text-slate-400">🌍 Solo hispanohablantes</span>
                        <button
                            onClick={() => updateCriteria({ requireSpanishSpeaker: !criteria.requireSpanishSpeaker })}
                            className={`relative w-10 h-5 rounded-full transition-colors ${criteria.requireSpanishSpeaker ? 'bg-violet-600' : 'bg-slate-700'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${criteria.requireSpanishSpeaker ? 'translate-x-5' : ''
                                }`} />
                        </button>
                    </div>

                    {/* Project Links Filter */}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-xs text-slate-400">🔗 Requiere links a proyectos</span>
                        <button
                            onClick={() => updateCriteria({ requireProjectLinks: !criteria.requireProjectLinks })}
                            className={`relative w-10 h-5 rounded-full transition-colors ${criteria.requireProjectLinks ? 'bg-violet-600' : 'bg-slate-700'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${criteria.requireProjectLinks ? 'translate-x-5' : ''
                                }`} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

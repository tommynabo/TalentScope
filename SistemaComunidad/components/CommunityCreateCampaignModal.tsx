import React, { useState } from 'react';
import { X, Plus, Hash, Globe, MessageSquare, Shield, Search, Sparkles } from 'lucide-react';
import { CommunityFilterCriteria, CommunityPlatform } from '../types/community';
import { COMMUNITY_PRESETS, getPreset } from '../lib/communityPresets';

interface CommunityCreateCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, criteria: CommunityFilterCriteria) => void;
}

const PLATFORM_OPTIONS = [
    { value: CommunityPlatform.Discord, label: 'Discord', icon: '🎮', color: 'indigo' },
    { value: CommunityPlatform.Reddit, label: 'Reddit', icon: '🔴', color: 'orange' },
    { value: CommunityPlatform.Skool, label: 'Skool', icon: '🎓', color: 'emerald' },
    { value: CommunityPlatform.GitHubDiscussions, label: 'GitHub Discussions', icon: '💻', color: 'purple' },
];

export const CommunityCreateCampaignModal: React.FC<CommunityCreateCampaignModalProps> = ({
    isOpen, onClose, onCreate,
}) => {
    const [name, setName] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<CommunityPlatform[]>([CommunityPlatform.Discord]);
    const [keywords, setKeywords] = useState<string[]>(['flutter']);
    const [keywordInput, setKeywordInput] = useState('');
    const [subreddits, setSubreddits] = useState<string[]>([]);
    const [subredditInput, setSubredditInput] = useState('');
    const [discordInput, setDiscordInput] = useState('');
    const [discordServers, setDiscordServers] = useState<string[]>([]);
    const [requireSpanish, setRequireSpanish] = useState(true);
    const [minActivity, setMinActivity] = useState(20);
    const [maxResults, setMaxResults] = useState(100);
    const [selectedPreset, setSelectedPreset] = useState<string>('');

    if (!isOpen) return null;

    const togglePlatform = (platform: CommunityPlatform) => {
        setSelectedPlatforms(prev =>
            prev.includes(platform)
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        );
    };

    const handleAddKeyword = () => {
        const kw = keywordInput.trim();
        if (kw && !keywords.includes(kw)) {
            setKeywords([...keywords, kw]);
            setKeywordInput('');
        }
    };

    const handleAddSubreddit = () => {
        const sr = subredditInput.trim().replace(/^r\//, '');
        if (sr && !subreddits.includes(sr)) {
            setSubreddits([...subreddits, sr]);
            setSubredditInput('');
        }
    };

    const handleAddDiscordServer = () => {
        const ds = discordInput.trim();
        if (ds && !discordServers.includes(ds)) {
            setDiscordServers([...discordServers, ds]);
            setDiscordInput('');
        }
    };

    const handlePresetSelect = (presetKey: string) => {
        setSelectedPreset(presetKey);
        const preset = getPreset(presetKey);
        if (preset) {
            setSelectedPlatforms(preset.platforms);
            setKeywords(preset.keywords);
            setTargetRole(preset.targetRole || '');
            setRequireSpanish(preset.requireSpanishSpeaker || false);
            setMinActivity(preset.minActivityScore || 20);
            setMaxResults(preset.maxResults || 100);
            if (preset.subreddits) setSubreddits(preset.subreddits);
            if (preset.discordServerIds) setDiscordServers(preset.discordServerIds);
        }
    };

    const handleCreate = () => {
        if (!name.trim()) return;

        const criteria: CommunityFilterCriteria = {
            platforms: selectedPlatforms,
            keywords,
            targetRole: targetRole || undefined,
            subreddits: subreddits.length > 0 ? subreddits : undefined,
            discordServerIds: discordServers.length > 0 ? discordServers : undefined,
            requireSpanishSpeaker: requireSpanish,
            minSpanishConfidence: requireSpanish ? 25 : undefined,
            minActivityScore: minActivity,
            maxResults,
            maxDaysOld: 90,
        };

        onCreate(name, criteria);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-600/20 rounded-xl">
                            <Sparkles className="h-6 w-6 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Nueva Campaña de Comunidades</h2>
                            <p className="text-sm text-slate-400">Infiltra ecosistemas donde viven los A-Players</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Preset Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">🎯 Preset rápido</label>
                        <select
                            value={selectedPreset}
                            onChange={(e) => handlePresetSelect(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                        >
                            <option value="">Seleccionar preset...</option>
                            {Object.entries(COMMUNITY_PRESETS).map(([key, preset]) => (
                                <option key={key} value={key}>{preset.icon} {preset.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Campaign Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de campaña *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Flutter Devs - Discord Q1 2026"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>

                    {/* Target Role */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Rol objetivo</label>
                        <input
                            type="text"
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            placeholder="Ej: Flutter Developer, SaaS Builder, Full Stack..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>

                    {/* Platform Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">
                            <Globe className="h-4 w-4 inline mr-1" />
                            Plataformas
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {PLATFORM_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => togglePlatform(opt.value)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedPlatforms.includes(opt.value)
                                            ? 'bg-violet-600/20 border-violet-500/50 text-white'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                        }`}
                                >
                                    <span className="text-xl">{opt.icon}</span>
                                    <span className="font-medium">{opt.label}</span>
                                    {selectedPlatforms.includes(opt.value) && (
                                        <span className="ml-auto text-violet-400">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Keywords */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            <Search className="h-4 w-4 inline mr-1" />
                            Keywords de búsqueda
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={keywordInput}
                                onChange={(e) => setKeywordInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                                placeholder="Añadir keyword..."
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                            />
                            <button onClick={handleAddKeyword} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm transition-colors">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {keywords.map(kw => (
                                <span key={kw} className="flex items-center gap-1 px-3 py-1 bg-violet-600/20 border border-violet-500/30 rounded-full text-sm text-violet-300">
                                    {kw}
                                    <button onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="hover:text-red-400">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Subreddits (if Reddit selected) */}
                    {selectedPlatforms.includes(CommunityPlatform.Reddit) && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <Hash className="h-4 w-4 inline mr-1" />
                                Subreddits
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={subredditInput}
                                    onChange={(e) => setSubredditInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubreddit()}
                                    placeholder="Ej: Flutter, SaaS, startups..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                                />
                                <button onClick={handleAddSubreddit} className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-white text-sm transition-colors">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {subreddits.map(sr => (
                                    <span key={sr} className="flex items-center gap-1 px-3 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-sm text-orange-300">
                                        r/{sr}
                                        <button onClick={() => setSubreddits(subreddits.filter(s => s !== sr))} className="hover:text-red-400">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Discord Servers (if Discord selected) */}
                    {selectedPlatforms.includes(CommunityPlatform.Discord) && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <MessageSquare className="h-4 w-4 inline mr-1" />
                                Discord Server IDs
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={discordInput}
                                    onChange={(e) => setDiscordInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddDiscordServer()}
                                    placeholder="Server ID o invite link..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                                />
                                <button onClick={handleAddDiscordServer} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm transition-colors">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {discordServers.map(ds => (
                                    <span key={ds} className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-sm text-indigo-300">
                                        {ds.length > 20 ? `${ds.slice(0, 20)}...` : ds}
                                        <button onClick={() => setDiscordServers(discordServers.filter(d => d !== ds))} className="hover:text-red-400">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filters Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <Shield className="h-4 w-4 inline mr-1" />
                                Actividad mínima
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={80}
                                value={minActivity}
                                onChange={(e) => setMinActivity(Number(e.target.value))}
                                className="w-full accent-violet-500"
                            />
                            <span className="text-xs text-slate-500">Score ≥ {minActivity}</span>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Max resultados</label>
                            <select
                                value={maxResults}
                                onChange={(e) => setMaxResults(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                            >
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                                <option value={500}>500</option>
                            </select>
                        </div>
                    </div>

                    {/* Spanish Filter */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        <div>
                            <p className="text-sm font-medium text-white">🌍 Filtro hispanohablante</p>
                            <p className="text-xs text-slate-400">Solo mostrar candidatos con señales de español</p>
                        </div>
                        <button
                            onClick={() => setRequireSpanish(!requireSpanish)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${requireSpanish ? 'bg-violet-600' : 'bg-slate-700'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${requireSpanish ? 'translate-x-6' : ''
                                }`} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!name.trim()}
                        className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30"
                    >
                        Crear Campaña
                    </button>
                </div>
            </div>
        </div>
    );
};

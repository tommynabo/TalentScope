import React, { useState } from 'react';
import { X, Plus, Code2, Globe, Star, Users, Shield, Smartphone, FileText } from 'lucide-react';
import { GitHubFilterCriteria } from '../../types/database';

interface GitHubCreateCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, criteria: GitHubFilterCriteria) => void;
}

const POPULAR_LANGUAGES = [
    'TypeScript', 'JavaScript', 'Python', 'Dart', 'Swift', 'Kotlin',
    'Go', 'Rust', 'Java', 'Ruby', 'C++', 'C#', 'PHP', 'Elixir'
];

export const GitHubCreateCampaignModal: React.FC<GitHubCreateCampaignModalProps> = ({ isOpen, onClose, onCreate }) => {
    if (!isOpen) return null;

    const [campaignName, setCampaignName] = useState('');
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['TypeScript']);
    const [customLanguage, setCustomLanguage] = useState('');

    const [criteria, setCriteria] = useState<GitHubFilterCriteria>({
        target_role: '',
        keywords: [],
        search_language: 'en',
        min_stars: 5,
        max_stars: 50000,
        min_forks: 0,
        languages: ['TypeScript'],
        min_public_repos: 5,
        min_followers: 3,
        min_contributions_per_month: 2,
        min_originality_ratio: 40,
        exclude_generic_repos: true,
        require_recent_activity: true,
        max_months_since_last_commit: 6,
        require_app_store_link: false,
        locations: [],
        available_for_hire: false,
        require_spanish_speaker: true,
        min_spanish_language_confidence: 40,
        score_threshold: 45,
    });

    const [currentKeyword, setCurrentKeyword] = useState('');
    const [currentLocation, setCurrentLocation] = useState('');

    // ICP / Outreach fields
    const [roleKeyword, setRoleKeyword] = useState('');
    const [icpDescription, setIcpDescription] = useState('');
    const [miniSkills, setMiniSkills] = useState<string[]>([]);
    const [miniSkillInput, setMiniSkillInput] = useState('');

    const handleAddMiniSkill = () => {
        const skill = miniSkillInput.trim();
        if (skill && !miniSkills.includes(skill)) {
            setMiniSkills([...miniSkills, skill]);
            setMiniSkillInput('');
        }
    };

    const toggleLanguage = (lang: string) => {
        const updated = selectedLanguages.includes(lang)
            ? selectedLanguages.filter(l => l !== lang)
            : [...selectedLanguages, lang];
        setSelectedLanguages(updated);
        setCriteria({ ...criteria, languages: updated });
    };

    const addCustomLanguage = () => {
        if (customLanguage.trim() && !selectedLanguages.includes(customLanguage.trim())) {
            const updated = [...selectedLanguages, customLanguage.trim()];
            setSelectedLanguages(updated);
            setCriteria({ ...criteria, languages: updated });
            setCustomLanguage('');
        }
    };

    const handleAddKeyword = () => {
        if (currentKeyword.trim() && !criteria.keywords?.includes(currentKeyword.trim())) {
            setCriteria({ ...criteria, keywords: [...(criteria.keywords || []), currentKeyword.trim()] });
            setCurrentKeyword('');
        }
    };

    const handleRemoveKeyword = (keyword: string) => {
        setCriteria({ ...criteria, keywords: (criteria.keywords || []).filter(k => k !== keyword) });
    };

    const handleAddLocation = () => {
        if (currentLocation.trim() && !criteria.locations?.includes(currentLocation.trim())) {
            setCriteria({ ...criteria, locations: [...(criteria.locations || []), currentLocation.trim()] });
            setCurrentLocation('');
        }
    };

    const handleRemoveLocation = (location: string) => {
        setCriteria({ ...criteria, locations: (criteria.locations || []).filter(l => l !== location) });
    };

    const handleCreate = () => {
        if (!campaignName.trim()) {
            alert('Introduce un nombre para la campaña');
            return;
        }
        if (!criteria.target_role?.trim()) {
            alert('Introduce un Cargo / Target Role');
            return;
        }
        if (selectedLanguages.length === 0) {
            alert('Selecciona al menos un lenguaje de programación');
            return;
        }
        onCreate(campaignName, {
            ...criteria,
            role_keyword: roleKeyword || criteria.target_role,
            icp_description: icpDescription,
            skills: miniSkills,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl animate-in zoom-in-95">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 flex items-center justify-between z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white">Nueva Campaña GitHub</h3>
                        <p className="text-slate-400 text-sm mt-1">Configura los filtros de búsqueda</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Campaign Name & Role */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Nombre de Campaña *
                            </label>
                            <input
                                type="text"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                placeholder="ej: Senior Flutter Devs LATAM"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Cargo / Target Role *
                            </label>
                            <input
                                type="text"
                                value={criteria.target_role || ''}
                                onChange={(e) => setCriteria({ ...criteria, target_role: e.target.value })}
                                placeholder="ej: Frontend Developer"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Keywords/Skills */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Keywords / Tech Stack (Añade múltiples)
                        </label>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={currentKeyword}
                                onChange={(e) => setCurrentKeyword(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddKeyword();
                                    }
                                }}
                                placeholder="ej: React, Next.js, GraphQL..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                            />
                            <button
                                onClick={handleAddKeyword}
                                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(criteria.keywords || []).map(keyword => (
                                <div
                                    key={keyword}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-lg"
                                >
                                    <span className="text-orange-300 text-sm">{keyword}</span>
                                    <button
                                        onClick={() => handleRemoveKeyword(keyword)}
                                        className="text-orange-400 hover:text-orange-300"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Locations */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Ubicación (Países/Ciudades)
                        </label>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={currentLocation}
                                onChange={(e) => setCurrentLocation(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddLocation();
                                    }
                                }}
                                placeholder="ej: Spain, Mexico, Remote..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                            />
                            <button
                                onClick={handleAddLocation}
                                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(criteria.locations || []).map(location => (
                                <div
                                    key={location}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg"
                                >
                                    <span className="text-blue-300 text-sm">{location}</span>
                                    <button
                                        onClick={() => handleRemoveLocation(location)}
                                        className="text-blue-400 hover:text-blue-300"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Languages */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                            <Code2 className="h-4 w-4 text-orange-400" />
                            Lenguajes de Programación *
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {POPULAR_LANGUAGES.map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => toggleLanguage(lang)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedLanguages.includes(lang)
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                        }`}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={customLanguage}
                                onChange={(e) => setCustomLanguage(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomLanguage(); } }}
                                placeholder="Otro lenguaje..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 outline-none"
                            />
                            <button onClick={addCustomLanguage} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Developer Quality */}
                    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg space-y-4">
                        <h4 className="flex items-center gap-2 font-semibold text-slate-200">
                            <Star className="h-4 w-4 text-yellow-400" />
                            Calidad del Desarrollador
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Min Stars: {criteria.min_stars}
                                </label>
                                <input
                                    type="range" min="0" max="100" value={criteria.min_stars}
                                    onChange={(e) => setCriteria({ ...criteria, min_stars: parseInt(e.target.value) })}
                                    className="w-full accent-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Min Followers: {criteria.min_followers}
                                </label>
                                <input
                                    type="range" min="0" max="100" value={criteria.min_followers}
                                    onChange={(e) => setCriteria({ ...criteria, min_followers: parseInt(e.target.value) })}
                                    className="w-full accent-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Min Public Repos: {criteria.min_public_repos}
                                </label>
                                <input
                                    type="range" min="1" max="50" value={criteria.min_public_repos}
                                    onChange={(e) => setCriteria({ ...criteria, min_public_repos: parseInt(e.target.value) })}
                                    className="w-full accent-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Score Threshold: {criteria.score_threshold}
                                </label>
                                <input
                                    type="range" min="0" max="100" value={criteria.score_threshold || 45}
                                    onChange={(e) => setCriteria({ ...criteria, score_threshold: parseInt(e.target.value) })}
                                    className="w-full accent-orange-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Code Quality */}
                    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg space-y-4">
                        <h4 className="flex items-center gap-2 font-semibold text-slate-200">
                            <Shield className="h-4 w-4 text-cyan-400" />
                            Calidad de Código
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Min Originalidad: {criteria.min_originality_ratio}%
                                </label>
                                <input
                                    type="range" min="0" max="100" value={criteria.min_originality_ratio}
                                    onChange={(e) => setCriteria({ ...criteria, min_originality_ratio: parseInt(e.target.value) })}
                                    className="w-full accent-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Max Meses Sin Commit: {criteria.max_months_since_last_commit}
                                </label>
                                <input
                                    type="range" min="1" max="24" value={criteria.max_months_since_last_commit}
                                    onChange={(e) => setCriteria({ ...criteria, max_months_since_last_commit: parseInt(e.target.value) })}
                                    className="w-full accent-cyan-500"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={criteria.exclude_generic_repos}
                                    onChange={(e) => setCriteria({ ...criteria, exclude_generic_repos: e.target.checked })}
                                    className="w-4 h-4 accent-cyan-500"
                                />
                                <span className="text-sm text-slate-300">Excluir repos genéricos</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={criteria.require_recent_activity}
                                    onChange={(e) => setCriteria({ ...criteria, require_recent_activity: e.target.checked })}
                                    className="w-4 h-4 accent-cyan-500"
                                />
                                <span className="text-sm text-slate-300">Requiere actividad reciente</span>
                            </label>
                        </div>
                    </div>

                    {/* App Store & Spanish */}
                    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg space-y-4">
                        <h4 className="flex items-center gap-2 font-semibold text-slate-200">
                            <Globe className="h-4 w-4 text-emerald-400" />
                            Señales Especiales
                        </h4>

                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={criteria.require_app_store_link}
                                    onChange={(e) => setCriteria({ ...criteria, require_app_store_link: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-500"
                                />
                                <div>
                                    <span className="text-sm text-slate-200 font-medium flex items-center gap-1">
                                        <Smartphone className="h-3.5 w-3.5" /> Requiere App en Store
                                    </span>
                                    <span className="text-xs text-slate-500">Solo devs con apps publicadas en Play Store o App Store</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={criteria.require_spanish_speaker || false}
                                    onChange={(e) => setCriteria({ ...criteria, require_spanish_speaker: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-500"
                                />
                                <div>
                                    <span className="text-sm text-slate-200 font-medium">🇪🇸 Solo Hispanohablantes</span>
                                    <span className="text-xs text-slate-500 block">Filtrar por ubicación y señales de idioma español</span>
                                </div>
                            </label>

                            {criteria.require_spanish_speaker && (
                                <div className="ml-7">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Confianza Mínima: {criteria.min_spanish_language_confidence || 30}%
                                    </label>
                                    <input
                                        type="range" min="10" max="80"
                                        value={criteria.min_spanish_language_confidence || 30}
                                        onChange={(e) => setCriteria({ ...criteria, min_spanish_language_confidence: parseInt(e.target.value) })}
                                        className="w-full accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Amplio (10%)</span>
                                        <span>Estricto (80%)</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ICP & Mensajes */}
                    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg space-y-4">
                        <h4 className="flex items-center gap-2 font-semibold text-slate-200">
                            <FileText className="h-4 w-4 text-pink-400" />
                            ICP & Mensajes de Outreach
                        </h4>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Keyword del puesto en mensajes</label>
                            <input
                                type="text"
                                value={roleKeyword}
                                onChange={(e) => setRoleKeyword(e.target.value)}
                                placeholder={`ej: ${criteria.target_role || 'Product Manager'}`}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Descripción del puesto / ICP</label>
                            <textarea
                                value={icpDescription}
                                onChange={(e) => setIcpDescription(e.target.value)}
                                rows={5}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 outline-none"
                                placeholder="Pega aquí la oferta de trabajo o descripción del candidato ideal."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Mini Skills adicionales</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={miniSkillInput}
                                    onChange={(e) => setMiniSkillInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMiniSkill(); } }}
                                    placeholder="ej: A/B Testing, OKRs..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 outline-none"
                                />
                                <button type="button" onClick={handleAddMiniSkill} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {miniSkills.map(skill => (
                                    <span key={skill} className="flex items-center gap-1 px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-sm text-pink-300">
                                        {skill}
                                        <button type="button" onClick={() => setMiniSkills(miniSkills.filter(s => s !== skill))} className="hover:text-red-400">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleCreate}
                            className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold rounded-lg transition-all"
                        >
                            Crear Campaña
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

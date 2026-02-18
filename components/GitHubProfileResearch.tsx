import React, { useState, useMemo } from 'react';
import { GitBranch, Mail, Linkedin, ExternalLink, Copy, X, Code2, Star, TrendingUp, Users, BrainCircuit } from 'lucide-react';
import { GitHubMetrics } from '../types/database';
import Toast from './Toast';

interface GitHubProfileResearchProps {
    candidate: GitHubMetrics;
    onClose: () => void;
}

export const GitHubProfileResearch: React.FC<GitHubProfileResearchProps> = ({ candidate, onClose }) => {
    const [toast, setToast] = useState({ show: false, message: '' });

    // Generate AI-like research summary based on GitHub metrics
    const generateResearch = useMemo(() => {
        const metrics = candidate;
        
        // Detect developer profile type
        const primaryLanguage = metrics.most_used_language || 'Unknown';
        let profileType = 'Full Stack Developer';
        if (primaryLanguage.toLowerCase().includes('java') || primaryLanguage.toLowerCase().includes('kotlin')) {
            profileType = 'Backend Developer';
        } else if (['javascript', 'typescript', 'react', 'vue'].some(t => primaryLanguage.toLowerCase().includes(t))) {
            profileType = 'Frontend Developer';
        } else if (primaryLanguage.toLowerCase().includes('dart') || primaryLanguage.toLowerCase().includes('flutter')) {
            profileType = 'Mobile Developer';
        } else if (primaryLanguage.toLowerCase().includes('go') || primaryLanguage.toLowerCase().includes('rust')) {
            profileType = 'Systems Developer';
        }

        // Determine activity level
        let activityLevel = 'Active';
        if (metrics.contribution_streak && metrics.contribution_streak < 7) {
            activityLevel = 'Recently Active';
        } else if (metrics.contribution_streak && metrics.contribution_streak < 1) {
            activityLevel = 'Low Activity';
        }

        // Code quality assessment
        let codeQuality = 'Strong';
        if (metrics.average_repo_stars < 10) {
            codeQuality = 'Emerging';
        } else if (metrics.average_repo_stars > 50) {
            codeQuality = 'Exceptional';
        }

        // Open source contribution level
        const osLevel = metrics.open_source_contributions > 20 ? 'Highly Engaged' : 
                       metrics.open_source_contributions > 5 ? 'Contributing' : 'Minimal';

        return {
            profileType,
            activityLevel,
            codeQuality,
            osLevel,
            primarySkill: primaryLanguage,
            experience: Math.min(Math.floor(metrics.followers / 50), 15) + ' años estimados',
            reputation: metrics.total_stars_received > 500 ? '🌟 Establecido' : 
                       metrics.total_stars_received > 100 ? '⭐ Respetado' : '✨ Prometedor'
        };
    }, [candidate]);

    // Generate personalized outreach messages
    const outreachMessages = useMemo(() => {
        const research = generateResearch;
        const name = candidate.github_username;
        const language = research.profileType;

        return {
            icebreaker: `Hola @${name}, vi tu trabajo en GitHub (${research.primarySkill}) y los ${candidate.total_stars_received} stars que has acumulado. Me parece que tienes un talento excepcional en desarrollo. ¿Estaría abierto a una conversación sobre oportunidades de crecimiento?`,
            
            followup: `@${name}, basándome en tu perfil GitHub, veo que eres un ${language} con ${research.codeQuality} capacidad técnica. Tenemos un proyecto que necesita exactamente tu expertise. Veamos si podemos hacer un buen match.`,
            
            secondFollowup: `@${name}, aunque no hayas respondido, quería compartirte una oportunidad que creo que te interesará. Tu patrón de commits activos y diversidad tecnológica te hacen candidato ideal para lo que estamos construyendo. Cuéntame si tienes interés.`
        };
    }, [candidate, generateResearch]);

    const copyToClipboard = (text: string, messageType: string) => {
        navigator.clipboard.writeText(text);
        setToast({ show: true, message: `✅ ${messageType} copiado!` });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="h-5 w-5 text-orange-500" />
                        GitHub Deep Research Profile
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
                    {/* Profile Header */}
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-800/50">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                            {candidate.github_username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <GitBranch className="h-5 w-5 text-orange-400" />
                                @{candidate.github_username}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                                {generateResearch.profileType} • {generateResearch.reputation}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <a
                                    href={candidate.github_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                                >
                                    <GitBranch className="h-3 w-3" /> GitHub Profile
                                </a>
                                {candidate.linkedin_url && (
                                    <a
                                        href={candidate.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/20"
                                    >
                                        <Linkedin className="h-3 w-3" /> LinkedIn
                                    </a>
                                )}
                                {candidate.mentioned_email && (
                                    <a
                                        href={`mailto:${candidate.mentioned_email}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium transition-colors border border-cyan-500/20"
                                    >
                                        <Mail className="h-3 w-3" /> {candidate.mentioned_email}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold mb-1">
                                <Star className="h-3 w-3" /> Reputation
                            </div>
                            <p className="text-white font-bold text-lg">{candidate.total_stars_received}</p>
                            <p className="text-slate-400 text-xs mt-1">Total Stars</p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold mb-1">
                                <Users className="h-3 w-3" /> Community
                            </div>
                            <p className="text-white font-bold text-lg">{candidate.followers}</p>
                            <p className="text-slate-400 text-xs mt-1">Followers</p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center gap-1.5 text-code-4 text-xs font-semibold mb-1">
                                <Code2 className="h-3 w-3" /> Activity
                            </div>
                            <p className="text-white font-bold text-lg">{candidate.contribution_streak}</p>
                            <p className="text-slate-400 text-xs mt-1">Day Streak</p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold mb-1">
                                <TrendingUp className="h-3 w-3" /> Quality
                            </div>
                            <p className="text-white font-bold text-lg">{candidate.average_repo_stars.toFixed(1)}</p>
                            <p className="text-slate-400 text-xs mt-1">Avg Stars/Repo</p>
                        </div>
                    </div>

                    {/* AI Research Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-orange-500/20">
                            <div className="flex items-center gap-2 mb-3 text-orange-400 font-semibold text-sm">
                                <BrainCircuit className="h-4 w-4" />
                                PERFIL TÉCNICO
                            </div>
                            <ul className="space-y-2 text-slate-300 text-sm">
                                <li>• <strong>Especialidad:</strong> {generateResearch.profileType}</li>
                                <li>• <strong>Lenguaje Principal:</strong> {generateResearch.primarySkill}</li>
                                <li>• <strong>Calidad de Código:</strong> {generateResearch.codeQuality}</li>
                                <li>• <strong>Open Source:</strong> {generateResearch.osLevel}</li>
                            </ul>
                        </div>

                        <div className="bg-slate-800/30 p-4 rounded-xl border border-cyan-500/20">
                            <div className="flex items-center gap-2 mb-3 text-cyan-400 font-semibold text-sm">
                                <TrendingUp className="h-4 w-4" />
                                ACTIVIDAD & EXPERIENCIA
                            </div>
                            <ul className="space-y-2 text-slate-300 text-sm">
                                <li>• <strong>Status:</strong> {generateResearch.activityLevel}</li>
                                <li>• <strong>Experiencia Est.:</strong> {generateResearch.experience}</li>
                                <li>• <strong>Repos Originales:</strong> {candidate.original_repos_count}</li>
                                <li>• <strong>Última Actividad:</strong> {candidate.last_commit_date ? new Date(candidate.last_commit_date).toLocaleDateString() : 'N/A'}</li>
                            </ul>
                        </div>
                    </div>

                    {/* Outreach Messages */}
                    <div className="space-y-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensajes Personalizados de Outreach</p>

                        {/* ICEBREAKER */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                            <div className="flex items-center gap-2 mb-2 text-blue-400 font-semibold text-sm">
                                <Mail className="h-4 w-4" />
                                1️⃣ PRIMER CONTACTO
                            </div>
                            <p className="text-slate-200 text-sm leading-relaxed italic mb-3 min-h-[60px]">
                                "{outreachMessages.icebreaker}"
                            </p>
                            <button
                                onClick={() => copyToClipboard(outreachMessages.icebreaker, 'Primer contacto')}
                                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Copy className="h-3.5 w-3.5" /> Copiar
                            </button>
                        </div>

                        {/* FOLLOWUP */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                            <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-sm">
                                <Mail className="h-4 w-4" />
                                2️⃣ SEGUNDA INTERACCIÓN
                            </div>
                            <p className="text-slate-200 text-sm leading-relaxed italic mb-3 min-h-[60px]">
                                "{outreachMessages.followup}"
                            </p>
                            <button
                                onClick={() => copyToClipboard(outreachMessages.followup, 'Segunda interacción')}
                                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Copy className="h-3.5 w-3.5" /> Copiar
                            </button>
                        </div>

                        {/* SECOND FOLLOWUP */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                            <div className="flex items-center gap-2 mb-2 text-purple-400 font-semibold text-sm">
                                <Mail className="h-4 w-4" />
                                3️⃣ SEGUIMIENTO
                            </div>
                            <p className="text-slate-200 text-sm leading-relaxed italic mb-3 min-h-[60px]">
                                "{outreachMessages.secondFollowup}"
                            </p>
                            <button
                                onClick={() => copyToClipboard(outreachMessages.secondFollowup, 'Seguimiento')}
                                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Copy className="h-3.5 w-3.5" /> Copiar
                            </button>
                        </div>
                    </div>

                    {/* Technologies */}
                    {candidate.most_used_language && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Stack Detectado</p>
                            <div className="flex gap-2 flex-wrap">
                                <span className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-md text-sm font-medium">
                                    {candidate.most_used_language}
                                </span>
                                {candidate.original_repos_count > 0 && (
                                    <span className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-md text-sm font-medium">
                                        {candidate.original_repos_count} Repos Originales
                                    </span>
                                )}
                                {candidate.has_app_store_link && (
                                    <span className="bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-md text-sm font-medium">
                                        ✅ App Store Publicada
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Toast 
                isVisible={toast.show} 
                message={toast.message} 
                onClose={() => setToast({ ...toast, show: false })} 
            />
        </div>
    );
};

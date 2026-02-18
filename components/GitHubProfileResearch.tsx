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
                    <div className="flex items-start gap-4 pb-4 border-b border-slate-800/50">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                            {candidate.github_username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white">{candidate.name || `@${candidate.github_username}`}</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                {generateResearch.profileType} • {generateResearch.reputation}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <a
                                    href={`https://github.com/${candidate.github_username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded-lg text-xs font-medium transition-colors border border-orange-500/30"
                                >
                                    <GitBranch className="h-3 w-3" /> GitHub Profile
                                </a>
                                {candidate.linkedin_url && (
                                    <a
                                        href={candidate.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/30"
                                    >
                                        <Linkedin className="h-3 w-3" /> LinkedIn
                                    </a>
                                )}
                                {candidate.mentioned_email && (
                                    <a
                                        href={`mailto:${candidate.mentioned_email}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 rounded-lg text-xs font-medium transition-colors border border-cyan-500/30"
                                    >
                                        <Mail className="h-3 w-3" /> {candidate.mentioned_email}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Grid - 4 Rectángulitos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. Perfil Técnico */}
                        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 p-4 rounded-lg border border-orange-500/20">
                            <h4 className="font-semibold text-orange-400 text-sm mb-2">🧠 Perfil Técnico</h4>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {generateResearch.profileType} especializado en <strong>{generateResearch.primarySkill}</strong>. Nivel técnico <strong>{generateResearch.codeQuality}</strong> con capacidad comprobada de entregar código de calidad.
                            </p>
                        </div>

                        {/* 2. Actividad & Engagement */}
                        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4 rounded-lg border border-blue-500/20">
                            <h4 className="font-semibold text-blue-400 text-sm mb-2">📊 Actividad</h4>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {generateResearch.activityLevel} con racha de <strong>{candidate.contribution_streak} días</strong>. Open source: <strong>{generateResearch.osLevel}</strong>. Comunidad: <strong>{candidate.followers}</strong> seguidores.
                            </p>
                        </div>

                        {/* 3. Expertise & Impact */}
                        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4 rounded-lg border border-purple-500/20">
                            <h4 className="font-semibold text-purple-400 text-sm mb-2">⭐ Expertise</h4>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                <strong>{candidate.total_stars_received}</strong> stars acumulados. Promedio de <strong>{candidate.average_repo_stars.toFixed(1)}</strong> stars por repo. <strong>{candidate.public_repos}</strong> repositorios públicos.
                            </p>
                        </div>

                        {/* 4. Oportunidad */}
                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 rounded-lg border border-emerald-500/20">
                            <h4 className="font-semibold text-emerald-400 text-sm mb-2">🎯 Oportunidad</h4>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Candidato ideal para proyectos con requisitos técnicos exigentes. Demuestra compromiso con la calidad y la comunidad open source.
                            </p>
                        </div>
                    </div>

                    {/* Mensajes de Outreach */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">📧 Mensajes Personalizados</h4>

                        {/* Icebreaker */}
                        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-orange-400 bg-orange-500/20 px-2 py-1 rounded">1️⃣ PRIMER CONTACTO</span>
                            </div>
                            <p className="text-slate-300 text-sm italic mb-2">{outreachMessages.icebreaker}</p>
                            <button
                                onClick={() => copyToClipboard(outreachMessages.icebreaker, 'Mensaje 1')}
                                className="w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Copy className="h-3 w-3" /> Copiar
                            </button>
                        </div>

                        {/* Followup */}
                        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">2️⃣ SEGUNDA INTERACCIÓN</span>
                            </div>
                            <p className="text-slate-300 text-sm italic mb-2">{outreachMessages.followup}</p>
                            <button
                                onClick={() => copyToClipboard(outreachMessages.followup, 'Mensaje 2')}
                                className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Copy className="h-3 w-3" /> Copiar
                            </button>
                        </div>

                        {/* Second Followup */}
                        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-2 py-1 rounded">3️⃣ SEGUIMIENTO</span>
                            </div>
                            <p className="text-slate-300 text-sm italic mb-2">{outreachMessages.secondFollowup}</p>
                            <button
                                onClick={() => copyToClipboard(outreachMessages.secondFollowup, 'Mensaje 3')}
                                className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Copy className="h-3 w-3" /> Copiar
                            </button>
                        </div>
                    </div>

                    {/* Export Section */}
                    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50 space-y-3">
                        <h4 className="font-semibold text-slate-300 text-sm">📥 Exportar Información</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {candidate.mentioned_email && (
                                <button
                                    onClick={() => copyToClipboard(candidate.mentioned_email || '', 'Email')}
                                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-all"
                                >
                                    <Mail className="h-3.5 w-3.5" /> Copiar Email
                                </button>
                            )}
                            {candidate.linkedin_url && (
                                <button
                                    onClick={() => copyToClipboard(candidate.linkedin_url || '', 'LinkedIn')}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-all"
                                >
                                    <Linkedin className="h-3.5 w-3.5" /> Copiar LinkedIn
                                </button>
                            )}
                        </div>
                    </div>
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

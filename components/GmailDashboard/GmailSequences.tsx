import React, { useState, useEffect } from 'react';
import { GmailService, GmailSequence, GmailSequenceStep } from '../../lib/gmailService';
import { PlusCircle, Search, Play, Pause, Edit, Trash2, ArrowLeft, Clock, Save, Plus, GripVertical, AlertCircle, FileText, Zap, MessageSquare, Rocket } from 'lucide-react';

// ── Outreach message templates ──────────────────────────────────
interface OutreachTemplate {
    label: string;
    description: string;
    icon: 'zap' | 'message';
    steps: Partial<GmailSequenceStep>[];
}

const OUTREACH_TEMPLATES: OutreachTemplate[] = [
    {
        label: 'Secuencia Outreach Completa',
        description: 'Invitación → Post-aceptación (24h) → Seguimiento (48h)',
        icon: 'zap',
        steps: [
            {
                subject_template: 'Oportunidad para {{name}} en {{specialty}}',
                body_template: `Hola {{name}},

Soy parte del equipo de Symmetry, una app de salud y bienestar con fuerte crecimiento. Vi tu experiencia en {{specialty}} y me pareció muy interesante.

Me encantaría conectar contigo y compartir más sobre lo que estamos construyendo.

¡Saludos!`,
                delay_hours: 0,
            },
            {
                subject_template: 'Re: Oportunidad para {{name}} en {{specialty}}',
                body_template: `Hola {{name}},

Gracias por tu interés. Estamos escalando Symmetry, una app de salud y bienestar con mucha tracción (+400k descargas/mes) y un equipo de producto pequeño pero potente.

Buscamos product engineers con experiencia en {{specialty}}. Creemos que tu perfil encaja muy bien.

¿Te interesaría que te pase el brief técnico del proyecto?

¡Quedo atento!`,
                delay_hours: 24,
            },
            {
                subject_template: 'Re: Oportunidad para {{name}} en {{specialty}}',
                body_template: `Hola {{name}},

Te escribo de nuevo porque viendo tu trayectoria creemos que hay una gran alineación con lo que buscamos.

Es una oportunidad de trabajar en un producto con tracción real y un equipo senior. Si tienes unos minutos, me encantaría agendar una llamada rápida.

¿Qué dices?`,
                delay_hours: 48,
            },
        ],
    },
    {
        label: 'Invitación + Post-aceptación',
        description: 'Solo los 2 primeros pasos: invitación y pitch (24h)',
        icon: 'message',
        steps: [
            {
                subject_template: 'Hola {{name}} — Una propuesta que creo te va a interesar',
                body_template: `Hola {{name}},

Vi tu experiencia en {{specialty}} y me pareció que podrías encajar perfecto con un proyecto en el que estamos trabajando.

¿Te gustaría saber más?

¡Saludos!`,
                delay_hours: 0,
            },
            {
                subject_template: 'Re: Hola {{name}} — Una propuesta que creo te va a interesar',
                body_template: `Hola {{name}},

Gracias por tu respuesta. Te cuento un poco más: estamos escalando Symmetry, una app de salud y bienestar con +400k descargas/mes.

Buscamos product engineers en {{specialty}} para un equipo senior y pequeño. Creo que tu perfil es ideal.

¿Te interesaría revisar el brief técnico o agendar una llamada corta?`,
                delay_hours: 24,
            },
        ],
    },
];

const GmailSequences: React.FC = () => {
    const [sequences, setSequences] = useState<GmailSequence[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Editor state
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [activeSequence, setActiveSequence] = useState<GmailSequence | null>(null);
    const [steps, setSteps] = useState<Partial<GmailSequenceStep>[]>([]);
    const [saving, setSaving] = useState(false);
    const [showTemplatePanel, setShowTemplatePanel] = useState(false);
    const [activating, setActivating] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadSequences();
    }, []);

    const loadSequences = async () => {
        try {
            const s = await GmailService.getSequences();
            setSequences(s);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = async () => {
        try {
            const name = prompt('Nombre de la nueva secuencia:');
            if (!name) return;
            const newSeq = await GmailService.createSequence(name);
            setSequences([newSeq, ...sequences]);
            openEditor(newSeq);
        } catch (error) {
            console.error(error);
            alert('Error al crear la secuencia');
        }
    };

    const handleCreateFromTemplate = async (template: OutreachTemplate) => {
        try {
            const name = prompt('Nombre de la nueva secuencia:', template.label);
            if (!name) return;
            const newSeq = await GmailService.createSequence(name);
            setSequences([newSeq, ...sequences]);
            setActiveSequence(newSeq);
            setSteps(template.steps.map(s => ({ ...s })));
            setView('editor');
            setShowTemplatePanel(false);
        } catch (error) {
            console.error(error);
            alert('Error al crear la secuencia');
        }
    };

    const loadTemplateIntoEditor = (template: OutreachTemplate) => {
        if (steps.some(s => s.body_template && s.body_template.trim() !== '')) {
            if (!confirm('⚠️ Esto reemplazará los pasos actuales. ¿Continuar?')) return;
        }
        setSteps(template.steps.map(s => ({ ...s })));
        setShowTemplatePanel(false);
    };

    const openEditor = async (seq: GmailSequence) => {
        setActiveSequence(seq);
        setView('editor');
        try {
            const seqSteps = await GmailService.getSequenceSteps(seq.id);
            setSteps(seqSteps.length > 0 ? seqSteps : [
                { subject_template: '', body_template: '', delay_hours: 0 } // default first step
            ]);
        } catch (error) {
            console.error("Failed to load steps", error);
        }
    };

    const handleSaveSteps = async () => {
        if (!activeSequence) return;
        setSaving(true);
        try {
            await GmailService.saveSequenceSteps(activeSequence.id, steps);
            alert('¡Secuencia guardada exitosamente!');
            setView('list');
        } catch (error) {
            console.error(error);
            alert('Error al guardar pasos de secuencia.');
        } finally {
            setSaving(false);
        }
    };

    const addStep = () => {
        setSteps([...steps, { subject_template: '', body_template: '', delay_hours: 24 }]);
    };

    const updateStep = (index: number, field: keyof GmailSequenceStep, value: any) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const handleDeleteSequence = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la secuencia "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await GmailService.deleteSequence(id);
            setSequences(sequences.filter(s => s.id !== id));
        } catch (error) {
            console.error(error);
            alert('Error al eliminar la secuencia');
        }
    };

    const handleToggleStatus = async (seq: GmailSequence) => {
        const newStatus = seq.status === 'active' ? 'paused' : 'active';
        try {
            await GmailService.updateSequenceStatus(seq.id, newStatus);
            setSequences(sequences.map(s => s.id === seq.id ? { ...s, status: newStatus } : s));
        } catch (error) {
            console.error(error);
            alert('Error al cambiar el estado de la secuencia');
        }
    };

    const handleActivateSequence = async () => {
        if (!activeSequence) return;
        if (steps.length === 0) {
            alert('⚠️ Debes añadir al menos un paso a la secuencia');
            return;
        }
        setActivating(true);
        try {
            await GmailService.activateSequence(activeSequence.id);
            // Update local state
            setSequences(sequences.map(s => s.id === activeSequence.id ? { ...s, status: 'active' } : s));
            setActiveSequence({ ...activeSequence, status: 'active' });
            alert('✅ Secuencia activada. Los emails comenzarán a enviarse automáticamente.');
        } catch (error) {
            console.error(error);
            alert('Error al activar la secuencia');
        } finally {
            setActivating(false);
        }
    };

    const handleTestOutreach = async () => {
        if (!activeSequence) return;
        setTesting(true);
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            
            // Only add auth header if CRON_SECRET is configured
            const cronSecret = import.meta.env.VITE_CRON_SECRET;
            if (cronSecret) {
                headers['Authorization'] = `Bearer ${cronSecret}`;
            }

            console.log('[Test] Starting outreach test...');
            const response = await fetch('/api/test-outreach', {
                method: 'POST',
                headers,
            });

            console.log('[Test] Response status:', response.status);

            // Try to parse JSON
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // If JSON parsing fails, the server likely returned HTML error
                const text = await response.text();
                console.error('[Test] Non-JSON response:', text.substring(0, 200));
                throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                const errorMsg = data?.error || data?.message || 'Unknown error';
                const details = data?.details || '';
                console.error('[Test] Error response:', data);
                throw new Error(`${errorMsg}${details ? '\n' + details : ''}`);
            }

            const result = data?.data || {};
            const errorsList = result.errors?.map((e: any) => `${e.leadId}: ${e.error}`).join('\n') || 'Sin errores especiales';
            
            alert(
                `✅ Test completado\n\n` +
                `Enviados: ${result.success}\n` +
                `Fallos: ${result.failed}\n\n` +
                `Detalles:\n${errorsList}`
            );
            
            console.log('[Test] Success:', result);
        } catch (error: any) {
            console.error('[Test] Error:', error);
            const errorMsg = error?.message || String(error);
            alert(`❌ Error en test: ${errorMsg}`);
        } finally {
            setTesting(false);
        }
    };

    const filteredSequences = sequences.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (view === 'editor' && activeSequence) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl sticky top-0 z-10 shadow-lg shadow-black/20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('list')}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {activeSequence.name}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${activeSequence.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                    {activeSequence.status}
                                </span>
                            </h2>
                            <p className="text-sm text-slate-400">Constructor visual de la secuencia.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all border ${showTemplatePanel ? 'bg-purple-600/20 text-purple-300 border-purple-500/40' : 'bg-slate-800 text-slate-300 hover:text-purple-300 border-slate-700 hover:border-purple-500/30 hover:bg-purple-500/10'}`}
                            title="Cargar plantilla de mensajes de outreach"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">Plantillas</span>
                        </button>
                        {activeSequence.status === 'draft' && (
                            <button
                                onClick={handleActivateSequence}
                                disabled={activating || steps.length === 0}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                title="Activar secuencia para comenzar a enviar emails"
                            >
                                {activating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <Rocket className="w-5 h-5" />
                                )}
                                <span>Activar Secuencia</span>
                            </button>
                        )}
                        <button
                            onClick={handleTestOutreach}
                            disabled={testing || steps.length === 0}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                            title="Probar el envío ahora sin esperar al cron"
                        >
                            {testing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Zap className="w-5 h-5" />
                            )}
                            <span>Probar Envío</span>
                        </button>
                        <button
                            onClick={handleSaveSteps}
                            disabled={saving}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-[0_0_15px_rgba(8,145,178,0.4)]"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            <span>Guardar Cambios</span>
                        </button>
                    </div>
                </div>

                {/* ── Template selection panel ────────────────────── */}
                {showTemplatePanel && (
                    <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/20 rounded-2xl p-5 shadow-xl shadow-purple-900/10 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-purple-400" />
                                    Cargar Plantilla de Outreach
                                </h3>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    Precarga los mensajes de invitación, post-aceptación y seguimiento.
                                    Variables disponibles: <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-xs">{'{{name}}'}</code> <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-xs">{'{{specialty}}'}</code> <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-xs">{'{{role}}'}</code>
                                </p>
                            </div>
                            <button onClick={() => setShowTemplatePanel(false)} className="text-slate-500 hover:text-white p-1">✕</button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {OUTREACH_TEMPLATES.map((tpl, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => loadTemplateIntoEditor(tpl)}
                                    className="group text-left bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/30 rounded-xl p-4 transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors shrink-0">
                                            {tpl.icon === 'zap' ? <Zap className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white group-hover:text-purple-300 transition-colors">{tpl.label}</p>
                                            <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                                            <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider font-medium">{tpl.steps.length} pasos</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
                    {steps.map((step, index) => (
                        <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-slate-950 bg-slate-900 text-cyan-400 font-bold shadow-xl shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                {index + 1}
                            </div>

                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg transition-all hover:border-slate-700 relative">
                                {/* Time delay for step > 1 */}
                                {index > 0 && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-medium text-slate-300 flex items-center gap-1.5 shadow-md z-20">
                                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                        <span>Esperar</span>
                                        <input
                                            type="number"
                                            value={step.delay_hours}
                                            onChange={(e) => updateStep(index, 'delay_hours', parseInt(e.target.value) || 0)}
                                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1 text-center focus:outline-none focus:border-cyan-500"
                                            min="0"
                                        />
                                        <span>horas</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Asunto del Correo</label>
                                        <input
                                            type="text"
                                            value={step.subject_template}
                                            onChange={(e) => updateStep(index, 'subject_template', e.target.value)}
                                            placeholder="Ej: Hola {{name}}, una oportunidad en {{company}}..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                                        />
                                    </div>
                                    {steps.length > 1 && (
                                        <button
                                            onClick={() => removeStep(index)}
                                            className="ml-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                        <span>Cuerpo del Mensaje</span>
                                        <span className="text-[10px] text-slate-500 normal-case font-normal flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Soporta variables {'{{name}}'}, {'{{role}}'}, {'{{specialty}}'}
                                        </span>
                                    </label>
                                    <textarea
                                        value={step.body_template}
                                        onChange={(e) => updateStep(index, 'body_template', e.target.value)}
                                        placeholder="Escribe el contenido de tu correo aquí..."
                                        rows={5}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors resize-y custom-scrollbar"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="flex items-center justify-center pt-8 relative z-10">
                        <button
                            onClick={addStep}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-cyan-600 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white px-6 py-3 rounded-full font-medium transition-all shadow-lg hover:shadow-[0_0_20px_rgba(8,145,178,0.4)]"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Añadir Siguiente Paso</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Buscar secuencia..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border ${showTemplatePanel ? 'bg-purple-600/20 text-purple-300 border-purple-500/40' : 'bg-slate-800 text-slate-300 hover:text-purple-300 border-slate-700 hover:border-purple-500/30 hover:bg-purple-500/10'}`}
                        >
                            <Zap className="w-4 h-4" />
                            <span className="hidden sm:inline">Desde Plantilla</span>
                        </button>
                        {showTemplatePanel && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-purple-500/20 rounded-xl p-3 shadow-2xl shadow-black/40 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 px-1">Crear con plantilla de outreach</p>
                                {OUTREACH_TEMPLATES.map((tpl, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleCreateFromTemplate(tpl)}
                                        className="w-full text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/30 rounded-lg p-3 mb-2 last:mb-0 transition-all group"
                                    >
                                        <div className="flex items-center gap-2">
                                            {tpl.icon === 'zap' ? <Zap className="w-4 h-4 text-purple-400" /> : <MessageSquare className="w-4 h-4 text-purple-400" />}
                                            <span className="font-medium text-sm text-white group-hover:text-purple-300 transition-colors">{tpl.label}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1 ml-6">{tpl.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-[0_0_15px_rgba(8,145,178,0.3)]"
                    >
                        <PlusCircle className="w-5 h-5" />
                        <span>Nueva Secuencia</span>
                    </button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    </div>
                ) : filteredSequences.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 border border-dashed border-slate-800 m-4 rounded-xl">
                        <h3 className="text-lg font-medium text-slate-300 mb-2">No hay secuencias</h3>
                        <p className="max-w-md mx-auto">Crea tu primera secuencia para automatizar respuestas, envíos masivos y seguimientos a los candidatos.</p>
                        <button
                            onClick={handleCreateNew}
                            className="mt-6 text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1"
                        >
                            <PlusCircle className="w-4 h-4" /> Crear ahora
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-semibold">Nombre de la Secuencia</th>
                                    <th className="p-4 font-semibold">Estado</th>
                                    <th className="p-4 font-semibold">Fecha Creación</th>
                                    <th className="p-4 font-semibold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredSequences.map((seq) => (
                                    <tr key={seq.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-4">
                                            <span className="font-medium text-white group-hover:text-cyan-400 transition-colors cursor-pointer" onClick={() => openEditor(seq)}>
                                                {seq.name}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border ${seq.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                seq.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                    'bg-slate-800 text-slate-400 border-slate-700'
                                                }`}>
                                                {seq.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {new Date(seq.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditor(seq)}
                                                    className="p-2 bg-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors border border-slate-700 hover:border-cyan-500/30"
                                                    title="Editar Secuencia"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(seq)}
                                                    className={`p-2 bg-slate-800 text-slate-300 rounded-lg transition-colors border border-slate-700 ${seq.status === 'active' ? 'hover:text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/30' : 'hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30'}`}
                                                    title={seq.status === 'active' ? "Pausar Secuencia" : "Iniciar Secuencia"}
                                                >
                                                    {seq.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSequence(seq.id, seq.name)}
                                                    className="p-2 bg-slate-800 text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-slate-700 hover:border-red-500/30"
                                                    title="Eliminar Secuencia"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GmailSequences;

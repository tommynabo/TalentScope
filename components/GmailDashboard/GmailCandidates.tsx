import React, { useState, useEffect, useMemo } from 'react';
import { GmailCandidatesService, GlobalEmailCandidate } from '../../lib/gmailCandidatesService';
import { GmailService, GmailSequence, GmailOutreachLead } from '../../lib/gmailService';
import { Search, MailPlus, Filter, Github, Linkedin, Briefcase, MoreHorizontal, MessageSquare, Calendar } from 'lucide-react';

type CandidateWithLane = GlobalEmailCandidate & {
    kanbanLane: string;
    leadId?: string;
};

const COLUMNS = [
    { id: 'todo', label: 'Por Contactar', color: 'bg-slate-500' },
    { id: 'contacted', label: 'Contactado', color: 'bg-blue-500' },
    { id: 'replied', label: 'Respondió', color: 'bg-yellow-500' },
    { id: 'rejected', label: 'Rechazó', color: 'bg-red-500' },
    { id: 'hired', label: 'Contratado', color: 'bg-emerald-500' },
];

const GmailCandidates: React.FC = () => {
    const [candidates, setCandidates] = useState<CandidateWithLane[]>([]);
    const [sequences, setSequences] = useState<GmailSequence[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [platformFilter, setPlatformFilter] = useState<string>('all');

    // Action state
    const [enrolling, setEnrolling] = useState(false);
    const [selectedSequence, setSelectedSequence] = useState<string>('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [candData, seqData, leadsData] = await Promise.all([
                GmailCandidatesService.getGlobalEmailCandidates(),
                GmailService.getSequences(),
                GmailService.getAllOutreachLeads()
            ]);

            // Map candidates to their kanban lane based on outreach leads
            const candidatesWithState = candData.map(c => {
                const lead = leadsData.find(l => l.candidate_id === c.candidate_id);
                let lane = 'todo';
                if (lead) {
                    if (lead.status === 'replied') lane = 'replied';
                    else if (lead.status === 'bounced' || lead.status === 'failed') lane = 'rejected';
                    else if (lead.status === 'completed') lane = 'hired'; // mapped for Kanban parity
                    else if (lead.status === 'running') lane = 'contacted';
                    else if (lead.status === 'pending') lane = 'todo';
                    else lane = lead.status; // fallback
                }
                return { ...c, kanbanLane: lane, leadId: lead?.id };
            });

            setCandidates(candidatesWithState);
            setSequences(seqData);
        } catch (error) {
            console.error('Error fetching data for candidates view:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleEnroll = async () => {
        if (selectedIds.size === 0 || !selectedSequence) return;

        setEnrolling(true);
        try {
            const selectedCandidates = candidates.filter(c => selectedIds.has(c.candidate_id));
            const result = await GmailCandidatesService.enrollCandidatesToSequence(selectedSequence, selectedCandidates);

            alert(`Acción completada.\nAñadidos a la secuencia: ${result.success}\nFallidos/Duplicados: ${result.failed}`);
            setSelectedIds(new Set());
            setSelectedSequence('');
            fetchData(); // Refresh pipeline
        } catch (error: any) {
            alert(`Error al añadir candidatos: ${error.message}`);
        } finally {
            setEnrolling(false);
        }
    };

    // Drag and Drop
    const handleDragStart = (e: React.DragEvent, candidateId: string) => {
        e.dataTransfer.setData('candidateId', candidateId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, laneId: string) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData('candidateId');
        if (!candidateId) return;

        const candidate = candidates.find(c => c.candidate_id === candidateId);
        if (!candidate) return;

        // Optimistic UI update
        const previousCandidates = [...candidates];
        setCandidates(candidates.map(c =>
            c.candidate_id === candidateId ? { ...c, kanbanLane: laneId } : c
        ));

        // If they have a lead record, update status representing the lane
        if (candidate.leadId) {
            try {
                let status = 'pending';
                if (laneId === 'contacted') status = 'running';
                if (laneId === 'replied') status = 'replied';
                if (laneId === 'rejected') status = 'failed';
                if (laneId === 'hired') status = 'completed'; // mapped appropriately

                await GmailService.updateLeadStatus(candidate.leadId, status);
            } catch (error) {
                console.error("Failed to update status", error);
                setCandidates(previousCandidates); // Revert
                alert("Error al mover candidato");
            }
        } else {
            // Cannot logically move if they aren't in a sequence yet. We can just keep the visual state locally or let them know!
            alert('Añade primero al candidato a una secuencia antes de mover de estado manualmente.');
            setCandidates(previousCandidates); // Revert
        }
    };

    const filteredCandidates = useMemo(() => {
        return candidates.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPlatform = platformFilter === 'all' || c.source_platform.toLowerCase() === platformFilter.toLowerCase();
            return matchesSearch && matchesPlatform;
        });
    }, [candidates, searchTerm, platformFilter]);

    const getPlatformIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'github': return <Github className="w-3 h-3 text-slate-400 inline" />;
            case 'linkedin': return <Linkedin className="w-3 h-3 text-blue-400 inline" />;
            default: return <Briefcase className="w-3 h-3 text-emerald-400 inline" />;
        }
    };

    const getColumnCandidates = (laneId: string) => {
        return filteredCandidates.filter(c => c.kanbanLane === laneId);
    };

    return (
        <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white">Pipeline de Candidatos ({filteredCandidates.length})</h2>
                    <p className="text-slate-400 text-sm mt-1">Arrastra contactos o añádelos a una secuencia de correos.</p>
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700 animate-in fade-in zoom-in duration-200">
                        <span className="text-sm font-medium text-cyan-400 px-2">{selectedIds.size} seleccionados</span>

                        <select
                            value={selectedSequence}
                            onChange={(e) => setSelectedSequence(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:border-cyan-500"
                        >
                            <option value="">Seleccionar Secuencia...</option>
                            {sequences.map(seq => (
                                <option key={seq.id} value={seq.id}>{seq.name}</option>
                            ))}
                        </select>

                        <button
                            onClick={handleEnroll}
                            disabled={!selectedSequence || enrolling}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                            {enrolling ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <MailPlus className="w-4 h-4" />
                            )}
                            Añadir
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shrink-0">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>

                <div className="sm:w-48 relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <select
                        value={platformFilter}
                        onChange={e => setPlatformFilter(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm appearance-none focus:outline-none focus:border-cyan-500 transition-colors"
                    >
                        <option value="all">Todas las plataformas</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="github">GitHub</option>
                        <option value="upwork">Upwork / Fiverr</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                </div>
            ) : (
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar">
                    <div className="flex h-full gap-4">
                        {COLUMNS.map(col => (
                            <div
                                key={col.id}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                                className="min-w-[280px] w-[280px] bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col h-full"
                            >
                                <div className="p-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10 rounded-t-xl shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${col.color}`}></div>
                                        <span className="font-semibold text-slate-200 text-sm">{col.label}</span>
                                        <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                            {getColumnCandidates(col.id).length}
                                        </span>
                                    </div>
                                    <MoreHorizontal className="h-4 w-4 text-slate-500 hover:text-white cursor-pointer" />
                                </div>

                                <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
                                    {getColumnCandidates(col.id).map(candidate => (
                                        <div
                                            key={candidate.candidate_id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, candidate.candidate_id)}
                                            className={`p-3 rounded-lg bg-slate-800 border cursor-grab active:cursor-grabbing hover:shadow-md hover:bg-slate-800/80 transition-all select-none
                                                ${selectedIds.has(candidate.candidate_id) ? 'border-cyan-500 ring-1 ring-cyan-500/50' : 'border-slate-700/50 hover:border-emerald-500/50'}`}
                                            onClick={(e) => {
                                                if (e.ctrlKey || e.metaKey || col.id === 'todo') { // allow selection mostly in todo
                                                    handleSelectOne(candidate.candidate_id);
                                                }
                                            }}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(candidate.candidate_id)}
                                                        onChange={() => handleSelectOne(candidate.candidate_id)}
                                                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-900"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                    <img
                                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=0F172A&color=94A3B8`}
                                                        alt={candidate.name}
                                                        className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-700"
                                                    />
                                                </div>
                                            </div>
                                            <h4 className="font-semibold text-slate-200 text-sm mb-0.5 truncate" title={candidate.name}>{candidate.name}</h4>

                                            <div className="text-[10px] text-slate-500 truncate mb-1 flex items-center gap-1.5">
                                                {getPlatformIcon(candidate.source_platform)}
                                                <span>{candidate.source_platform}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mb-2 truncate" title={candidate.email}>
                                                {candidate.email}
                                            </p>

                                            <div className="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-700/50">
                                                <div className="flex gap-2">
                                                    <MessageSquare className="h-3 w-3" />
                                                    <Calendar className="h-3 w-3" />
                                                </div>
                                                <span className="text-[10px]">
                                                    {new Date(candidate.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GmailCandidates;

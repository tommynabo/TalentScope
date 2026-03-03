import React, { useState, useEffect, useMemo } from 'react';
import { GmailCandidatesService, GlobalEmailCandidate } from '../../lib/gmailCandidatesService';
import { GmailService, GmailSequence } from '../../lib/gmailService';
import { Search, MailPlus, Filter, Github, Linkedin, Briefcase, Calendar, MessageSquare } from 'lucide-react';

type CandidateWithLane = GlobalEmailCandidate & {
    kanbanLane: string;
    leadId?: string;
};

const laneLabels: Record<string, string> = {
    todo: 'Por Contactar',
    contacted: 'Contactado',
    replied: 'Respondió',
    rejected: 'Rechazó / Falló',
    hired: 'Completado',
};

const laneBg: Record<string, string> = {
    todo: 'bg-slate-500 hover:bg-slate-400',
    contacted: 'bg-blue-500 hover:bg-blue-400',
    replied: 'bg-yellow-500 hover:bg-yellow-400',
    rejected: 'bg-red-500 hover:bg-red-400',
    hired: 'bg-emerald-500 hover:bg-emerald-400',
};

const GmailCandidates: React.FC = () => {
    const [candidates, setCandidates] = useState<CandidateWithLane[]>([]);
    const [sequences, setSequences] = useState<GmailSequence[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters & Sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [platformFilter, setPlatformFilter] = useState<string>('all');
    const [filterLane, setFilterLane] = useState<string | null>(null);

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

            // Map candidates to their lane based on outreach leads
            const candidatesWithState = candData.map(c => {
                const lead = leadsData.find(l => l.candidate_id === c.candidate_id);
                let lane = 'todo';
                if (lead) {
                    if (lead.status === 'replied') lane = 'replied';
                    else if (lead.status === 'bounced' || lead.status === 'failed') lane = 'rejected';
                    else if (lead.status === 'completed') lane = 'hired'; // mapped
                    else if (lead.status === 'running') lane = 'contacted';
                    else if (lead.status === 'pending') lane = 'todo';
                    else lane = lead.status; // fallback
                }
                return { ...c, kanbanLane: lane, leadId: lead?.id };
            });

            // Default sort by added date (created_at) descending
            candidatesWithState.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredCandidates.map(c => c.candidate_id)));
        } else {
            setSelectedIds(new Set());
        }
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
            fetchData(); // Refresh list to get new status
        } catch (error: any) {
            alert(`Error al añadir candidatos: ${error.message}`);
        } finally {
            setEnrolling(false);
        }
    };

    // Change status from the dropdown
    const handleStatusChange = async (candidate: CandidateWithLane, newLane: string) => {
        if (!candidate.leadId) {
            alert("El candidato aún no está asignado a ninguna secuencia. No puedes cambiar su estado manualmente.");
            return;
        }

        // Optimistic UI update
        const previousCandidates = [...candidates];
        setCandidates(candidates.map(c =>
            c.candidate_id === candidate.candidate_id ? { ...c, kanbanLane: newLane } : c
        ));

        try {
            let status = 'pending';
            if (newLane === 'contacted') status = 'running';
            if (newLane === 'replied') status = 'replied';
            if (newLane === 'rejected') status = 'failed';
            if (newLane === 'hired') status = 'completed';

            await GmailService.updateLeadStatus(candidate.leadId, status);
        } catch (error) {
            console.error("Failed to update status", error);
            setCandidates(previousCandidates); // Revert
            alert("Error al actualizar el estado del candidato");
        }
    };

    const filteredCandidates = useMemo(() => {
        return candidates.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPlatform = platformFilter === 'all' || c.source_platform.toLowerCase() === platformFilter.toLowerCase();
            const matchesLane = filterLane ? c.kanbanLane === filterLane : true;
            return matchesSearch && matchesPlatform && matchesLane;
        });
    }, [candidates, searchTerm, platformFilter, filterLane]);

    const getPlatformIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'github': return <Github className="w-4 h-4 text-slate-400" />;
            case 'linkedin': return <Linkedin className="w-4 h-4 text-blue-400" />;
            default: return <Briefcase className="w-4 h-4 text-emerald-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
                <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3">
                        <select
                            value={platformFilter}
                            onChange={e => setPlatformFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="all">Todas las plataformas</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="github">GitHub</option>
                            <option value="upwork">Upwork / Fiverr</option>
                        </select>

                        <select
                            value={filterLane || ''}
                            onChange={(e) => setFilterLane(e.target.value || null)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                            <option value="">Todos los Estados</option>
                            <option value="todo">Por Contactar</option>
                            <option value="contacted">Contactado</option>
                            <option value="replied">Respondió</option>
                            <option value="rejected">Rechazó / Falló</option>
                            <option value="hired">Completado</option>
                        </select>
                    </div>
                </div>

                {/* Bulk Actions Menu */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700 animate-in fade-in zoom-in duration-200 ml-auto w-full md:w-auto mt-4 md:mt-0">
                        <span className="text-sm font-medium text-cyan-400 px-2 whitespace-nowrap">{selectedIds.size} selec.</span>
                        <select
                            value={selectedSequence}
                            onChange={(e) => setSelectedSequence(e.target.value)}
                            className="flex-1 min-w-[150px] bg-slate-950 border border-slate-700 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:border-cyan-500 text-slate-200"
                        >
                            <option value="">Seleccionar Secuencia...</option>
                            {sequences.map(seq => (
                                <option key={seq.id} value={seq.id}>{seq.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleEnroll}
                            disabled={!selectedSequence || enrolling}
                            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
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

            {/* Pipeline List Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                {loading ? (
                    <div className="p-16 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="p-16 text-center text-slate-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-slate-300 mb-1">No hay candidatos importados</h3>
                        <p>Los candidatos scrapeados con email en Github, LinkedIn y Marketplace aparecerán aquí.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                                            className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-900"
                                        />
                                    </th>
                                    <th className="p-4 font-semibold">Estado en Pipeline</th>
                                    <th className="p-4 font-semibold">Candidato</th>
                                    <th className="p-4 font-semibold">Origen</th>
                                    <th className="p-4 font-semibold">Contacto</th>
                                    <th className="p-4 font-semibold">Incorporado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredCandidates.map(candidate => (
                                    <tr
                                        key={candidate.candidate_id}
                                        className={`hover:bg-slate-800/30 transition-colors group ${selectedIds.has(candidate.candidate_id) ? 'bg-cyan-900/10' : ''}`}
                                        onClick={(e) => {
                                            // Handle row click (except when clicking select menus or anchors)
                                            if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'A' && (e.target as HTMLElement).tagName !== 'INPUT') {
                                                handleSelectOne(candidate.candidate_id);
                                            }
                                        }}
                                    >
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(candidate.candidate_id)}
                                                onChange={() => handleSelectOne(candidate.candidate_id)}
                                                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-900"
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <select
                                                value={candidate.kanbanLane}
                                                onChange={(e) => handleStatusChange(candidate, e.target.value)}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white border-0 cursor-pointer focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors ${laneBg[candidate.kanbanLane]}`}
                                            >
                                                {Object.entries(laneLabels).map(([key, label]) => (
                                                    <option key={key} value={key} className="bg-slate-800 text-white capitalize font-medium">{label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=0F172A&color=94A3B8`}
                                                    alt={candidate.name}
                                                    className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-700"
                                                />
                                                <div>
                                                    <div className="font-medium text-slate-200">{candidate.name}</div>
                                                    <div className="text-xs text-slate-500">{candidate.current_role}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                {getPlatformIcon(candidate.source_platform)}
                                                <span className="text-sm font-medium">{candidate.source_platform}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm text-slate-300 max-w-[200px] truncate" title={candidate.email}>
                                                    {candidate.email}
                                                </div>
                                                {candidate.profile_url && (
                                                    <a href={candidate.profile_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-[11px] uppercase tracking-wider font-semibold w-fit">
                                                        Ver Perfil
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 opacity-50" />
                                                <span>{new Date(candidate.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Stats Summary Panel */}
            {!loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(laneLabels).map(([lane, label]) => {
                        const count = candidates.filter(c => c.kanbanLane === lane).length;
                        return (
                            <div key={lane} className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                                <div className={`absolute top-0 left-0 w-1 h-full ${laneBg[lane].split(' ')[0]}`}></div>
                                <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>
                                <div className="text-2xl font-bold text-white tracking-tight">{count}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default GmailCandidates;

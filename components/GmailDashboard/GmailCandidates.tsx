import React, { useState, useEffect, useMemo } from 'react';
import { GmailCandidatesService, GlobalEmailCandidate } from '../../lib/gmailCandidatesService';
import { GmailService, GmailSequence } from '../../lib/gmailService';
import { Search, MailPlus, Filter, Github, Linkedin, Briefcase } from 'lucide-react';

const GmailCandidates: React.FC = () => {
    const [candidates, setCandidates] = useState<GlobalEmailCandidate[]>([]);
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
            const [candData, seqData] = await Promise.all([
                GmailCandidatesService.getGlobalEmailCandidates(),
                GmailService.getSequences()
            ]);
            setCandidates(candData);
            setSequences(seqData);
        } catch (error) {
            console.error('Error fetching data for candidates view:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredCandidates.map(c => c.candidate_id)));
        } else {
            setSelectedIds(new Set());
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
        } catch (error: any) {
            alert(`Error al añadir candidatos: ${error.message}`);
        } finally {
            setEnrolling(false);
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
            case 'github': return <Github className="w-4 h-4 text-slate-400" />;
            case 'linkedin': return <Linkedin className="w-4 h-4 text-blue-400" />;
            default: return <Briefcase className="w-4 h-4 text-emerald-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Candidatos Globales ({filteredCandidates.length})</h2>
                    <p className="text-slate-400 text-sm mt-1">Todos los candidatos que disponen de email en la plataforma.</p>
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

            <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
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

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs">
                            <tr>
                                <th className="p-4 w-12">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-800"
                                        checked={filteredCandidates.length > 0 && selectedIds.size === filteredCandidates.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-4 font-semibold">Candidato</th>
                                <th className="p-4 font-semibold">Plataforma</th>
                                <th className="p-4 font-semibold">Rol / Título</th>
                                <th className="p-4 font-semibold text-right">Añadido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        Cargando candidatos globales...
                                    </td>
                                </tr>
                            ) : filteredCandidates.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500 border border-slate-800 border-dashed m-4 rounded-xl block w-[calc(100%-2rem)]">
                                        <p>No se encontraron candidatos con email registrado.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCandidates.map(c => (
                                    <tr
                                        key={c.candidate_id}
                                        className={`hover:bg-slate-800/30 transition-colors ${selectedIds.has(c.candidate_id) ? 'bg-cyan-500/5' : ''}`}
                                    >
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-800"
                                                checked={selectedIds.has(c.candidate_id)}
                                                onChange={() => handleSelectOne(c.candidate_id)}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-200">{c.name}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{c.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 inline-flex">
                                                {getPlatformIcon(c.source_platform)}
                                                <span className="text-xs text-slate-300">{c.source_platform}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-400">
                                            {c.current_role || '-'}
                                        </td>
                                        <td className="p-4 text-right text-slate-500 text-xs">
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GmailCandidates;

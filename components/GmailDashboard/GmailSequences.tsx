import React, { useState, useEffect } from 'react';
import { GmailService, GmailSequence } from '../../lib/gmailService';
import { PlusCircle, Search, Play, Pause, Edit, Trash2 } from 'lucide-react';

const GmailSequences: React.FC = () => {
    const [sequences, setSequences] = useState<GmailSequence[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        GmailService.getSequences().then(s => {
            setSequences(s);
            setLoading(false);
        }).catch(console.error);
    }, []);

    const handleCreateNew = async () => {
        try {
            const name = prompt('Nombre de la nueva secuencia:');
            if (!name) return;
            const newSeq = await GmailService.createSequence(name);
            setSequences([newSeq, ...sequences]);
        } catch (error) {
            console.error(error);
            alert('Error al crear la secuencia');
        }
    };

    const filteredSequences = sequences.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <PlusCircle className="w-5 h-5" />
                    <span>Nueva Secuencia</span>
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando secuencias...</div>
                ) : filteredSequences.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <p>No tienes secuencias creadas todavía.</p>
                        <p className="mt-2 text-sm">Las secuencias te permiten automatizar envíos a múltiples candidatos.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-sm">
                                <th className="p-4 font-medium">Nombre de la Secuencia</th>
                                <th className="p-4 font-medium">Estado</th>
                                <th className="p-4 font-medium">Fecha Creación</th>
                                <th className="p-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSequences.map((seq) => (
                                <tr key={seq.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                    <td className="p-4">
                                        <span className="font-medium text-white">{seq.name}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${seq.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                seq.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                    'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                            {seq.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-400 text-sm">
                                        {new Date(seq.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                                                <Play className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default GmailSequences;

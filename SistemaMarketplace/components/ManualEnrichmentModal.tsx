import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EnrichedCandidateInCampaign } from '../types/campaigns';

interface ManualEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (candidate: Omit<EnrichedCandidateInCampaign, 'candidateId'>) => void;
}

export const ManualEnrichmentModal: React.FC<ManualEnrichmentModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    linkedInUrl: '',
    hourlyRate: 25,
    jobSuccessRate: 80,
    kanbanLane: 'todo' as const,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      alert('Nombre y email son requeridos');
      return;
    }

    onCreate({
      name: form.name,
      email: form.email,
      linkedInUrl: form.linkedInUrl || undefined,
      hourlyRate: form.hourlyRate,
      jobSuccessRate: form.jobSuccessRate,
      kanbanLane: form.kanbanLane,
      notes: form.notes,
      addedAt: new Date().toISOString(),
      platform: 'upwork', // Default
    });

    // Reset form
    setForm({
      name: '',
      email: '',
      linkedInUrl: '',
      hourlyRate: 25,
      jobSuccessRate: 80,
      kanbanLane: 'todo',
      notes: '',
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-700 shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Agregar Candidato Manual</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Juan Pérez"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@example.com"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* LinkedIn URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              LinkedIn URL (opcional)
            </label>
            <input
              type="url"
              value={form.linkedInUrl}
              onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
              placeholder="https://linkedin.com/in/juanperez"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Hourly Rate */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Tarifa por Hora: ${form.hourlyRate}/hr
            </label>
            <input
              type="range"
              min="5"
              max="200"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded cursor-pointer"
            />
          </div>

          {/* Job Success Rate */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Success Rate: {form.jobSuccessRate}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={form.jobSuccessRate}
              onChange={(e) => setForm({ ...form, jobSuccessRate: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded cursor-pointer"
            />
          </div>

          {/* Kanban Lane */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Estado Inicial
            </label>
            <select
              value={form.kanbanLane}
              onChange={(e) => setForm({ ...form, kanbanLane: e.target.value as any })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="todo">Por Contactar</option>
              <option value="contacted">Contactado</option>
              <option value="replied">Respondió</option>
              <option value="rejected">Rechazó</option>
              <option value="hired">Contratado</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Agregar notas sobre este candidato..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

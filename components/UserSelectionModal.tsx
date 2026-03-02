import React from 'react';
import { X, User } from 'lucide-react';
import { OutreachUser } from '../lib/messageGenerator';

interface UserSelectionModalProps {
  isOpen: boolean;
  onSelect: (user: OutreachUser) => void;
  onClose: () => void;
}

export const UserSelectionModal: React.FC<UserSelectionModalProps> = ({
  isOpen,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null;

  const users: Array<{ id: OutreachUser; name: string; title: string; color: string }> = [
    {
      id: 'mauro',
      name: 'Mauro',
      title: 'Fundador de Symmetry',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'nyo',
      name: 'Nyo',
      title: 'Trabajador de Symmetry',
      color: 'from-purple-500 to-purple-600'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-lg shadow-2xl max-w-md w-full animate-in fade-in scale-95 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white">Selecciona usuario</h2>
              <p className="text-sm text-slate-400 mt-1">¿Con qué cuenta enviarás los mensajes de LinkedIn?</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-3">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelect(user.id);
                  onClose();
                }}
                className="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 p-4 border border-slate-700 hover:border-cyan-500 transition-all hover:shadow-lg hover:shadow-cyan-500/20"
              >
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`bg-gradient-to-r ${user.color} p-3 rounded-lg`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">{user.name}</div>
                    <div className="text-sm text-slate-400">{user.title}</div>
                  </div>
                </div>
                
                {/* Hover indicator */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-cyan-500/10 transition-colors pointer-events-none" />
              </button>
            ))}
          </div>

          {/* Footer info */}
          <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-800 rounded-b-lg">
            <p className="text-xs text-slate-400">
              ✨ El mensaje de invitación se personalizará automáticamente con el nombre y especialidad de cada candidato.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserSelectionModal;

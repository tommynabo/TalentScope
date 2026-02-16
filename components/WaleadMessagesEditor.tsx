import React, { useState, useEffect } from 'react';
import { Candidate } from '../types/database';
import { X, Copy, RotateCcw, AlertCircle } from 'lucide-react';

interface WaleadMessagesEditorProps {
  isOpen: boolean;
  candidate: Candidate | null;
  onClose: () => void;
  onSave: (messages: { icebreaker?: string; followup_message?: string; second_followup?: string }) => void;
}

const MESSAGE_LIMITS = {
  icebreaker: { max: 200, label: '1️⃣ INVITACIÓN INICIAL' },
  followup_message: { max: 400, label: '2️⃣ POST-ACEPTACIÓN' },
  second_followup: { max: 500, label: '3️⃣ SEGUIMIENTO' }
};

export const WaleadMessagesEditor: React.FC<WaleadMessagesEditorProps> = ({
  isOpen,
  candidate,
  onClose,
  onSave
}) => {
  const [messages, setMessages] = useState({
    icebreaker: '',
    followup_message: '',
    second_followup: ''
  });
  const [charCounts, setCharCounts] = useState({
    icebreaker: 0,
    followup_message: 0,
    second_followup: 0
  });
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (candidate && isOpen) {
      // Get messages from candidate or from AI analysis
      let analysis: any = {};
      try {
        if (candidate.ai_analysis) {
          analysis = JSON.parse(candidate.ai_analysis);
        }
      } catch (e) {
        // Fallback if parsing fails
      }

      setMessages({
        icebreaker: candidate.walead_messages?.icebreaker || analysis.icebreaker || '',
        followup_message: candidate.walead_messages?.followup_message || analysis.followup_message || '',
        second_followup: candidate.walead_messages?.second_followup || analysis.second_followup || ''
      });

      setCharCounts({
        icebreaker: (candidate.walead_messages?.icebreaker || analysis.icebreaker || '').length,
        followup_message: (candidate.walead_messages?.followup_message || analysis.followup_message || '').length,
        second_followup: (candidate.walead_messages?.second_followup || analysis.second_followup || '').length
      });
    }
  }, [candidate, isOpen]);

  const handleMessageChange = (field: keyof typeof messages, value: string) => {
    setMessages(prev => ({ ...prev, [field]: value }));
    setCharCounts(prev => ({ ...prev, [field]: value.length }));
  };

  const resetToDefault = (field: keyof typeof messages) => {
    let analysis: any = {};
    try {
      if (candidate?.ai_analysis) {
        analysis = JSON.parse(candidate.ai_analysis);
      }
    } catch (e) {
      // Use empty analysis
    }

    const defaultMessage = analysis[field] || '';
    setMessages(prev => ({ ...prev, [field]: defaultMessage }));
    setCharCounts(prev => ({ ...prev, [field]: defaultMessage.length }));
  };

  const copyToClipboard = (field: keyof typeof messages) => {
    navigator.clipboard.writeText(messages[field]);
    setToastMsg(`✅ ${MESSAGE_LIMITS[field].label} copiado!`);
    setTimeout(() => setToastMsg(''), 2000);
  };

  const handleSave = () => {
    onSave(messages);
    onClose();
  };

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-700 w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-lg text-slate-100">Editar Mensajes Walead</h3>
            <p className="text-xs text-slate-400 mt-1">{candidate.full_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(Object.keys(MESSAGE_LIMITS) as Array<keyof typeof MESSAGE_LIMITS>).map((field) => {
            const limit = MESSAGE_LIMITS[field].max;
            const count = charCounts[field];
            const isOverLimit = count > limit;
            const percentage = (count / limit) * 100;

            return (
              <div key={field} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-300">
                    {MESSAGE_LIMITS[field].label}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : 'text-slate-400'}`}>
                      {count} / {limit}
                    </span>
                    {isOverLimit && <AlertCircle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>

                <textarea
                  value={messages[field]}
                  onChange={(e) => handleMessageChange(field, e.target.value)}
                  className={`w-full h-24 p-3 rounded-lg bg-slate-800 border text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 transition-all ${
                    isOverLimit
                      ? 'border-red-500/50 focus:ring-red-500/50'
                      : 'border-slate-700 focus:ring-blue-500/50'
                  }`}
                  placeholder={`Escribe el mensaje aquí...`}
                />

                {/* Character counter bar */}
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(field)}
                    className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar
                  </button>
                  <button
                    onClick={() => resetToDefault(field)}
                    className="flex-1 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Por defecto
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50 flex-shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2 rounded-lg text-sm">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

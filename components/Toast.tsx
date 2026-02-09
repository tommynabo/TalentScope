import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg shadow-2xl shadow-black/50">
        <AlertCircle className="h-5 w-5 text-cyan-400" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">Feature Locked</span>
          <span className="text-xs text-slate-400">{message}</span>
        </div>
        <button onClick={onClose} className="ml-4 text-slate-500 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
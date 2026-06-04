import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface InPageDialogModalProps {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function InPageDialogModal({
  isOpen,
  type,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: InPageDialogModalProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-sans select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left text-theme-text"
      >
        <div className="flex items-center gap-3 text-indigo-400 font-bold text-lg">
          {type === 'confirm' ? (
            <AlertTriangle className="text-amber-500 animate-pulse" size={20} />
          ) : (
            <AlertTriangle className="text-indigo-400" size={20} />
          )}
          <span>{title}</span>
        </div>
        
        <p className="text-sm text-theme-muted leading-relaxed select-text">
          {message}
        </p>
        
        <div className="flex justify-end gap-3 mt-2">
          {type === 'confirm' && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-theme-bg border border-theme-border hover:bg-white/5 transition-colors cursor-pointer text-theme-text"
            >
              {cancelText || 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition-colors cursor-pointer shadow-md uppercase tracking-wider ${
              type === 'confirm' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
            }`}
          >
            {confirmText || (type === 'confirm' ? 'Confirm' : 'OK')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

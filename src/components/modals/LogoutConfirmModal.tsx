import React from 'react';
import { motion } from 'motion/react';
import { LogOut } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({ isOpen, onClose, onConfirm }: LogoutConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left text-theme-text"
      >
        <div className="flex items-center gap-3 text-rose-500 font-bold text-lg">
          <LogOut size={20} />
          <span>Sign Out</span>
        </div>
        
        <p className="text-sm text-theme-muted leading-relaxed select-text">
          Are you sure you want to log out of Dicord? You will need to log back in to access your messages.
        </p>
        
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-theme-bg border border-theme-border hover:bg-white/5 transition-colors cursor-pointer text-theme-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-md shadow-rose-600/10 uppercase tracking-wider"
          >
            Log Out
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

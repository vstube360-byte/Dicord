import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { Palette, X, Camera } from 'lucide-react';
import { User } from '../../types';

interface WallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser?: (updates: Partial<User>) => void;
}

export function WallpaperModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
}: WallpaperModalProps) {
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string' && onUpdateUser) {
          onUpdateUser({ chatWallpaper: event.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-theme-text font-sans select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-theme-border">
            <h3 className="font-bold text-base text-theme-text flex items-center gap-2">
              <Palette size={16} className="text-indigo-400" />
              <span>Customize Chat Wallpaper</span>
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg glass flex items-center justify-center text-theme-muted hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Preset Solid Colors */}
          <div>
            <span className="block text-[8px] font-black text-theme-muted mb-2 ml-1 uppercase tracking-wider">Solid Colors</span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: '', name: 'Default' },
                { id: '#0b0f19', name: 'Midnight' },
                { id: '#1e293b', name: 'Slate' },
                { id: '#180828', name: 'Violet' },
                { id: '#022c22', name: 'Spruce' },
                { id: '#310411', name: 'Bordeaux' }
              ].map((wp) => {
                const isSelected = (currentUser.chatWallpaper || '') === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => {
                      onUpdateUser?.({ chatWallpaper: wp.id });
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-500/10 border-indigo-500 text-theme-text'
                        : 'bg-theme-bg/40 border-theme-border text-theme-muted hover:bg-theme-bg/60 hover:text-theme-text'
                    }`}
                  >
                    {wp.id ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: wp.id }} />
                        <span>{wp.name}</span>
                      </div>
                    ) : (
                      <span>Default</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Gradients */}
          <div>
            <span className="block text-[8px] font-black text-theme-muted mb-2 ml-1 uppercase tracking-wider">Gradient Backdrops</span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'gradient-aurora', name: 'Aurora Moss', style: 'linear-gradient(135deg, #0b3f2a 0%, #111827 100%)' },
                { id: 'gradient-sunset', name: 'Sunset Terracotta', style: 'linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)' },
                { id: 'gradient-neon', name: 'Purple Cyberpunk', style: 'linear-gradient(135deg, #1e1b4b 0%, #030712 100%)' },
                { id: 'gradient-cherry', name: 'Crimson Night', style: 'linear-gradient(135deg, #4c0519 0%, #0b0f19 100%)' },
                { id: 'gradient-ocean', name: 'Deep Ocean', style: 'linear-gradient(135deg, #042f2e 0%, #0b0f19 100%)' }
              ].map((wp) => {
                const isSelected = currentUser.chatWallpaper === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => {
                      onUpdateUser?.({ chatWallpaper: wp.id });
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-500/10 border-indigo-500 text-theme-text'
                        : 'bg-theme-bg/40 border-theme-border text-theme-muted hover:bg-theme-bg/60 hover:text-theme-text'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10" style={{ backgroundImage: wp.style }} />
                      <span>{wp.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Image Backdrop */}
          <div>
            <span className="block text-[8px] font-black text-theme-muted mb-2.5 ml-1 uppercase tracking-wider">Custom Image Backdrop</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => wallpaperInputRef.current?.click()}
                className="text-[9px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-650 dark:hover:text-indigo-300 font-bold uppercase tracking-widest glass px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-500/20"
              >
                <Camera size={12} />
                <span>Upload Wallpaper</span>
              </button>
              {currentUser.chatWallpaper && (currentUser.chatWallpaper.startsWith('http') || currentUser.chatWallpaper.startsWith('data:')) && (
                <>
                  <button
                    type="button"
                    onClick={() => onUpdateUser?.({ chatWallpaper: '' })}
                    className="text-[9px] text-rose-500 dark:text-rose-400 hover:text-rose-650 dark:hover:text-rose-300 font-bold uppercase tracking-widest glass px-3 py-2 rounded-xl transition-all cursor-pointer border border-rose-500/20"
                  >
                    Remove Image
                  </button>
                  <div className="w-10 h-10 rounded-lg border border-theme-border overflow-hidden bg-black/20 shrink-0 select-none">
                    <img src={currentUser.chatWallpaper} alt="Wallpaper Preview" className="w-full h-full object-cover" />
                  </div>
                </>
              )}
              <input
                type="file"
                ref={wallpaperInputRef}
                onChange={handleWallpaperChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <p className="text-[9px] text-theme-muted mt-2 ml-1 leading-relaxed">
              Upload an image from your device. Wallpapers are automatically dimmed depending on dark/light modes to preserve message contrast.
            </p>
          </div>

          {/* Save / Close Actions */}
          <div className="pt-2 border-t border-theme-border flex justify-end mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/10 uppercase tracking-wider"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

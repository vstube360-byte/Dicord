import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Link as LinkIcon, ShieldCheck, Award } from 'lucide-react';
import { User } from '../types';
import { Avatar } from './Avatar';

interface UserProfileProps {
  user: User;
  onClose: () => void;
}

const THEME_STYLES: Record<string, { border: string; glow: string; text: string; bg: string }> = {
  indigo: { border: 'border-indigo-500/30', glow: 'shadow-indigo-500/10', text: 'text-indigo-400', bg: 'from-indigo-600 to-purple-600' },
  emerald: { border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10', text: 'text-emerald-400', bg: 'from-emerald-600 to-teal-600' },
  rose: { border: 'border-rose-500/30', glow: 'shadow-rose-500/10', text: 'text-rose-400', bg: 'from-rose-600 to-pink-600' },
  amber: { border: 'border-amber-500/30', glow: 'shadow-amber-500/10', text: 'text-amber-400', bg: 'from-amber-500 to-orange-600' },
  violet: { border: 'border-violet-500/30', glow: 'shadow-violet-500/10', text: 'text-violet-400', bg: 'from-violet-600 to-fuchsia-600' },
};

const BADGE_COLORS: Record<string, string> = {
  'Early Adopter': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  'Coder': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Gamer': 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  'Musician': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'Design Guru': 'bg-violet-500/10 text-violet-300 border-violet-500/20',
};

export function UserProfile({ user, onClose }: UserProfileProps) {
  const theme = user.theme || 'indigo';
  const style = THEME_STYLES[theme] || THEME_STYLES.indigo;
  const joinDate = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) 
    : 'Unknown';

  const privacy = user.privacySettings || { showPronouns: true, showBio: true, showWebsite: true };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-bg/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`w-full max-w-sm bg-theme-panel border ${style.border} rounded-[28px] shadow-2xl relative overflow-hidden flex flex-col ${style.glow} shadow-xl`}
        >
          {/* Header Banner */}
          <div 
            className={`w-full h-32 relative shrink-0 overflow-hidden ${(!user.bannerImage && !user.bannerColor) ? `bg-gradient-to-r ${style.bg}` : ''}`}
            style={{ 
              backgroundColor: user.bannerColor || undefined,
              backgroundImage: user.bannerImage ? `url(${user.bannerImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Dark tint overlay on banner for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-theme-border text-theme-text hover:text-white transition-all flex items-center justify-center cursor-pointer z-10"
              title="Close Profile"
            >
              <X size={16} />
            </button>
          </div>

          {/* User Info Section */}
          <div className="px-6 pb-6 relative flex flex-col">
            {/* Avatar positioning overlap */}
            <div className="relative -mt-14 mb-4 flex items-end justify-between">
              <div className="relative">
                <Avatar 
                  user={user} 
                  className="w-24 h-24 text-2xl rounded-full border-4 border-theme-panel shadow-lg shadow-black/50" 
                />
                {!user.isGroup && (
                  <div 
                    className={`absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full border-2 border-theme-panel ${
                      user.status === 'online' ? 'bg-green-500' : 'bg-slate-500'
                    }`}
                    title={user.status === 'online' ? 'Online' : 'Offline'}
                  />
                )}
              </div>

              {/* Badges Area */}
              {user.badges && user.badges.length > 0 && (
                <div className="flex gap-1.5 flex-wrap max-w-[60%] justify-end">
                  {user.badges.map((badge) => (
                    <span 
                      key={badge} 
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-theme-border flex items-center gap-1 bg-white/5 text-theme-text shrink-0"
                    >
                      <Award size={10} className="shrink-0 text-indigo-400" />
                      <span>{badge}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Names & Custom Status */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-theme-text tracking-tight">
                  {user.displayName || user.username}
                </h3>
                {privacy.showPronouns && user.pronouns && (
                  <span className="text-[10px] font-bold text-theme-muted bg-white/5 px-2 py-0.5 rounded-md border border-theme-border uppercase tracking-wider">
                    {user.pronouns}
                  </span>
                )}
              </div>
              <span className="text-xs text-theme-muted font-semibold mt-0.5">
                @{user.username}
              </span>

              {user.customStatus && (
                <div className="mt-3 p-2.5 rounded-xl bg-white/[0.02] border border-theme-border text-xs text-theme-text font-medium italic break-words">
                  💭 {user.customStatus}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-theme-border w-full my-4" />

            {/* Custom details */}
            <div className="space-y-4 text-left">
              {/* Bio block */}
              {privacy.showBio && user.bio && (
                <div>
                  <h4 className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-1.5">
                    About Me
                  </h4>
                  <p className="text-xs text-theme-text leading-relaxed break-words whitespace-pre-wrap select-text">
                    {user.bio}
                  </p>
                </div>
              )}

              {/* Website block */}
              {privacy.showWebsite && user.website && (
                <div>
                  <h4 className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-1.5">
                    Link
                  </h4>
                  <a 
                    href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1.5 break-all cursor-pointer font-semibold"
                  >
                    <LinkIcon size={12} className="shrink-0" />
                    <span>{user.website}</span>
                  </a>
                </div>
              )}

              {/* Account Details block */}
              <div className="flex justify-between text-[11px] text-theme-muted font-medium border-t border-theme-border pt-3.5 mt-2.5">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="opacity-70" />
                  <span>Joined {joinDate}</span>
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={12} className="opacity-70" />
                  <span>Dicord User</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

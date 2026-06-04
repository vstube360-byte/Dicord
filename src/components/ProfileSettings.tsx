import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Palette, User as UserIcon, Shield, AlertTriangle, Link as LinkIcon, Award, Eye, EyeOff, Calendar, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { Avatar } from './Avatar';

interface ProfileSettingsProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onClose: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  onDeleteAccount?: () => void | Promise<void>;
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

const PRESET_BANNER_COLORS = [
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#DB2777', // Rose
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#2563EB', // Blue
  '#DC2626', // Red
  '#1F2937', // Dark Gray
];

const PRESET_THEMES = [
  { id: 'indigo', name: 'Indigo Aura', color: 'bg-indigo-500' },
  { id: 'emerald', name: 'Emerald Forest', color: 'bg-emerald-500' },
  { id: 'rose', name: 'Rose Petal', color: 'bg-rose-500' },
  { id: 'amber', name: 'Amber Glow', color: 'bg-amber-500' },
  { id: 'violet', name: 'Violet Velvet', color: 'bg-violet-500' },
];

export function ProfileSettings({ user, onUpdate, onClose, theme: appTheme, onThemeChange, onDeleteAccount }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'visuals' | 'privacy' | 'delete'>('profile');
  
  // Profile inputs
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [pronouns, setPronouns] = useState(user.pronouns || '');
  const [website, setWebsite] = useState(user.website || '');
  const [customStatus, setCustomStatus] = useState(user.customStatus || '');

  // Visual inputs
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [bannerColor, setBannerColor] = useState(user.bannerColor || '#4F46E5');
  const [bannerImage, setBannerImage] = useState(user.bannerImage || '');
  const [theme, setTheme] = useState(user.theme || 'indigo');
  const [customTag, setCustomTag] = useState(user.badges?.[0] || '');

  // Privacy inputs
  const [privacy, setPrivacy] = useState(
    user.privacySettings || { showPronouns: true, showBio: true, showWebsite: true }
  );

  // DangerZone inputs
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Handle Avatar base64 change
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setAvatar(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Banner Image base64 change
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setBannerImage(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = () => {
    onUpdate({
      displayName: displayName.trim() || user.username,
      avatar,
      bio: bio.trim(),
      pronouns: pronouns.trim(),
      website: website.trim(),
      customStatus: customStatus.trim(),
      bannerColor,
      bannerImage,
      theme,
      badges: customTag.trim() ? [customTag.trim()] : [],
      privacySettings: privacy,
    });
    onClose();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user.username) return;
    setDeleting(true);
    try {
      if (onDeleteAccount) {
        await onDeleteAccount();
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    } finally {
      setDeleting(false);
    }
  };

  const joinDate = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) 
    : 'Unknown';

  const previewStyle = THEME_STYLES[theme] || THEME_STYLES.indigo;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-bg/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-3xl bg-theme-panel border border-theme-border rounded-[28px] shadow-2xl relative flex flex-col h-[600px] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between shrink-0">
            <h2 className="text-xl font-bold text-theme-text tracking-tight flex items-center gap-2">
              <UserIcon className="text-indigo-450 dark:text-indigo-400" size={20} />
              <span>Customize Profile</span>
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-theme-bg/5 hover:bg-theme-bg/10 text-theme-muted hover:text-theme-text transition-all flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body split: Sidebar tabs, Tab content, and Live preview */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left side settings */}
            <div className="flex flex-1 min-h-0 overflow-hidden border-r border-theme-border">
              {/* Tabs Sidebar */}
              <div className="w-40 border-r border-theme-border p-4 flex flex-col gap-1.5 shrink-0 bg-black/5 dark:bg-black/15">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-bg/10 border border-transparent'
                }`}
              >
                <UserIcon size={14} />
                <span>Identity</span>
              </button>
              <button
                onClick={() => setActiveTab('visuals')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'visuals'
                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-bg/10 border border-transparent'
                }`}
              >
                <Palette size={14} />
                <span>Styling</span>
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-bg/10 border border-transparent'
                }`}
              >
                <Shield size={14} />
                <span>Privacy</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('delete');
                  setDeleteConfirmText('');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'delete'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                    : 'text-rose-550/70 hover:text-rose-500 hover:bg-rose-500/5 border border-transparent'
                }`}
              >
                <AlertTriangle size={14} />
                <span>Delete</span>
              </button>
            </div>

            {/* Tab content panel */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-left">
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-theme-muted mb-2">Personal Info</h3>
                  
                  {/* Display Name */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name"
                      className="w-full bg-theme-bg/40 border border-theme-border rounded-xl px-4 py-2.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Pronouns */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      Pronouns
                    </label>
                    <input
                      type="text"
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      placeholder="e.g. they/them, he/him"
                      className="w-full bg-theme-bg/40 border border-theme-border rounded-xl px-4 py-2.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Custom Status Quote */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      Custom Status Quote
                    </label>
                    <input
                      type="text"
                      value={customStatus}
                      onChange={(e) => setCustomStatus(e.target.value)}
                      placeholder="💭 What's on your mind?"
                      className="w-full bg-theme-bg/40 border border-theme-border rounded-xl px-4 py-2.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Write a short description of yourself..."
                      rows={3}
                      className="w-full bg-theme-bg/40 border border-theme-border rounded-xl px-4 py-2.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Website link */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      Website URL
                    </label>
                    <div className="relative">
                      <LinkIcon size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" />
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="example.com"
                        className="w-full bg-theme-bg/40 border border-theme-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'visuals' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-theme-muted mb-2">Visual Theme Customization</h3>

                  {/* Application Theme Selector */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-2 ml-1">
                      Application Theme (App Mode)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'dark', name: 'Dark Mode', color: 'bg-slate-800 border border-slate-700' },
                        { id: 'light', name: 'Light Mode', color: 'bg-slate-200 border border-slate-350' },
                        { id: 'midnight', name: 'Midnight', color: 'bg-slate-950 border border-indigo-955' },
                        { id: 'slate', name: 'Slate', color: 'bg-slate-600 border border-slate-500' },
                        { id: 'violet', name: 'Violet', color: 'bg-violet-900 border border-violet-850' },
                        { id: 'spruce', name: 'Spruce', color: 'bg-emerald-950 border border-emerald-800' },
                        { id: 'bordeaux', name: 'Bordeaux', color: 'bg-rose-950 border border-rose-900' },
                        { id: 'auroramoss', name: 'Aurora Moss', color: 'bg-teal-950 border border-teal-800' },
                        { id: 'forest', name: 'Forest Moss', color: 'bg-emerald-800 border border-emerald-700' },
                        { id: 'sunset', name: 'Sunset Terracotta', color: 'bg-amber-700 border border-amber-600' },
                        { id: 'cyberpunk', name: 'Purple Cyberpunk', color: 'bg-purple-950 border border-pink-500/30' },
                        { id: 'crimsonnight', name: 'Crimson Night', color: 'bg-red-950 border border-red-800' },
                        { id: 'deepocean', name: 'Deep Ocean', color: 'bg-blue-950 border border-blue-800' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onThemeChange(t.id)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            appTheme === t.id
                              ? 'bg-indigo-500/10 border-indigo-500 text-theme-text shadow-sm'
                              : 'bg-theme-bg/40 border-theme-border text-theme-muted hover:bg-theme-bg/60 hover:text-theme-text'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full ${t.color} shrink-0`} />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-theme-border w-full" />

                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-3 ml-1">
                      Profile Picture
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                        <Avatar user={{ ...user, avatar }} className="w-16 h-16 text-xl rounded-full border border-white/15" />
                        <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <Camera size={18} className="text-white" />
                        </div>
                        <input
                          type="file"
                          ref={avatarInputRef}
                          onChange={handleAvatarChange}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest glass px-3 py-1.5 rounded-full transition-all cursor-pointer border border-indigo-500/20"
                        >
                          Change Photo
                        </button>
                        {avatar && (
                          <button
                            onClick={() => setAvatar('')}
                            className="text-[9px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-widest glass px-3 py-1.5 rounded-full transition-all cursor-pointer border border-rose-500/20"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-theme-border w-full" />

                  {/* Profile Theme Select */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-2 ml-1">
                      Profile Theme Accent
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            theme === t.id
                              ? 'bg-indigo-500/10 border-indigo-500 text-theme-text font-bold'
                              : 'bg-theme-bg/40 border-theme-border text-theme-muted hover:bg-theme-bg/60 hover:text-theme-text'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full ${t.color}`} />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-theme-border w-full" />

                  {/* Banner Image / Colors */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-2 ml-1">
                      Profile Banner Color / Presets
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {PRESET_BANNER_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setBannerColor(color);
                            setBannerImage(''); // Clear custom photo to fallback to color
                          }}
                          className={`w-6 h-6 rounded-full border transition-all cursor-pointer hover:scale-110 ${
                            bannerColor === color && !bannerImage ? 'border-theme-text scale-105 shadow-md shadow-white/10' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-2 ml-1">
                      Custom Banner Photo
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => bannerInputRef.current?.click()}
                        className="text-[9px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-650 dark:hover:text-indigo-300 font-bold uppercase tracking-widest glass px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-500/20"
                      >
                        <Camera size={12} />
                        <span>Upload Banner Image</span>
                      </button>
                      {bannerImage && (
                        <button
                          onClick={() => setBannerImage('')}
                          className="text-[9px] text-rose-500 dark:text-rose-400 hover:text-rose-650 dark:hover:text-rose-300 font-bold uppercase tracking-widest glass px-3 py-2 rounded-xl transition-all cursor-pointer border border-rose-500/20"
                        >
                          Clear
                        </button>
                      )}
                      <input
                        type="file"
                        ref={bannerInputRef}
                        onChange={handleBannerChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-theme-border w-full" />

                  {/* Custom Profile Tag */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      Custom Profile Tag
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value.slice(0, 20))}
                        placeholder="e.g. Gamer, Developer, Artist"
                        className="w-full bg-theme-bg/40 border border-theme-border rounded-xl px-4 py-2.5 text-xs text-theme-text focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-theme-muted">
                        {customTag.length}/20
                      </span>
                    </div>
                    <p className="text-[10px] text-theme-muted mt-1.5 ml-1 leading-normal">
                      Specify a custom tag/badge to display on your profile (only one tag allowed).
                    </p>
                  </div>


                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-theme-muted mb-2">Privacy & Visibility</h3>
                  <p className="text-xs text-theme-muted leading-relaxed mb-4">
                    Control which fields are visible to other users who look at your profile card.
                  </p>

                  {/* Toggle Pronouns */}
                  <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-theme-border rounded-2xl">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-theme-text">Show Pronouns</span>
                      <span className="text-[10px] text-theme-muted mt-0.5">Allow other users to see your pronouns.</span>
                    </div>
                    <button
                      onClick={() => setPrivacy((prev) => ({ ...prev, showPronouns: !prev.showPronouns }))}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        privacy.showPronouns ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-theme-muted'
                      }`}
                    >
                      {privacy.showPronouns ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>

                  {/* Toggle Bio */}
                  <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-theme-border rounded-2xl">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-theme-text">Show Bio</span>
                      <span className="text-[10px] text-theme-muted mt-0.5">Make your About Me profile section public.</span>
                    </div>
                    <button
                      onClick={() => setPrivacy((prev) => ({ ...prev, showBio: !prev.showBio }))}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        privacy.showBio ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-theme-muted'
                      }`}
                    >
                      {privacy.showBio ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>

                  {/* Toggle Website */}
                  <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-theme-border rounded-2xl">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-theme-text">Show Website link</span>
                      <span className="text-[10px] text-theme-muted mt-0.5">Display your website hyperlink on your card.</span>
                    </div>
                    <button
                      onClick={() => setPrivacy((prev) => ({ ...prev, showWebsite: !prev.showWebsite }))}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        privacy.showWebsite ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-theme-muted'
                      }`}
                    >
                      {privacy.showWebsite ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'delete' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5 mb-2 select-none">
                    <AlertTriangle size={16} />
                    <span>Delete Account</span>
                  </h3>
                  
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-xs text-rose-300 leading-relaxed select-none">
                    <p className="font-bold mb-1">⚠️ Crucial Warning: Irreversible Action</p>
                    <p>Deleting your account will permanently purge your user profile, messages, group chat memberships, media uploads, and all personal settings from our servers. You will be logged out instantly and this account cannot be recovered.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                      To confirm, type your username: <span className="text-white font-extrabold select-all">@{user.username}</span>
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={user.username}
                      className="w-full bg-theme-bg/40 border border-rose-500/20 focus:border-rose-500 rounded-xl px-4 py-2.5 text-xs text-theme-text focus:outline-none transition-colors font-semibold"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={deleteConfirmText !== user.username || deleting}
                    onClick={handleDeleteAccount}
                    className="w-full mt-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-600/15 uppercase tracking-wider"
                  >
                    {deleting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Permanently Delete Account'
                    )}
                  </button>
                </div>
              )}


            </div>
          </div>

          {/* Right side live preview panel */}
          <div className="hidden md:flex w-[340px] shrink-0 bg-black/5 dark:bg-black/20 p-6 flex-col items-center justify-center overflow-y-auto custom-scrollbar">
            <div className="w-full flex flex-col gap-3">
              <div className="text-[10px] font-black text-theme-muted uppercase tracking-widest self-start">
                Profile Preview (Other's Perspective)
              </div>
              
              {/* Profile Card */}
              <div className={`w-full bg-theme-panel border ${previewStyle.border} rounded-2xl shadow-xl overflow-hidden flex flex-col ${previewStyle.glow}`}>
                {/* Header Banner */}
                <div 
                  className={`w-full h-24 relative shrink-0 overflow-hidden ${(!bannerImage && !bannerColor) ? `bg-gradient-to-r ${previewStyle.bg}` : ''}`}
                  style={{ 
                    backgroundColor: bannerColor || undefined,
                    backgroundImage: bannerImage ? `url(${bannerImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                {/* User Info */}
                <div className="px-4 pb-4 relative flex flex-col text-left">
                  {/* Avatar overlap */}
                  <div className="relative -mt-10 mb-2 flex items-end justify-between">
                    <div className="relative">
                      <Avatar 
                        user={{ ...user, avatar }} 
                        className="w-16 h-16 text-xl rounded-full border-4 border-theme-panel shadow-md shadow-black/50" 
                      />
                      <div 
                        className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-theme-panel ${
                          user.status === 'online' ? 'bg-green-500' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    {/* Custom Tag Badge */}
                    {customTag.trim() && (
                      <div className="flex justify-end">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 bg-white/5 text-theme-text border-theme-border shrink-0">
                          <Award size={8} className="shrink-0 text-indigo-455 dark:text-indigo-400" />
                          <span>{customTag.trim()}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Names & Custom Status */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-base font-bold text-theme-text tracking-tight truncate max-w-[150px]">
                        {displayName || user.username}
                      </h3>
                      {privacy.showPronouns && pronouns && (
                        <span className="text-[8px] font-bold text-theme-muted bg-white/5 px-1.5 py-0.5 rounded border border-theme-border uppercase tracking-wider">
                          {pronouns}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-theme-muted font-semibold mt-0.5">
                      @{user.username}
                    </span>

                    {customStatus && (
                      <div className="mt-2.5 p-2 rounded-lg bg-white/[0.02] border border-theme-border text-[10px] text-theme-text font-medium italic break-words">
                        💭 {customStatus}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-theme-border w-full my-3" />

                  {/* Custom details */}
                  <div className="space-y-3">
                    {/* Bio */}
                    {privacy.showBio && bio && (
                      <div>
                        <h4 className="text-[9px] font-black text-theme-muted uppercase tracking-widest mb-1">
                          About Me
                        </h4>
                        <p className="text-[11px] text-theme-text leading-normal break-words whitespace-pre-wrap select-text">
                          {bio}
                        </p>
                      </div>
                    )}

                    {/* Website */}
                    {privacy.showWebsite && website && (
                      <div>
                        <h4 className="text-[9px] font-black text-theme-muted uppercase tracking-widest mb-1">
                          Link
                        </h4>
                        <a 
                          href={website.startsWith('http') ? website : `https://${website}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-650 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 break-all cursor-pointer font-semibold"
                        >
                          <LinkIcon size={10} className="shrink-0" />
                          <span>{website}</span>
                        </a>
                      </div>
                    )}

                    {/* Footer Details */}
                    <div className="flex justify-between text-[9px] text-theme-muted font-medium border-t border-theme-border pt-2.5 mt-1.5">
                      <span className="flex items-center gap-0.5">
                        <Calendar size={10} className="opacity-70" />
                        <span>Joined {joinDate}</span>
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ShieldCheck size={10} className="opacity-70" />
                        <span>Dicord User</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Footer bar */}
          <div className="px-6 py-4 border-t border-theme-border flex justify-end gap-3 shrink-0 bg-black/5 dark:bg-black/10">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-bg/10 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="px-4 py-2 rounded-xl gradient-msg text-white text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md shadow-indigo-600/10 uppercase tracking-wider"
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

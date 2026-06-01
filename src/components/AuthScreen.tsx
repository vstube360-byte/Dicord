import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (
    username: string,
    password: string,
    displayName: string | undefined,
    isRegister: boolean
  ) => Promise<void>;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [status, setStatus] = useState('Use your username as your Dicord identity.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      return;
    }

    setIsSubmitting(true);
    setStatus(isRegister ? 'Creating your account...' : 'Signing you in...');
    try {
      await onLogin(username, password, isRegister ? displayName : undefined, isRegister);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to continue.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-theme-bg relative text-theme-text">
      <div className="min-h-full w-full flex flex-col items-center justify-center py-8">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md glass rounded-[32px] p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-10"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-msg flex items-center justify-center text-white">
              <MessageSquare size={32} />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
              Dicord
            </h1>
            <p className="text-theme-muted text-sm">
              Private, fluid, and real-time messaging.
            </p>
          </div>

          <div className="bg-black/5 dark:bg-black/20 p-1 rounded-xl flex mb-6 border border-theme-border">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isRegister ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold shadow-md' : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isRegister ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold shadow-md' : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-theme-bg/50 border border-theme-border rounded-xl px-4 py-3.5 text-theme-text focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. johndoe"
                className="w-full bg-theme-bg/50 border border-theme-border rounded-xl px-4 py-3.5 text-theme-text focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1.5 ml-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-theme-bg/50 border border-theme-border rounded-xl px-4 py-3.5 text-theme-text focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                required
              />
            </div>

            <motion.button
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full gradient-msg text-white rounded-xl px-4 py-4 font-bold transition-transform mt-8 shadow-lg tracking-wide uppercase text-sm disabled:opacity-60"
            >
              {isSubmitting ? 'Please wait' : isRegister ? 'Create account' : 'Enter chat'}
            </motion.button>
            <p className="text-center text-xs text-theme-muted min-h-4">{status}</p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

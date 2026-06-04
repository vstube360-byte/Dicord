import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { GroupSettingsModal } from './components/modals/GroupSettingsModal';
import { InPageDialogModal } from './components/modals/InPageDialogModal';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ProfileSettings } from './components/ProfileSettings';
import { UserProfile } from './components/UserProfile';
import { Avatar } from './components/Avatar';
import { ChatSession, Message, User } from './types';
import {
  deleteAccount,
  deleteMessage,
  fetchChats,
  fetchConversation,
  fetchMe,
  login,
  register,
  resolveGif,
  sendMessage,
  sendReaction,
  toClientMessage,
  toClientUser,
  toggleBlock,
  toggleMute,
  updateProfile,
  togglePin,
  editMessage,
  createGroup,
  updateGroupMetadata,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  sendTypingStatus,
  sendReadReceipt,
} from './lib/api';

const TOKEN_KEY = 'dicord-token';

function playPingSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First note: G5 (783.99 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime);
    gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.12);
    
    // Second note: B5 (987.77 Hz) slightly delayed
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, audioCtx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.08);
    osc2.stop(audioCtx.currentTime + 0.22);
  } catch (e) {
    console.error('Failed to play ping sound:', e);
  }
}

interface SavedAccount {
  username: string;
  displayName: string;
  avatar: string;
  token: string;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('dicord-theme') || 'dark');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState<User | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => {
    try {
      const raw = localStorage.getItem('dicord-saved-accounts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [inPageDialog, setInPageDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
  });

  const showAlert = useCallback((title: string, message: string) => {
    setInPageDialog({
      isOpen: true,
      type: 'alert',
      title,
      message,
      confirmText: 'OK',
      onConfirm: () => setInPageDialog(prev => ({ ...prev, isOpen: false }))
    });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void | Promise<void>, onCancel?: () => void) => {
    setInPageDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setInPageDialog(prev => ({ ...prev, isOpen: false }));
        await onConfirm();
      },
      onCancel: () => {
        setInPageDialog(prev => ({ ...prev, isOpen: false }));
        if (onCancel) onCancel();
      }
    });
  }, []);



  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(
      'theme-light', 'theme-dark', 'theme-forest', 'theme-sunset', 'theme-cyberpunk',
      'theme-midnight', 'theme-slate', 'theme-violet', 'theme-spruce', 'theme-bordeaux',
      'theme-auroramoss', 'theme-crimsonnight', 'theme-deepocean'
    );
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('dicord-theme', theme);

    // Update favicon dynamically
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/x-icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = theme === 'light' ? '/logo_lightmode.ico' : '/logo_darkmode.ico';
    link.sizes = 'any';
  }, [theme]);

  useEffect(() => {
    if (currentUser && currentUser.appTheme) {
      setTheme(currentUser.appTheme);
    }
  }, [currentUser]);

  const handleThemeChange = useCallback(async (nextTheme: string) => {
    setTheme(nextTheme);
    if (token && currentUser) {
      try {
        const updatedUser = await updateProfile(token, { appTheme: nextTheme });
        setCurrentUser(updatedUser);
      } catch (err) {
        console.error('Failed to sync theme to profile:', err);
      }
    }
  }, [token, currentUser]);

  const upsertChat = useCallback((peer: User, message?: Message) => {
    setChats((prev) => {
      const index = prev.findIndex((chat) => chat.peer.username === peer.username);
      const existing = index >= 0 ? prev[index] : null;
      
      let messages = existing?.messages || [];
      if (message) {
        if (message.authorId !== currentUser.username) {
          messages = messages.map(m => m.authorId === currentUser.username ? { ...m, seen: true } : m);
        }
        const existsIndex = messages.findIndex((entry) => entry.id === message.id);
        if (existsIndex >= 0) {
          messages = messages.map((entry) => entry.id === message.id ? message : entry);
        } else {
          const pendingIndex = messages.findIndex((entry) => entry.pending && entry.authorId === message.authorId);
          if (pendingIndex >= 0) {
            messages = [...messages];
            messages[pendingIndex] = message;
          } else {
            messages = [...messages, message];
          }
        }
      }

      const nextChat: ChatSession = {
        id: peer.username,
        peer,
        messages,
        unreadCount: existing?.unreadCount || 0,
        isTyping: message && message.authorId !== currentUser.username ? false : existing?.isTyping,
      };
      const next = index >= 0 ? [...prev.slice(0, index), ...prev.slice(index + 1)] : prev;
      return [nextChat, ...next];
    });
  }, [currentUser]);

  const loadChats = useCallback(async (nextToken: string) => {
    const nextChats = await fetchChats(nextToken);
    setChats((prev) => {
      return nextChats.map((newChat) => {
        const existing = prev.find((c) => c.id === newChat.id);
        if (existing) {
          return {
            ...newChat,
            messages: existing.messages,
          };
        }
        return newChat;
      });
    });
  }, []);

  const handleAuthenticate = useCallback(
    async (username: string, password: string, displayName: string | undefined, isRegister: boolean) => {
      const result = isRegister
        ? await register(username, password, displayName || username)
        : await login(username, password);
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setCurrentUser(result.user);
      
      setSavedAccounts((prev) => {
        const newAccount: SavedAccount = {
          username: result.user.username,
          displayName: result.user.displayName,
          avatar: result.user.avatar || '',
          token: result.token
        };
        const filtered = prev.filter((acc) => acc.username !== result.user.username);
        const next = [...filtered, newAccount];
        localStorage.setItem('dicord-saved-accounts', JSON.stringify(next));
        return next;
      });

      setIsAddingAccount(false);
      await loadChats(result.token);
    },
    [loadChats]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    fetchMe(token)
      .then(async (user) => {
        setCurrentUser(user);
        await loadChats(token);

        // Auto-add/update current active user to the saved accounts list
        setSavedAccounts((prev) => {
          if (prev.some((acc) => acc.username === user.username && acc.token === token)) {
            return prev;
          }
          const newAccount: SavedAccount = {
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar || '',
            token: token
          };
          const filtered = prev.filter((acc) => acc.username !== user.username);
          const next = [...filtered, newAccount];
          localStorage.setItem('dicord-saved-accounts', JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken('');
        setCurrentUser(null);
        setSavedAccounts((prev) => {
          const next = prev.filter((acc) => acc.token !== token);
          localStorage.setItem('dicord-saved-accounts', JSON.stringify(next));
          return next;
        });
      });
  }, [token, loadChats]);

  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  const activeChatIdRef = React.useRef(activeChatId);
  const activeConversationIdRef = React.useRef(activeConversationId);
  const showGroupSettingsRef = React.useRef(showGroupSettings);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    showGroupSettingsRef.current = showGroupSettings;
  }, [showGroupSettings]);

  useEffect(() => {
    const handleFocus = async () => {
      if (!token || !activeChatId) return;
      if (document.hasFocus() && document.visibilityState === 'visible') {
        try {
          await sendReadReceipt(token, activeChatId);
        } catch (err) {
          console.error('Failed to send read receipt on focus:', err);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    handleFocus();

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [token, activeChatId]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    const source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === 'read' && data.conversationId && data.username) {
        setChats((prev) =>
          prev.map((chat) => {
            const expectedId = chat.peer.isGroup ? chat.peer.username : [currentUser.username, chat.peer.username].sort().join("__");
            if (expectedId === data.conversationId) {
              if (data.username !== currentUser.username) {
                return {
                  ...chat,
                  messages: chat.messages.map(m => m.authorId === currentUser.username ? { ...m, seen: true } : m)
                };
              }
            }
            return chat;
          })
        );
        return;
      }

      if (data.event === 'typing' && data.conversationId && data.username) {
        setChats((prev) =>
          prev.map((chat) => {
            const expectedId = chat.peer.isGroup ? chat.peer.username : [currentUser.username, chat.peer.username].sort().join("__");
            if (expectedId === data.conversationId) {
              if (data.username !== currentUser.username) {
                let typingVal: boolean | string = false;
                if (data.isTyping) {
                  if (chat.peer.isGroup) {
                    const userChat = prev.find((c) => !c.peer.isGroup && c.peer.username === data.username);
                    typingVal = userChat?.peer.displayName || data.username;
                  } else {
                    typingVal = chat.peer.displayName;
                  }
                }
                return {
                  ...chat,
                  isTyping: typingVal,
                  messages: data.isTyping
                    ? chat.messages.map(m => m.authorId === currentUser.username ? { ...m, seen: true } : m)
                    : chat.messages
                };
              }
            }
            return chat;
          })
        );
        return;
      }

      if (data.event === 'presence' && data.username) {
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.peer.username === data.username) {
              return {
                ...chat,
                peer: {
                  ...chat.peer,
                  status: data.status,
                  lastActive: data.lastActive,
                },
              };
            }
            return chat;
          })
        );
        setSelectedProfileUser((prev) => {
          if (prev && prev.username === data.username) {
            return {
              ...prev,
              status: data.status,
              lastActive: data.lastActive,
            };
          }
          return prev;
        });
        return;
      }

      if (data.event === 'delete-message' && data.messageId && data.conversationId) {
        setChats((prev) =>
          prev.map((chat) => {
            const expectedId = chat.peer.isGroup ? chat.peer.username : [currentUser.username, chat.peer.username].sort().join("__");
            if (expectedId === data.conversationId) {
              return {
                ...chat,
                messages: chat.messages.filter((m) => m.id !== data.messageId),
              };
            }
            return chat;
          })
        );
        return;
      }

      if (data.event === 'edit-message' && data.message && data.conversationId) {
        const message = toClientMessage(data.message);
        setChats((prev) =>
          prev.map((chat) => {
            const expectedId = chat.peer.isGroup ? chat.peer.username : [currentUser.username, chat.peer.username].sort().join("__");
            if (expectedId === data.conversationId) {
              return {
                ...chat,
                messages: chat.messages.map((m) => (m.id === message.id ? message : m)),
              };
            }
            return chat;
          })
        );
        return;
      }

      if (data.event === 'reaction' && data.message && data.conversationId) {
        const message = toClientMessage(data.message);
        setChats((prev) =>
          prev.map((chat) => {
            const expectedId = chat.peer.isGroup ? chat.peer.username : [currentUser.username, chat.peer.username].sort().join("__");
            if (expectedId === data.conversationId) {
              return {
                ...chat,
                messages: chat.messages.map((m) => (m.id === message.id ? message : m)),
              };
            }
            return chat;
          })
        );
        return;
      }

      if (data.event === 'pin-toggle' && data.message && data.conversationId) {
        const message = toClientMessage(data.message);
        setChats((prev) =>
          prev.map((chat) => {
            const expectedId = chat.peer.isGroup ? chat.peer.username : [currentUser.username, chat.peer.username].sort().join("__");
            if (expectedId === data.conversationId) {
              return {
                ...chat,
                messages: chat.messages.map((m) => (m.id === message.id ? message : m)),
              };
            }
            return chat;
          })
        );
        return;
      }

      if (data.event === 'delete-group' && data.conversationId) {
        setChats((prev) => prev.filter((chat) => chat.id !== data.conversationId));
        if (activeChatIdRef.current === data.conversationId) {
          setActiveChatId(null);
          setActiveConversationId('');
        }
        if (showGroupSettingsRef.current && showGroupSettingsRef.current.username === data.conversationId) {
          setShowGroupSettings(null);
        }
        return;
      }

      if (data.event !== 'message' || !data.message || !data.peer) {
        return;
      }

      const message = toClientMessage(data.message);
      const peer = toClientUser(data.peer);

      // Send read receipt if we are actively viewing this conversation and tab is focused
      if (data.conversationId === activeConversationIdRef.current && document.hasFocus() && document.visibilityState === 'visible') {
        if (message.authorId !== currentUser.username) {
          try {
            sendReadReceipt(token, peer.username);
          } catch (err) {
            console.error('Failed to send read receipt for incoming message:', err);
          }
        }
      }

      upsertChat(peer, message);

      // Play chime if mentioned by another user
      if (
        message.text &&
        currentUser &&
        new RegExp(`@${currentUser.username}\\b`, 'i').test(message.text) &&
        message.authorId !== currentUser.username &&
        !currentUser.mutedUsers?.includes(message.authorId) &&
        !currentUser.blockedUsers?.includes(message.authorId)
      ) {
        playPingSound();
      }

      if (
        message.authorId !== currentUser.username &&
        !currentUser.mutedUsers?.includes(message.authorId) &&
        !currentUser.blockedUsers?.includes(message.authorId) &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const isCurrentlyChatting = data.conversationId === activeConversationIdRef.current && document.hasFocus();
        if (!isCurrentlyChatting) {
          try {
            new Notification(peer.displayName, {
              body: message.text || (message.gifUrl ? '[GIF]' : 'Sent a message'),
              icon: peer.avatar || undefined,
            });
          } catch (e) {
            console.error('Failed to trigger notification:', e);
          }
        }
      }

      if (data.conversationId === activeConversationIdRef.current) {
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== activeChatIdRef.current) {
              return chat;
            }
            
            let messages = chat.messages;
            // If the incoming message is from the peer, they must have seen our messages.
            if (message.authorId !== currentUser.username) {
              messages = messages.map(m => m.authorId === currentUser.username ? { ...m, seen: true } : m);
            }
            const existsIndex = messages.findIndex((entry) => entry.id === message.id);
            if (existsIndex >= 0) {
              messages = messages.map((entry) => entry.id === message.id ? message : entry);
            } else {
              const pendingIndex = messages.findIndex((entry) => entry.pending && entry.authorId === message.authorId);
              if (pendingIndex >= 0) {
                messages = [...messages];
                messages[pendingIndex] = message;
              } else {
                messages = [...messages, message];
              }
            }

            return {
              ...chat,
              messages,
            };
          })
        );
      }
    };

    return () => source.close();
  }, [currentUser, token, upsertChat]);

  const handleUpdateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!currentUser || !token) {
        return;
      }
      const updated = await updateProfile(token, updates);
      setCurrentUser(updated);

      // Sync display name and avatar updates to the saved accounts list
      setSavedAccounts((prev) => {
        const next = prev.map((acc) => {
          if (acc.username === updated.username) {
            return {
              ...acc,
              displayName: updated.displayName || acc.displayName,
              avatar: updated.avatar || '',
            };
          }
          return acc;
        });
        localStorage.setItem('dicord-saved-accounts', JSON.stringify(next));
        return next;
      });
    },
    [currentUser, token]
  );

  const openChat = useCallback(
    async (peer: User) => {
      if (!token) {
        return;
      }
      const conversation = await fetchConversation(token, peer.username);
      setActiveChatId(peer.username);
      setActiveConversationId(conversation.conversationId);
      setSidebarOpen(false);

      // Notify peer that we've read their messages
      if (document.hasFocus() && document.visibilityState === 'visible') {
        try {
          await sendReadReceipt(token, peer.username);
        } catch (err) {
          console.error('Failed to send read receipt:', err);
        }
      }

      setChats((prev) => {
        const index = prev.findIndex((chat) => chat.peer.username === peer.username);
        const messages = conversation.messages.map(m => {
          if (m.authorId === currentUser?.username) {
            let seen = !!m.seen;
            if (!seen && conversation.readStates) {
              if (peer.isGroup) {
                const otherParticipants = peer.participants?.filter(p => p !== currentUser?.username) || [];
                seen = otherParticipants.some(p => {
                  const readTimeStr = conversation.readStates?.[p];
                  return readTimeStr && m.createdAt <= new Date(readTimeStr).getTime();
                });
              } else {
                const readTimeStr = conversation.readStates[peer.username];
                seen = !!readTimeStr && m.createdAt <= new Date(readTimeStr).getTime();
              }
            }
            return { ...m, seen };
          }
          return m;
        });

        const nextChat: ChatSession = {
          id: peer.username,
          peer: conversation.peer,
          messages,
          unreadCount: 0,
        };
        if (index === -1) {
          return [nextChat, ...prev];
        }
        const next = [...prev];
        next[index] = nextChat;
        return next;
      });
    },
    [token, currentUser]
  );

  const handleNewChat = useCallback(
    async (username: string) => {
      const safeUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!safeUsername || !token) {
        return;
      }

      const existing = chats.find((chat) => chat.peer.username === safeUsername);
      try {
        if (existing) {
          await openChat(existing.peer);
          return;
        }
        const conversation = await fetchConversation(token, safeUsername);
        await openChat(conversation.peer);
      } catch (error) {
        showAlert('Search Error', error instanceof Error ? error.message : 'User not found.');
      }
    },
    [chats, openChat, token, showAlert]
  );

  const handleSwitchAccount = useCallback(
    async (targetToken: string) => {
      try {
        const user = await fetchMe(targetToken);
        localStorage.setItem(TOKEN_KEY, targetToken);
        setToken(targetToken);
        setCurrentUser(user);
        setActiveChatId(null);
        setActiveConversationId('');
        setChats([]); // Clear old account's chats to prevent leaks
        await loadChats(targetToken);
      } catch (err) {
        showAlert('Switch Account Error', 'Failed to log in to the selected account. Please try logging in again.');
        setSavedAccounts((prev) => {
          const next = prev.filter((acc) => acc.token !== targetToken);
          localStorage.setItem('dicord-saved-accounts', JSON.stringify(next));
          return next;
        });
      }
    },
    [loadChats, showAlert]
  );

  const handleLogout = useCallback(() => {
    if (!currentUser) return;
    const currentUsername = currentUser.username;
    
    const remaining = savedAccounts.filter((acc) => acc.username !== currentUsername);
    setSavedAccounts(remaining);
    localStorage.setItem('dicord-saved-accounts', JSON.stringify(remaining));

    if (remaining.length > 0) {
      handleSwitchAccount(remaining[0].token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken('');
      setCurrentUser(null);
      setActiveChatId(null);
      setActiveConversationId('');
      setShowProfileSettings(false);
      setChats([]);
    }
  }, [currentUser, savedAccounts, handleSwitchAccount]);

  const handleRemoveAccount = useCallback((username: string) => {
    setSavedAccounts((prev) => {
      const next = prev.filter((acc) => acc.username !== username);
      localStorage.setItem('dicord-saved-accounts', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (!token || !currentUser) {
      return;
    }
    try {
      await deleteAccount(token);
      handleLogout();
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'Failed to delete account.');
    }
  }, [token, currentUser, handleLogout, showAlert]);

  const handleViewProfile = useCallback(
    async (userOrUsername: User | string) => {
      if (!token) return;
      if (typeof userOrUsername === 'string') {
        const username = userOrUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!username) return;

        if (currentUser && username === currentUser.username.toLowerCase()) {
          setSelectedProfileUser(currentUser);
          return;
        }

        const existingChat = chats.find((c) => c.peer.username.toLowerCase() === username);
        if (existingChat) {
          setSelectedProfileUser(existingChat.peer);
          return;
        }

        try {
          const conversation = await fetchConversation(token, username);
          setSelectedProfileUser(conversation.peer);
        } catch (err) {
          console.error('Failed to fetch user details:', err);
        }
      } else {
        if (userOrUsername.isGroup) {
          setShowGroupSettings(userOrUsername);
          return;
        }
        
        if (!userOrUsername.createdAt) {
          try {
            const conversation = await fetchConversation(token, userOrUsername.username);
            setSelectedProfileUser(conversation.peer);
          } catch (err) {
            setSelectedProfileUser(userOrUsername);
          }
        } else {
          setSelectedProfileUser(userOrUsername);
        }
      }
    },
    [token, currentUser, chats]
  );



  const handleUpdateGroupMetadata = useCallback(async (groupId: string, name?: string, avatar?: string) => {
    if (!token) return;
    try {
      const res = await updateGroupMetadata(token, groupId, name, avatar);
      if (res.ok) {
        await loadChats(token);
        setShowGroupSettings(prev => prev && prev.username === groupId ? res.peer : prev);
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to update group metadata.');
    }
  }, [token, loadChats, showAlert]);

  const handleAddGroupMembers = useCallback(async (groupId: string, usernames: string[]) => {
    if (!token) return;
    try {
      const res = await addGroupMembers(token, groupId, usernames);
      if (res.ok) {
        await loadChats(token);
        setShowGroupSettings(prev => prev && prev.username === groupId ? res.peer : prev);
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to add members.');
    }
  }, [token, loadChats, showAlert]);

  const handleRemoveGroupMember = useCallback(async (groupId: string, username: string) => {
    if (!token) return;
    try {
      const res = await removeGroupMember(token, groupId, username);
      if (res.ok) {
        await loadChats(token);
        setShowGroupSettings(prev => prev && prev.username === groupId ? res.peer : prev);
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to remove member.');
    }
  }, [token, loadChats, showAlert]);

  const handleLeaveGroup = useCallback(async (groupId: string) => {
    if (!token) return;
    
    const performLeave = async () => {
      try {
        const res = await leaveGroup(token, groupId);
        if (res.ok) {
          setShowGroupSettings(null);
          setChats((prev) => prev.filter((chat) => chat.id !== groupId));
          if (activeChatId === groupId) {
            setActiveChatId(null);
            setActiveConversationId('');
          }
        }
      } catch (err) {
        console.error(err);
        showAlert('Error', err instanceof Error ? err.message : 'Failed to leave group.');
      }
    };

    showConfirm(
      'Leave Group',
      'Are you sure you want to leave this group?',
      performLeave
    );
  }, [token, activeChatId, showConfirm, showAlert]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (!token) return;

    const performDelete = async () => {
      try {
        const res = await deleteGroup(token, groupId);
        if (res.ok) {
          setShowGroupSettings(null);
          setChats((prev) => prev.filter((chat) => chat.id !== groupId));
          if (activeChatId === groupId) {
            setActiveChatId(null);
            setActiveConversationId('');
          }
        }
      } catch (err) {
        console.error(err);
        showAlert('Error', err instanceof Error ? err.message : 'Failed to delete group.');
      }
    };

    showConfirm(
      'Delete Group',
      'Are you sure you want to delete this group? This will delete all messages for everyone.',
      performDelete
    );
  }, [token, activeChatId, showConfirm, showAlert]);



  const handleSelectChat = async (id: string) => {
    const chat = chats.find((entry) => entry.id === id);
    if (chat) {
      openChat(chat.peer);
    } else if (id.startsWith('group__')) {
      try {
        const conversation = await fetchConversation(token, id);
        openChat(conversation.peer);
      } catch (err) {
        console.error('Failed to open newly created group chat:', err);
      }
    }
  };

  const handleTypingChange = useCallback(
    async (peerUsername: string, isTyping: boolean) => {
      if (!token) return;
      try {
        await sendTypingStatus(token, peerUsername, isTyping);
      } catch (err) {
        console.error('Failed to send typing status:', err);
      }
    },
    [token]
  );

  const handleSend = useCallback(
    async (text: string, gifUrl?: string, mediaUrl?: string, mediaType?: string, mediaSize?: number, embeds?: any[], replyTo?: string) => {
      if (!token || !activeChatId || !currentUser) {
        return;
      }
      const finalGifUrl = gifUrl ? await resolveGif(gifUrl) : '';

      const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const repliedOriginal = replyTo
        ? chats.find((c) => c.id === activeChatId)?.messages.find((m) => m.id === replyTo)
        : null;

      const tempMessage: Message = {
        id: tempId,
        text,
        authorId: currentUser.username,
        authorName: currentUser.displayName,
        gifUrl: finalGifUrl,
        mediaUrl,
        mediaType,
        mediaSize,
        embeds,
        createdAt: Date.now(),
        pending: true,
        replyTo: repliedOriginal
          ? {
              id: repliedOriginal.id,
              author: repliedOriginal.authorId,
              authorName: repliedOriginal.authorName,
              text: repliedOriginal.text,
              gifUrl: repliedOriginal.gifUrl,
              mediaUrl: repliedOriginal.mediaUrl,
              mediaType: repliedOriginal.mediaType,
              mediaSize: repliedOriginal.mediaSize,
            }
          : null,
      };

      // Add optimistic message
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: [...chat.messages, tempMessage],
              }
            : chat
        )
      );

      try {
        await sendMessage(token, activeChatId, text, finalGifUrl, mediaUrl, mediaType, mediaSize, embeds, replyTo, tempId);
      } catch (error) {
        // If failed, remove the optimistic message
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? {
                  ...chat,
                  messages: chat.messages.filter((m) => m.id !== tempId),
                }
              : chat
          )
        );
        showAlert('Send Error', error instanceof Error ? error.message : 'Failed to send message.');
      }
    },
    [activeChatId, token, currentUser, chats, showAlert]
  );

  const handleReact = useCallback(
    async (messageId: string, reaction: string) => {
      if (!token || !activeChatId) {
        return;
      }
      try {
        await sendReaction(token, activeChatId, messageId, reaction);
      } catch (error) {
        console.error('Failed to send reaction:', error);
      }
    },
    [activeChatId, token]
  );

  const handleDeleteMessage = useCallback(
    async (peerUsername: string, messageId: string) => {
      if (!token) {
        return;
      }
      try {
        await deleteMessage(token, peerUsername, messageId);
      } catch (error) {
        showAlert('Error', error instanceof Error ? error.message : 'Failed to delete message.');
      }
    },
    [token, showAlert]
  );

  const handleEditMessage = useCallback(
    async (peerUsername: string, messageId: string, text: string) => {
      if (!token) {
        return;
      }
      try {
        await editMessage(token, peerUsername, messageId, text);
      } catch (error) {
        showAlert('Error', error instanceof Error ? error.message : 'Failed to edit message.');
      }
    },
    [token, showAlert]
  );

  const handleTogglePin = useCallback(
    async (peerUsername: string, messageId: string) => {
      if (!token) {
        return;
      }
      try {
        await togglePin(token, peerUsername, messageId);
      } catch (error) {
        showAlert('Error', error instanceof Error ? error.message : 'Failed to pin/unpin message.');
      }
    },
    [token, showAlert]
  );

  const handleToggleBlock = useCallback(
    async (username: string) => {
      if (!token || !currentUser) {
        return;
      }
      try {
        const result = await toggleBlock(token, username);
        setCurrentUser({
          ...currentUser,
          blockedUsers: result.blocked,
        });
      } catch (error) {
        showAlert('Error', error instanceof Error ? error.message : 'Action failed.');
      }
    },
    [currentUser, token, showAlert]
  );

  const handleToggleMute = useCallback(
    async (username: string) => {
      if (!token || !currentUser) {
        return;
      }
      try {
        const result = await toggleMute(token, username);
        setCurrentUser({
          ...currentUser,
          mutedUsers: result.muted,
        });
      } catch (error) {
        showAlert('Error', error instanceof Error ? error.message : 'Action failed.');
      }
    },
    [currentUser, token, showAlert]
  );



  if (!currentUser || isAddingAccount) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-theme-bg text-theme-text transition-colors relative selection:bg-indigo-500/30">
        <AuthScreen 
          onLogin={handleAuthenticate} 
          theme={theme} 
          onCancel={isAddingAccount ? () => setIsAddingAccount(false) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-theme-bg text-theme-text transition-colors relative selection:bg-indigo-500/30">
      <AnimatePresence mode="wait">
        <motion.div
          key="app"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="h-full flex relative overflow-hidden"
        >
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-20 md:hidden"
            />
          )}

          <div
            className={`
              absolute md:relative z-30 h-full transition-transform duration-300 ease-in-out font-sans w-full md:w-auto
              ${sidebarOpen || !activeChatId ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
          >
            <Sidebar
              currentUser={currentUser}
              chats={chats}
              activeChatId={activeChatId}
              onSelectChat={handleSelectChat}
              onLogout={() => setShowLogoutConfirm(true)}
              onSettings={() => setShowProfileSettings(true)}
              onNewChat={handleNewChat}
              onViewProfile={handleViewProfile}
              onShowCreateGroup={() => setShowCreateGroup(true)}
              savedAccounts={savedAccounts}
              onSwitchAccount={handleSwitchAccount}
              onAddAccount={() => setIsAddingAccount(true)}
              onRemoveAccount={handleRemoveAccount}
            />
          </div>

          <div className={`flex-1 min-w-0 h-full relative z-10 flex flex-col font-sans ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
            <ChatArea
              chat={chats.find((chat) => chat.id === activeChatId)}
              currentUser={currentUser}
              onSend={handleSend}
              onReact={handleReact}
              onToggleBlock={handleToggleBlock}
              onToggleMute={handleToggleMute}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onTogglePin={handleTogglePin}
              onToggleSidebar={() => setSidebarOpen(true)}
              onBack={() => setActiveChatId(null)}
              onViewProfile={handleViewProfile}
              onUpdateUser={handleUpdateProfile}
              onShowGroupSettings={setShowGroupSettings}
              theme={theme}
              chats={chats}
              onShowAlert={showAlert}
              onShowConfirm={showConfirm}
              onTypingChange={handleTypingChange}
            />
          </div>

          {showProfileSettings && (
            <ProfileSettings
              user={currentUser}
              onUpdate={handleUpdateProfile}
              onClose={() => setShowProfileSettings(false)}
              theme={theme}
              onThemeChange={handleThemeChange}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {selectedProfileUser && (
            <UserProfile
              user={selectedProfileUser}
              onClose={() => setSelectedProfileUser(null)}
            />
          )}

          <AnimatePresence>
            {showLogoutConfirm && (
              <LogoutConfirmModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={handleLogout}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCreateGroup && (
              <CreateGroupModal
                isOpen={showCreateGroup}
                onClose={() => setShowCreateGroup(false)}
                token={token}
                currentUser={currentUser!}
                chats={chats}
                openChat={openChat}
                loadChats={loadChats}
                showAlert={showAlert}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showGroupSettings && (
              <GroupSettingsModal
                isOpen={!!showGroupSettings}
                group={showGroupSettings}
                onClose={() => setShowGroupSettings(null)}
                currentUser={currentUser!}
                chats={chats}
                onUpdateGroupMetadata={handleUpdateGroupMetadata}
                onAddGroupMembers={handleAddGroupMembers}
                onRemoveGroupMember={handleRemoveGroupMember}
                onLeaveGroup={handleLeaveGroup}
                onDeleteGroup={handleDeleteGroup}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {inPageDialog.isOpen && (
              <InPageDialogModal
                isOpen={inPageDialog.isOpen}
                type={inPageDialog.type}
                title={inPageDialog.title}
                message={inPageDialog.message}
                confirmText={inPageDialog.confirmText}
                cancelText={inPageDialog.cancelText}
                onConfirm={inPageDialog.onConfirm || (() => {})}
                onCancel={inPageDialog.onCancel}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

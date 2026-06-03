import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, LogOut, Plus, X, Camera, AlertTriangle } from 'lucide-react';
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
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showGroupSettings, setShowGroupSettings] = useState<User | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const [inPageDialog, setInPageDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void | Promise<void>;
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

  const lastGroupIdRef = React.useRef<string | null>(null);

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
      };
      const next = index >= 0 ? [...prev.slice(0, index), ...prev.slice(index + 1)] : prev;
      return [nextChat, ...next];
    });
  }, []);

  const loadChats = useCallback(async (nextToken: string) => {
    const nextChats = await fetchChats(nextToken);
    setChats(nextChats);
  }, []);

  const handleAuthenticate = useCallback(
    async (username: string, password: string, displayName: string | undefined, isRegister: boolean) => {
      const result = isRegister
        ? await register(username, password, displayName || username)
        : await login(username, password);
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setCurrentUser(result.user);
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
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken('');
      });
  }, [token, loadChats]);

  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    const source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

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
        if (activeChatId === data.conversationId) {
          setActiveChatId(null);
          setActiveConversationId('');
        }
        if (showGroupSettings && showGroupSettings.username === data.conversationId) {
          setShowGroupSettings(null);
        }
        return;
      }

      if (data.event !== 'message' || !data.message || !data.peer) {
        return;
      }

      const message = toClientMessage(data.message);
      const peer = toClientUser(data.peer);
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
        const isCurrentlyChatting = data.conversationId === activeConversationId && document.hasFocus();
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

      if (data.conversationId === activeConversationId) {
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== activeChatId) {
              return chat;
            }
            
            let messages = chat.messages;
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
  }, [activeChatId, activeConversationId, currentUser, token, upsertChat]);

  const handleUpdateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!currentUser || !token) {
        return;
      }
      const updated = await updateProfile(token, updates);
      setCurrentUser(updated);
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
      setChats((prev) => {
        const index = prev.findIndex((chat) => chat.peer.username === peer.username);
        const nextChat: ChatSession = {
          id: peer.username,
          peer: conversation.peer,
          messages: conversation.messages,
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
    [token]
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

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setCurrentUser(null);
    setActiveChatId(null);
    setActiveConversationId('');
    setShowProfileSettings(false);
    setChats([]);
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
          setSelectedProfileUser(userOrUsername);
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

  const handleCreateGroup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !groupName.trim() || selectedUsers.length === 0) return;
    try {
      const res = await createGroup(token, groupName.trim(), selectedUsers);
      setGroupName('');
      setSelectedUsers([]);
      setMemberSearchQuery('');
      setShowCreateGroup(false);
      await loadChats(token);
      
      if (res && res.groupId) {
        // Find or wait for the chat peer to be resolved
        try {
          const conversation = await fetchConversation(token, res.groupId);
          openChat(conversation.peer);
        } catch (fetchErr) {
          console.error(fetchErr);
        }
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to create group');
    }
  }, [token, groupName, selectedUsers, loadChats, openChat, showAlert]);

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

  const [groupSettingsName, setGroupSettingsName] = useState('');
  const [groupSettingsAvatar, setGroupSettingsAvatar] = useState('');
  const [groupSettingsSearch, setGroupSettingsSearch] = useState('');
  const groupIconInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showGroupSettings) {
      const currentId = showGroupSettings.username;
      if (lastGroupIdRef.current !== currentId) {
        setGroupSettingsName(showGroupSettings.displayName);
        setGroupSettingsAvatar(showGroupSettings.avatar);
        setGroupSettingsSearch('');
        lastGroupIdRef.current = currentId;
      }
    } else {
      lastGroupIdRef.current = null;
    }
  }, [showGroupSettings]);

  const handleGroupIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setGroupSettingsAvatar(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGroupSettings = async () => {
    if (!showGroupSettings) return;
    await handleUpdateGroupMetadata(showGroupSettings.username, groupSettingsName.trim(), groupSettingsAvatar);
  };

  const getGroupMembers = (participantUsernames: string[]) => {
    return participantUsernames.map(username => {
      const userChat = chats.find(c => c.peer.username === username);
      if (userChat) {
        return userChat.peer;
      }
      if (username === currentUser?.username) {
        return currentUser;
      }
      return {
        id: username,
        username,
        displayName: username,
        avatar: '',
      };
    });
  };

  const availableToAdd = React.useMemo(() => {
    if (!showGroupSettings) return [];
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser?.username && !showGroupSettings.participants?.includes(chat.peer.username) && chat.messages.length > 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser, showGroupSettings]);

  const otherToAdd = React.useMemo(() => {
    if (!showGroupSettings) return [];
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser?.username && !showGroupSettings.participants?.includes(chat.peer.username) && chat.messages.length === 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser, showGroupSettings]);

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
        await sendMessage(token, activeChatId, text, finalGifUrl, mediaUrl, mediaType, mediaSize, embeds, replyTo);
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

  const activeInvitees = React.useMemo(() => {
    if (!currentUser) return [];
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser.username && chat.messages.length > 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser]);

  const otherRegisteredUsers = React.useMemo(() => {
    if (!currentUser) return [];
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser.username && chat.messages.length === 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser]);

  const filteredActiveInvitees = React.useMemo(() => {
    return activeInvitees.filter(u => 
      u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
      u.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  }, [activeInvitees, memberSearchQuery]);

  const filteredOtherUsers = React.useMemo(() => {
    if (!memberSearchQuery) return [];
    return otherRegisteredUsers.filter(u => 
      u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
      u.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  }, [otherRegisteredUsers, memberSearchQuery]);

  if (!currentUser) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-theme-bg text-theme-text transition-colors relative selection:bg-indigo-500/30">
        <AuthScreen onLogin={handleAuthenticate} theme={theme} />
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
            />
          </div>

          {showProfileSettings && (
            <ProfileSettings
              user={currentUser}
              onUpdate={handleUpdateProfile}
              onClose={() => setShowProfileSettings(false)}
              onDeleteAccount={handleDeleteAccount}
              theme={theme}
              onThemeChange={handleThemeChange}
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
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans select-none">
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
                      onClick={() => setShowLogoutConfirm(false)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-theme-bg border border-theme-border hover:bg-white/5 transition-colors cursor-pointer text-theme-text"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogoutConfirm(false);
                        handleLogout();
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-md shadow-rose-600/10 uppercase tracking-wider"
                    >
                      Log Out
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCreateGroup && (
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans select-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-md bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left text-theme-text"
                >
                  <div className="flex items-center gap-3 text-indigo-400 font-bold text-lg">
                    <Users size={20} />
                    <span>Create Group Chat</span>
                  </div>
                  
                  <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
                    <div>
                      <label className="text-[10px] text-theme-muted uppercase font-bold tracking-wider block mb-1.5">Group Name</label>
                      <input
                        type="text"
                        required
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="Enter group name..."
                        className="w-full bg-black/20 border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-theme-muted uppercase font-bold tracking-wider block mb-1.5">Search Members</label>
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={e => setMemberSearchQuery(e.target.value)}
                        placeholder="Search by username or display name..."
                        className="w-full bg-black/20 border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] text-theme-muted uppercase font-bold tracking-wider block mb-1.5">
                        Select Members ({selectedUsers.length} selected)
                      </label>
                      
                      {filteredActiveInvitees.length === 0 && filteredOtherUsers.length === 0 ? (
                        <p className="text-xs text-theme-muted italic">No matching members found.</p>
                      ) : (
                        <div className="max-h-[160px] overflow-y-auto border border-theme-border rounded-xl p-2.5 bg-black/10 flex flex-col gap-1.5 scrollbar-hide">
                          {/* Active conversations section */}
                          {filteredActiveInvitees.map(invitee => {
                            const isChecked = selectedUsers.includes(invitee.username);
                            const handleToggle = () => {
                              setSelectedUsers(prev => isChecked ? prev.filter(u => u !== invitee.username) : [...prev, invitee.username]);
                            };
                            return (
                              <button
                                key={invitee.id}
                                type="button"
                                onClick={handleToggle}
                                className={`flex items-center justify-between p-2 rounded-lg text-left cursor-pointer transition-colors ${
                                  isChecked ? 'bg-indigo-500/10 text-indigo-300 font-semibold' : 'hover:bg-white/5 text-theme-text'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar user={invitee} className="w-6 h-6 shrink-0" />
                                  <div className="truncate text-xs font-bold">{invitee.displayName || invitee.username}</div>
                                </div>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                  isChecked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-500 text-transparent'
                                }}`}>
                                  <Plus size={10} strokeWidth={4} />
                                </div>
                              </button>
                            );
                          })}

                          {/* Other registered users section */}
                          {filteredOtherUsers.length > 0 && (
                            <>
                              <div className="text-[9px] uppercase font-bold tracking-wider text-theme-muted px-2 pt-2 border-t border-theme-border/30">Other Registered Users</div>
                              {filteredOtherUsers.map(invitee => {
                                const isChecked = selectedUsers.includes(invitee.username);
                                const handleToggle = () => {
                                  setSelectedUsers(prev => isChecked ? prev.filter(u => u !== invitee.username) : [...prev, invitee.username]);
                                };
                                return (
                                  <button
                                    key={invitee.id}
                                    type="button"
                                    onClick={handleToggle}
                                    className={`flex items-center justify-between p-2 rounded-lg text-left cursor-pointer transition-colors ${
                                      isChecked ? 'bg-indigo-500/10 text-indigo-300 font-semibold' : 'hover:bg-white/5 text-theme-text'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <Avatar user={invitee} className="w-6 h-6 shrink-0" />
                                      <div className="truncate text-xs font-bold">{invitee.displayName || invitee.username}</div>
                                    </div>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                      isChecked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-500 text-transparent'
                                    }`}>
                                      <Plus size={10} strokeWidth={4} />
                                    </div>
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateGroup(false);
                          setGroupName('');
                          setSelectedUsers([]);
                          setMemberSearchQuery('');
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-theme-bg border border-theme-border hover:bg-white/5 transition-colors cursor-pointer text-theme-text"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!groupName.trim() || selectedUsers.length === 0}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/10 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Create Group
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showGroupSettings && (
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans select-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-lg bg-theme-panel border border-theme-border rounded-[28px] shadow-2xl p-6 relative flex flex-col h-[560px] text-left text-theme-text"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-theme-border pb-4 shrink-0">
                    <div className="flex items-center gap-3 text-indigo-400 font-bold text-lg">
                      <Users size={20} />
                      <span>Group Settings</span>
                    </div>
                    <button
                      onClick={() => setShowGroupSettings(null)}
                      className="w-8 h-8 rounded-full bg-theme-bg/5 hover:bg-theme-bg/10 text-theme-muted hover:text-theme-text transition-all flex items-center justify-center cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-5 scrollbar-hide">
                    {/* Name and Icon section */}
                    <div className="flex gap-4 items-center">
                      <div 
                        className="relative group cursor-pointer shrink-0" 
                        onClick={() => groupIconInputRef.current?.click()}
                      >
                        <Avatar user={{ displayName: groupSettingsName, avatar: groupSettingsAvatar, username: showGroupSettings.username }} className="w-16 h-16 rounded-full border border-white/10" />
                        <div className="absolute inset-0 bg-black/65 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Camera size={18} className="text-white" />
                        </div>
                        <input
                          type="file"
                          ref={groupIconInputRef}
                          onChange={handleGroupIconChange}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      
                      <div className="flex-1 flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[10px] text-theme-muted uppercase font-bold tracking-wider block mb-1">Group Name</label>
                          <input
                            type="text"
                            value={groupSettingsName}
                            onChange={e => setGroupSettingsName(e.target.value)}
                            placeholder="Enter group name..."
                            className="w-full bg-black/20 border border-theme-border rounded-xl px-4 py-2 text-sm text-theme-text focus:outline-none focus:border-indigo-500/50 transition-colors"
                          />
                        </div>
                        
                        {(groupSettingsName.trim() !== showGroupSettings.displayName || groupSettingsAvatar !== showGroupSettings.avatar) && (
                          <button
                            type="button"
                            onClick={handleSaveGroupSettings}
                            disabled={!groupSettingsName.trim()}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer uppercase tracking-wider"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Members list section */}
                    <div>
                      <h4 className="text-[10px] text-theme-muted uppercase font-bold tracking-wider mb-2">Members ({showGroupSettings.participants?.length})</h4>
                      <div className="max-h-[140px] overflow-y-auto border border-theme-border rounded-xl p-2 bg-black/10 flex flex-col gap-1.5 scrollbar-hide">
                        {getGroupMembers(showGroupSettings.participants || []).map(member => {
                          const isMe = member.username === currentUser?.username;
                          return (
                            <div key={member.username} className="flex items-center justify-between p-1.5 rounded-lg bg-white/2 hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar user={member} className="w-6 h-6 shrink-0" />
                                <div className="truncate text-xs font-bold">{member.displayName || member.username} {isMe && <span className="text-[9px] text-indigo-400 font-normal ml-1">(You)</span>}</div>
                              </div>
                              
                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGroupMember(showGroupSettings.username, member.username)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-455 hover:text-white border border-rose-500/20 transition-all cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add Members section */}
                    <div>
                      <h4 className="text-[10px] text-theme-muted uppercase font-bold tracking-wider mb-2">Add Members</h4>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={groupSettingsSearch}
                          onChange={e => setGroupSettingsSearch(e.target.value)}
                          placeholder="Search users to add..."
                          className="w-full bg-black/20 border border-theme-border rounded-xl px-4 py-2 text-xs text-theme-text focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                        
                        <div className="max-h-[140px] overflow-y-auto border border-theme-border rounded-xl p-2 bg-black/10 flex flex-col gap-1.5 scrollbar-hide">
                          {(() => {
                            const query = groupSettingsSearch.toLowerCase().trim();
                            const activeFiltered = availableToAdd.filter(u => u.username.toLowerCase().includes(query) || u.displayName.toLowerCase().includes(query));
                            const otherFiltered = query ? otherToAdd.filter(u => u.username.toLowerCase().includes(query) || u.displayName.toLowerCase().includes(query)) : [];
                            
                            if (activeFiltered.length === 0 && otherFiltered.length === 0) {
                              return <p className="text-xs text-theme-muted italic text-center py-2">No users available to add.</p>;
                            }
                            
                            return (
                              <>
                                {activeFiltered.map(user => (
                                  <div key={user.username} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Avatar user={user} className="w-6 h-6 shrink-0" />
                                      <div className="truncate text-xs font-bold">{user.displayName || user.username}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddGroupMembers(showGroupSettings.username, [user.username])}
                                      className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer uppercase tracking-wider"
                                    >
                                      Add
                                    </button>
                                  </div>
                                ))}
                                
                                {otherFiltered.length > 0 && (
                                  <>
                                    <div className="text-[9px] uppercase font-bold tracking-wider text-theme-muted px-2 pt-2 border-t border-theme-border/30">Other Registered Users</div>
                                    {otherFiltered.map(user => (
                                      <div key={user.username} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Avatar user={user} className="w-6 h-6 shrink-0" />
                                          <div className="truncate text-xs font-bold">{user.displayName || user.username}</div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleAddGroupMembers(showGroupSettings.username, [user.username])}
                                          className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer uppercase tracking-wider"
                                        >
                                          Add
                                        </button>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="border-t border-theme-border pt-4 mt-2 flex justify-between items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLeaveGroup(showGroupSettings.username)}
                      className="px-4 py-2 rounded-xl border border-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-black font-bold text-xs transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Leave Group
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(showGroupSettings.username)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Delete Group
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* In-Page Custom Confirmation & Alert Dialog Modal */}
          <AnimatePresence>
            {inPageDialog.isOpen && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-sans select-none animate-fade-in">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-sm bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left text-theme-text"
                >
                  <div className="flex items-center gap-3 text-indigo-400 font-bold text-lg">
                    {inPageDialog.type === 'confirm' ? (
                      <AlertTriangle className="text-amber-500 animate-pulse" size={20} />
                    ) : (
                      <AlertTriangle className="text-indigo-400" size={20} />
                    )}
                    <span>{inPageDialog.title}</span>
                  </div>
                  
                  <p className="text-sm text-theme-muted leading-relaxed select-text">
                    {inPageDialog.message}
                  </p>
                  
                  <div className="flex justify-end gap-3 mt-2">
                    {inPageDialog.type === 'confirm' && (
                      <button
                        type="button"
                        onClick={() => setInPageDialog(prev => ({ ...prev, isOpen: false }))}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-theme-bg border border-theme-border hover:bg-white/5 transition-colors cursor-pointer text-theme-text"
                      >
                        {inPageDialog.cancelText || 'Cancel'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setInPageDialog(prev => ({ ...prev, isOpen: false }));
                        if (inPageDialog.onConfirm) {
                          await inPageDialog.onConfirm();
                        }
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition-colors cursor-pointer shadow-md uppercase tracking-wider ${
                        inPageDialog.type === 'confirm' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
                      }`}
                    >
                      {inPageDialog.confirmText || (inPageDialog.type === 'confirm' ? 'Confirm' : 'OK')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

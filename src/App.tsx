import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ProfileSettings } from './components/ProfileSettings';
import { UserProfile } from './components/UserProfile';
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
} from './lib/api';

const TOKEN_KEY = 'dicord-token';

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

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-forest', 'theme-sunset', 'theme-cyberpunk');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('dicord-theme', theme);
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
            const expectedId = [currentUser.username, chat.peer.username].sort().join("__");
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
            const expectedId = [currentUser.username, chat.peer.username].sort().join("__");
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
            const expectedId = [currentUser.username, chat.peer.username].sort().join("__");
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
            const expectedId = [currentUser.username, chat.peer.username].sort().join("__");
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

      if (data.event !== 'message' || !data.message || !data.peer) {
        return;
      }

      const message = toClientMessage(data.message);
      const peer = toClientUser(data.peer);
      upsertChat(peer, message);

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
        window.alert(error instanceof Error ? error.message : 'User not found.');
      }
    },
    [chats, openChat, token]
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
      window.alert(error instanceof Error ? error.message : 'Failed to delete account.');
    }
  }, [token, currentUser, handleLogout]);

  const handleSelectChat = (id: string) => {
    const chat = chats.find((entry) => entry.id === id);
    if (chat) {
      openChat(chat.peer);
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
        window.alert(error instanceof Error ? error.message : 'Failed to send message.');
      }
    },
    [activeChatId, token, currentUser, chats]
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
        window.alert(error instanceof Error ? error.message : 'Failed to delete message.');
      }
    },
    [token]
  );

  const handleEditMessage = useCallback(
    async (peerUsername: string, messageId: string, text: string) => {
      if (!token) {
        return;
      }
      try {
        await editMessage(token, peerUsername, messageId, text);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Failed to edit message.');
      }
    },
    [token]
  );

  const handleTogglePin = useCallback(
    async (peerUsername: string, messageId: string) => {
      if (!token) {
        return;
      }
      try {
        await togglePin(token, peerUsername, messageId);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Failed to pin/unpin message.');
      }
    },
    [token]
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
        window.alert(error instanceof Error ? error.message : 'Action failed.');
      }
    },
    [currentUser, token]
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
        window.alert(error instanceof Error ? error.message : 'Action failed.');
      }
    },
    [currentUser, token]
  );

  if (!currentUser) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-theme-bg text-theme-text transition-colors relative selection:bg-indigo-500/30">
        <AuthScreen onLogin={handleAuthenticate} />
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
              onLogout={handleLogout}
              onSettings={() => setShowProfileSettings(true)}
              onNewChat={handleNewChat}
              onViewProfile={setSelectedProfileUser}
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
              onViewProfile={setSelectedProfileUser}
              onUpdateUser={handleUpdateProfile}
              theme={theme}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

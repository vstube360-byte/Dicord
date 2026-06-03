import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, ArrowLeft, MoreVertical, Download, VolumeX, Ban, Volume2, ShieldAlert, X, Copy, Trash2, CheckSquare, Palette, Search, Pin, Camera } from 'lucide-react';
import { ChatSession, User, Message } from '../types';
import { MessageItem } from './MessageItem';
import { ChatComposer } from './ChatComposer';
import { TypingIndicator } from './TypingIndicator';
import { Avatar } from './Avatar';

interface ChatAreaProps {
  chat: ChatSession | undefined;
  currentUser: User;
  onSend: (text: string, gifUrl?: string, mediaUrl?: string, mediaType?: string, mediaSize?: number, embeds?: any[], replyTo?: string) => void;
  onReact?: (messageId: string, reaction: string) => void;
  onToggleBlock?: (username: string) => void;
  onToggleMute?: (username: string) => void;
  onDeleteMessage?: (chatId: string, messageId: string) => void;
  onEditMessage?: (peerUsername: string, messageId: string, text: string) => void;
  onTogglePin?: (chatId: string, messageId: string) => void;
  onToggleSidebar: () => void;
  onBack?: () => void;
  onViewProfile?: (user: User) => void;
  onUpdateUser?: (updates: Partial<User>) => void;
  onShowGroupSettings?: (group: User) => void;
  theme: string;
  chats?: ChatSession[];
  onShowAlert?: (title: string, message: string) => void;
  onShowConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

function formatLastActive(isoString: string | undefined) {
  if (!isoString) return 'Offline';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Offline · Just now';
  if (diffMins < 60) return `Offline · Active ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Offline · Active ${diffHours}h ago`;
  return `Offline · Active ${date.toLocaleDateString()}`;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-indigo-500/30 text-indigo-200 px-0.5 rounded font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

function getWallpaperStyle(wallpaper: string, isLightMode: boolean) {
  if (!wallpaper) return {};
  if (wallpaper.startsWith('http') || wallpaper.startsWith('data:') || wallpaper.startsWith('/')) {
    const overlayColor = isLightMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(11, 14, 20, 0.5)';
    return {
      background: `linear-gradient(${overlayColor}, ${overlayColor}), url("${wallpaper}") center/cover local no-repeat`
    };
  }
  if (wallpaper.startsWith('gradient-')) {
    switch (wallpaper) {
      case 'gradient-aurora':
        return { background: 'linear-gradient(135deg, #0b3f2a 0%, #111827 100%)' };
      case 'gradient-sunset':
        return { background: 'linear-gradient(135deg, #4c1d95 0%, #0f172a 100%)' };
      case 'gradient-neon':
        return { background: 'linear-gradient(135deg, #1e1b4b 0%, #030712 100%)' };
      case 'gradient-cherry':
        return { background: 'linear-gradient(135deg, #4c0519 0%, #0b0f19 100%)' };
      case 'gradient-ocean':
        return { background: 'linear-gradient(135deg, #042f2e 0%, #0b0f19 100%)' };
      default:
        return {};
    }
  }
  return { background: wallpaper };
}

export function ChatArea({ chat, currentUser, onSend, onReact, onToggleBlock, onToggleMute, onDeleteMessage, onEditMessage, onTogglePin, onToggleSidebar, onBack, onViewProfile, onUpdateUser, onShowGroupSettings, theme, chats = [], onShowAlert, onShowConfirm }: ChatAreaProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  const focusComposer = () => {
    const isMobile = window.innerWidth < 1024;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isMobile || isTouch) return;
    composerInputRef.current?.focus();
  };

  const mentionableUsers = React.useMemo(() => {
    const usersMap = new Map<string, User>();
    if (currentUser) {
      usersMap.set(currentUser.username, currentUser);
    }
    if (chat && chat.peer) {
      usersMap.set(chat.peer.username, chat.peer);
    }
    return Array.from(usersMap.values());
  }, [currentUser, chat]);
  
  const [showMenu, setShowMenu] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [selectionModeEnabled, setSelectionModeEnabled] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('Wallpaper file input changed. File:', file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        console.log('Wallpaper base64 read completed. String length:', typeof event.target?.result === 'string' ? event.target.result.length : 0);
        if (typeof event.target?.result === 'string' && onUpdateUser) {
          console.log('Calling onUpdateUser with custom wallpaper...');
          onUpdateUser({ chatWallpaper: event.target.result });
        } else {
          console.log('onUpdateUser missing or result is not string:', { hasOnUpdateUser: !!onUpdateUser });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    setSelectedMessageIds(new Set());
    setSelectionModeEnabled(false);
    setReplyToMessage(null);
    setShowSearch(false);
    setSearchQuery('');
    setHighlightedMessageId(null);
    setShowPins(false);
    setShowWallpaperModal(false);
    
    setTimeout(() => {
      focusComposer();
    }, 50);
  }, [chat?.id]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. If any modal overlay is currently open, do not steal focus
      const hasModal = document.querySelector('.fixed, [class*="fixed"]');
      if (hasModal) {
        return;
      }

      // 2. If the click is inside a message item, do not focus the composer
      if (target.closest('[id^="msg-"]')) {
        return;
      }

      // 3. Only focus the composer if the click was inside the messages list container
      if (!scrollRef.current || !scrollRef.current.contains(target)) {
        return;
      }

      // 4. Check if they clicked a button, a label, or empty space
      const isButton = target.closest('button, [role="button"]');
      const isComposerTextarea = target === composerInputRef.current;
      
      if (isComposerTextarea) {
        return;
      }

      const isInteractive = target.closest('input, textarea, a, img, iframe');
      
      const isButtonClick = !!isButton;
      const isBgClick = !isInteractive && !window.getSelection()?.toString();

      if (isButtonClick || isBgClick) {
        setTimeout(() => {
          const activeEl = document.activeElement;
          if (
            activeEl &&
            (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
            activeEl !== composerInputRef.current
          ) {
            return;
          }
          focusComposer();
        }, 0);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const isSelectionMode = selectionModeEnabled || selectedMessageIds.size > 0;

  const handleToggleSelect = (messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedMessageIds(new Set());
    setSelectionModeEnabled(false);
  };

  const handleSelectAll = () => {
    if (!chat) return;
    const allIds = chat.messages.map((m) => m.id);
    setSelectedMessageIds(new Set(allIds));
  };

  const handleCopySelected = () => {
    if (!chat) return;
    const selectedMsgs = chat.messages.filter((m) => selectedMessageIds.has(m.id));
    const combinedText = selectedMsgs
      .map((m) => {
        const time = new Date(m.createdAt).toLocaleString();
        const author = m.authorId === currentUser.username ? 'You' : chat.peer.displayName;
        return `[${time}] ${author}: ${m.text || m.gifUrl || '[Attachment]'}`;
      })
      .join('\n');
    navigator.clipboard.writeText(combinedText);
    if (onShowAlert) {
      onShowAlert('Copy Messages', `Copied ${selectedMsgs.length} messages to clipboard!`);
    } else {
      window.alert(`Copied ${selectedMsgs.length} messages to clipboard!`);
    }
  };

  const handleDeleteSelected = async () => {
    if (!chat || !onDeleteMessage) return;
    const ownSelectedMessageIds = chat.messages
      .filter((m) => selectedMessageIds.has(m.id) && m.authorId === currentUser.username)
      .map((m) => m.id);

    if (ownSelectedMessageIds.length === 0) {
      if (onShowAlert) {
        onShowAlert('Action Denied', "You can only delete your own messages.");
      } else {
        window.alert("You can only delete your own messages.");
      }
      return;
    }

    const performDelete = async () => {
      try {
        await Promise.all(
          ownSelectedMessageIds.map((id) => onDeleteMessage(chat.id, id))
        );
        setSelectedMessageIds(new Set());
        setSelectionModeEnabled(false);
      } catch (err) {
        console.error("Failed to delete selected messages:", err);
      }
    };

    if (onShowConfirm) {
      onShowConfirm(
        'Delete Messages',
        `Delete ${ownSelectedMessageIds.length} selected message(s)?`,
        performDelete
      );
    } else if (window.confirm(`Delete ${ownSelectedMessageIds.length} selected message(s)?`)) {
      await performDelete();
    }
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2500);
      if (window.innerWidth < 1024) {
        setShowSearch(false);
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const handleDownloadChat = () => {
    if (!chat) return;
    const content = chat.messages.map((message) => {
      const time = new Date(message.createdAt).toLocaleString();
      const author = message.authorId === currentUser.username ? 'You' : chat.peer.displayName;
      const text = message.text || '';
      const gif = message.gifUrl ? `[GIF: ${message.gifUrl}]` : '';
      return `[${time}] ${author}: ${text} ${gif}`.trim();
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat_with_${chat.peer.username}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chat?.messages, chat?.isTyping]);

  if (!chat) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-theme-bg relative z-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-40 h-40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_80px_rgba(99,102,241,0.15)] glass">
            <img 
              src={theme === 'light' ? '/logo_lightmode.ico' : '/logo_darkmode.ico'} 
              alt="Dicord Logo" 
              className="w-28 h-28 object-contain pointer-events-none select-none" 
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">Dicord</h2>
          <p className="text-theme-muted text-sm max-w-[280px] mx-auto leading-relaxed mt-4">
            Select a conversation on the left or search to start a new chat.
          </p>
        </motion.div>
      </div>
    );
  }

  const isLightMode = theme === 'light';
  const wallpaperStyle = getWallpaperStyle(currentUser.chatWallpaper || '', isLightMode);

  return (
    <div 
      className="flex-1 flex flex-col h-full overflow-hidden bg-theme-bg relative z-0 transition-all duration-300"
      style={wallpaperStyle}
    >
      {/* Header */}
      {isSelectionMode ? (
        <header className="h-[80px] px-8 flex items-center justify-between bg-theme-panel border-b border-indigo-500/20 sticky top-0 z-20 transition-all select-none">
          <div className="flex items-center space-x-4 animate-fade-in">
            <button
              onClick={handleClearSelection}
              className="w-10 h-10 rounded-xl glass hover:bg-white/10 flex items-center justify-center text-theme-text cursor-pointer"
              title="Cancel Selection"
            >
              <X size={18} />
            </button>
            <span className="text-white font-bold text-lg">
              {selectedMessageIds.size} Selected
            </span>
          </div>

          <div className="flex items-center space-x-3 animate-fade-in">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg border border-theme-border hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold text-theme-text cursor-pointer transition-all"
            >
              Select All
            </button>
            <button
              onClick={handleCopySelected}
              className="w-10 h-10 rounded-xl glass hover:bg-white/10 flex items-center justify-center text-theme-text cursor-pointer"
              title="Copy text of selected messages"
            >
              <Copy size={18} />
            </button>
            {chat.messages.some((m) => selectedMessageIds.has(m.id) && m.authorId === currentUser.username) && (
              <button
                onClick={handleDeleteSelected}
                className="w-10 h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-400 cursor-pointer"
                title="Delete your selected messages"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </header>
      ) : (
        <header className="h-[80px] px-8 flex items-center justify-between glass border-b border-theme-border shrink-0 z-10 sticky top-0 transition-colors">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={onBack || onToggleSidebar}
              className="md:hidden w-10 h-10 rounded-xl glass flex items-center justify-center text-theme-text hover:bg-white/10 transition-colors -ml-4 mr-2 cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            
            <div 
              onClick={() => {
                if (chat.peer.isGroup) {
                  onShowGroupSettings?.(chat.peer);
                } else {
                  onViewProfile?.(chat.peer);
                }
              }}
              className="flex items-center space-x-4 cursor-pointer group"
            >
              <div className="relative hidden sm:block">
                <Avatar user={chat.peer} className="w-10 h-10 transition-transform group-hover:scale-105" />
                {(chat.peer.status === 'online' || chat.isTyping) && ( 
                   <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0B0E14] rounded-full" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-white truncate max-w-[200px] group-hover:text-indigo-300 transition-colors">
                    {chat.peer.displayName}
                  </h2>
                  {currentUser.mutedUsers?.includes(chat.peer.username) && (
                    <span title="Muted"><VolumeX size={14} className="text-theme-muted" /></span>
                  )}
                  {currentUser.blockedUsers?.includes(chat.peer.username) && (
                    <span title="Blocked"><Ban size={14} className="text-rose-400" /></span>
                  )}
                </div>
                <div className="flex items-center text-xs font-medium mt-0.5">
                  {chat.peer.status === 'online' || chat.isTyping ? (
                    <>
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-green-400">{chat.isTyping ? 'Typing...' : 'Online'}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full mr-2"></div>
                      <span className="text-theme-muted">{formatLastActive(chat.peer.lastActive)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 relative">
            <div className="flex space-x-2 relative" ref={menuRef}>
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  setShowPins(false);
                  focusComposer();
                }}
                className={`w-10 h-10 rounded-xl glass flex items-center justify-center cursor-pointer hover:bg-white/10 text-theme-text transition-all ${
                  showSearch ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : ''
                }`}
                title="Search Messages"
              >
                <Search size={18} />
              </button>

              <button
                onClick={() => {
                  setShowPins(!showPins);
                  setShowSearch(false);
                  focusComposer();
                }}
                className={`w-10 h-10 rounded-xl glass flex items-center justify-center cursor-pointer hover:bg-white/10 text-theme-text transition-all ${
                  showPins ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : ''
                }`}
                title="Pinned Messages"
              >
                <Pin size={18} className={showPins ? "fill-indigo-400/25" : ""} />
              </button>

              <button
                onClick={() => {
                  setSelectionModeEnabled(true);
                  focusComposer();
                }}
                className="w-10 h-10 rounded-xl glass flex items-center justify-center cursor-pointer hover:bg-white/10 text-theme-text"
                title="Select Messages"
              >
                <CheckSquare size={18} />
              </button>

              <button
                onClick={() => {
                  setShowMenu(!showMenu);
                  focusComposer();
                }}
                className="w-10 h-10 rounded-xl glass flex items-center justify-center cursor-pointer hover:bg-white/10 text-theme-text"
              >
                <MoreVertical size={18} />
              </button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-theme-panel rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 border border-theme-border"
                  >
                    <button
                      onClick={() => {
                        setShowWallpaperModal(true);
                        setShowMenu(false);
                        focusComposer();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-theme-text hover:text-white text-sm text-left transition-colors cursor-pointer"
                    >
                      <Palette size={16} className="text-indigo-400 opacity-80" />
                      <span>Change Wallpaper</span>
                    </button>

                    <button
                      onClick={() => {
                        handleDownloadChat();
                        focusComposer();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-theme-text hover:text-white text-sm text-left transition-colors cursor-pointer"
                    >
                      <Download size={16} className="opacity-80" />
                      <span>Download Chat (.txt)</span>
                    </button>
                    <button
                      onClick={() => {
                        onToggleMute?.(chat.peer.username);
                        setShowMenu(false);
                        focusComposer();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-theme-text hover:text-white text-sm text-left transition-colors cursor-pointer"
                    >
                      {currentUser.mutedUsers?.includes(chat.peer.username) ? (
                        <>
                          <Volume2 size={16} className="text-green-400 opacity-80" />
                          <span>Unmute User</span>
                        </>
                      ) : (
                        <>
                          <VolumeX size={16} className="text-theme-muted opacity-80" />
                          <span>Mute User</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onToggleBlock?.(chat.peer.username);
                        setShowMenu(false);
                        focusComposer();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-theme-text hover:text-rose-400 text-sm text-left transition-colors cursor-pointer border-t border-theme-border mt-1 pt-2.5"
                    >
                      {currentUser.blockedUsers?.includes(chat.peer.username) ? (
                        <>
                          <ShieldAlert size={16} className="text-rose-400" />
                          <span>Unblock User</span>
                        </>
                      ) : (
                        <>
                          <Ban size={16} className="text-rose-400" />
                          <span>Block User</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Left Side: Messages list & Composer */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-8 flex flex-col gap-2 relative z-0 scrollbar-hide"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {chat.messages.map((message, index) => {
                const prevMessage = index > 0 ? chat.messages[index - 1] : null;
                const nextMessage = index < chat.messages.length - 1 ? chat.messages[index + 1] : null;

                const isGroupedWithPrevious = !!(
                  prevMessage &&
                  prevMessage.authorId === message.authorId &&
                  (message.createdAt - prevMessage.createdAt) < 60000
                );

                const isGroupedWithNext = !!(
                  nextMessage &&
                  nextMessage.authorId === message.authorId &&
                  (nextMessage.createdAt - message.createdAt) < 60000
                );

                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isMine={message.authorId === currentUser.id}
                    peer={chat.peer}
                    onDelete={onDeleteMessage ? () => {
                      onDeleteMessage(chat.id, message.id);
                      focusComposer();
                    } : undefined}
                    onEdit={onEditMessage ? (messageId, text) => onEditMessage(chat.id, messageId, text) : undefined}
                    onEditEnd={() => {
                      focusComposer();
                    }}
                    onViewProfile={onViewProfile}
                    onReact={(reaction) => onReact?.(message.id, reaction)}
                    currentUser={currentUser}
                    theme={theme}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedMessageIds.has(message.id)}
                    onToggleSelect={() => handleToggleSelect(message.id)}
                    onReply={() => {
                      setReplyToMessage(message);
                      focusComposer();
                    }}
                    isGroupedWithPrevious={isGroupedWithPrevious}
                    isGroupedWithNext={isGroupedWithNext}
                    isHighlighted={message.id === highlightedMessageId}
                    onPin={onTogglePin ? () => {
                      onTogglePin(chat.id, message.id);
                      focusComposer();
                    } : undefined}
                    onShowAlert={onShowAlert}
                  />
                );
              })}
              {chat.isTyping && <TypingIndicator key="typing" name={chat.peer.displayName.split(' ')[0]} />}
            </AnimatePresence>
            
            {/* Spacer to prevent scroll issues */}
            <div className="h-2 w-full shrink-0" />
          </div>

          {/* Composer or Block Banner */}
          {currentUser.blockedUsers?.includes(chat.peer.username) ? (
            <div className="h-[80px] px-8 py-4 flex items-center justify-center bg-transparent shrink-0">
              <div className="w-full h-full glass border border-rose-500/20 bg-rose-500/5 rounded-2xl flex items-center justify-center gap-3 text-rose-400 font-medium text-sm">
                <Ban size={16} />
                <span>You have blocked this user. Unblock them to send messages.</span>
              </div>
            </div>
          ) : (
            <ChatComposer
              inputRef={composerInputRef}
              onSend={(text, gifUrl, mediaUrl, mediaType, mediaSize, embeds) => {
                onSend(text, gifUrl, mediaUrl, mediaType, mediaSize, embeds, replyToMessage?.id);
                setReplyToMessage(null);
              }}
              replyToMessage={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
              mentionableUsers={mentionableUsers}
              onShowAlert={onShowAlert}
            />
          )}
        </div>

        {/* Right Side Search Panel */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute lg:relative inset-y-0 right-0 z-20 w-full sm:w-[350px] lg:w-[380px] shrink-0 border-l border-theme-border bg-theme-panel h-full flex flex-col shadow-2xl animate-fade-in"
            >
              {/* Search Header */}
              <div className="h-[80px] px-6 border-b border-theme-border flex items-center justify-between shrink-0">
                <h3 className="font-bold text-lg text-theme-text flex items-center gap-2">
                  <Search size={18} className="text-indigo-400" />
                  <span>Search Messages</span>
                </h3>
                <button
                  onClick={() => setShowSearch(false)}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center text-theme-muted hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Input Area */}
              <div className="p-4 border-b border-theme-border shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in this conversation..."
                    className="w-full bg-theme-bg text-theme-text text-sm rounded-xl py-2.5 pl-10 pr-10 border border-theme-border focus:border-indigo-500/50 focus:outline-none transition-colors placeholder-theme-muted"
                    autoFocus
                  />
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-white cursor-pointer transition-colors p-0.5 rounded"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {searchQuery.trim() && (
                  <div className="text-xs font-semibold text-theme-muted mt-2 px-1">
                    {(() => {
                      const searchResults = searchQuery.trim()
                        ? chat.messages.filter((m) => {
                            const textMatch = m.text?.toLowerCase().includes(searchQuery.toLowerCase());
                            const authorMatch = m.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                m.authorId?.toLowerCase().includes(searchQuery.toLowerCase());
                            return textMatch || authorMatch;
                          })
                        : [];
                      return `${searchResults.length} ${searchResults.length === 1 ? 'result' : 'results'} found`;
                    })()}
                  </div>
                )}
              </div>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide">
                {!searchQuery.trim() ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
                      <Search size={24} />
                    </div>
                    <h4 className="font-bold text-theme-text mb-1">Search Messages</h4>
                    <p className="text-xs text-theme-muted max-w-[220px] leading-relaxed">
                      Search for keywords or phrases to instantly locate messages in this conversation.
                    </p>
                  </div>
                ) : (() => {
                  const searchResults = chat.messages.filter((m) => {
                    const textMatch = m.text?.toLowerCase().includes(searchQuery.toLowerCase());
                    const authorMatch = m.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        m.authorId?.toLowerCase().includes(searchQuery.toLowerCase());
                    return textMatch || authorMatch;
                  });

                  if (searchResults.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-slate-500/5 border border-slate-500/10 flex items-center justify-center text-theme-muted mb-4">
                          <Search size={24} />
                        </div>
                        <h4 className="font-bold text-theme-text mb-1">No Results</h4>
                        <p className="text-xs text-theme-muted max-w-[220px] leading-relaxed">
                          We couldn't find any messages matching "{searchQuery}" in this chat.
                        </p>
                      </div>
                    );
                  }

                  return searchResults.map((message) => {
                    const isMessageAuthorMe = message.authorId === currentUser.username;
                    const displayAuthor = isMessageAuthorMe ? currentUser : chat.peer;
                    const dateFormatted = new Date(message.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={message.id}
                        onClick={() => handleScrollToMessage(message.id)}
                        className="p-3 rounded-xl border border-theme-border bg-theme-card/50 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all cursor-pointer group text-left relative flex shrink-0 gap-3 overflow-hidden select-none"
                      >
                        <Avatar user={displayAuthor} className="w-8 h-8 shrink-0 rounded-full" />
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-theme-text truncate group-hover:text-indigo-400 transition-colors">
                              {displayAuthor.displayName}
                            </span>
                            <span className="text-[10px] text-theme-muted shrink-0 font-medium">
                              {dateFormatted}
                            </span>
                          </div>
                          <p className="text-xs text-theme-text/90 leading-relaxed break-words whitespace-pre-wrap select-text">
                            {message.text ? (
                              <HighlightText text={message.text} query={searchQuery} />
                            ) : message.gifUrl ? (
                              <span className="italic text-indigo-400">[GIF]</span>
                            ) : (
                              <span className="italic text-indigo-400">[Attachment]</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Side Pinned Messages Panel */}
        <AnimatePresence>
          {showPins && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute lg:relative inset-y-0 right-0 z-20 w-full sm:w-[350px] lg:w-[380px] shrink-0 border-l border-theme-border bg-theme-panel h-full flex flex-col shadow-2xl animate-fade-in"
            >
              {/* Header */}
              <div className="h-[80px] px-6 border-b border-theme-border flex items-center justify-between shrink-0">
                <h3 className="font-bold text-lg text-theme-text flex items-center gap-2">
                  <Pin size={18} className="text-indigo-400 fill-indigo-400/20" />
                  <span>Pinned Messages</span>
                </h3>
                <button
                  onClick={() => setShowPins(false)}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center text-theme-muted hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Pins list */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide">
                {(() => {
                  const pinnedMessages = chat.messages.filter((m) => m.pinned);

                  if (pinnedMessages.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
                          <Pin size={24} className="fill-indigo-400/20" />
                        </div>
                        <h4 className="font-bold text-theme-text mb-1">No Pinned Messages</h4>
                        <p className="text-xs text-theme-muted max-w-[220px] leading-relaxed">
                          Hover over any message in the chat and click the Pin button to save key references here.
                        </p>
                      </div>
                    );
                  }

                  return pinnedMessages.map((message) => {
                    const isMessageAuthorMe = message.authorId === currentUser.username;
                    const displayAuthor = isMessageAuthorMe ? currentUser : chat.peer;
                    const dateFormatted = new Date(message.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={message.id}
                        onClick={() => handleScrollToMessage(message.id)}
                        className="p-3 rounded-xl border border-theme-border bg-theme-card/50 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all cursor-pointer group text-left relative flex shrink-0 gap-3 overflow-hidden select-none"
                      >
                        <Avatar user={displayAuthor} className="w-8 h-8 shrink-0 rounded-full" />
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5 pr-6">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-theme-text truncate group-hover:text-indigo-400 transition-colors">
                              {displayAuthor.displayName}
                            </span>
                            <span className="text-[10px] text-theme-muted shrink-0 font-medium">
                              {dateFormatted}
                            </span>
                          </div>
                          <p className="text-xs text-theme-text/90 leading-relaxed break-words whitespace-pre-wrap select-text">
                            {message.text ? (
                              <span>{message.text}</span>
                            ) : message.gifUrl ? (
                              <span className="italic text-indigo-400">[GIF]</span>
                            ) : (
                              <span className="italic text-indigo-400">[Attachment]</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin?.(chat.id, message.id);
                          }}
                          className={`absolute right-3 top-3 text-theme-muted hover:text-rose-400 p-1 hover:bg-white/5 rounded-lg transition-all duration-150 cursor-pointer ${
                            isTouchDevice ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Unpin message"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Wallpaper Selection Modal */}
      {createPortal(
        <AnimatePresence>
          {showWallpaperModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-theme-text">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-md bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left font-sans"
              >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-theme-border">
                <h3 className="font-bold text-base text-theme-text flex items-center gap-2">
                  <Palette size={16} className="text-indigo-400" />
                  <span>Customize Chat Wallpaper</span>
                </h3>
                <button
                  onClick={() => setShowWallpaperModal(false)}
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
                          console.log('Solid color clicked:', wp.id);
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
                          console.log('Gradient backdrop clicked:', wp.id);
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
                  onClick={() => setShowWallpaperModal(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/10 uppercase tracking-wider"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
}

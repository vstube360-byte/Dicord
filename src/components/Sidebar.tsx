import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Search, LogOut, Settings, Plus, VolumeX, Ban, Users, ChevronDown, UserPlus, Trash2 } from 'lucide-react';
import { ChatSession, User } from '../types';
import { Avatar } from './Avatar';

interface SavedAccount {
  username: string;
  displayName: string;
  avatar: string;
  token: string;
}

interface SidebarProps {
  currentUser: User;
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onLogout: () => void;
  onSettings: () => void;
  onNewChat: (username: string) => void;
  onViewProfile?: (user: User) => void;
  onShowCreateGroup: () => void;
  savedAccounts: SavedAccount[];
  onSwitchAccount: (token: string) => void;
  onAddAccount: () => void;
  onRemoveAccount: (username: string) => void;
}

export function Sidebar({
  currentUser,
  chats,
  activeChatId,
  onSelectChat,
  onLogout,
  onSettings,
  onNewChat,
  onViewProfile,
  onShowCreateGroup,
  savedAccounts,
  onSwitchAccount,
  onAddAccount,
  onRemoveAccount
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    if (showAccountMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountMenu]);

  const filteredChats = chats.filter((chat) => {
    const hasInteracted = chat.messages.length > 0 || chat.id === activeChatId;
    if (!searchQuery.trim()) {
      return hasInteracted;
    }
    const query = searchQuery.toLowerCase();
    if (hasInteracted) {
      return (
        chat.peer.displayName.toLowerCase().includes(query) ||
        chat.peer.username.toLowerCase().includes(query)
      );
    } else {
      return chat.peer.username.toLowerCase().includes(query);
    }
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onNewChat(searchQuery.trim());
      setSearchQuery('');
    }
  };

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] h-full glass border-r border-theme-border flex flex-col relative z-20">
      <div className="p-6 flex items-center justify-between relative" ref={accountMenuRef}>
        <div className="flex items-center gap-3 cursor-pointer group select-none" onClick={() => setShowAccountMenu(!showAccountMenu)}>
          <div className="relative">
            <Avatar user={currentUser} className="w-10 h-10 transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <ChevronDown size={14} className="text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent truncate max-w-[130px]">{currentUser.displayName}</h1>
              <ChevronDown size={14} className="text-theme-muted group-hover:text-theme-text transition-transform duration-200 mt-0.5 shrink-0" />
            </div>
            <p className="text-xs text-theme-muted font-medium tracking-wide uppercase truncate max-w-[150px]">@{currentUser.username}</p>
          </div>
        </div>

        {showAccountMenu && (
          <div className="absolute top-[76px] left-6 w-[320px] bg-theme-card border border-theme-border rounded-2xl shadow-2xl z-50 p-3 animate-fade-in font-sans">
            {/* Header */}
            <div className="px-2 py-1.5 mb-2 border-b border-theme-border pb-2">
              <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Switch Accounts</p>
            </div>
            
            {/* List of accounts */}
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {savedAccounts.map((acc) => {
                const isActive = acc.username === currentUser.username;
                return (
                  <div 
                    key={acc.username}
                    className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                      isActive ? 'bg-indigo-500/10 text-theme-text' : 'hover:bg-theme-bg/10 text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (!isActive) {
                          onSwitchAccount(acc.token);
                        }
                        setShowAccountMenu(false);
                      }}
                      className="flex items-center gap-3 flex-1 text-left cursor-pointer select-none border-none bg-transparent p-0 outline-none"
                    >
                      <div className="relative shrink-0">
                        <Avatar 
                          user={{ username: acc.username, displayName: acc.displayName, avatar: acc.avatar }} 
                          className="w-9 h-9" 
                        />
                        {isActive && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-theme-card rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate leading-tight">{acc.displayName}</p>
                        <p className="text-xs opacity-70 truncate">@{acc.username}</p>
                      </div>
                    </button>
                    
                    {/* Remove account button */}
                    {!isActive && (
                      <button
                        onClick={() => onRemoveAccount(acc.username)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer border-none bg-transparent outline-none shrink-0"
                        title="Remove Account"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-theme-border my-2" />

            {/* Action Items */}
            <button
              onClick={() => {
                onAddAccount();
                setShowAccountMenu(false);
              }}
              className="w-full flex items-center gap-3 p-2.5 text-sm font-semibold text-indigo-405 dark:text-indigo-400 hover:bg-theme-bg/10 rounded-xl transition-colors cursor-pointer text-left border-none bg-transparent outline-none"
            >
              <UserPlus size={16} />
              <span>Add Existing Account</span>
            </button>


          </div>
        )}
        <div className="flex items-center space-x-2">
          <button
            onClick={onShowCreateGroup}
            className="w-8 h-8 rounded-full glass flex items-center justify-center cursor-pointer hover:bg-theme-bg/10 transition-colors text-theme-text"
            title="Create Group Chat"
          >
            <Users size={16} />
          </button>
          <button
            onClick={onSettings}
            className="w-8 h-8 rounded-full glass flex items-center justify-center cursor-pointer hover:bg-theme-bg/10 transition-colors text-theme-text"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-full glass flex items-center justify-center cursor-pointer hover:bg-theme-bg/10 transition-colors text-theme-text hover:text-rose-455"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 mb-2 mt-2">
        <div className="flex items-center glass rounded-xl px-4 py-2 text-sm text-theme-muted focus-within:border-indigo-500/50 border border-transparent transition-colors">
          <Search size={16} className="mr-2 opacity-70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search or new chat..."
            className="bg-transparent border-none outline-none flex-1 text-theme-text placeholder:text-theme-muted w-full"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide pb-4">
        {searchQuery && !filteredChats.length && (
          <div className="px-6 py-4">
            <button 
              onClick={() => {
                onNewChat(searchQuery.trim());
                setSearchQuery('');
              }}
              className="w-full flex items-center justify-center space-x-2 glass hover:bg-theme-bg/10 text-indigo-505 dark:text-indigo-400 font-medium py-3 rounded-xl transition-colors"
            >
              <Plus size={18} />
              <span>Start chat with "{searchQuery}"</span>
            </button>
          </div>
        )}

        {filteredChats.length === 0 && !searchQuery && (
          <div className="px-8 py-10 text-center">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mx-auto mb-4 text-theme-muted">
               <Search size={24} />
            </div>
            <p className="text-theme-muted text-sm">Search for a username above to start a conversation.</p>
          </div>
        )}

        {filteredChats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const lastMsg = chat.messages[chat.messages.length - 1];
          const isMe = lastMsg?.authorId === currentUser.id;

          const timeString = lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          }) : '';

          return (
            <motion.button
              key={chat.id}
              layout="position"
              onClick={() => onSelectChat(chat.id)}
              className={`w-full flex items-center space-x-4 p-4 transition-colors cursor-pointer text-left ${
                isActive
                  ? 'sidebar-active'
                  : 'hover:bg-theme-bg/10'
              }`}
            >
              <div 
                className="relative shrink-0 cursor-pointer hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile?.(chat.peer);
                }}
              >
                <Avatar user={chat.peer} className="w-12 h-12" />
                {!chat.peer.isGroup && (chat.peer.status === 'online' || chat.isTyping) && ( 
                   <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-theme-bg rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {chat.peer.isGroup && (
                      <Users size={14} className="text-indigo-400 shrink-0" />
                    )}
                    <span className="font-semibold text-theme-text truncate">
                      {chat.peer.displayName}
                    </span>
                    {currentUser.mutedUsers?.includes(chat.peer.username) && (
                      <VolumeX size={12} className="text-theme-muted shrink-0" />
                    )}
                    {currentUser.blockedUsers?.includes(chat.peer.username) && (
                      <Ban size={12} className="text-rose-500/80 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-theme-muted uppercase font-medium shrink-0 ml-2">
                    {timeString || 'New'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate font-medium ${chat.isTyping ? 'text-indigo-300' : 'text-theme-muted'}`}>
                    {chat.isTyping ? (
                      typeof chat.isTyping === 'string' ? `${chat.isTyping} is typing...` : 'Typing...'
                    ) : (
                      <>
                        {isMe ? 'You: ' : (chat.peer.isGroup && lastMsg ? `${lastMsg.authorName || lastMsg.authorId}: ` : '')}
                        {lastMsg ? lastMsg.text || 'GIF' : 'No messages yet'}
                      </>
                    )}
                  </p>
                  {chat.unreadCount > 0 && (
                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, LogOut, Settings, Plus, VolumeX, Ban } from 'lucide-react';
import { ChatSession, User } from '../types';
import { Avatar } from './Avatar';

interface SidebarProps {
  currentUser: User;
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onLogout: () => void;
  onSettings: () => void;
  onNewChat: (username: string) => void;
  onViewProfile?: (user: User) => void;
}

export function Sidebar({ currentUser, chats, activeChatId, onSelectChat, onLogout, onSettings, onNewChat, onViewProfile }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onSettings}>
          <div className="relative">
            <Avatar user={currentUser} className="w-10 h-10 transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Settings size={14} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent truncate max-w-[150px]">{currentUser.displayName}</h1>
            <p className="text-xs text-theme-muted font-medium tracking-wide uppercase truncate max-w-[150px]">@{currentUser.username}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
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
                {(chat.peer.status === 'online' || chat.isTyping) && ( 
                   <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-theme-bg rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
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
                      'Typing...'
                    ) : (
                      <>
                        {isMe ? 'You: ' : ''}
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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Users, X, Camera } from 'lucide-react';
import { Avatar } from '../Avatar';
import { User, ChatSession } from '../../types';

interface GroupSettingsModalProps {
  isOpen: boolean;
  group: User;
  onClose: () => void;
  currentUser: User;
  chats: ChatSession[];
  onUpdateGroupMetadata: (groupId: string, name?: string, avatar?: string) => Promise<void>;
  onAddGroupMembers: (groupId: string, usernames: string[]) => Promise<void>;
  onRemoveGroupMember: (groupId: string, username: string) => Promise<void>;
  onLeaveGroup: (groupId: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}

export function GroupSettingsModal({
  isOpen,
  group,
  onClose,
  currentUser,
  chats,
  onUpdateGroupMetadata,
  onAddGroupMembers,
  onRemoveGroupMember,
  onLeaveGroup,
  onDeleteGroup,
}: GroupSettingsModalProps) {
  const [name, setName] = useState(group.displayName);
  const [avatar, setAvatar] = useState(group.avatar || '');
  const [search, setSearch] = useState('');
  const groupIconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(group.displayName);
    setAvatar(group.avatar || '');
    setSearch('');
  }, [group.username, group.displayName, group.avatar]);

  const handleGroupIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSaveSettings = async () => {
    await onUpdateGroupMetadata(group.username, name.trim(), avatar);
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

  const availableToAdd = useMemo(() => {
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser?.username && !group.participants?.includes(chat.peer.username) && chat.messages.length > 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser, group]);

  const otherToAdd = useMemo(() => {
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser?.username && !group.participants?.includes(chat.peer.username) && chat.messages.length === 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser, group]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans select-none"
    >
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
            onClick={onClose}
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
              <Avatar user={{ displayName: name, avatar: avatar, username: group.username, isGroup: true }} className="w-16 h-16 rounded-[30%] border border-white/10" />
              <div className="absolute inset-0 bg-black/65 rounded-[30%] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
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
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full bg-black/20 border border-theme-border rounded-xl px-4 py-2 text-sm text-theme-text focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
              
              {(name.trim() !== group.displayName || avatar !== group.avatar) && (
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={!name.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Members list section */}
          <div>
            <h4 className="text-[10px] text-theme-muted uppercase font-bold tracking-wider mb-2">Members ({group.participants?.length})</h4>
            <div className="max-h-[140px] overflow-y-auto border border-theme-border rounded-xl p-2 bg-black/10 flex flex-col gap-1.5 scrollbar-hide">
              {getGroupMembers(group.participants || []).map(member => {
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
                        onClick={() => onRemoveGroupMember(group.username, member.username)}
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
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users to add..."
                className="w-full bg-black/20 border border-theme-border rounded-xl px-4 py-2 text-xs text-theme-text focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              
              <div className="max-h-[140px] overflow-y-auto border border-theme-border rounded-xl p-2 bg-black/10 flex flex-col gap-1.5 scrollbar-hide">
                {(() => {
                  const query = search.toLowerCase().trim();
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
                            onClick={() => onAddGroupMembers(group.username, [user.username])}
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
                                onClick={() => onAddGroupMembers(group.username, [user.username])}
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
            onClick={() => onLeaveGroup(group.username)}
            className="px-4 py-2 rounded-xl border border-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-black font-bold text-xs transition-all cursor-pointer uppercase tracking-wider"
          >
            Leave Group
          </button>
          
          <button
            type="button"
            onClick={() => onDeleteGroup(group.username)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer uppercase tracking-wider"
          >
            Delete Group
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Users, Plus } from 'lucide-react';
import { Avatar } from '../Avatar';
import { User, ChatSession } from '../../types';
import { createGroup, fetchConversation } from '../../lib/api';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  currentUser: User;
  chats: ChatSession[];
  openChat: (peer: User) => Promise<void>;
  loadChats: (token: string) => Promise<void>;
  showAlert: (title: string, message: string) => void;
}

export function CreateGroupModal({
  isOpen,
  onClose,
  token,
  currentUser,
  chats,
  openChat,
  loadChats,
  showAlert,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute active invitees and other registered users
  const activeInvitees = useMemo(() => {
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser.username && chat.messages.length > 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser]);

  const otherRegisteredUsers = useMemo(() => {
    const peersMap = new Map<string, User>();
    chats.forEach(chat => {
      if (chat.peer && !chat.peer.isGroup && chat.peer.username !== currentUser.username && chat.messages.length === 0) {
        peersMap.set(chat.peer.username, chat.peer);
      }
    });
    return Array.from(peersMap.values());
  }, [chats, currentUser]);

  const filteredActiveInvitees = useMemo(() => {
    return activeInvitees.filter(u => 
      u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
      u.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  }, [activeInvitees, memberSearchQuery]);

  const filteredOtherUsers = useMemo(() => {
    if (!memberSearchQuery) return [];
    return otherRegisteredUsers.filter(u => 
      u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
      u.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  }, [otherRegisteredUsers, memberSearchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !groupName.trim() || selectedUsers.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await createGroup(token, groupName.trim(), selectedUsers);
      setGroupName('');
      setSelectedUsers([]);
      setMemberSearchQuery('');
      onClose();
      await loadChats(token);
      
      if (res && res.groupId) {
        try {
          const conversation = await fetchConversation(token, res.groupId);
          await openChat(conversation.peer);
        } catch (fetchErr) {
          console.error(fetchErr);
        }
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedUsers([]);
    setMemberSearchQuery('');
    onClose();
  };

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
        className="w-full max-w-md bg-theme-panel border border-theme-border rounded-[24px] shadow-2xl p-6 relative flex flex-col gap-4 text-left text-theme-text"
      >
        <div className="flex items-center gap-3 text-indigo-400 font-bold text-lg">
          <Users size={20} />
          <span>Create Group Chat</span>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                      }`}>
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
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-theme-bg border border-theme-border hover:bg-white/5 transition-colors cursor-pointer text-theme-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!groupName.trim() || selectedUsers.length === 0 || isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/10 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

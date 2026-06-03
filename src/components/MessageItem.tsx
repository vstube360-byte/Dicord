import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, User } from '../types';
import { 
  Trash2, 
  FileText, 
  Download, 
  Play, 
  Image as ImageIcon, 
  FileCode, 
  FileSpreadsheet, 
  FileArchive, 
  FileType,
  Check,
  Reply,
  Pin,
  Pencil,
  Copy
} from 'lucide-react';
import { Avatar } from './Avatar';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileConfig(url: string, mediaType: string) {
  const filename = url.split('/').pop() || '';
  // Strip timestamp and random bytes prefixes from local uploaded file ID
  const cleanName = filename.includes('-') 
    ? filename.split('-').slice(2).join('-') 
    : filename;
  const extension = cleanName.split('.').pop()?.split('?')[0].toLowerCase() || '';
  
  if (mediaType === 'image') {
    return {
      icon: <ImageIcon size={20} />,
      gradient: 'from-pink-500 to-rose-500',
      label: 'Image',
      name: cleanName
    };
  }
  if (mediaType === 'video') {
    return {
      icon: <Play size={20} className="fill-white" />,
      gradient: 'from-violet-500 to-indigo-500',
      label: 'Video',
      name: cleanName
    };
  }
  
  switch (extension) {
    case 'pdf':
      return {
        icon: <FileType size={20} />,
        gradient: 'from-rose-500 to-red-600',
        label: 'PDF Document',
        name: cleanName
      };
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return {
        icon: <FileArchive size={20} />,
        gradient: 'from-amber-500 to-orange-600',
        label: 'Archive',
        name: cleanName
      };
    case 'doc':
    case 'docx':
      return {
        icon: <FileText size={20} />,
        gradient: 'from-blue-500 to-indigo-600',
        label: 'Word Document',
        name: cleanName
      };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return {
        icon: <FileSpreadsheet size={20} />,
        gradient: 'from-emerald-500 to-green-600',
        label: 'Spreadsheet',
        name: cleanName
      };
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'html':
    case 'css':
    case 'json':
    case 'py':
    case 'cpp':
    case 'c':
    case 'java':
      return {
        icon: <FileCode size={20} />,
        gradient: 'from-teal-500 to-cyan-600',
        label: 'Source Code',
        name: cleanName
      };
    default:
      return {
        icon: <FileText size={20} />,
        gradient: 'from-slate-500 to-slate-600',
        label: 'Document',
        name: cleanName
      };
  }
}

function parseMarkdown(
  text: string, 
  currentUsername?: string, 
  onViewMention?: (username: string) => void,
  isBubbleMine?: boolean,
  theme?: string
): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-black/35 rounded-lg p-3 font-mono text-[11px] my-1 overflow-x-auto border border-theme-border/50 text-left text-slate-100 lg:select-text select-none">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBlockContent = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteText = line.slice(2);
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-slate-500/40 pl-3 italic text-theme-muted my-1 text-left lg:select-text select-none">
          {parseInlineMarkdown(quoteText, currentUsername, onViewMention, isBubbleMine, theme)}
        </blockquote>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1.5 mb-1 text-left leading-normal lg:select-text select-none text-white">
          {parseInlineMarkdown(line.slice(2), currentUsername, onViewMention, isBubbleMine, theme)}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold tracking-tight mt-1 mb-0.5 text-left leading-normal lg:select-text select-none text-white">
          {parseInlineMarkdown(line.slice(3), currentUsername, onViewMention, isBubbleMine, theme)}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base sm:text-lg font-bold mt-1 text-left leading-normal lg:select-text select-none text-white">
          {parseInlineMarkdown(line.slice(4), currentUsername, onViewMention, isBubbleMine, theme)}
        </h3>
      );
      continue;
    }

    elements.push(
      <div key={`line-${i}`} className="min-h-[1.2rem] lg:select-text select-none">
        {parseInlineMarkdown(line, currentUsername, onViewMention, isBubbleMine, theme)}
      </div>
    );
  }

  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="code-unclosed" className="bg-black/35 rounded-lg p-3 font-mono text-[11px] my-1 overflow-x-auto border border-theme-border/50 text-left text-slate-100 lg:select-text select-none">
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    );
  }

  return <>{elements}</>;
}

function parseInlineMarkdown(
  text: string, 
  currentUsername?: string, 
  onViewMention?: (username: string) => void,
  isBubbleMine?: boolean,
  theme?: string
): React.ReactNode {
  if (!text) return '';

  let parts: { type: 'text' | 'code' | 'bold' | 'italic' | 'bold_italic' | 'strike' | 'mention'; text: string }[] = [
    { type: 'text', text }
  ];

  // 1. Parse inline code: `code`
  parts = parts.flatMap((part) => {
    if (part.type !== 'text') return part;
    const regex = /`([^`]+)`/g;
    const subParts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      if (match.index > lastIndex) {
        subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex, match.index) });
      }
      subParts.push({ type: 'code' as const, text: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < part.text.length) {
      subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex) });
    }
    return subParts;
  });

  // 2. Parse bold italic: ***text***
  parts = parts.flatMap((part) => {
    if (part.type !== 'text') return part;
    const regex = /\*\*\*([^*]+)\*\*\*/g;
    const subParts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      if (match.index > lastIndex) {
        subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex, match.index) });
      }
      subParts.push({ type: 'bold_italic' as const, text: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < part.text.length) {
      subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex) });
    }
    return subParts;
  });

  // 3. Parse bold: **text**
  parts = parts.flatMap((part) => {
    if (part.type !== 'text') return part;
    const regex = /\*\*([^*]+)\*\*/g;
    const subParts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      if (match.index > lastIndex) {
        subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex, match.index) });
      }
      subParts.push({ type: 'bold' as const, text: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < part.text.length) {
      subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex) });
    }
    return subParts;
  });

  // 4. Parse italic: *text* or _text_
  parts = parts.flatMap((part) => {
    if (part.type !== 'text') return part;
    const regex = /(\*|_)([^*_]+)\1/g;
    const subParts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      if (match.index > lastIndex) {
        subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex, match.index) });
      }
      subParts.push({ type: 'italic' as const, text: match[2] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < part.text.length) {
      subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex) });
    }
    return subParts;
  });

  // 5. Parse strikethrough: ~~text~~
  parts = parts.flatMap((part) => {
    if (part.type !== 'text') return part;
    const regex = /~~([^~]+)~~/g;
    const subParts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      if (match.index > lastIndex) {
        subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex, match.index) });
      }
      subParts.push({ type: 'strike' as const, text: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < part.text.length) {
      subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex) });
    }
    return subParts;
  });

  // 6. Parse mentions: @username
  parts = parts.flatMap((part) => {
    if (part.type !== 'text') return part;
    const regex = /@([a-zA-Z0-9_.-]+)/g;
    const subParts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      if (match.index > lastIndex) {
        subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex, match.index) });
      }
      subParts.push({ type: 'mention' as const, text: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < part.text.length) {
      subParts.push({ type: 'text' as const, text: part.text.substring(lastIndex) });
    }
    return subParts;
  });

  return (
    <>
      {parts.map((part, idx) => {
        switch (part.type) {
          case 'code':
            return (
              <code key={idx} className="bg-black/25 px-1.5 py-0.5 rounded font-mono text-[11px] border border-theme-border/50 text-indigo-200">
                {part.text}
              </code>
            );
          case 'bold_italic':
            return <strong key={idx}><em>{part.text}</em></strong>;
          case 'bold':
            return <strong key={idx} className="font-extrabold">{part.text}</strong>;
          case 'italic':
            return <em key={idx}>{part.text}</em>;
          case 'strike':
            return <del key={idx} className="line-through opacity-75">{part.text}</del>;
          case 'mention':
            const isMe = currentUsername && part.text.toLowerCase() === currentUsername.toLowerCase();
            const isLight = theme === 'light';
            
            let pillClass = '';
            if (isBubbleMine) {
              pillClass = isMe 
                ? 'bg-amber-400/20 hover:bg-amber-400/35 border-amber-400/30 text-amber-200' 
                : 'bg-indigo-300/20 hover:bg-indigo-300/35 border-indigo-300/30 text-indigo-100';
            } else {
              if (isLight) {
                pillClass = isMe
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-900 shadow-[0_0_8px_rgba(245,158,11,0.05)]'
                  : 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/40 text-indigo-900';
              } else {
                pillClass = isMe
                  ? 'bg-amber-400/15 hover:bg-amber-400/30 border-amber-400/30 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.05)]'
                  : 'bg-indigo-400/15 hover:bg-indigo-400/30 border-indigo-400/30 text-indigo-200';
              }
            }
            
            return (
              <span 
                key={idx} 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewMention?.(part.text);
                }}
                className={`inline-block px-1.5 py-0.5 rounded cursor-pointer font-bold transition-all duration-150 border select-none ${pillClass} ${isMe && !isBubbleMine ? 'animate-pulse' : ''}`}
                title={`Click to view profile of @${part.text}`}
              >
                @{part.text}
              </span>
            );
          default:
            return part.text;
        }
      })}
    </>
  );
}

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  peer: User;
  onDelete?: () => void;
  onViewProfile?: (user: User | string) => void;
  onReact?: (reaction: string) => void;
  currentUser: User;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onReply?: () => void;
  isGroupedWithPrevious?: boolean;
  isGroupedWithNext?: boolean;
  isHighlighted?: boolean;
  onPin?: () => void;
  onEdit?: (messageId: string, text: string) => void | Promise<void>;
  onEditEnd?: () => void;
  theme?: string;
  onShowAlert?: (title: string, message: string) => void;
}

export function MessageItem({ 
  message, 
  isMine, 
  peer, 
  onDelete, 
  onViewProfile, 
  onReact, 
  currentUser,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onReply,
  isGroupedWithPrevious = false,
  isGroupedWithNext = false,
  isHighlighted = false,
  onPin,
  onEdit,
  onEditEnd,
  theme = 'dark',
  onShowAlert
}: MessageItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(message.text);

  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const hasMovedRef = useRef(false);
  const isTouchRef = useRef(false);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isTouchRef.current = e.pointerType === 'touch';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isTouchRef.current = true;
    hasMovedRef.current = false;
    if (e.touches.length !== 1) return;

    touchTimerRef.current = window.setTimeout(() => {
      setShowLongPressMenu(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (err) {
          // ignore vibration errors (e.g. permission issues in browser)
        }
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    }, 600);
  };

  const handleTouchMove = () => {
    hasMovedRef.current = true;
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (showLongPressMenu) {
      e.preventDefault();
    }
  };

  const senderUser = React.useMemo(() => {
    if (peer.isGroup) {
      return {
        id: message.authorId,
        username: message.authorId,
        displayName: message.authorName || message.authorId,
        avatar: message.authorAvatar || '',
      };
    }
    return peer;
  }, [peer, message]);

  const isMentioned = React.useMemo(() => {
    if (!message.text || !currentUser?.username) return false;
    const regex = new RegExp(`@${currentUser.username}\\b`, 'i');
    return regex.test(message.text);
  }, [message.text, currentUser?.username]);

  const highlightMention = !isMine && isMentioned;

  const handleViewMention = (mentionedUsername: string) => {
    if (!onViewProfile) return;
    const lowerName = mentionedUsername.toLowerCase();
    if (lowerName === currentUser.username.toLowerCase()) {
      onViewProfile(currentUser);
    } else if (lowerName === peer.username.toLowerCase() && !peer.isGroup) {
      onViewProfile(peer);
    } else {
      onViewProfile(mentionedUsername);
    }
  };

  React.useEffect(() => {
    setEditText(message.text);
  }, [message.text]);

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText(message.text);
    onEditEnd?.();
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed === message.text) {
      setIsEditing(false);
      onEditEnd?.();
      return;
    }
    try {
      if (onEdit) {
        await onEdit(message.id, trimmed);
      }
      setIsEditing(false);
      onEditEnd?.();
    } catch (err) {
      console.error('Failed to save message edit:', err);
    }
  };

  const timeString = new Date(message.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  let cornersClass = '';
  if (isMine) {
    if (!isGroupedWithPrevious && !isGroupedWithNext) {
      cornersClass = 'rounded-2xl rounded-br-none';
    } else if (!isGroupedWithPrevious && isGroupedWithNext) {
      cornersClass = 'rounded-2xl rounded-tr-none';
    } else if (isGroupedWithPrevious && isGroupedWithNext) {
      cornersClass = 'rounded-2xl';
    } else if (isGroupedWithPrevious && !isGroupedWithNext) {
      cornersClass = 'rounded-2xl rounded-br-none';
    }
  } else {
    if (!isGroupedWithPrevious && !isGroupedWithNext) {
      cornersClass = 'rounded-2xl rounded-bl-none';
    } else if (!isGroupedWithPrevious && isGroupedWithNext) {
      cornersClass = 'rounded-2xl rounded-tl-none';
    } else if (isGroupedWithPrevious && isGroupedWithNext) {
      cornersClass = 'rounded-2xl';
    } else if (isGroupedWithPrevious && !isGroupedWithNext) {
      cornersClass = 'rounded-2xl rounded-bl-none';
    }
  }

  const isAttachment = !!message.mediaUrl || !!message.gifUrl || (message.embeds && message.embeds.length > 0) || !!message.embed;

  return (
    <motion.div
      layout
      id={`msg-${message.id}`}
      onClick={isSelectionMode ? onToggleSelect : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex group relative items-center w-full px-4 py-1 hover:bg-white/[0.01] transition-all select-none ${
        showLongPressMenu ? 'z-[1000]' : 'hover:z-30 z-0'
      } ${
        isGroupedWithPrevious ? 'mt-0' : 'mt-3'
      } ${
        isSelectionMode ? 'hover:bg-indigo-500/5 bg-indigo-500/[0.01] cursor-pointer' : ''
      } ${isSelected ? 'bg-indigo-500/10 hover:bg-indigo-500/15' : ''} ${
        isHighlighted ? 'bg-indigo-500/20 ring-1 ring-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.15)] rounded-xl' : ''
      } ${
        highlightMention ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-[3px] border-amber-500/70 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]' : ''
      }`}
    >
      {/* Selection Checkbox */}
      <div 
        className={`flex items-center justify-center transition-all duration-200 shrink-0 overflow-hidden ${
          isSelectionMode 
            ? (isSelected ? 'w-8 opacity-100 mr-2' : 'w-0 opacity-0 group-hover:w-8 group-hover:opacity-100 group-hover:mr-2') 
            : 'w-0 opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`w-5 h-5 rounded-full border transition-colors flex items-center justify-center cursor-pointer ${
            isSelected
              ? 'bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
              : 'border-slate-500 hover:border-indigo-400 hover:bg-white/5 text-transparent'
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </button>
      </div>

      {/* Main Message Alignment & Content */}
      <div className={`flex flex-1 ${isSelectionMode ? 'pointer-events-none' : ''} ${isMine ? 'flex-col items-end space-y-1 ml-auto max-w-[70%] sm:max-w-[75%]' : 'items-end space-x-3 max-w-[70%] sm:max-w-[75%]'}`}>
        
        {!isMine && (
          isGroupedWithPrevious ? (
            <div className="w-8 h-8 hidden sm:flex shrink-0" />
          ) : (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile?.(senderUser);
              }}
              className="cursor-pointer group hover:scale-105 transition-transform"
            >
              <Avatar user={senderUser} className="w-8 h-8 hidden sm:flex shrink-0" />
            </button>
          )
        )}
      
      <div className={`relative flex flex-col group ${isMine ? 'items-end max-w-[70%] sm:max-w-[75%]' : 'items-start max-w-full'}`}>
        {/* Author Name for Group Chats */}
        {peer.isGroup && !isMine && !isGroupedWithPrevious && (
          <div className="flex items-center gap-1.5 text-[10px] text-theme-muted font-bold mb-1 ml-1 select-none">
            <span className="text-white hover:underline cursor-pointer" onClick={() => onViewProfile?.(senderUser)}>
              {message.authorName || message.authorId}
            </span>
            <span className="opacity-75 font-normal">@{message.authorId}</span>
          </div>
        )}
        
        {/* Action Menu (Reply, Pin, Delete) */}
        {!message.pending && !isSelectionMode && (
          <div className={`absolute top-0 flex items-center bg-theme-card/95 border border-theme-border rounded-xl p-0.5 shadow-xl z-30 transition-all duration-150 hover:scale-105 pointer-events-auto ${
            isMine ? 'right-full mr-2.5' : 'left-full ml-2.5'
          } ${
            isTouchDevice ? 'hidden' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReply?.();
              }}
              className="w-7 h-7 rounded-lg hover:bg-white/10 text-theme-muted hover:text-indigo-400 flex items-center justify-center cursor-pointer transition-colors"
              title="Reply"
            >
              <Reply size={13} />
            </button>
            {onPin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPin();
                }}
                className={`w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors ${
                  message.pinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-theme-muted hover:text-indigo-400'
                }`}
                title={message.pinned ? "Unpin message" : "Pin message"}
              >
                <Pin size={13} className={message.pinned ? "fill-indigo-400/20" : ""} />
              </button>
            )}
            {isMine && onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/10 text-theme-muted hover:text-indigo-400 flex items-center justify-center cursor-pointer transition-colors"
                title="Edit message"
              >
                <Pencil size={13} />
              </button>
            )}
            {isMine && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/10 text-theme-muted hover:text-rose-500 flex items-center justify-center cursor-pointer transition-colors"
                title="Delete message"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}

        {/* Pinned Message Header Block */}
        {message.pinned && (
          <div className={`flex items-center gap-1 text-[9px] text-indigo-400 font-bold mb-1 uppercase tracking-wide select-none ${
            isMine ? 'justify-end' : 'justify-start'
          }`}>
            <Pin size={10} className="fill-indigo-400/20" />
            <span>Pinned Message</span>
          </div>
        )}

        {/* Replied Message Header Block */}
        {message.replyTo && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              const el = document.getElementById(`msg-${message.replyTo?.id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('bg-indigo-500/10');
                setTimeout(() => el.classList.remove('bg-indigo-500/10'), 2000);
              }
            }}
            className={`flex items-center gap-1.5 text-[10px] text-theme-muted font-bold mb-1 max-w-[280px] hover:text-indigo-400 cursor-pointer select-none truncate ${
              isMine ? 'justify-end' : 'justify-start'
            }`}
          >
            <Reply size={10} className="shrink-0 scale-x-[-1] opacity-75" />
            <span className="italic hover:underline font-bold">
              {message.authorName || message.authorId}
            </span>
            <span className="opacity-75 font-normal mx-0.5">replied to</span>
            <span className="italic hover:underline font-bold">
              {message.replyTo.authorName || message.replyTo.author}
            </span>
            <span className="truncate italic font-medium opacity-80 max-w-[150px]">
              "{message.replyTo.text || (message.replyTo.gifUrl ? 'GIF' : 'Attachment')}"
            </span>
          </div>
        )}

        {/* Text Bubble: Only render if there's actual text, a GIF, or standard image/video attachments, or if editing */}
        {(message.text || message.gifUrl || (message.mediaUrl && message.mediaType !== 'document') || isEditing) && (
          <div
            onPointerDown={handlePointerDown}
            onDoubleClick={(e) => {
              if (isTouchRef.current) {
                isTouchRef.current = false;
                return;
              }
              if (isMine && !message.pending && onEdit) {
                setIsEditing(true);
              }
            }}
            className={`relative ${cornersClass} ${
              isMine
                ? 'gradient-msg p-4 text-white leading-relaxed w-full'
                : 'glass p-4 text-theme-text leading-relaxed shadow-sm'
            } ${message.pending ? 'opacity-50 saturate-50 cursor-not-allowed select-none' : ''}`}
          >
            {/* Render Caption / Message Text */}
            {isEditing ? (
              <div className="relative z-10 w-full text-left mt-1">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      cancelEdit();
                    }
                  }}
                  className="w-full bg-black/30 border border-indigo-500/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500 resize-none font-medium leading-relaxed"
                  rows={Math.max(1, editText.split('\n').length)}
                  autoFocus
                />
                <div className="text-[10px] text-theme-muted mt-1 select-none flex gap-1.5 font-semibold">
                  <span>escape to</span>
                  <button 
                    type="button" 
                    onClick={cancelEdit}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    cancel
                  </button>
                  <span>•</span>
                  <span>enter to</span>
                  <button 
                    type="button" 
                    onClick={handleSaveEdit}
                    className="text-indigo-400 hover:underline cursor-pointer"
                  >
                    save
                  </button>
                </div>
              </div>
            ) : (
              message.text && (
                <div className={`relative z-10 break-words ${isAttachment ? 'block mb-2 font-medium' : ''}`}>
                  {parseMarkdown(message.text, currentUser.username, handleViewMention, isMine, theme)}
                  {message.edited && (
                    <span className="text-[9px] text-theme-muted/80 ml-1.5 select-none hover:text-indigo-400 font-bold uppercase tracking-wider">
                      (edited)
                    </span>
                  )}
                </div>
              )
            )}

            {/* Render GIF Attachments */}
            {message.gifUrl && (
              <div className="relative z-10 mt-1 rounded-xl overflow-hidden border border-theme-border hover:border-indigo-500/20 transition-colors shadow-md">
                <img
                  src={message.gifUrl}
                  alt="Shared GIF"
                  className="max-h-72 max-w-full object-contain"
                />
              </div>
            )}

            {/* Render Image Attachments */}
            {message.mediaUrl && message.mediaType === 'image' && (() => {
              const config = getFileConfig(message.mediaUrl, 'image');
              return (
                <div className="relative z-10 mt-1 rounded-xl overflow-hidden border border-theme-border hover:border-indigo-500/30 transition-all shadow-md group/img select-none bg-black/20">
                  <img
                    src={message.mediaUrl}
                    alt={config.name}
                    className="max-h-72 max-w-full object-contain cursor-pointer transition-transform duration-300 group-hover/img:scale-[1.01]"
                    onClick={() => window.open(message.mediaUrl, '_blank')}
                  />
                  {isTouchDevice ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(message.mediaUrl, '_blank');
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center pointer-events-auto shadow-lg active:scale-95 transition-all cursor-pointer z-20"
                      title="Open full size"
                    >
                      <Download size={13} />
                    </button>
                  ) : (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center gap-2.5 transition-opacity duration-200 pointer-events-none">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(message.mediaUrl, '_blank');
                        }}
                        className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center pointer-events-auto shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Open full size"
                      >
                        <Download size={16} />
                      </button>
                      <span className="text-[10px] font-semibold text-white/90 truncate max-w-[80%] px-2 py-0.5 rounded bg-black/40 border border-theme-border">
                        {config.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Render Video Attachments */}
            {message.mediaUrl && message.mediaType === 'video' && (
              <div className="relative z-10 mt-1 rounded-xl overflow-hidden border border-theme-border hover:border-indigo-500/30 transition-all shadow-md select-none bg-black/20">
                <video
                  src={message.mediaUrl}
                  controls
                  className="max-h-72 max-w-full object-contain"
                />
              </div>
            )}

            {/* Quick Reactions Bar */}
            {onReact && !message.pending && (
              <div className={`absolute top-full mt-1.5 pointer-events-none transition-opacity duration-200 flex items-center bg-theme-card border border-theme-border rounded-full px-1 py-0.5 shadow-xl z-20 ${
                isMine ? 'right-4' : 'left-4'
              } ${
                isTouchDevice ? 'hidden' : 'opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto'
              }`}>
                {['👍', '❤️', '😂', '🔥', '🎉', '😢'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(emoji)}
                    className="w-6 h-6 flex items-center justify-center text-xs rounded-full hover:bg-white/10 transition-colors cursor-pointer hover:scale-115 active:scale-95 duration-100"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Render Document Attachments (Outside the bubble, matching Discord widget design) */}
        {message.mediaUrl && message.mediaType === 'document' && (() => {
          const config = getFileConfig(message.mediaUrl, 'document');
          return (
            <div 
              onClick={() => window.open(message.mediaUrl, '_blank')}
              className="relative z-10 mt-1.5 p-3.5 rounded-xl border bg-black/35 hover:bg-black/55 border-theme-border hover:border-theme-border transition-all cursor-pointer flex items-center justify-between gap-4 select-none w-full sm:w-[320px] shadow-lg group/doc"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shrink-0 shadow-md group-hover/doc:scale-105 transition-transform`}>
                  {config.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-theme-text truncate pr-1 group-hover/doc:text-white transition-colors" title={config.name}>
                    {config.name}
                  </span>
                  <span className="text-[9px] font-bold text-theme-muted uppercase mt-0.5 tracking-wider">
                    {config.label} • {message.mediaSize ? formatBytes(message.mediaSize) : 'Unknown size'}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 group-hover/doc:bg-indigo-500/20 group-hover/doc:text-indigo-300 flex items-center justify-center text-theme-muted shrink-0 transition-colors">
                <Download size={14} />
              </div>
            </div>
          );
        })()}

        {/* Render Link Embed Previews (Discord style!) */}
        {message.embeds && message.embeds.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 max-w-full sm:max-w-md w-full">
            {message.embeds.map((embed, idx) => {
              if (embed.type === 'image' || embed.type === 'gif') {
                return (
                  <div 
                    key={idx}
                    className="rounded-lg overflow-hidden border border-theme-border max-h-64 max-w-full bg-black/20 flex items-center justify-center cursor-pointer group/img relative z-10 self-start"
                    onClick={() => window.open(embed.url, '_blank')}
                  >
                    <img
                      src={embed.url}
                      alt="Direct Media Preview"
                      className="max-h-64 max-w-full object-contain group-hover/img:scale-[1.01] transition-transform duration-200"
                    />
                  </div>
                );
              }

              if (embed.type === 'video') {
                return (
                  <div 
                    key={idx}
                    className="rounded-lg overflow-hidden border border-theme-border max-h-64 max-w-full bg-black/20 relative z-10 self-start"
                  >
                    <video
                      src={embed.url}
                      controls
                      playsInline
                      className="max-h-64 max-w-full object-contain"
                    />
                  </div>
                );
              }

              // Default standard webpage embed
              return (
                <div 
                  key={idx}
                  className="rounded-lg bg-theme-card/95 border border-theme-border border-l-4 border-l-indigo-500 p-4 max-w-full shadow-2xl flex flex-col relative z-10 text-left"
                >
                  {/* Site Provider */}
                  {embed.siteName && (
                    <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest select-none">
                      {embed.siteName}
                    </span>
                  )}
                  
                  {/* Title (Link) */}
                  <a 
                    href={embed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-sky-400 hover:text-sky-300 hover:underline mt-1 break-words cursor-pointer"
                  >
                    {embed.title || embed.url}
                  </a>

                  {/* Description */}
                  {embed.description && (
                    <p className="text-xs text-theme-text mt-2 leading-relaxed break-words whitespace-pre-wrap lg:select-text select-none">
                      {embed.description}
                    </p>
                  )}

                  {/* Large Image Block */}
                  {embed.image && (
                    <div 
                      className="mt-3 rounded-lg overflow-hidden border border-theme-border max-h-64 max-w-full bg-black/20 flex items-center justify-center cursor-pointer group/img"
                      onClick={() => window.open(embed.url, '_blank')}
                    >
                      <img
                        src={embed.image}
                        alt="Link Preview"
                        className="w-full h-full object-cover group-hover/img:scale-[1.01] transition-transform duration-200"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reactions Display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([reaction, users]) => {
              const hasReacted = users.includes(currentUser.id);
              return (
                <button
                  key={reaction}
                  onClick={() => onReact?.(reaction)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    hasReacted
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 shadow-md shadow-indigo-500/5'
                      : 'bg-white/5 border-theme-border text-theme-muted hover:bg-white/10 hover:border-white/20'
                  }`}
                  title={users.join(', ')}
                >
                  <span>{reaction}</span>
                  <span className="opacity-80 font-bold">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {showLongPressMenu && (
            <>
              {/* Transparent backdrop overlay to dismiss on click away */}
              <div 
                className="fixed inset-0 z-[90] bg-transparent cursor-default"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLongPressMenu(false);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              />
              {/* Compact Menu Tooltip above the message */}
              <div 
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-[100] animate-in fade-in zoom-in-95 duration-100 select-none"
              >
                {/* Reactions row */}
                {onReact && !message.pending && (
                  <div className="flex items-center bg-theme-panel/95 backdrop-blur border border-theme-border rounded-t-xl px-2 py-1 shadow-lg gap-1 border-b-0">
                    {['👍', '❤️', '😂', '🔥', '🎉', '😢'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLongPressMenu(false);
                          onReact(emoji);
                        }}
                        className="w-7 h-7 flex items-center justify-center text-sm rounded-full hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer hover:scale-115 active:scale-95 duration-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {/* Action buttons row */}
                <div className={`flex items-center bg-theme-panel/95 backdrop-blur border border-theme-border p-1 shadow-xl gap-1 ${onReact && !message.pending ? 'rounded-b-xl border-t-theme-border/50' : 'rounded-xl'}`}>
                  {/* Reply */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLongPressMenu(false);
                      onReply?.();
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 text-theme-muted hover:text-indigo-400 flex items-center justify-center cursor-pointer transition-colors"
                    title="Reply"
                  >
                    <Reply size={14} />
                  </button>

                  {/* Edit */}
                  {isMine && onEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLongPressMenu(false);
                        setIsEditing(true);
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 text-theme-muted hover:text-indigo-400 flex items-center justify-center cursor-pointer transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  {/* Pin / Unpin */}
                  {onPin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLongPressMenu(false);
                        onPin();
                      }}
                      className={`w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors ${
                        message.pinned ? 'text-indigo-400' : 'text-theme-muted hover:text-indigo-400'
                      }`}
                      title={message.pinned ? "Unpin" : "Pin"}
                    >
                      <Pin size={14} className={message.pinned ? "fill-indigo-400/20" : ""} />
                    </button>
                  )}

                  {/* Copy */}
                  {message.text && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLongPressMenu(false);
                        navigator.clipboard.writeText(message.text);
                        if (onShowAlert) {
                          onShowAlert('Clipboard Copy', 'Message copied to clipboard.');
                        }
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 text-theme-muted hover:text-indigo-400 flex items-center justify-center cursor-pointer transition-colors"
                      title="Copy"
                    >
                      <Copy size={14} />
                    </button>
                  )}

                  {/* Delete */}
                  {isMine && onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLongPressMenu(false);
                        onDelete();
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 text-theme-muted hover:text-rose-500 flex items-center justify-center cursor-pointer transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>

      {isMine && !isGroupedWithNext && (
         <div className="text-[10px] text-theme-muted mr-2 uppercase tracking-wide">
           {timeString} · {message.pending ? 'Sending...' : 'Delivered'}
         </div>
      )}
      {!isMine && !isGroupedWithNext && (
         <div className="text-[10px] text-theme-muted ml-2 uppercase tracking-wide">
           {timeString}
         </div>
      )}
      </div>

    </motion.div>
  );
}

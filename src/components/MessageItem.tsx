import React from 'react';
import { motion } from 'motion/react';
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
  Pin
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

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  peer: User;
  onDelete?: () => void;
  onViewProfile?: (user: User) => void;
  onReact?: (reaction: string) => void;
  currentUserId: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onReply?: () => void;
  isGroupedWithPrevious?: boolean;
  isGroupedWithNext?: boolean;
  isHighlighted?: boolean;
  onPin?: () => void;
}

export function MessageItem({ 
  message, 
  isMine, 
  peer, 
  onDelete, 
  onViewProfile, 
  onReact, 
  currentUserId,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onReply,
  isGroupedWithPrevious = false,
  isGroupedWithNext = false,
  isHighlighted = false,
  onPin
}: MessageItemProps) {
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
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex group relative hover:z-30 items-center w-full px-4 py-1 hover:bg-white/[0.01] transition-all select-none ${
        isGroupedWithPrevious ? 'mt-0' : 'mt-3'
      } ${
        isSelectionMode ? 'hover:bg-indigo-500/5 bg-indigo-500/[0.01] cursor-pointer' : ''
      } ${isSelected ? 'bg-indigo-500/10 hover:bg-indigo-500/15' : ''} ${
        isHighlighted ? 'bg-indigo-500/20 ring-1 ring-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.15)] rounded-xl' : ''
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
                onViewProfile?.(peer);
              }}
              className="cursor-pointer group hover:scale-105 transition-transform"
            >
              <Avatar user={peer} className="w-8 h-8 hidden sm:flex shrink-0" />
            </button>
          )
        )}
      
      <div className={`relative flex flex-col group ${isMine ? 'items-end max-w-[70%] sm:max-w-[75%]' : 'items-start max-w-full'}`}>
        
        {/* Action Menu (Reply, Pin, Delete) */}
        {!message.pending && !isSelectionMode && (
          <div className={`absolute top-0 opacity-0 group-hover:opacity-100 flex items-center bg-theme-card/95 border border-theme-border rounded-xl p-0.5 shadow-xl z-30 transition-all duration-150 hover:scale-105 pointer-events-auto ${
            isMine ? 'right-full mr-2.5' : 'left-full ml-2.5'
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
            <span>
              {message.replyTo.authorName || message.replyTo.author} replied:
            </span>
            <span className="truncate italic font-medium opacity-80 max-w-[150px]">
              "{message.replyTo.text || (message.replyTo.gifUrl ? 'GIF' : 'Attachment')}"
            </span>
          </div>
        )}

        {/* Text Bubble: Only render if there's actual text, a GIF, or standard image/video attachments */}
        {(message.text || message.gifUrl || (message.mediaUrl && message.mediaType !== 'document')) && (
          <div
            className={`relative ${cornersClass} ${
              isMine
                ? 'gradient-msg p-4 text-white leading-relaxed w-full'
                : 'glass p-4 text-theme-text leading-relaxed shadow-sm'
            } ${message.pending ? 'opacity-50 saturate-50 cursor-not-allowed select-none' : ''}`}
          >
            {/* Render Caption / Message Text */}
            {message.text && (
              <span className={`relative z-10 break-words whitespace-pre-wrap ${isAttachment ? 'block mb-2 font-medium' : ''}`}>
                {message.text}
              </span>
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
              <div className={`absolute top-full mt-1.5 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 flex items-center bg-theme-card border border-theme-border rounded-full px-1 py-0.5 shadow-xl z-20 ${
                isMine ? 'right-4' : 'left-4'
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
                    <p className="text-xs text-theme-text mt-2 leading-relaxed break-words whitespace-pre-wrap select-text">
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
              const hasReacted = users.includes(currentUserId);
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

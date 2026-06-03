import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image as ImageIcon, Smile, X, Search, Heart, Paperclip, FileText, CornerUpLeft } from 'lucide-react';
import { Message, User } from '../types';
import { Avatar } from './Avatar';

interface ComposerProps {
  onSend: (text: string, gifUrl?: string, mediaUrl?: string, mediaType?: string, mediaSize?: number, embeds?: any[]) => void;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  mentionableUsers?: User[];
  onShowAlert?: (title: string, message: string) => void;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😃',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
    ]
  },
  {
    id: 'people',
    name: 'Gestures & People',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐱',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️', '🕸️', '🐢', '🐍', '🦎', '🐙', '🦑', '🦞', '🦀', '🦐', '🐠', '🐟', '🐡', '🐬', '🐳', '🐋', '🐊', '🐆', '🐅', '🐃', '🐂', '🐄', '🦌', '🐪', '🐫', '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐐', '🐏', '🐑', '🐎', '🐖', '🐕', '🐈', '🐇', '🦝', '🦡', '🦦', '🦥', '🦘', '🦬', '🐉', '🦕', '🦖', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃', '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🥩', '🍗', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧂', '🥫', '🍱', '🍣', '🍤', '🍥', '🍡', '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧊'
    ]
  },
  {
    id: 'activities',
    name: 'Activities & Sports',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '⛳', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎟️', '🎫', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'
    ]
  },
  {
    id: 'objects',
    name: 'Objects & Symbols',
    icon: '💡',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚜', '🚲', '🛴', '🛵', '🏍️', '🚨', '🛰️', '✈️', '🛳️', '⛵', '⚓', '🛸', '🚀', '🚁', '🧭', '⏰', '🕰️', '⌛', '⏳', '💡', '🏮', '📔', '📕', '📗', '📘', '📚', '📓', '📒', '📝', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '🏷️', '📮', '🗳️', '✏️', '✒️', '🖊️', '🖋️', '🖌️', '🖍️', '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '🛡️', '🔧', '🪛', '🔩', '⚙️', '⚖️', '🔗', '⛓️', '🪝', '🧰', '🧲', '🪜', '⚗️', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩺', '🪞', '🪟', '🧹', '🧺', '🧻', '🧼', '🪥', '🧽', '🧯', '🛒', '🚬', '⚰️', '🪦', '⚱️'
    ]
  }
];

const FALLBACK_GIFS: Record<string, string[]> = {
  trending: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3B3amswZnQ3amcydnZrcHF2YTZobWNnZndhYndnMTd0MzhwOHhieCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/31lPv5L3a10A0/giphy.gif',
    'https://media.giphy.com/media/l1Aswx0kkGgccu75K/giphy.gif',
    'https://media.giphy.com/media/26n6R5HO1IIeGC1Ry/giphy.gif',
    'https://media.giphy.com/media/t3s3G2f2j0qDG/giphy.gif',
    'https://media.giphy.com/media/9Y5BbDSkSTiY8/giphy.gif',
    'https://media.giphy.com/media/wM0IbbpRLAG4w/giphy.gif'
  ],
  excited: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3B3amswZnQ3amcydnZrcHF2YTZobWNnZndhYndnMTd0MzhwOHhieCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/31lPv5L3a10A0/giphy.gif',
    'https://media.giphy.com/media/l1Aswx0kkGgccu75K/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2k0MHh2YXZmZmRpaXl3eG05cnJ2YWZpNDBpNnYzbm56amU1dHN1OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ckeHl52mNtoq87veET/giphy.gif'
  ],
  happy: [
    'https://media.giphy.com/media/26n6R5HO1IIeGC1Ry/giphy.gif',
    'https://media.giphy.com/media/t3s3G2f2j0qDG/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzNocGRiaTh4NjhnbG15djM4Znkyczhpbm11YTR3OGJzajAxaHNwbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/chzz1FQgqhytWRWbp3/giphy.gif'
  ],
  sad: [
    'https://media.giphy.com/media/9Y5BbDSkSTiY8/giphy.gif',
    'https://media.giphy.com/media/7SF5scGB2AFrO/giphy.gif',
    'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif'
  ],
  funny: [
    'https://media.giphy.com/media/wM0IbbpRLAG4w/giphy.gif',
    'https://media.giphy.com/media/13CoXDiaCcC2EA/giphy.gif'
  ],
  yes: [
    'https://media.giphy.com/media/xT5LMHxhag69P0ENiw/giphy.gif',
    'https://media.giphy.com/media/3o7abKhOpu0NXS3fsk/giphy.gif'
  ],
  no: [
    'https://media.giphy.com/media/23BST5OBU8GiY/giphy.gif',
    'https://media.giphy.com/media/POql6zsXZbmcUTKl5t/giphy.gif'
  ],
  angry: [
    'https://media.giphy.com/media/11tIJDkuNtF280/giphy.gif',
    'https://media.giphy.com/media/3o72FiX39c0hstv4t2/giphy.gif'
  ],
  love: [
    'https://media.giphy.com/media/26hpKMTa5Hg1tUAvo/giphy.gif',
    'https://media.giphy.com/media/l4pTkaQMK3jhMMcmA/giphy.gif'
  ],
  dance: [
    'https://media.giphy.com/media/13CoXDiaCcC2EA/giphy.gif',
    'https://media.giphy.com/media/l3V0lsGtTMSB5YNgc/giphy.gif'
  ],
  lol: [
    'https://media.giphy.com/media/3o84U0gIhcabewT62Q/giphy.gif',
    'https://media.giphy.com/media/10yXFkBJ0MwIN2/giphy.gif'
  ],
  wow: [
    'https://media.giphy.com/media/cl90q5wYv8lsQ/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif'
  ],
  hello: [
    'https://media.giphy.com/media/VzX3sV553S1k4/giphy.gif',
    'https://media.giphy.com/media/l0FF56/giphy.gif'
  ],
  bye: [
    'https://media.giphy.com/media/m9eG1qVjvjksBIARVy/giphy.gif',
    'https://media.giphy.com/media/v098YxoQL1eUM/giphy.gif'
  ],
  thanks: [
    'https://media.giphy.com/media/3o85pxC5zPtjFHJA1G/giphy.gif',
    'https://media.giphy.com/media/26vUxJ9rqfwuIEkTu/giphy.gif'
  ],
  please: [
    'https://media.giphy.com/media/U4DswrOPDcWli/giphy.gif'
  ],
  scared: [
    'https://media.giphy.com/media/cEOG7nGA7tZEI/giphy.gif'
  ],
  tired: [
    'https://media.giphy.com/media/pb8waym1jZVWONhShG/giphy.gif'
  ],
  cool: [
    'https://media.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif'
  ]
};

const getFallbackGifs = (query: string): string[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return FALLBACK_GIFS.trending;
  
  if (FALLBACK_GIFS[normalized]) {
    return FALLBACK_GIFS[normalized];
  }
  
  for (const key of Object.keys(FALLBACK_GIFS)) {
    if (key !== 'trending' && (normalized.includes(key) || key.includes(normalized))) {
      return FALLBACK_GIFS[key];
    }
  }
  
  return FALLBACK_GIFS.trending;
};

export function ChatComposer({ onSend, replyToMessage = null, onCancelReply, inputRef, mentionableUsers = [], onShowAlert }: ComposerProps) {
  const [text, setText] = useState('');
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  const localRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || localRef;

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredUsers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return mentionableUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        (user.displayName && user.displayName.toLowerCase().includes(query))
    );
  }, [mentionQuery, mentionableUsers]);

  React.useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

  const checkMentionTrigger = (val: string, selectionStart: number) => {
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastWordMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
    if (lastWordMatch) {
      setMentionQuery(lastWordMatch[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const selectionStart = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, selectionStart);
    const textAfterCursor = text.slice(selectionStart);
    
    const lastAtOffset = textBeforeCursor.search(/@([a-zA-Z0-9_.-]*)$/);
    if (lastAtOffset === -1) return;
    
    const beforeMention = textBeforeCursor.slice(0, lastAtOffset);
    const replacement = `@${username} `;
    
    const newText = beforeMention + replacement + textAfterCursor;
    setText(newText);
    setMentionQuery(null);
    
    const newCursorPos = beforeMention.length + replacement.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.style.height = 'auto';
      const targetHeight = Math.min(144, textarea.scrollHeight);
      textarea.style.height = `${targetHeight}px`;
    }, 0);
  };

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // 1 line is ~24px, 6 lines is ~144px. Cap height at 144px.
      const targetHeight = Math.min(144, textarea.scrollHeight);
      textarea.style.height = `${targetHeight}px`;
    }
  }, [text]);

  const [showEmojis, setShowEmojis] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState('smileys');

  const [resolvedEmbeds, setResolvedEmbeds] = useState<any[]>([]);
  const [ignoredUrls, setIgnoredUrls] = useState<string[]>([]);
  const [resolvingUrls, setResolvingUrls] = useState<Record<string, boolean>>({});

  const resolvedEmbedsRef = React.useRef<any[]>([]);
  const ignoredUrlsRef = React.useRef<string[]>([]);
  const resolvingUrlsRef = React.useRef<Record<string, boolean>>({});

  React.useEffect(() => {
    resolvedEmbedsRef.current = resolvedEmbeds;
  }, [resolvedEmbeds]);

  React.useEffect(() => {
    ignoredUrlsRef.current = ignoredUrls;
  }, [ignoredUrls]);

  React.useEffect(() => {
    resolvingUrlsRef.current = resolvingUrls;
  }, [resolvingUrls]);

  React.useEffect(() => {
    const URL_REGEX = /https?:\/\/[^\s]+/gi;
    const matches = text.match(URL_REGEX) || [];
    const currentUrls = Array.from(new Set(matches));

    // Remove resolved embeds that are no longer in the text
    setResolvedEmbeds((prev) => {
      const filtered = prev.filter((embed) => currentUrls.includes(embed.requestedUrl || embed.url));
      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });

    // Remove ignored URLs that are no longer in the text
    setIgnoredUrls((prev) => {
      const filtered = prev.filter((url) => currentUrls.includes(url));
      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });

    // Find URLs that need resolution
    const urlsToResolve = currentUrls.filter((url) => {
      const isResolved = resolvedEmbedsRef.current.some((embed) => (embed.requestedUrl || embed.url) === url);
      const isIgnored = ignoredUrlsRef.current.includes(url);
      const isResolving = resolvingUrlsRef.current[url];
      return !isResolved && !isIgnored && !isResolving;
    });

    if (urlsToResolve.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      // Set resolving state to true only when fetching starts
      setResolvingUrls((prev) => {
        const next = { ...prev };
        urlsToResolve.forEach((url) => {
          next[url] = true;
        });
        return next;
      });

      await Promise.all(
        urlsToResolve.map(async (url) => {
          try {
            const response = await fetch(`/api/resolve-embed?url=${encodeURIComponent(url)}`);
            if (response.ok) {
              const data = await response.json();
              setResolvedEmbeds((prev) => {
                if (prev.some((e) => (e.requestedUrl || e.url) === url)) {
                  return prev;
                }
                return [...prev, { ...data, requestedUrl: url }];
              });
            }
          } catch (err) {
            console.error(`Failed to resolve embed for ${url}:`, err);
          } finally {
            setResolvingUrls((prev) => {
              const next = { ...prev };
              delete next[url];
              return next;
            });
          }
        })
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [text]);

  const handleRemoveEmbed = (url: string) => {
    setIgnoredUrls((prev) => [...prev, url]);
    setResolvedEmbeds((prev) => prev.filter((embed) => (embed.requestedUrl || embed.url) !== url));
    textareaRef.current?.focus();
  };

  const [gifSearchInput, setGifSearchInput] = useState('');
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<string[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('dicord-favorite-gifs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showFavorites, setShowFavorites] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [mediaName, setMediaName] = useState('');
  const [mediaSize, setMediaSize] = useState(0);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [xhrRef, setXhrRef] = useState<XMLHttpRequest | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('dicord-token') || '';
    if (!token) {
      if (onShowAlert) {
        onShowAlert('Error', 'Authentication token is missing. Please sign in again.');
      } else {
        window.alert('Authentication token is missing. Please sign in again.');
      }
      return;
    }

    const formData = new FormData();
    formData.append('media', file);

    setUploadFileName(file.name);
    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    setXhrRef(xhr);
    xhr.open('POST', `/api/upload-media?token=${encodeURIComponent(token)}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setXhrRef(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setMediaUrl(data.url);
          setMediaType(data.type);
          setMediaName(data.name);
          setMediaSize(data.size);
        } catch (err) {
          if (onShowAlert) {
            onShowAlert('Error', 'Upload succeeded but server response was invalid.');
          } else {
            window.alert('Upload succeeded but server response was invalid.');
          }
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (onShowAlert) {
            onShowAlert('Error', data.error || 'Failed to upload file.');
          } else {
            window.alert(data.error || 'Failed to upload file.');
          }
        } catch (err) {
          if (onShowAlert) {
            onShowAlert('Error', `Failed to upload file (${xhr.status}).`);
          } else {
            window.alert(`Failed to upload file (${xhr.status}).`);
          }
        }
      }
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
      textareaRef.current?.focus();
    };

    xhr.onerror = () => {
      setXhrRef(null);
      if (onShowAlert) {
        onShowAlert('Error', 'Network error occurred during file upload.');
      } else {
        window.alert('Network error occurred during file upload.');
      }
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
      textareaRef.current?.focus();
    };

    xhr.onabort = () => {
      setXhrRef(null);
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
      textareaRef.current?.focus();
    };

    xhr.send(formData);
  };

  const handleCancelUpload = () => {
    if (xhrRef) {
      xhrRef.abort();
    }
    textareaRef.current?.focus();
  };

  const handleRemoveMedia = () => {
    setMediaUrl('');
    setMediaType('');
    setMediaName('');
    setMediaSize(0);
    textareaRef.current?.focus();
  };

  const toggleFavorite = (url: string) => {
    setFavorites((prev) => {
      const next = prev.includes(url)
        ? prev.filter((item) => item !== url)
        : [...prev, url];
      try {
        localStorage.setItem('dicord-favorite-gifs', JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save favorite gifs:', error);
      }
      return next;
    });
    textareaRef.current?.focus();
  };

  React.useEffect(() => {
    if (!showGifPicker) return;
    
    const term = gifSearchQuery.trim().toLowerCase();
    const defaults = getFallbackGifs(term);
    
    let isMounted = true;
    setGifLoading(true);

    const fetchGifs = async () => {
      try {
        const apiKey = 'U48bN5rACQ0DnDpdRrnneAPfSWYhmso0';
        const url = term
          ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(term)}&limit=40`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=40`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Giphy API error');
        const data = await response.json();
        if (isMounted) {
          if (data.data && data.data.length > 0) {
            const urls = data.data.map((r: any) => r.images.fixed_height.url);
            setGifResults(urls);
          } else {
            setGifResults(defaults);
          }
          setGifLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setGifResults(defaults);
          setGifLoading(false);
        }
      }
    };

    fetchGifs();

    return () => {
      isMounted = false;
    };
  }, [gifSearchQuery, showGifPicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasEmbeds = resolvedEmbeds.length > 0;
    if (!text.trim() && !mediaUrl.trim() && !hasEmbeds) return;
    
    onSend(
      text, 
      undefined, 
      mediaUrl || undefined, 
      mediaType || undefined, 
      mediaSize || undefined,
      resolvedEmbeds
    );
    
    setText('');
    setMediaUrl('');
    setMediaType('');
    setMediaName('');
    setMediaSize(0);
    setResolvedEmbeds([]);
    setIgnoredUrls([]);
    setResolvingUrls({});
    setShowEmojis(false);
    setShowGifPicker(false);
    textareaRef.current?.focus();
  };

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleGifSelect = (url: string) => {
    onSend('', url);
    setShowGifPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <div className={`px-8 py-3 flex flex-col justify-center bg-transparent shrink-0 relative w-full ${showEmojis || showGifPicker || resolvedEmbeds.length > 0 ? 'z-40' : 'z-20'}`}>
      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-8 w-[310px] bg-theme-panel border border-theme-border shadow-2xl rounded-2xl p-3 z-40 flex flex-col"
          >
            {/* Header: Categories */}
            <div className="flex items-center justify-between border-b border-theme-border pb-2 mb-2 gap-1">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    textareaRef.current?.focus();
                  }}
                  className={`w-9 h-9 text-lg shrink-0 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-indigo-500/20 text-indigo-300 font-bold scale-105 border-indigo-500/30'
                      : 'hover:bg-white/5 text-theme-muted hover:text-theme-text'
                  }`}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
            </div>

            {/* Body: Emojis Grid */}
            <div className="grid grid-cols-7 gap-1 overflow-y-auto max-h-[180px] pr-1 scrollbar-hide">
              {EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory)?.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-xl hover:bg-white/10 rounded-xl transition-transform hover:scale-110 active:scale-95 duration-100 cursor-pointer"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {showGifPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-8 w-[310px] bg-theme-panel border border-theme-border shadow-2xl rounded-2xl p-3 z-40 flex flex-col gap-2 h-[310px]"
          >
            {/* Header with tabs: Giphy vs Favorites */}
            <div className="flex items-center justify-between border-b border-theme-border pb-2 mb-1 shrink-0">
              <div className="flex gap-2.5 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowFavorites(false);
                    textareaRef.current?.focus();
                  }}
                  className={`text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                    !showFavorites ? 'text-indigo-300' : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  GIPHY
                </button>
                <span className="text-slate-700 text-xs">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowFavorites(true);
                    textareaRef.current?.focus();
                  }}
                  className={`text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                    showFavorites ? 'text-indigo-300' : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  Favorites <Heart size={10} className={showFavorites ? 'fill-indigo-300 text-indigo-300' : 'text-theme-muted'} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGifPicker(false);
                  textareaRef.current?.focus();
                }}
                className="text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {showFavorites ? (
              // Favorites view
              favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-4 px-2 gap-2">
                  <Heart size={20} className="text-slate-600 animate-pulse" />
                  <span className="text-theme-muted text-[10px] leading-relaxed">No favorite GIFs yet. Click the heart icon on any GIF to add it here!</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1 scrollbar-hide">
                  {favorites.map((gifUrl, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleGifSelect(gifUrl)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleGifSelect(gifUrl);
                        }
                      }}
                      className="w-full h-[78px] relative rounded-lg overflow-hidden bg-black/30 hover:scale-[1.03] transition-transform duration-100 cursor-pointer border border-theme-border flex items-center justify-center shrink-0 group"
                    >
                      <img src={gifUrl} alt="GIF" className="absolute inset-0 w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(gifUrl);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 hover:bg-black/75 transition-all z-10 opacity-100"
                        title="Unfavorite"
                      >
                        <Heart size={12} className="fill-rose-500 text-rose-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // GIPHY Search & Results view
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setGifSearchQuery(gifSearchInput);
                  }}
                  className="flex gap-1.5 shrink-0"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={gifSearchInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGifSearchInput(val);
                        if (!val.trim()) {
                          setGifSearchQuery('');
                        }
                      }}
                      placeholder="Search GIFs..."
                      className="w-full bg-theme-bg border border-theme-border rounded-xl pl-7 pr-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-theme-muted"
                    />
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted" />
                  </div>
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-indigo-500/30 shadow-md shadow-indigo-600/10 shrink-0"
                  >
                    Search
                  </button>
                </form>

                {gifLoading ? (
                  <div className="grid grid-cols-2 gap-2 overflow-hidden flex-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-full h-[78px] rounded-lg bg-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                ) : gifResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-4">
                    <span className="text-theme-muted text-xs">No GIFs found.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1 scrollbar-hide">
                    {gifResults.map((gifUrl, idx) => {
                      const isFav = favorites.includes(gifUrl);
                      return (
                        <div
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleGifSelect(gifUrl)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleGifSelect(gifUrl);
                            }
                          }}
                          className="w-full h-[78px] relative rounded-lg overflow-hidden bg-black/30 hover:scale-[1.03] transition-transform duration-100 cursor-pointer border border-theme-border flex items-center justify-center shrink-0 group"
                        >
                          <img src={gifUrl} alt="GIF" className="absolute inset-0 w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(gifUrl);
                            }}
                            className={`absolute top-1 right-1 p-1 rounded-full bg-black/50 hover:bg-black/75 transition-all z-10 ${
                              isFav || isTouchDevice ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            title={isFav ? "Unfavorite" : "Favorite"}
                          >
                            <Heart size={12} className={isFav ? "fill-rose-500 text-rose-500" : "text-white"} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {(resolvedEmbeds.length > 0 || Object.keys(resolvingUrls).length > 0) && (
          <div className="absolute bottom-full mb-2 left-8 right-8 z-20 flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar select-none pointer-events-auto">
            {/* Loading Indicator */}
            {Object.keys(resolvingUrls).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="glass shadow-xl rounded-xl p-2 px-3 border border-theme-border flex items-center gap-2 max-w-xs self-start"
              >
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-[10px] text-theme-muted font-medium">
                  Resolving {Object.keys(resolvingUrls).length} link{Object.keys(resolvingUrls).length > 1 ? 's' : ''}...
                </span>
              </motion.div>
            )}

            {/* Resolved Embeds Stack */}
            {resolvedEmbeds.map((embed) => (
              <motion.div
                key={embed.requestedUrl || embed.url}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="glass shadow-xl rounded-xl p-3 border border-theme-border flex items-center justify-between gap-4 max-w-md w-full relative"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  {embed.type === 'image' || embed.type === 'gif' ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/30 border border-theme-border shrink-0 flex items-center justify-center">
                      <img
                        src={embed.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : embed.type === 'video' ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/30 border border-theme-border shrink-0 flex items-center justify-center relative">
                      <video
                        src={embed.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="text-[8px] text-white bg-black/60 px-1 rounded font-black">VIDEO</span>
                      </div>
                    </div>
                  ) : embed.image ? (
                    <img
                      src={embed.image}
                      alt="Site thumbnail"
                      className="w-12 h-12 rounded-lg object-cover bg-black/30 border border-theme-border shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0 flex items-center justify-center text-indigo-300">
                      <FileText size={20} />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 truncate">
                      {embed.type === 'image' || embed.type === 'gif' ? 'Direct Media' : embed.type === 'video' ? 'Direct Video' : (embed.siteName || 'Link Embed')}
                    </span>
                    <span className="text-xs text-theme-text font-bold truncate mt-0.5">
                      {embed.title || embed.url}
                    </span>
                    {embed.description && (
                      <span className="text-[10px] text-theme-muted truncate mt-0.5">
                        {embed.description}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEmbed(embed.requestedUrl || embed.url)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-theme-muted hover:text-white transition-colors flex items-center justify-center cursor-pointer shrink-0"
                  title="Remove embed"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
        {uploading && !mediaUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-2 left-8 right-8 glass shadow-xl rounded-2xl p-4 z-20 flex flex-col gap-3 border border-theme-border"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 shrink-0 animate-pulse">
                  <Paperclip size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-theme-text truncate max-w-[200px] font-medium">{uploadFileName}</span>
                  <span className="text-[10px] text-theme-muted font-bold uppercase">Uploading... {uploadProgress}%</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-theme-muted hover:text-white transition-colors flex items-center justify-center cursor-pointer shrink-0"
                title="Cancel upload"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        )}
        {mediaUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-2 left-8 right-8 glass shadow-xl rounded-2xl p-3 z-20 flex items-center justify-between gap-4 border border-theme-border"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {mediaType === 'image' ? (
                <img
                  src={mediaUrl}
                  alt="Upload preview"
                  className="w-12 h-12 rounded-lg object-cover bg-black/30 border border-theme-border shrink-0"
                />
              ) : mediaType === 'video' ? (
                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 border border-theme-border shrink-0 flex items-center justify-center text-xs font-bold text-indigo-300">
                  VID
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-500/20 border border-theme-border shrink-0 flex items-center justify-center text-theme-text">
                  <FileText size={20} />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-theme-text truncate max-w-[200px] font-medium">{mediaName}</span>
                <span className="text-[10px] text-theme-muted font-semibold uppercase">{formatBytes(mediaSize)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-theme-muted hover:text-white transition-colors flex items-center justify-center cursor-pointer shrink-0"
              title="Remove file"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {replyToMessage && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-2 bg-indigo-950/20 border border-indigo-500/20 border-l-4 border-l-indigo-500 rounded-r-xl mb-3 text-xs w-full shadow-lg"
        >
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1">
              <CornerUpLeft size={10} />
              <span>Replying to {replyToMessage.authorName || replyToMessage.authorId}</span>
            </span>
            <span className="text-theme-text truncate max-w-[500px] mt-0.5 font-medium">
              {replyToMessage.text || (replyToMessage.gifUrl ? 'GIF' : 'Attachment')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onCancelReply?.();
              textareaRef.current?.focus();
            }}
            className="w-6 h-6 rounded-full hover:bg-white/10 text-theme-muted hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Cancel Reply"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 flex items-center space-x-4">
        
        <div className="flex-1 glass rounded-2xl px-6 flex items-center space-x-4 border-theme-border relative">
          <AnimatePresence>
            {mentionQuery !== null && filteredUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 right-0 mb-3 glass border border-indigo-500/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-50 flex flex-col max-h-[220px]"
              >
                <div className="px-4 py-2 border-b border-indigo-500/10 flex items-center justify-between text-[10px] text-theme-muted font-bold uppercase tracking-wider select-none bg-black/10">
                  <span>Mention Users</span>
                  <span>Use ↑ ↓ Enter</span>
                </div>
                <div className="overflow-y-auto py-1.5 scrollbar-hide">
                  {filteredUsers.map((user, idx) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => insertMention(user.username)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors duration-100 ${
                        idx === mentionIndex
                          ? 'bg-indigo-500/20 text-indigo-300 font-bold border-l-4 border-indigo-500'
                          : 'hover:bg-white/5 text-theme-text'
                      }`}
                    >
                      <Avatar user={user} className="w-6 h-6 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate text-white">{user.displayName || user.username}</div>
                        <div className="text-[10px] text-theme-muted truncate">@{user.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => {
              setShowEmojis(!showEmojis);
              setShowGifPicker(false);
              textareaRef.current?.focus();
            }}
            className="text-theme-muted hover:text-indigo-400 cursor-pointer shrink-0 py-3"
            title="Emoji"
          >
            <Smile size={20} />
          </button>

          <label
            className="text-theme-muted hover:text-indigo-400 cursor-pointer shrink-0 py-3 flex items-center justify-center relative"
            title="Upload Media"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip size={20} />
            )}
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowEmojis(false);
              textareaRef.current?.focus();
            }}
            className={`text-[10px] font-bold tracking-wider px-2 h-7 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              showGifPicker
                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 scale-105 shadow-md shadow-indigo-600/10'
                : 'border-theme-border bg-theme-bg/5 hover:bg-theme-bg/10 text-theme-muted hover:text-theme-text'
            }`}
            title="Search GIFs"
          >
            GIF
          </button>
          
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              checkMentionTrigger(e.target.value, e.target.selectionStart);
            }}
            onKeyUp={(e) => {
              const target = e.target as HTMLTextAreaElement;
              checkMentionTrigger(target.value, target.selectionStart);
            }}
            onSelect={(e) => {
              const target = e.target as HTMLTextAreaElement;
              checkMentionTrigger(target.value, target.selectionStart);
            }}
            onKeyDown={(e) => {
              if (mentionQuery !== null && filteredUsers.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex((prev) => (prev + 1) % filteredUsers.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  insertMention(filteredUsers[mentionIndex].username);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setMentionQuery(null);
                  return;
                }
              }

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder="Type a message..."
            className="bg-transparent border-none outline-none flex-1 text-theme-text placeholder-slate-500 py-3 font-medium scrollbar-hide resize-none overflow-y-auto"
            style={{ height: 'auto', maxHeight: '144px', alignSelf: 'center' }}
            rows={1}
          />

          {/* Paste GIF link button removed. Detection is automatic */}
        </div>

        <button
          type="submit"
          disabled={uploading || (!text.trim() && !mediaUrl.trim() && resolvedEmbeds.length === 0)}
          className="w-12 h-12 rounded-2xl gradient-msg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shrink-0 shadow-lg text-white"
        >
          <Send size={20} strokeWidth={2.5} className="-ml-1" />
        </button>
      </form>
    </div>
  );
}

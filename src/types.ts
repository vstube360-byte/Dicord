export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  blockedUsers?: string[];
  mutedUsers?: string[];
  status?: string;
  lastActive?: string;
  createdAt?: string;
  bio?: string;
  pronouns?: string;
  bannerColor?: string;
  bannerImage?: string;
  customStatus?: string;
  website?: string;
  theme?: string;
  appTheme?: string;
  chatWallpaper?: string;
  privacySettings?: {
    showPronouns?: boolean;
    showBio?: boolean;
    showWebsite?: boolean;
  };
  badges?: string[];
  isGroup?: boolean;
  participants?: string[];
}

export interface Message {
  id: string;
  text: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  gifUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  reactions?: Record<string, string[]>;
  createdAt: number;
  pending?: boolean;
  pinned?: boolean;
  edited?: boolean;
  seen?: boolean;
  embed?: {
    url: string;
    title: string;
    description: string;
    image: string;
    siteName: string;
  };
  embeds?: Array<{
    type: 'image' | 'video' | 'gif' | 'embed';
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  }>;
  replyTo?: {
    id: string;
    author: string;
    authorName?: string;
    text: string;
    gifUrl?: string;
    mediaUrl?: string;
    mediaType?: string;
    mediaSize?: number;
  } | null;
}

export interface ChatSession {
  id: string;
  peer: User;
  messages: Message[];
  unreadCount: number;
  isTyping?: boolean | string;
}

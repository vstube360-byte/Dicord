import { ChatSession, Message, User } from '../types';

interface ServerUser {
  username: string;
  displayName: string;
  avatar?: string;
  status?: string;
  lastActive?: string;
  bio?: string;
  pronouns?: string;
  bannerColor?: string;
  bannerImage?: string;
  customStatus?: string;
  website?: string;
  theme?: string;
  appTheme?: string;
  chatWallpaper?: string;
  privacySettings?: any;
  badges?: string[];
  createdAt?: string;
}

interface ServerMessage {
  id: string;
  text?: string;
  gifUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  author: string;
  authorName?: string;
  authorAvatar?: string;
  reactions?: Record<string, string[]>;
  createdAt: string;
  embed?: any;
  embeds?: any[];
  replyTo?: any;
  pinned?: boolean;
}

interface ServerChat {
  user: ServerUser;
  lastMessage: ServerMessage | null;
  unread: number;
}

export interface SessionResponse {
  token: string;
  user: User;
}

export interface ConversationResponse {
  conversationId: string;
  peer: User;
  messages: Message[];
}

export function toClientUser(user: ServerUser): User {
  return {
    id: user.username,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar || '',
    status: user.status || 'offline',
    lastActive: user.lastActive || '',
    bio: user.bio || '',
    pronouns: user.pronouns || '',
    bannerColor: user.bannerColor || '',
    bannerImage: user.bannerImage || '',
    customStatus: user.customStatus || '',
    website: user.website || '',
    theme: user.theme || 'indigo',
    appTheme: user.appTheme || 'dark',
    chatWallpaper: user.chatWallpaper || '',
    privacySettings: user.privacySettings || { showPronouns: true, showBio: true, showWebsite: true },
    badges: user.badges || [],
    createdAt: user.createdAt,
  };
}

export function toClientMessage(message: ServerMessage): Message {
  return {
    id: message.id,
    text: message.text || '',
    gifUrl: message.gifUrl || '',
    mediaUrl: message.mediaUrl || '',
    mediaType: message.mediaType || '',
    mediaSize: message.mediaSize || 0,
    authorId: message.author,
    authorName: message.authorName || message.author,
    reactions: message.reactions || {},
    createdAt: new Date(message.createdAt).getTime(),
    embed: message.embed,
    embeds: message.embeds || (message.embed ? [{ type: 'embed', ...message.embed }] : []),
    replyTo: message.replyTo ? {
      id: message.replyTo.id,
      author: message.replyTo.author,
      authorName: message.replyTo.authorName,
      text: message.replyTo.text || '',
      gifUrl: message.replyTo.gifUrl,
      mediaUrl: message.replyTo.mediaUrl,
      mediaType: message.replyTo.mediaType,
      mediaSize: message.replyTo.mediaSize,
    } : null,
    pinned: !!message.pinned,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }
  return data as T;
}

export async function login(username: string, password: string): Promise<SessionResponse> {
  const data = await request<{ token: string; user: ServerUser }>('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { token: data.token, user: toClientUser(data.user) };
}

export async function register(
  username: string,
  password: string,
  displayName: string
): Promise<SessionResponse> {
  const data = await request<{ token: string; user: ServerUser }>('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName }),
  });
  return { token: data.token, user: toClientUser(data.user) };
}

export async function fetchMe(token: string): Promise<User> {
  const data = await request<{ user: ServerUser }>(`/api/me?token=${encodeURIComponent(token)}`);
  return toClientUser(data.user);
}

export async function fetchChats(token: string): Promise<ChatSession[]> {
  const data = await request<{ chats: ServerChat[] }>(`/api/users?token=${encodeURIComponent(token)}`);
  return data.chats.map((chat) => ({
    id: chat.user.username,
    peer: toClientUser(chat.user),
    messages: chat.lastMessage ? [toClientMessage(chat.lastMessage)] : [],
    unreadCount: chat.unread || 0,
  }));
}

export async function fetchConversation(token: string, username: string): Promise<ConversationResponse> {
  const data = await request<{
    conversation: { id: string; messages: ServerMessage[] };
    peer: ServerUser;
  }>(`/api/conversation?token=${encodeURIComponent(token)}&with=${encodeURIComponent(username)}`);

  return {
    conversationId: data.conversation.id,
    peer: toClientUser(data.peer),
    messages: data.conversation.messages.map(toClientMessage),
  };
}

export async function sendMessage(
  token: string,
  to: string,
  text: string,
  gifUrl?: string,
  mediaUrl?: string,
  mediaType?: string,
  mediaSize?: number,
  embeds?: any[],
  replyTo?: string
): Promise<Message> {
  const data = await request<{ ok: boolean; message: ServerMessage }>('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, to, text, gifUrl, mediaUrl, mediaType, mediaSize, embeds, replyTo }),
  });
  return toClientMessage(data.message);
}

export async function updateProfile(
  token: string,
  updates: Partial<User>
): Promise<User> {
  const data = await request<{ user: ServerUser }>('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...updates }),
  });
  return toClientUser(data.user);
}

export async function deleteAccount(token: string): Promise<void> {
  await request<{ ok: boolean }>('/api/delete-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export async function resolveGif(url: string): Promise<string> {
  const data = await request<{ gifUrl: string }>(`/api/resolve-gif?url=${encodeURIComponent(url)}`);
  return data.gifUrl;
}

export async function sendReaction(
  token: string,
  peerUsername: string,
  messageId: string,
  reaction: string
): Promise<Message> {
  const data = await request<{ ok: boolean; message: ServerMessage }>('/api/react', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, with: peerUsername, messageId, reaction }),
  });
  return toClientMessage(data.message);
}

export async function toggleBlock(
  token: string,
  username: string
): Promise<{ ok: boolean; blocked: string[] }> {
  return request<{ ok: boolean; blocked: string[] }>('/api/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, username }),
  });
}

export async function toggleMute(
  token: string,
  username: string
): Promise<{ ok: boolean; muted: string[] }> {
  return request<{ ok: boolean; muted: string[] }>('/api/mute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, username }),
  });
}

export async function deleteMessage(
  token: string,
  peerUsername: string,
  messageId: string
): Promise<void> {
  await request<{ ok: boolean }>('/api/delete-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, with: peerUsername, messageId }),
  });
}

export async function togglePin(
  token: string,
  peerUsername: string,
  messageId: string
): Promise<Message> {
  const data = await request<{ ok: boolean; message: ServerMessage }>('/api/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, with: peerUsername, messageId }),
  });
  return toClientMessage(data.message);
}


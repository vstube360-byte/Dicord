import { ChatSession, User } from '../types';

export const CURRENT_USER: User = {
  id: 'me',
  username: 'me_user',
  displayName: 'My Account',
  avatar: '',
};

export const MOCK_USERS: User[] = [];

export const INITIAL_CHATS: ChatSession[] = [];

// Helper to generate a contextual, somewhat random reply
const replies = [
  "That sounds amazing!",
  "I totally agree.",
  "Let me think about that and get back to you.",
  "Haha, exactly! 😂",
  "Could you clarify what you mean?",
  "Awesome! Let's do it.",
  "Can't wait!",
  "Whoa, really?",
  "I'm on it! 🚀",
  "Looks great to me.",
];

export function getBotReply(): string {
  return replies[Math.floor(Math.random() * replies.length)];
}

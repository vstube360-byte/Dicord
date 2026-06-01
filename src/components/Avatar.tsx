import React from 'react';
import { User } from '../types';

interface AvatarProps {
  user?: Partial<User>;
  className?: string;
}

export function Avatar({ user, className = 'w-10 h-10' }: AvatarProps) {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName || 'User'}
        className={`${className} rounded-full object-cover shadow-sm bg-slate-800`}
      />
    );
  }
  const name = user?.displayName || user?.username || '?';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className={`${className} rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold tracking-wider shadow-sm shrink-0 border border-theme-border`}>
      {initials}
    </div>
  );
}

import React from 'react';
import { User } from '../types';
import { Users } from 'lucide-react';

interface AvatarProps {
  user?: Partial<User>;
  className?: string;
}

export function Avatar({ user, className = 'w-10 h-10' }: AvatarProps) {
  const isGroup = !!user?.isGroup;
  const shapeClass = isGroup ? 'rounded-[30%]' : 'rounded-full';

  // Sanitize className to remove any parent-supplied rounded-full or custom rounded classes
  const sanitizedClassName = className
    .replace(/\brounded-(?:full|xl|lg|md|sm|2xl|3xl|none)\b/g, '')
    .replace(/\brounded-\[.*?\]\b/g, '');

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName || (isGroup ? 'Group' : 'User')}
        className={`${sanitizedClassName} ${shapeClass} object-cover shadow-sm bg-slate-800 border border-theme-border/50`}
      />
    );
  }

  if (isGroup) {
    return (
      <div className={`${sanitizedClassName} ${shapeClass} bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-sm shrink-0 border border-indigo-500/30 relative overflow-hidden group`}>
        <Users className="w-1/2 h-1/2 text-white/90 drop-shadow" />
      </div>
    );
  }

  const name = user?.displayName || user?.username || '?';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className={`${sanitizedClassName} ${shapeClass} bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold tracking-wider shadow-sm shrink-0 border border-theme-border`}>
      {initials}
    </div>
  );
}


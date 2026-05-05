'use client';

import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  initials: string;
  isSpeaking?: boolean;
  isConnected?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({
  name,
  initials,
  isSpeaking = false,
  isConnected = true,
  size = 'md',
}: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
  };

  const ringSize = {
    sm: 'ring-1',
    md: 'ring-2',
    lg: 'ring-3',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-semibold',
          'bg-gradient-to-br from-purple-600 to-blue-600',
          'ring-primary transition-all duration-300',
          sizeClasses[size],
          ringSize[size],
          isSpeaking && 'animate-speaking-glow ring-secondary'
        )}
      >
        <span className="text-white">{initials}</span>
      </div>
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium truncate max-w-[80px] text-foreground">
          {name}
        </p>
        {isConnected && (
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </div>
  );
}

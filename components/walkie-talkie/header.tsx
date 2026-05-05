'use client';

import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';

interface HeaderProps {
  roomName: string;
  isConnected?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  userCount?: number;
}

export function Header({
  roomName,
  isConnected = true,
  isMuted = false,
  onToggleMute,
  userCount = 0,
}: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full border-b border-white/10 px-4 py-4 sm:px-6',
        'bg-white/8 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.18)]'
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left side - Room info */}
        <div className="flex-1">
          <h1 className="mb-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {roomName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-cyan-300" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <span className="text-border">•</span>
            <span>
              {userCount} {userCount === 1 ? 'user' : 'users'}
            </span>
          </div>
        </div>

        {/* Right side - Mute button */}
        <button
          onClick={() => {
            console.log('clicked');
            onToggleMute?.();
          }}
          className={cn(
            'relative z-20 pointer-events-auto min-h-11 min-w-11 rounded-2xl border transition-all duration-200 touch-manipulation backdrop-blur-xl',
            'border-white/10 bg-white/8 hover:bg-white/12',
            isMuted ? 'text-rose-300' : 'text-foreground'
          )}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
}

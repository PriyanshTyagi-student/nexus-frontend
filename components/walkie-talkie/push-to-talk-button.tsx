'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, MicOff } from 'lucide-react';

interface PushToTalkButtonProps {
  onTalkStart?: () => void;
  onTalkEnd?: () => void;
  isDisabled?: boolean;
  isActive?: boolean;
}

export function PushToTalkButton({
  onTalkStart,
  onTalkEnd,
  isDisabled = false,
  isActive = false,
}: PushToTalkButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const startTalking = () => {
    if (isDisabled || isPressed) return;
    console.log('clicked');
    setIsPressed(true);
    onTalkStart?.();
  };

  const stopTalking = () => {
    if (!isPressed) return;
    setIsPressed(false);
    onTalkEnd?.();
  };

  return (
    <div className="relative z-20 flex w-full max-w-xs flex-col items-center gap-6 pointer-events-auto">
      <button
        disabled={isDisabled}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          startTalking();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          stopTalking();
        }}
        onPointerCancel={stopTalking}
        onPointerLeave={stopTalking}
        className={cn(
          'relative z-20 pointer-events-auto w-28 h-28 sm:w-24 sm:h-24 rounded-full font-semibold text-white',
          'flex items-center justify-center transition-all duration-200',
          'hover:scale-105 active:scale-95 touch-manipulation',
          isActive || isPressed
            ? 'bg-gradient-to-br from-secondary to-accent shadow-2xl animate-pulse-expand'
            : 'bg-gradient-to-br from-primary to-blue-500 animate-glow-pulse',
          isDisabled && 'opacity-50 cursor-not-allowed',
          'min-h-[7rem] sm:min-h-[6rem]'
        )}
      >
        {isActive || isPressed ? (
          <Mic className="w-12 h-12 sm:w-10 sm:h-10" />
        ) : (
          <MicOff className="w-12 h-12 sm:w-10 sm:h-10" />
        )}
      </button>

      <div className="flex gap-3">
        {(isActive || isPressed) && (
          <>
            <div className="w-2 h-8 bg-primary animate-waveform rounded-full" />
            <div className="w-2 h-6 bg-primary animate-waveform rounded-full" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-10 bg-primary animate-waveform rounded-full" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-6 bg-primary animate-waveform rounded-full" style={{ animationDelay: '0.3s' }} />
            <div className="w-2 h-8 bg-primary animate-waveform rounded-full" style={{ animationDelay: '0.4s' }} />
          </>
        )}
      </div>

      <p className="text-sm font-medium text-muted-foreground text-center px-4">
        {isActive || isPressed ? 'Transmitting...' : 'Press & Hold to Talk'}
      </p>
    </div>
  );
}

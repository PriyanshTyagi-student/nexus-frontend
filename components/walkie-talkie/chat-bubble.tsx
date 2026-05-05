'use client';

import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  message: string;
  sender: string;
  timestamp: Date;
  isOwn?: boolean;
}

export function ChatBubble({
  message,
  sender,
  timestamp,
  isOwn = false,
}: ChatBubbleProps) {
  const timeStr = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex gap-2 animate-float-up',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-xs px-4 py-2 rounded-lg',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-card text-card-foreground border border-border rounded-bl-none'
        )}
      >
        {!isOwn && (
          <p className="text-xs font-semibold text-secondary mb-1">{sender}</p>
        )}
        <p className="text-sm break-words">{message}</p>
        <p
          className={cn(
            'text-xs mt-1 opacity-70',
            isOwn && 'text-primary-foreground'
          )}
        >
          {timeStr}
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChatBubble } from './chat-bubble';
import { ChevronUp, Send } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  isOwn: boolean;
}

interface ChatPanelProps {
  messages?: Message[];
  onSendMessage?: (message: string) => void;
}

export function ChatPanel({
  messages = [],
  onSendMessage,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage?.(messageInput);
      setMessageInput('');
    }
  };

  return (
    <div className="relative z-20 w-full flex-shrink-0 pointer-events-auto">
      {/* Chat Panel */}
      <div
        className={cn(
          'relative z-20 border-t border-white/10 bg-white/8 backdrop-blur-2xl transition-all duration-300 ease-out',
          isOpen ? 'h-64 md:h-80' : 'h-0'
        )}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No messages yet. Start chatting!
              </p>
            ) : (
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  {...msg}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-3 flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              inputMode="text"
              placeholder="Type a message..."
              className={cn(
                'flex-1 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-foreground placeholder:text-muted-foreground',
                'relative z-20 pointer-events-auto touch-manipulation text-base backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/30'
              )}
            />
            <button
              onClick={handleSendMessage}
              className={cn(
                'relative z-20 pointer-events-auto min-h-11 min-w-11 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-3 py-2.5 text-white',
                'transition-transform hover:scale-[1.02] active:scale-[0.98]',
                'disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation'
              )}
              disabled={!messageInput.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative z-20 pointer-events-auto w-full flex items-center justify-center gap-2 border-t border-white/10',
          'bg-white/8 text-foreground backdrop-blur-2xl transition-colors hover:bg-white/12',
          'py-3 text-sm font-medium touch-manipulation'
        )}
      >
        <span>{isOpen ? 'Close Chat' : `Chat (${messages.length})`}</span>
        <ChevronUp
          className={cn(
            'w-4 h-4 transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>
    </div>
  );
}


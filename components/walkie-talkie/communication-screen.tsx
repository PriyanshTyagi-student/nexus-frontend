'use client';

import { useState } from 'react';
import { Header } from './header';
import { UsersSection } from './users-section';
import { PushToTalkButton } from './push-to-talk-button';
import { ChatPanel } from './chat-panel';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  socketId: string;
  userId: string;
  name: string;
  initials: string;
  isSpeaking: boolean;
  isConnected: boolean;
}

interface Message {
  id: string;
  sender: string;
  userId?: string;
  message: string;
  timestamp: Date;
  isOwn: boolean;
}

interface CommunicationScreenProps {
  roomName: string;
  username: string;
  users?: User[];
  messages?: Message[];
  isSpeaking?: boolean;
  onSendMessage?: (message: string) => void;
  onTalkStart?: () => void;
  onTalkEnd?: () => void;
  onLeaveRoom?: () => void;
}

export function CommunicationScreen({
  roomName,
  username,
  users = [],
  messages = [],
  isSpeaking = false,
  onSendMessage,
  onTalkStart,
  onTalkEnd,
  onLeaveRoom,
}: CommunicationScreenProps) {
  const [isMuted, setIsMuted] = useState(false);

  // Find current speaking user
  const speakingUser = users.find((u) => u.isSpeaking);
  const currentUser = users.find((u) => u.name === username);

  return (
    <section className="relative z-10 flex min-h-dvh w-full flex-1 flex-col overflow-x-hidden bg-background">
      {/* Header */}
      <Header
        roomName={roomName}
        isConnected={true}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        userCount={users.length + 1}
      />

      {/* Users Section */}
      <UsersSection users={users} totalCount={users.length + 1} />

      {/* Main Content */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
        {/* Empty state or main PTT interface */}
            <div className="relative z-20 flex w-full max-w-[90vw] sm:max-w-md flex-col items-center gap-6 rounded-[2rem] border border-cyan-300/15 bg-white/10 px-4 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.3)] backdrop-blur-3xl sm:px-8 sm:py-8 max-h-[70vh] overflow-y-auto pointer-events-auto animate-glass-shift animate-glow-border">

          <div className="text-center">
            <p className="mb-2 text-xs sm:text-sm text-muted-foreground">Current Speaker</p>
            <p className="text-xl sm:text-2xl font-bold text-cyan-300 truncate px-2">
              {speakingUser?.name || 'Waiting...'}
            </p>
          </div>

          {/* PTT Button */}
          <PushToTalkButton
            onTalkStart={onTalkStart}
            onTalkEnd={onTalkEnd}
            isDisabled={isMuted}
            isActive={isSpeaking}
          />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center w-full">
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10">
              <p className="text-lg sm:text-2xl font-bold text-cyan-300">
                {users.length + 1}
              </p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </div>
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10">
              <p className="text-lg sm:text-2xl font-bold text-fuchsia-300">
                {messages.length}
              </p>
              <p className="text-xs text-muted-foreground">Messages</p>
            </div>
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10">
              <p
                className={cn(
                  'text-lg sm:text-2xl font-bold',
                  isSpeaking
                    ? 'text-accent animate-pulse'
                    : 'text-muted-foreground'
                )}
              >
                {isSpeaking ? '●' : '○'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isSpeaking ? 'Speaking' : 'Idle'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel messages={messages} onSendMessage={onSendMessage} />

      {/* Leave Room Button */}
      <div className="relative z-20 flex-shrink-0 border-t border-white/10 bg-white/8 p-2 sm:p-3 backdrop-blur-2xl flex gap-2 pointer-events-auto">
        <button
          onClick={onLeaveRoom}

          className={cn(
            'flex-1 flex items-center justify-center gap-2',
            'min-h-11 sm:min-h-12 px-4 py-2.5 rounded-2xl',
            'bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border border-rose-400/20',
            'relative z-20 pointer-events-auto transition-colors font-medium text-sm touch-manipulation backdrop-blur-xl',
            'active:scale-95'
          )}
        >
          <LogOut className="w-4 h-4" />
          <span className="truncate">Leave</span>
        </button>
      </div>
    </section>
  );
}

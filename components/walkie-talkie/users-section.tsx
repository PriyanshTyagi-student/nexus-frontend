'use client';

import { UserAvatar } from './user-avatar';

interface User {
  socketId: string;
  userId: string;
  name: string;
  initials: string;
  isSpeaking: boolean;
  isConnected: boolean;
}

interface UsersSectionProps {
  users?: User[];
  totalCount?: number;
}

export function UsersSection({ users = [], totalCount = users.length }: UsersSectionProps) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
      <h2 className="text-sm font-semibold text-muted-foreground min-w-fit">
        Online ({totalCount})
      </h2>
      <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1">
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground">No other users connected</p>
        ) : (
          users.map((user) => (
            <div key={user.socketId} className="flex-shrink-0">
              <UserAvatar
                name={user.name}
                initials={user.initials}
                isSpeaking={user.isSpeaking}
                isConnected={user.isConnected}
                size="md"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

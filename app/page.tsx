'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { JoinRoomScreen } from '@/components/walkie-talkie/join-room-screen';
import { CommunicationScreen } from '@/components/walkie-talkie/communication-screen';
import { useSocket } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

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

type AppState = 'joining' | 'communicating';

type Notice = {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
};

export default function Home() {
  const {
    emit,
    on,
    off,
    socket,
    ensureConnection,
    backendUrl,
    updateBackendUrl,
    restoreDefaultBackendUrl,
  } = useSocket();
  const [state, setState] = useState<AppState>('joining');
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string>('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeTimers = useRef<Record<string, number>>({});

  const pushNotice = useCallback(
    (notice: Omit<Notice, 'id'>) => {
      const id = `notice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setNotices((current) => [...current, { ...notice, id }]);

      const timerId = window.setTimeout(() => {
        setNotices((current) => current.filter((item) => item.id !== id));
        delete noticeTimers.current[id];
      }, 4000);

      noticeTimers.current[id] = timerId;
    },
    []
  );

  const dismissNotice = useCallback((id: string) => {
    const timerId = noticeTimers.current[id];
    if (timerId) {
      window.clearTimeout(timerId);
      delete noticeTimers.current[id];
    }

    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(noticeTimers.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  // Handle user-joined event
  useEffect(() => {
    on('user-joined', (data) => {
      console.log('[EVENT] User joined:', data);
      setUsers((prev) => [
        ...prev,
        {
          socketId: data.socketId,
          userId: data.userId,
          name: data.name,
          initials: data.name.slice(0, 2).toUpperCase(),
          isSpeaking: false,
          isConnected: true,
        },
      ]);
    });

    return () => off('user-joined');
  }, [on, off]);

  // Handle user-left event
  useEffect(() => {
    on('user-left', (data) => {
      console.log('[EVENT] User left:', data);
      setUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
    });

    return () => off('user-left');
  }, [on, off]);

  // Handle room-users event (initial list)
  useEffect(() => {
    on('room-users', (data) => {
      console.log('[EVENT] Room users:', data.users);
      setUsers(
        data.users.map((u: any) => ({
          socketId: u.socketId,
          userId: u.userId,
          name: u.name,
          initials: u.name.slice(0, 2).toUpperCase(),
          isSpeaking: false,
          isConnected: true,
        }))
      );
    });

    return () => off('room-users');
  }, [on, off]);

  // Handle receive-message event
  useEffect(() => {
    on('receive-message', (data) => {
      console.log('[EVENT] Message received:', data);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random()}`,
          sender: data.name,
          userId: data.userId,
          message: data.message,
          timestamp: new Date(data.timestamp),
          isOwn: data.socketId === socket?.id,
        },
      ]);
    });

    return () => off('receive-message');
  }, [on, off, socket?.id]);

  // Handle user-speaking event
  useEffect(() => {
    on('user-speaking', (data) => {
      console.log('[EVENT] User speaking:', data);
      setUsers((prev) =>
        prev.map((u) =>
          u.socketId === data.socketId
            ? { ...u, isSpeaking: data.isSpeaking }
            : u
        )
      );
    });

    return () => off('user-speaking');
  }, [on, off]);

  // Handle connection error
  useEffect(() => {
    on('connect_error', (err) => {
      console.error('[CONNECTION ERROR]', err);
      setError('Failed to connect to server. Please try again.');
    });

    return () => off('connect_error');
  }, [on, off]);

  const verifyBackendConnection = useCallback(async () => {
    const result = await ensureConnection();
    if (!result.ok) {
      const message = result.error || 'Failed to connect to backend server.';
      setError(message);
      pushNotice({
        title: 'Backend unavailable',
        description: message,
        tone: 'error',
      });
      return false;
    }

    setError('');
    return true;
  }, [ensureConnection, pushNotice]);

  const handleJoinRoom = useCallback(
    async (roomId: string, name: string) => {
      const isConnected = await verifyBackendConnection();
      if (!isConnected) {
        return;
      }

      const newUserId = crypto.randomUUID();
      const cleanRoomId = roomId.trim().toLowerCase();

      emit(
        'join-room',
        {
          roomId: cleanRoomId,
          userId: newUserId,
          name,
        },
        (response?: { success?: boolean; error?: string }) => {
          if (!response?.success) {
            const message = response?.error || 'Unable to join room.';
            setError(message);
            pushNotice({
              title: 'Join failed',
              description: message,
              tone: 'error',
            });
            return;
          }

          setUserId(newUserId);
          setRoomName(cleanRoomId);
          setUsername(name);
          setMessages([]);
          setState('communicating');
          setError('');
          pushNotice({
            title: 'Room joined',
            description: `You joined ${cleanRoomId}.`,
            tone: 'success',
          });
          console.log('[ACTION] Joining room:', cleanRoomId, name);
        }
      );
    },
    [emit, verifyBackendConnection, pushNotice]
  );

  const handleCreateRoom = useCallback(
    async (roomId: string, name: string) => {
      const isConnected = await verifyBackendConnection();
      if (!isConnected) {
        return;
      }

      const newUserId = crypto.randomUUID();
      const cleanRoomId = roomId.trim().toLowerCase();

      emit(
        'create-room',
        {
          roomId: cleanRoomId,
          userId: newUserId,
          name,
        },
        (response?: { success?: boolean; error?: string }) => {
          if (!response?.success) {
            const message = response?.error || 'Unable to create room.';
            setError(message);
            pushNotice({
              title: 'Create failed',
              description: message,
              tone: 'error',
            });
            return;
          }

          setUserId(newUserId);
          setRoomName(cleanRoomId);
          setUsername(name);
          setMessages([]);
          setState('communicating');
          setError('');
          pushNotice({
            title: 'Room created',
            description: `Room ${cleanRoomId} is now live.`,
            tone: 'success',
          });
          console.log('[ACTION] Creating room:', cleanRoomId, name);
        }
      );
    },
    [emit, pushNotice, verifyBackendConnection]
  );

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!roomName || !username) return;

      const isConnected = await verifyBackendConnection();
      if (!isConnected) {
        return;
      }

      const cleanRoomId = roomName.trim().toLowerCase();

      // Emit send-message event to backend
      emit('send-message', {
        roomId: cleanRoomId,
        userId,
        message: messageText,
        timestamp: new Date(),
      });

      console.log('[ACTION] Message sent:', messageText);
    },
    [emit, roomName, username, userId, verifyBackendConnection]
  );

  const handleTalkStart = useCallback(async () => {
    const isConnected = await verifyBackendConnection();
    if (!isConnected) {
      return;
    }

    const cleanRoomId = roomName.trim().toLowerCase();
    setIsSpeaking(true);

    // Emit speaking event to backend
    emit('speaking', {
      roomId: cleanRoomId,
      userId,
      isSpeaking: true,
    });

    console.log('[ACTION] Started speaking');
  }, [emit, roomName, userId, verifyBackendConnection]);

  const handleTalkEnd = useCallback(async () => {
    const isConnected = await verifyBackendConnection();
    if (!isConnected) {
      return;
    }

    const cleanRoomId = roomName.trim().toLowerCase();
    setIsSpeaking(false);

    // Emit speaking event to backend
    emit('speaking', {
      roomId: cleanRoomId,
      userId,
      isSpeaking: false,
    });

    console.log('[ACTION] Stopped speaking');
  }, [emit, roomName, userId, verifyBackendConnection]);

  const handleLeaveRoom = useCallback(async () => {
    const isConnected = await verifyBackendConnection();
    if (!isConnected) {
      return;
    }

    if (roomName) {
      emit('leave-room', { roomId: roomName }, (response?: { success?: boolean }) => {
        if (response?.success) {
          console.log('[ACTION] Left room via leave-room event');
        }
      });
    }

    setState('joining');
    setRoomName('');
    setUsername('');
    setUserId('');
    setUsers([]);
    setMessages([]);
    setIsSpeaking(false);

    console.log('[ACTION] Left room');
  }, [emit, roomName, verifyBackendConnection]);

  const handleBackendUrlChange = useCallback(
    (url: string) => {
      try {
        const nextUrl = updateBackendUrl(url);
        pushNotice({
          title: 'Backend URL saved',
          description: `Using ${nextUrl}.`,
          tone: 'success',
        });
      } catch (error) {
        pushNotice({
          title: 'Invalid backend URL',
          description:
            error instanceof Error ? error.message : 'Enter a valid backend URL.',
          tone: 'error',
        });
      }
    },
    [pushNotice, updateBackendUrl]
  );

  const handleBackendUrlReset = useCallback(() => {
    const nextUrl = restoreDefaultBackendUrl();
    pushNotice({
      title: 'Backend URL reset',
      description: `Using ${nextUrl}.`,
      tone: 'info',
    });
  }, [pushNotice, restoreDefaultBackendUrl]);

  if (error) {
    // Keep the join/create UI visible; the error is surfaced as a notice.
  }

  return (
    <main className="relative z-0 flex min-h-dvh w-full flex-1 flex-col overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,217,255,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(157,78,221,0.16),_transparent_28%),linear-gradient(180deg,_rgba(10,14,39,0.98),_rgba(7,10,24,1))]" />

      {state === 'joining' ? (
        <JoinRoomScreen
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          backendUrl={backendUrl}
          onBackendUrlChange={handleBackendUrlChange}
          onBackendUrlReset={handleBackendUrlReset}
        />
      ) : (
        <CommunicationScreen
          roomName={roomName}
          username={username}
          users={users}
          messages={messages}
          isSpeaking={isSpeaking}
          onSendMessage={handleSendMessage}
          onTalkStart={handleTalkStart}
          onTalkEnd={handleTalkEnd}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      <div className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-3 sm:right-4 sm:top-4 sm:w-96">
        {notices.map((notice) => {
          const isError = notice.tone === 'error';
          const isSuccess = notice.tone === 'success';

          return (
            <div
              key={notice.id}
              className={cn(
                'pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl',
                'bg-white/10 dark:bg-slate-950/50 border-white/15',
                isError && 'border-rose-400/30 bg-rose-500/10',
                isSuccess && 'border-emerald-400/30 bg-emerald-500/10'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isError ? (
                    <AlertTriangle className="h-5 w-5 text-rose-300" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {notice.title}
                  </p>
                  {notice.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {notice.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    console.log('clicked');
                    dismissNotice(notice.id);
                  }}
                  className="relative z-20 touch-manipulation pointer-events-auto rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

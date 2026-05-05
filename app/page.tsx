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

const USER_ID_STORAGE_KEY = 'nexus.userId';
const SESSION_STORAGE_KEY = 'nexus.session';

function getStoredUserId() {
  if (typeof window === 'undefined') {
    return '';
  }

  const existingUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existingUserId) {
    return existingUserId;
  }

  const nextUserId = crypto.randomUUID();
  window.localStorage.setItem(USER_ID_STORAGE_KEY, nextUserId);
  return nextUserId;
}

function saveSession(roomId: string, name: string) {
  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ roomId, name })
  );
}

function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

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
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const roomNameRef = useRef('');
  const userIdRef = useRef('');

  useEffect(() => {
    roomNameRef.current = roomName;
  }, [roomName]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

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

  const setLocalAudioEnabled = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => {
      track.enabled = false;
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const getOrCreateRemoteAudio = useCallback((socketId: string) => {
    const existingAudio = remoteAudioRef.current.get(socketId);
    if (existingAudio) {
      return existingAudio;
    }

    const audio = new Audio();
    audio.autoplay = true;
    audio.playsInline = true;
    audio.dataset.socketId = socketId;
    remoteAudioRef.current.set(socketId, audio);
    return audio;
  }, []);

  const closePeerConnection = useCallback((socketId: string) => {
    const peerConnection = peerConnectionsRef.current.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(socketId);
    }

    pendingIceCandidatesRef.current.delete(socketId);

    const audio = remoteAudioRef.current.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRef.current.delete(socketId);
    }
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((_, socketId) => {
      closePeerConnection(socketId);
    });
  }, [closePeerConnection]);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const addRemoteIceCandidate = useCallback(
    async (socketId: string, candidate: RTCIceCandidateInit) => {
      const peerConnection = peerConnectionsRef.current.get(socketId);
      if (!peerConnection?.remoteDescription) {
        const pendingCandidates =
          pendingIceCandidatesRef.current.get(socketId) || [];
        pendingCandidates.push(candidate);
        pendingIceCandidatesRef.current.set(socketId, pendingCandidates);
        return;
      }

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    },
    []
  );

  const flushPendingIceCandidates = useCallback(async (socketId: string) => {
    const peerConnection = peerConnectionsRef.current.get(socketId);
    const pendingCandidates = pendingIceCandidatesRef.current.get(socketId);

    if (!peerConnection?.remoteDescription || !pendingCandidates?.length) {
      return;
    }

    pendingIceCandidatesRef.current.delete(socketId);
    await Promise.all(
      pendingCandidates.map((candidate) =>
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      )
    );
  }, []);

  useEffect(() => {
    setUserId(getStoredUserId());

    return () => {
      Object.values(noticeTimers.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      closeAllPeerConnections();
      stopLocalStream();
    };
  }, [closeAllPeerConnections, stopLocalStream]);

  const createPeerConnection = useCallback(
    async (targetSocketId: string, shouldCreateOffer = false) => {
      if (!targetSocketId) {
        return null;
      }

      const existingPeerConnection =
        peerConnectionsRef.current.get(targetSocketId);
      if (existingPeerConnection) {
        return existingPeerConnection;
      }

      const localStream = await ensureLocalStream();
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnectionsRef.current.set(targetSocketId, peerConnection);

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !roomNameRef.current) {
          return;
        }

        emit('webrtc-ice-candidate', {
          roomId: roomNameRef.current,
          targetSocketId,
          candidate: event.candidate,
        });
      };

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) {
          return;
        }

        const audio = getOrCreateRemoteAudio(targetSocketId);
        audio.srcObject = remoteStream;
        audio.play().catch((error) => {
          console.warn('[WEBRTC] Remote audio playback blocked:', error);
        });
      };

      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed' ||
          peerConnection.connectionState === 'disconnected'
        ) {
          closePeerConnection(targetSocketId);
        }
      };

      if (shouldCreateOffer && roomNameRef.current) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        emit('webrtc-offer', {
          roomId: roomNameRef.current,
          targetSocketId,
          offer,
        });
      }

      return peerConnection;
    },
    [closePeerConnection, emit, ensureLocalStream, getOrCreateRemoteAudio]
  );

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

      createPeerConnection(data.socketId).catch((error) => {
        console.error('[WEBRTC] Failed to prepare peer:', error);
      });
    });

    return () => off('user-joined');
  }, [createPeerConnection, on, off]);

  // Handle user-left event
  useEffect(() => {
    on('user-left', (data) => {
      console.log('[EVENT] User left:', data);
      setUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
      closePeerConnection(data.socketId);
    });

    return () => off('user-left');
  }, [closePeerConnection, on, off]);

  // Handle room-users event (initial list)
  useEffect(() => {
    on('room-users', (data) => {
      console.log('[EVENT] Room users:', data.users);
      const roomUsers = Array.isArray(data.users) ? data.users : [];
      setUsers(
        roomUsers.map((u: any) => ({
          socketId: u.socketId,
          userId: u.userId,
          name: u.name,
          initials: u.name.slice(0, 2).toUpperCase(),
          isSpeaking: false,
          isConnected: true,
        }))
      );

      roomUsers.forEach((user: any) => {
        createPeerConnection(user.socketId, true).catch((error) => {
          console.error('[WEBRTC] Failed to create offer:', error);
        });
      });
    });

    return () => off('room-users');
  }, [createPeerConnection, on, off]);

  // Handle receive-message event
  useEffect(() => {
    on('receive-message', (data) => {
      console.log('[EVENT] Message received:', data);
      setMessages((prev) => [
        ...prev,
        {
          id: data.id || `msg-${Date.now()}-${Math.random()}`,
          sender: data.name || data.userId,
          userId: data.userId,
          message: data.message,
          timestamp: new Date(data.timestamp),
          isOwn: data.userId === userId || data.socketId === socket?.id,
        },
      ]);
    });

    return () => off('receive-message');
  }, [on, off, socket?.id, userId]);

  useEffect(() => {
    on('previous-messages', (data) => {
      const previousMessages = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(
        previousMessages.map((message: any) => ({
          id: message.id || `msg-${message.timestamp}-${message.userId}`,
          sender: message.name || message.userId,
          userId: message.userId,
          message: message.message,
          timestamp: new Date(message.timestamp),
          isOwn: message.userId === userId,
        }))
      );
    });

    return () => off('previous-messages');
  }, [on, off, userId]);

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

  useEffect(() => {
    on('webrtc-offer', async (data) => {
      try {
        const fromSocketId = data?.fromSocketId;
        const offer = data?.offer;
        if (!fromSocketId || !offer) {
          return;
        }

        const peerConnection = await createPeerConnection(fromSocketId);
        if (!peerConnection) {
          return;
        }

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        await flushPendingIceCandidates(fromSocketId);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        emit('webrtc-answer', {
          roomId: roomNameRef.current,
          targetSocketId: fromSocketId,
          answer,
        });
      } catch (error) {
        console.error('[WEBRTC] Failed to handle offer:', error);
      }
    });

    return () => off('webrtc-offer');
  }, [createPeerConnection, emit, flushPendingIceCandidates, on, off]);

  useEffect(() => {
    on('webrtc-answer', async (data) => {
      try {
        const fromSocketId = data?.fromSocketId;
        const answer = data?.answer;
        if (!fromSocketId || !answer) {
          return;
        }

        const peerConnection =
          peerConnectionsRef.current.get(fromSocketId);
        if (!peerConnection) {
          return;
        }

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        await flushPendingIceCandidates(fromSocketId);
      } catch (error) {
        console.error('[WEBRTC] Failed to handle answer:', error);
      }
    });

    return () => off('webrtc-answer');
  }, [flushPendingIceCandidates, on, off]);

  useEffect(() => {
    on('webrtc-ice-candidate', async (data) => {
      try {
        const fromSocketId = data?.fromSocketId;
        const candidate = data?.candidate;
        if (!fromSocketId || !candidate) {
          return;
        }

        const peerConnection =
          peerConnectionsRef.current.get(fromSocketId) ||
          (await createPeerConnection(fromSocketId));
        if (!peerConnection) {
          return;
        }

        await addRemoteIceCandidate(fromSocketId, candidate);
      } catch (error) {
        console.error('[WEBRTC] Failed to add ICE candidate:', error);
      }
    });

    return () => off('webrtc-ice-candidate');
  }, [addRemoteIceCandidate, createPeerConnection, on, off]);

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

  const finishRoomEntry = useCallback(
    (cleanRoomId: string, name: string) => {
      setRoomName(cleanRoomId);
      setUsername(name);
      setState('communicating');
      setError('');
      saveSession(cleanRoomId, name);
    },
    []
  );

  const handleJoinRoom = useCallback(
    async (roomId: string, name: string) => {
      const isConnected = await verifyBackendConnection();
      if (!isConnected) {
        return;
      }

      try {
        await ensureLocalStream();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Microphone permission is required for voice chat.';
        setError(message);
        pushNotice({
          title: 'Microphone unavailable',
          description: message,
          tone: 'error',
        });
        return;
      }

      const activeUserId = userId || getStoredUserId();
      setUserId(activeUserId);
      const cleanRoomId = roomId.trim().toLowerCase();
      roomNameRef.current = cleanRoomId;
      setMessages([]);

      emit(
        'join-room',
        {
          roomId: cleanRoomId,
          userId: activeUserId,
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

          finishRoomEntry(cleanRoomId, name);
          pushNotice({
            title: 'Room joined',
            description: `You joined ${cleanRoomId}.`,
            tone: 'success',
          });
          console.log('[ACTION] Joining room:', cleanRoomId, name);
        }
      );
    },
    [
      emit,
      ensureLocalStream,
      finishRoomEntry,
      pushNotice,
      userId,
      verifyBackendConnection,
    ]
  );

  const handleCreateRoom = useCallback(
    async (roomId: string, name: string) => {
      const isConnected = await verifyBackendConnection();
      if (!isConnected) {
        return;
      }

      try {
        await ensureLocalStream();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Microphone permission is required for voice chat.';
        setError(message);
        pushNotice({
          title: 'Microphone unavailable',
          description: message,
          tone: 'error',
        });
        return;
      }

      const activeUserId = userId || getStoredUserId();
      setUserId(activeUserId);
      const cleanRoomId = roomId.trim().toLowerCase();
      roomNameRef.current = cleanRoomId;
      setMessages([]);

      emit(
        'create-room',
        {
          roomId: cleanRoomId,
          userId: activeUserId,
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

          finishRoomEntry(cleanRoomId, name);
          pushNotice({
            title: 'Room created',
            description: `Room ${cleanRoomId} is now live.`,
            tone: 'success',
          });
          console.log('[ACTION] Creating room:', cleanRoomId, name);
        }
      );
    },
    [
      emit,
      ensureLocalStream,
      finishRoomEntry,
      pushNotice,
      userId,
      verifyBackendConnection,
    ]
  );

  useEffect(() => {
    if (!userId || state !== 'joining') {
      return;
    }

    const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedSession) {
      return;
    }

    try {
      const session = JSON.parse(savedSession) as {
        roomId?: string;
        name?: string;
      };

      if (session.roomId && session.name) {
        handleJoinRoom(session.roomId, session.name);
      }
    } catch {
      clearSession();
    }
  }, [handleJoinRoom, state, userId]);

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

    try {
      await ensureLocalStream();
      setLocalAudioEnabled(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Microphone permission is required to talk.';
      pushNotice({
        title: 'Microphone unavailable',
        description: message,
        tone: 'error',
      });
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
  }, [
    emit,
    ensureLocalStream,
    pushNotice,
    roomName,
    setLocalAudioEnabled,
    userId,
    verifyBackendConnection,
  ]);

  const handleTalkEnd = useCallback(async () => {
    const isConnected = await verifyBackendConnection();
    if (!isConnected) {
      return;
    }

    const cleanRoomId = roomName.trim().toLowerCase();
    setLocalAudioEnabled(false);
    setIsSpeaking(false);

    // Emit speaking event to backend
    emit('speaking', {
      roomId: cleanRoomId,
      userId,
      isSpeaking: false,
    });

    console.log('[ACTION] Stopped speaking');
  }, [emit, roomName, setLocalAudioEnabled, userId, verifyBackendConnection]);

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
    setUsers([]);
    setMessages([]);
    setIsSpeaking(false);
    setLocalAudioEnabled(false);
    closeAllPeerConnections();
    stopLocalStream();
    clearSession();

    console.log('[ACTION] Left room');
  }, [
    closeAllPeerConnections,
    emit,
    roomName,
    setLocalAudioEnabled,
    stopLocalStream,
    verifyBackendConnection,
  ]);

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

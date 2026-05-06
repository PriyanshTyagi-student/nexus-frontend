'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { JoinRoomScreen } from '@/components/walkie-talkie/join-room-screen';
import { CommunicationScreen } from '@/components/walkie-talkie/communication-screen';
import { useSocket } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bug, CheckCircle2, Signal, X } from 'lucide-react';

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

type PeerDebugState = {
  socketId: string;
  connectionState: string;
  iceState: string;
};

type WebRtcDebugStats = {
  socketConnected: boolean;
  peers: number;
  connectedPeers: number;
  pendingIce: number;
  remoteAudioElements: number;
  localTrackState: string;
  localTrackEnabled: boolean;
  audioUnlocked: boolean;
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
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugStats, setDebugStats] = useState<WebRtcDebugStats>({
    socketConnected: false,
    peers: 0,
    connectedPeers: 0,
    pendingIce: 0,
    remoteAudioElements: 0,
    localTrackState: 'none',
    localTrackEnabled: false,
    audioUnlocked: false,
  });
  const [peerDebugStates, setPeerDebugStates] = useState<PeerDebugState[]>([]);
  const noticeTimers = useRef<Record<string, number>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
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

  const unlockRemoteAudioPlayback = useCallback(async () => {
    if (audioUnlockedRef.current) {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioContextConstructor && !audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    audioUnlockedRef.current = true;

    await Promise.all(
      Array.from(remoteAudioRef.current.values()).map(async (audio) => {
        try {
          await audio.play();
        } catch {
          // Playback can still fail until a stream is attached.
        }
      })
    );
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    stream.getTracks().forEach((track) => {
      track.enabled = false;
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const recoverLocalStream = useCallback(async () => {
    const previousSpeaking = isSpeaking;

    try {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      nextStream.getAudioTracks().forEach((track) => {
        track.enabled = previousSpeaking;
      });

      localStreamRef.current = nextStream;

      await Promise.all(
        Array.from(peerConnectionsRef.current.values()).map(async (pc) => {
          const nextTrack = nextStream.getAudioTracks()[0];
          const sender = pc
            .getSenders()
            .find((item) => item.track && item.track.kind === 'audio');

          if (nextTrack && sender) {
            await sender.replaceTrack(nextTrack);
          }
        })
      );
    } catch (error) {
      console.error('[WEBRTC] Failed to recover local audio stream:', error);
      pushNotice({
        title: 'Microphone stream reset failed',
        description: 'Rejoin the room or grant microphone access again.',
        tone: 'error',
      });
    }
  }, [isSpeaking, pushNotice]);

  const getOrCreateRemoteAudio = useCallback((socketId: string) => {
    const existingAudio = remoteAudioRef.current.get(socketId);
    if (existingAudio) {
      return existingAudio;
    }

    const audio = new Audio();
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    audio.muted = false;
    audio.volume = 1;
    audio.preload = 'auto';
    audio.dataset.socketId = socketId;
    audio.style.display = 'none';
    document.body.appendChild(audio);
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
      audio.remove();
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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
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
          candidate: event.candidate.toJSON(),
        });
      };

      peerConnection.ontrack = (event) => {
        const [streamFromEvent] = event.streams;
        const remoteStream =
          streamFromEvent || new MediaStream(event.track ? [event.track] : []);

        if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
          return;
        }

        const audio = getOrCreateRemoteAudio(targetSocketId);
        remoteStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        audio.srcObject = remoteStream;

        const tryPlay = async () => {
          try {
            await audio.play();
          } catch (error) {
            console.warn('[WEBRTC] Remote audio playback blocked:', error);
          }
        };

        void tryPlay();
        audio.oncanplay = () => {
          void tryPlay();
        };
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
      setUsers((prev) => {
        if (prev.some((user) => user.socketId === data.socketId)) {
          return prev;
        }

        return [
          ...prev,
          {
            socketId: data.socketId,
            userId: data.userId,
            name: data.name,
            initials: data.name.slice(0, 2).toUpperCase(),
            isSpeaking: false,
            isConnected: true,
          },
        ];
      });

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

      if (data?.socketId && data.socketId !== socket?.id && data?.name) {
        setUsers((prev) => {
          if (prev.some((user) => user.socketId === data.socketId)) {
            return prev;
          }

          return [
            ...prev,
            {
              socketId: data.socketId,
              userId: data.userId,
              name: data.name,
              initials: String(data.name).slice(0, 2).toUpperCase(),
              isSpeaking: false,
              isConnected: true,
            },
          ];
        });

        createPeerConnection(data.socketId).catch((error) => {
          console.error('[WEBRTC] Failed to create peer from message event:', error);
        });
      }

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
  }, [createPeerConnection, off, on, socket?.id, userId]);

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

      if (data?.socketId && data.socketId !== socket?.id && data?.name) {
        setUsers((prev) => {
          if (prev.some((user) => user.socketId === data.socketId)) {
            return prev;
          }

          return [
            ...prev,
            {
              socketId: data.socketId,
              userId: data.userId,
              name: data.name,
              initials: String(data.name).slice(0, 2).toUpperCase(),
              isSpeaking: Boolean(data.isSpeaking),
              isConnected: true,
            },
          ];
        });

        createPeerConnection(data.socketId).catch((error) => {
          console.error('[WEBRTC] Failed to create peer from speaking event:', error);
        });
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.socketId === data.socketId
            ? { ...u, isSpeaking: data.isSpeaking }
            : u
        )
      );
    });

    return () => off('user-speaking');
  }, [createPeerConnection, off, on, socket?.id]);

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

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = async () => {
      const hasEndedTrack =
        localStreamRef.current
          ?.getAudioTracks()
          .some((track) => track.readyState !== 'live') ?? false;

      if (hasEndedTrack || isSpeaking) {
        await recoverLocalStream();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange
      );
    };
  }, [isSpeaking, recoverLocalStream]);

  useEffect(() => {
    if (state !== 'communicating') {
      setPeerDebugStates([]);
      return;
    }

    const updateDebug = () => {
      const localTrack = localStreamRef.current?.getAudioTracks()?.[0] || null;
      const peers = Array.from(peerConnectionsRef.current.entries());
      const pendingIce = Array.from(pendingIceCandidatesRef.current.values())
        .reduce((sum, list) => sum + list.length, 0);

      setDebugStats({
        socketConnected: Boolean(socket?.connected),
        peers: peers.length,
        connectedPeers: peers.filter(
          ([, pc]) => pc.connectionState === 'connected'
        ).length,
        pendingIce,
        remoteAudioElements: remoteAudioRef.current.size,
        localTrackState: localTrack?.readyState || 'none',
        localTrackEnabled: Boolean(localTrack?.enabled),
        audioUnlocked: audioUnlockedRef.current,
      });

      setPeerDebugStates(
        peers.slice(0, 6).map(([socketId, pc]) => ({
          socketId: socketId.slice(0, 6),
          connectionState: pc.connectionState,
          iceState: pc.iceConnectionState,
        }))
      );
    };

    updateDebug();
    const interval = window.setInterval(updateDebug, 700);

    return () => {
      window.clearInterval(interval);
    };
  }, [socket?.connected, state]);

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
        await unlockRemoteAudioPlayback();
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
      unlockRemoteAudioPlayback,
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
        await unlockRemoteAudioPlayback();
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
      unlockRemoteAudioPlayback,
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
    try {
      await unlockRemoteAudioPlayback();
      const stream = await ensureLocalStream();
      const hasDeadTrack = stream
        .getAudioTracks()
        .some((track) => track.readyState !== 'live');

      if (hasDeadTrack) {
        await recoverLocalStream();
      }

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
    if (socket?.connected) {
      emit('speaking', {
        roomId: cleanRoomId,
        userId,
        isSpeaking: true,
      });
    }

    console.log('[ACTION] Started speaking');
  }, [
    emit,
    ensureLocalStream,
    pushNotice,
    roomName,
    setLocalAudioEnabled,
    socket?.connected,
    unlockRemoteAudioPlayback,
    recoverLocalStream,
    userId,
  ]);

  const handleTalkEnd = useCallback(async () => {
    const cleanRoomId = roomName.trim().toLowerCase();
    setLocalAudioEnabled(false);
    setIsSpeaking(false);

    // Emit speaking event to backend
    if (socket?.connected) {
      emit('speaking', {
        roomId: cleanRoomId,
        userId,
        isSpeaking: false,
      });
    }

    console.log('[ACTION] Stopped speaking');
  }, [emit, roomName, setLocalAudioEnabled, socket?.connected, userId]);

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
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,217,255,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(157,78,221,0.2),_transparent_28%),linear-gradient(180deg,_rgba(10,14,39,0.98),_rgba(7,10,24,1))]" />
      <div className="pointer-events-none absolute -left-20 top-20 z-0 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl animate-aurora-drift" />
      <div className="pointer-events-none absolute -right-16 bottom-24 z-0 h-52 w-52 rounded-full bg-fuchsia-400/15 blur-3xl animate-aurora-drift-slow" />

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
                'pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl animate-float-up',
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
                  onClick={() => dismissNotice(notice.id)}

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

      {state === 'communicating' ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-[85] w-[calc(100vw-1.5rem)] max-w-sm sm:bottom-4 sm:left-4">
          <div className="pointer-events-auto rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-3 text-xs text-cyan-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl animate-glass-shift">
            <button
              type="button"
              onClick={() => setDebugOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
            >
              <span className="flex items-center gap-2 font-semibold tracking-wide text-cyan-100">
                <Bug className="h-4 w-4" />
                WebRTC Debug
              </span>
              <span className="flex items-center gap-1 text-[11px] text-cyan-200/90">
                <Signal className="h-3.5 w-3.5" />
                {debugStats.connectedPeers}/{debugStats.peers} peers
              </span>
            </button>

            {debugOpen ? (
              <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 text-[11px] leading-relaxed">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="text-cyan-100/80">Socket</span>
                  <span className={cn('font-semibold', debugStats.socketConnected ? 'text-emerald-300' : 'text-rose-300')}>
                    {debugStats.socketConnected ? 'connected' : 'disconnected'}
                  </span>
                  <span className="text-cyan-100/80">Local Track</span>
                  <span className="font-semibold text-cyan-100">
                    {debugStats.localTrackState} / {debugStats.localTrackEnabled ? 'enabled' : 'disabled'}
                  </span>
                  <span className="text-cyan-100/80">Audio Unlock</span>
                  <span className={cn('font-semibold', debugStats.audioUnlocked ? 'text-emerald-300' : 'text-amber-300')}>
                    {debugStats.audioUnlocked ? 'ready' : 'locked'}
                  </span>
                  <span className="text-cyan-100/80">Pending ICE</span>
                  <span className="font-semibold text-cyan-100">{debugStats.pendingIce}</span>
                  <span className="text-cyan-100/80">Remote Audio</span>
                  <span className="font-semibold text-cyan-100">{debugStats.remoteAudioElements}</span>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <p className="mb-1 font-semibold text-cyan-100/90">Peers</p>
                  {peerDebugStates.length === 0 ? (
                    <p className="text-cyan-100/70">No active peers</p>
                  ) : (
                    peerDebugStates.map((peer) => (
                      <p key={peer.socketId} className="truncate text-cyan-100/85">
                        {peer.socketId}: {peer.connectionState} / {peer.iceState}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

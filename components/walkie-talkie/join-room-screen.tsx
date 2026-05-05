'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, Plus, LogIn, Loader2, Server, RotateCcw } from 'lucide-react';

interface JoinRoomScreenProps {
  onJoinRoom?: (roomId: string, username: string) => void;
  onCreateRoom?: (roomName: string, username: string) => void;
  backendUrl?: string;
  onBackendUrlChange?: (url: string) => void;
  onBackendUrlReset?: () => void;
}

type MicPermissionResult = {
  ok: boolean;
  message: string;
};

async function requestMicrophonePermission(): Promise<MicPermissionResult> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        ok: false,
        message: 'Microphone access is not available in this browser.',
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('[MIC] Permission granted');
    stream.getTracks().forEach(track => track.stop());
    return {
      ok: true,
      message: 'Microphone is enabled.',
    };
  } catch (error) {
    console.error('[MIC] Permission denied:', error);
    const message =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Enable it in your browser or app settings.'
        : 'Could not access the microphone. Mobile browsers require HTTPS or the installed app.';

    return {
      ok: false,
      message,
    };
  }
}

export function JoinRoomScreen({
  onJoinRoom,
  onCreateRoom,
  backendUrl = '',
  onBackendUrlChange,
  onBackendUrlReset,
}: JoinRoomScreenProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [roomInput, setRoomInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [backendUrlInput, setBackendUrlInput] = useState(backendUrl);
  const [micMessage, setMicMessage] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = roomInput.trim().length > 0 && usernameInput.trim().length > 0;

  useEffect(() => {
    setBackendUrlInput(backendUrl);
  }, [backendUrl]);

  const handleBackendUrlApply = () => {
    onBackendUrlChange?.(backendUrlInput);
  };

  const handleBackendUrlReset = () => {
    onBackendUrlReset?.();
  };

  const ensureMicrophonePermission = async () => {
    const result = await requestMicrophonePermission();
    setHasMicPermission(result.ok);
    setMicMessage(result.message);
    return result.ok;
  };

  const handleJoin = async () => {
    if (!isValid || isLoading) return;
    setIsLoading(true);
    try {
      const hasPermission = hasMicPermission || (await ensureMicrophonePermission());
      if (!hasPermission) return;
      await onJoinRoom?.(roomInput.trim(), usernameInput.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!isValid || isLoading) return;
    setIsLoading(true);
    try {
      const hasPermission = hasMicPermission || (await ensureMicrophonePermission());
      if (!hasPermission) return;
      await onCreateRoom?.(roomInput.trim(), usernameInput.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && isValid) {
      e.preventDefault();
      mode === 'join' ? await handleJoin() : await handleCreate();
    }
  };

  const handleModeToggle = (newMode: 'join' | 'create') => {
    setMode(newMode);
  };

  return (
    <div className="relative z-10 flex min-h-dvh w-full flex-1 flex-col items-center justify-center overflow-x-hidden px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="pointer-events-none absolute z-0 left-1/2 top-[-8rem] h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute z-0 bottom-[-6rem] left-0 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="pointer-events-none absolute z-0 right-0 top-1/4 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-20 pointer-events-auto rounded-3xl border border-white/15 bg-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl p-6 sm:p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Nexus</h1>
        </div>

        <p className="text-center text-xs sm:text-sm text-muted-foreground mb-6">
          Secure walkie-talkie communication
        </p>

        <div className="relative z-20 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Server className="h-4 w-4 text-cyan-300" />
              Backend URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                placeholder="http://192.168.1.10:5000"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/8 px-3 py-3 text-base"
              />
              <button
                type="button"
                onClick={handleBackendUrlApply}
                className="min-h-12 rounded-2xl bg-cyan-400/15 px-4 text-sm font-semibold text-cyan-100"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleBackendUrlReset}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-white/8 text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={ensureMicrophonePermission}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3"
          >
            <Mic className="h-4 w-4" />
            <span className="text-sm font-medium">
              {hasMicPermission ? 'Microphone enabled' : 'Enable microphone'}
            </span>
          </button>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Secret Code
            </label>
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter code..."
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-base"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Your Name
            </label>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter your name..."
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-base"
            />
          </div>

          <button
            type="button"
            disabled={!isValid || isLoading}
            onClick={mode === 'join' ? handleJoin : handleCreate}
            className="w-full h-14 rounded-2xl px-4 font-semibold text-white bg-gradient-to-r from-cyan-400 to-indigo-500"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
            {mode === 'join' ? 'Join Room' : 'Create Room'}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Press & hold to transmit. Release to listen.
        </p>
      </div>
    </div>
  );
}


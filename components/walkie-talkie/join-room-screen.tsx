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

  const isValid = roomInput.trim().length === 6 && usernameInput.trim().length > 0 && /^\d{6}$/.test(roomInput);

  useEffect(() => {
    setBackendUrlInput(backendUrl);
  }, [backendUrl]);

  const handleBackendUrlApply = () => {
    console.log('clicked');
    onBackendUrlChange?.(backendUrlInput);
  };

  const handleBackendUrlReset = () => {
    console.log('clicked');
    onBackendUrlReset?.();
  };

  const ensureMicrophonePermission = async () => {
    const result = await requestMicrophonePermission();
    setHasMicPermission(result.ok);
    setMicMessage(result.message);
    return result.ok;
  };

  const handleJoin = async () => {
    if (!isValid || isLoading) {
      console.log('[DEBUG] Join blocked: valid=', isValid, 'loading=', isLoading);
      return;
    }
    console.log('clicked');
    console.log('[DEBUG] Join button clicked');
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
    if (!isValid || isLoading) {
      console.log('[DEBUG] Create blocked: valid=', isValid, 'loading=', isLoading);
      return;
    }
    console.log('clicked');
    console.log('[DEBUG] Create button clicked');
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
      console.log('[KEYPRESS] Enter pressed');
      mode === 'join' ? await handleJoin() : await handleCreate();
    }
  };

  const handleModeToggle = (newMode: 'join' | 'create') => {
    setMode(newMode);
    console.log('[MODE] Switched to', newMode);
  };

  return (
    <div className="relative z-10 flex min-h-dvh w-full flex-1 flex-col items-center justify-center overflow-x-hidden px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="pointer-events-none absolute z-0 left-1/2 top-[-8rem] h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute z-0 bottom-[-6rem] left-0 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="pointer-events-none absolute z-0 right-0 top-1/4 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      {/* Main card */}
      <div
        className={cn(
          'w-full max-w-md relative z-20 pointer-events-auto',
          'rounded-3xl border border-white/15 bg-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.35)]',
          'backdrop-blur-2xl p-6 sm:p-8'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Nexus</h1>
        </div>

        {/* Title */}
        <p className="text-center text-xs sm:text-sm text-muted-foreground mb-6">
          Secure glassmorphism walkie-talkie communication
        </p>

        {/* Form */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBackendUrlApply();
                  }
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="url"
                inputMode="url"
                placeholder="http://192.168.1.10:5000"
                style={{ fontSize: '16px' }}
                className={cn(
                  'min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/8 px-3 py-3 text-foreground placeholder:text-muted-foreground',
                  'relative z-20 touch-manipulation pointer-events-auto text-base',
                  'backdrop-blur-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/30'
                )}
              />
              <button
                type="button"
                onClick={handleBackendUrlApply}
                className="relative z-20 min-h-12 rounded-2xl bg-cyan-400/15 px-4 text-sm font-semibold text-cyan-100 touch-manipulation pointer-events-auto"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleBackendUrlReset}
                aria-label="Reset backend URL"
                className="relative z-20 flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-white/8 text-muted-foreground touch-manipulation pointer-events-auto"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              console.log('clicked');
              ensureMicrophonePermission();
            }}
            className={cn(
              'relative z-20 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3',
              'touch-manipulation pointer-events-auto transition-colors',
              hasMicPermission
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                : 'border-white/10 bg-white/8 text-foreground hover:bg-white/12'
            )}
          >
            <Mic className="h-4 w-4" />
            <span className="text-sm font-medium">
              {hasMicPermission ? 'Microphone enabled' : 'Enable microphone'}
            </span>
          </button>
          {micMessage ? (
            <p className="text-center text-xs leading-5 text-muted-foreground">
              {micMessage}
            </p>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Secret Code (6 digits)
            </label>
            <input
              type="number"
              inputMode="numeric"
              maxLength={6}
              value={roomInput}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0,6);
                setRoomInput(value);
                console.log('[INPUT] Code updated:', value);
              }}
              onKeyDown={handleKeyPress}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              placeholder="123456"
              style={{
                fontSize: '16px',
              }}
              className={cn(
                'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-foreground placeholder:text-muted-foreground',
                'backdrop-blur-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/30',
                'text-base shadow-inner shadow-black/10',
                'relative z-20 touch-manipulation pointer-events-auto',
                isLoading && 'opacity-75',
                roomInput.length !== 6 && 'border-yellow-400/50'
              )}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Your Name
            </label>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => {
                setUsernameInput(e.target.value);
                console.log('[INPUT] Username updated:', e.target.value);
              }}
              onKeyDown={handleKeyPress}
              autoCapitalize="words"
              autoCorrect="off"
              autoComplete="name"
              inputMode="text"
              placeholder="Enter your name..."
              style={{
                fontSize: '16px',
              }}
              className={cn(
                'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3.5 text-foreground placeholder:text-muted-foreground',
                'backdrop-blur-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/30',
                'text-base shadow-inner shadow-black/10',
                'relative z-20 touch-manipulation pointer-events-auto',
                isLoading && 'opacity-75'
              )}
            />
          </div>

          <button
            type="button"
            disabled={!isValid || isLoading}
            onClick={() => {
              console.log('clicked');
              console.log('[BUTTON] Clicked! valid=', isValid, 'loading=', isLoading);
              if (isValid && !isLoading) {
                mode === 'join' ? handleJoin() : handleCreate();
              }
            }}
            style={{
              fontSize: '16px',
            }}
            className={cn(
              'w-full h-14 sm:min-h-12 rounded-2xl px-4 font-semibold text-white text-base',
              'bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 shadow-lg shadow-cyan-500/20',
              'transition-all duration-200 touch-manipulation active:scale-95',
              'flex items-center justify-center gap-2',
              'pointer-events-auto z-20 relative',
              isValid && !isLoading && 'hover:shadow-cyan-500/40 cursor-pointer',
              (!isValid || isLoading) && 'opacity-60 cursor-not-allowed'
            )}
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />}
            <span className="truncate">{mode === 'join' ? 'Join Room' : 'Create Room'}</span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 leading-5">
          Enter 6-digit code. Press & hold to transmit.
        </p>
      </div>
    </div>
  );
}


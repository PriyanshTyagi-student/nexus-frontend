'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Mic, Loader2, Server, RotateCcw } from 'lucide-react';

interface JoinRoomScreenProps {
  onJoinRoom?: (roomId: string, username: string) => void;
  onCreateRoom?: (roomName: string, username: string) => void;
  backendUrl?: string;
  onBackendUrlChange?: (url: string) => void;
  onBackendUrlReset?: () => void;
}

export function JoinRoomScreen({
  onJoinRoom,
  onCreateRoom,
  backendUrl = '',
  onBackendUrlChange,
  onBackendUrlReset,
}: JoinRoomScreenProps) {
  const [mode, setMode] = useState<'join' | 'create'>('create');
  const [roomInput, setRoomInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [backendUrlInput, setBackendUrlInput] = useState(backendUrl);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = roomInput.trim().length > 0 && usernameInput.trim().length > 0;

  const handleJoin = useCallback(async () => {
    if (!isValid || isLoading) return;
    setIsLoading(true);
    try {
      await onJoinRoom?.(roomInput.trim(), usernameInput.trim());
    } finally {
      setIsLoading(false);
    }
  }, [isValid, isLoading, roomInput, usernameInput, onJoinRoom]);

  const handleCreate = useCallback(async () => {
    if (!isValid || isLoading) return;
    setIsLoading(true);
    try {
      await onCreateRoom?.(roomInput.trim(), usernameInput.trim());
    } finally {
      setIsLoading(false);
    }
  }, [isValid, isLoading, roomInput, usernameInput, onCreateRoom]);

  const handleSubmit = mode === 'create' ? handleCreate : handleJoin;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
            Nexus
          </h1>
          <p className="text-gray-400">Real-time voice chat</p>
        </div>

        {/* Backend URL */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Backend URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={backendUrlInput}
              onChange={(e) => setBackendUrlInput(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="http://localhost:5000"
            />
            <button
              onClick={() => onBackendUrlChange?.(backendUrlInput)}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-600"
            >
              Save
            </button>
            <button
              onClick={onBackendUrlReset}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Secret Code */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Secret Code
          </label>
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-lg font-mono tracking-wider"
            placeholder="Enter room code"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Your name"
          />
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setMode('create')}
            className={cn(
              'flex-1 py-3 px-4 rounded-lg font-medium transition-all',
              mode === 'create' 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' 
                : 'text-gray-400 hover:text-white'
            )}
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            className={cn(
              'flex-1 py-3 px-4 rounded-lg font-medium transition-all',
              mode === 'join' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                : 'text-gray-400 hover:text-white'
            )}
          >
            Join Room
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full py-4 px-6 rounded-2xl font-semibold text-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-2xl hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 transition-all duration-200"
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          ) : mode === 'create' ? (
            'Create & Join'
          ) : (
            'Join Room'
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Press and hold to talk, release to listen
        </p>
      </div>
    </div>
  );
}


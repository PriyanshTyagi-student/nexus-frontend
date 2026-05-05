// Custom hook for using Socket.io in React components
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  checkBackendStatus,
  connectSocketWithTimeout,
  getBackendUrl,
  getSocket,
  resetBackendUrl,
  setBackendUrl,
} from '@/lib/socket';

/**
 * Custom hook to use Socket.io in components
 * Automatically manages socket connection lifecycle
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [backendUrl, setBackendUrlState] = useState('');

  useEffect(() => {
    // Get or create socket connection
    socketRef.current = getSocket();
    setBackendUrlState(getBackendUrl());

    return () => {
      // Note: We don't disconnect here to keep connection alive
      // as multiple components may use the socket
    };
  }, [backendUrl]);

  const updateBackendUrl = useCallback((url: string) => {
    const nextUrl = setBackendUrl(url);
    socketRef.current = getSocket();
    setBackendUrlState(nextUrl);
    return nextUrl;
  }, []);

  const restoreDefaultBackendUrl = useCallback(() => {
    const nextUrl = resetBackendUrl();
    socketRef.current = getSocket();
    setBackendUrlState(nextUrl);
    return nextUrl;
  }, []);

  const emit = useCallback(
    (
      event: string,
      data?: any,
      callback?: (...args: any[]) => void
    ) => {
      if (socketRef.current) {
        if (callback) {
          socketRef.current.emit(event, data, callback);
          return;
        }

        socketRef.current.emit(event, data);
      }
    },
    [backendUrl]
  );

  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback);
      }
    },
    [backendUrl]
  );

  const off = useCallback(
    (event: string, callback?: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    },
    [backendUrl]
  );

  const once = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.once(event, callback);
      }
    },
    [backendUrl]
  );

  const ensureConnection = useCallback(async () => {
    const health = await checkBackendStatus();
    if (!health.ok) {
      return {
        ok: false,
        error:
          health.message ||
          'Backend is unavailable. Please start the backend server.',
      };
    }

    try {
      const activeSocket = await connectSocketWithTimeout();
      socketRef.current = activeSocket;
      return { ok: true, socket: activeSocket };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown socket connection error';

      return {
        ok: false,
        error: `Socket connection failed. ${message}`,
      };
    }
  }, [backendUrl]);

  return {
    socket: socketRef.current,
    backendUrl,
    updateBackendUrl,
    restoreDefaultBackendUrl,
    emit,
    on,
    off,
    once,
    ensureConnection,
  };
}

export default useSocket;

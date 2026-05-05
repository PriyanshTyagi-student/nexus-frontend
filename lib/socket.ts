// Socket.io client utility for backend communication
// Configure the socket connection here

import { io, Socket } from 'socket.io-client';

const DEFAULT_BACKEND_PORT = '5000';
const BACKEND_URL_STORAGE_KEY = 'nexus.backendUrl';

function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  return withProtocol.replace(/\/$/, '');
}

function getDefaultBackendUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

  if (configuredUrl && !configuredUrl.includes('localhost') && !configuredUrl.includes('127.0.0.1')) {
    return normalizeBackendUrl(configuredUrl);
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`;
  }

  return normalizeBackendUrl(configuredUrl || `http://localhost:${DEFAULT_BACKEND_PORT}`);
}

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const savedUrl = window.localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (savedUrl?.trim()) {
      return normalizeBackendUrl(savedUrl);
    }
  }

  return getDefaultBackendUrl();
}

export function setBackendUrl(url: string): string {
  const normalizedUrl = normalizeBackendUrl(url);
  if (!normalizedUrl) {
    throw new Error('Backend URL is required.');
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalizedUrl);
  }

  disconnectSocket();
  return normalizedUrl;
}

export function resetBackendUrl(): string {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  }

  disconnectSocket();
  return getDefaultBackendUrl();
}

function getSocketUrl(): string {
  return getBackendUrl();
}

let socket: Socket | null = null;

type BackendStatusResult = {
  ok: boolean;
  message?: string;
};

/**
 * Get or create socket connection
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[SOCKET] Connected to backend');
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from backend');
    });

    socket.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error);
    });
  }

  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Verify backend health endpoint before connecting socket events.
 */
export async function checkBackendStatus(): Promise<BackendStatusResult> {
  try {
    const response = await fetch(`${getSocketUrl()}/status`);
    if (!response.ok) {
      return {
        ok: false,
        message: `Backend health check failed with status ${response.status}.`,
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      ok: false,
      message: `Cannot reach backend at ${getSocketUrl()}. ${message}`,
    };
  }
}

/**
 * Connect the socket and wait until the connection is established.
 */
export async function connectSocketWithTimeout(
  timeoutMs = 5000
): Promise<Socket> {
  const activeSocket = getSocket();

  if (activeSocket.connected) {
    return activeSocket;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out while connecting to backend socket.'));
    }, timeoutMs);

    const handleConnect = () => {
      cleanup();
      resolve(activeSocket);
    };

    const handleError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      activeSocket.off('connect', handleConnect);
      activeSocket.off('connect_error', handleError);
    };

    activeSocket.on('connect', handleConnect);
    activeSocket.on('connect_error', handleError);
    activeSocket.connect();
  });
}

export default getSocket;

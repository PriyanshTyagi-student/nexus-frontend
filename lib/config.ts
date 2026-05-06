const RENDER_BACKEND = process.env.NEXT_PUBLIC_RENDER_BACKEND || 'https://your-app.onrender.com';

const LOCAL_BACKEND_PORT = '5000';

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return RENDER_BACKEND;
  
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  
  // Mobile always uses Render
  if (isMobile) {
    return RENDER_BACKEND;
  }
  
  // Desktop: local first, fallback Render
  const local = `http://${window.location.hostname || 'localhost'}:${LOCAL_BACKEND_PORT}`;
  return local;
}


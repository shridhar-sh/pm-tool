import { useEffect, useRef } from 'react';

// Refresh active screens and returning tabs without keeping stale closures.
export default function useLiveRefresh(refresh, refreshKey) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    let running = false;
    const run = async () => {
      if (document.hidden || running) return;
      running = true;
      try { await latest.current(); } finally { running = false; }
    };
    run();
    const interval = window.setInterval(run, 30000);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [refreshKey]);
}

import { useEffect, useRef } from 'react';

// Calls `callback` every `intervalMs` while the tab is visible, and immediately
// when the tab/window regains focus or the connection comes back. This is what
// makes changes made by someone else (an admin approving a store, a customer
// placing an order, an owner editing a price) show up without a manual reload.
//
// The callback should be a "silent" loader: no spinner, no error banner, so a
// background refresh never flickers the screen. Overlapping runs are skipped.
export default function useAutoRefresh(callback, intervalMs = 10000, enabled = true) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let running = false;

    const run = async () => {
      if (running || document.visibilityState !== 'visible' || navigator.onLine === false) return;
      running = true;
      try {
        await cbRef.current();
      } catch {
        // background refresh is best-effort
      } finally {
        running = false;
      }
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      timer = setInterval(run, intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
    };
  }, [intervalMs, enabled]);
}

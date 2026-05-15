/**
 * Keeps dashboard lists fresh without manual browser refresh.
 * Combines Supabase realtime + tab focus + light polling fallback.
 */
export function attachLiveDataRefresh({
  enabled = true,
  reload,
  subscribe,
  pollMs = 12000,
}) {
  if (!enabled || typeof reload !== 'function') {
    return () => {};
  }

  let disposed = false;
  let pollId = null;

  const runReload = (options = {}) => {
    if (disposed) return;
    try {
      reload(options);
    } catch (error) {
      console.warn('[live-refresh] reload failed', error);
    }
  };

  runReload({ force: true });

  const unsubscribe = typeof subscribe === 'function'
    ? subscribe(() => runReload({ force: true, silent: true }))
    : () => {};

  const onWake = () => {
    if (!disposed && document.visibilityState === 'visible') {
      runReload({ force: true, silent: true });
    }
  };

  if (typeof window !== 'undefined') {
    if (pollMs > 0) {
      pollId = window.setInterval(() => runReload({ force: true, silent: true }), pollMs);
    }
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
  }

  return () => {
    disposed = true;
    unsubscribe();
    if (pollId) window.clearInterval(pollId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    }
  };
}

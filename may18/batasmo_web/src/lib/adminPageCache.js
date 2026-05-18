/**
 * Session cache for admin pages — shows last-known data instantly on refresh
 * while fresh data loads in the background (stale-while-revalidate).
 */
const STORAGE_PREFIX = 'batasmo_admin_cache:';
const DEFAULT_TTL_MS = 15 * 60 * 1000;

const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function readAdminPageCache(pageKey, { maxAgeMs = DEFAULT_TTL_MS } = {}) {
  if (typeof window === 'undefined' || !pageKey) return null;
  try {
    const envelope = safeParse(window.sessionStorage.getItem(`${STORAGE_PREFIX}${pageKey}`));
    if (!envelope?.savedAt || !envelope.data) return null;
    if (Date.now() - envelope.savedAt > maxAgeMs) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

export function writeAdminPageCache(pageKey, data) {
  if (typeof window === 'undefined' || !pageKey) return;
  try {
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}${pageKey}`,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // Quota or private mode — ignore.
  }
}

export function patchAdminPageCache(pageKey, partial) {
  const current = readAdminPageCache(pageKey, { maxAgeMs: Number.MAX_SAFE_INTEGER }) || {};
  writeAdminPageCache(pageKey, { ...current, ...partial });
}

export function hasAdminPageCache(pageKey) {
  return Boolean(readAdminPageCache(pageKey));
}

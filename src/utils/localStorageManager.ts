/**
 * localStorage Quota Management
 * 
 * Prevents QuotaExceededError from blocking critical keys (auth tokens)
 * by cleaning up disposable cached data when storage is near capacity.
 */

const HEADROOM_BYTES = 500 * 1024; // 500 KB free space target
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // ~5 MB typical limit

// Keys matching these patterns are never auto-cleared
const CRITICAL_PATTERNS = [
  /^sb-.*-auth-token$/,
  'cso_access_token',
];

// Disposable keys, cleared in this order
const DISPOSABLE_KEYS_ORDERED: string[] = [
  'loginRateLimitUntil',
  'liveTranscriptDraft',
  'liveTranscriptDraftTimestamp',
  'gpscribeTranscriptDraft',
  'gpscribeTranscriptDraftTimestamp',
  'meetingTranscriptDraft',
  'meetingDraftTimestamp',
  'medical_translation_audit',
  'turkeyFavorites',
  'image-studio-history',
  'lg_watch_processed_files',
  'gp_history',
];

// Prefix patterns for disposable keys (e.g. ack_draft_*)
const DISPOSABLE_PREFIXES = ['ack_draft_'];

function isCriticalKey(key: string): boolean {
  return CRITICAL_PATTERNS.some(pattern =>
    typeof pattern === 'string' ? key === pattern : pattern.test(key)
  );
}

/** Returns current localStorage usage in bytes and percentage. */
export function getStorageUsage(): { bytes: number; percentage: number } {
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      bytes += key.length * 2; // UTF-16
      bytes += (localStorage.getItem(key)?.length ?? 0) * 2;
    }
  }
  return { bytes, percentage: (bytes / MAX_STORAGE_BYTES) * 100 };
}

function hasEnoughSpace(): boolean {
  const { bytes } = getStorageUsage();
  return (MAX_STORAGE_BYTES - bytes) >= HEADROOM_BYTES;
}

/** Remove a key and return bytes freed. */
function removeAndMeasure(key: string): number {
  const value = localStorage.getItem(key);
  if (value === null) return 0;
  const freed = (key.length + value.length) * 2;
  localStorage.removeItem(key);
  return freed;
}

/**
 * Frees localStorage space by removing disposable keys in priority order.
 * Stops once ~500 KB headroom is available.
 */
export function cleanupStorage(): number {
  const before = getStorageUsage().bytes;
  console.log(`[localStorageManager] Cleanup triggered. Usage: ${(before / 1024).toFixed(1)} KB`);

  // 1. Remove disposable prefix keys (ack_draft_*, etc.)
  const allKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(Boolean);
  for (const key of allKeys) {
    if (hasEnoughSpace()) break;
    if (DISPOSABLE_PREFIXES.some(prefix => key.startsWith(prefix))) {
      removeAndMeasure(key);
    }
  }

  // 2. Remove disposable keys in order
  for (const key of DISPOSABLE_KEYS_ORDERED) {
    if (hasEnoughSpace()) break;
    removeAndMeasure(key);
  }

  // 3. Last resort: remove non-critical, non-disposable keys by size (largest first)
  if (!hasEnoughSpace()) {
    const remaining = Array.from({ length: localStorage.length }, (_, i) => {
      const k = localStorage.key(i)!;
      return { key: k, size: (localStorage.getItem(k)?.length ?? 0) * 2 };
    })
      .filter(({ key }) => !isCriticalKey(key))
      .sort((a, b) => b.size - a.size);

    for (const { key } of remaining) {
      if (hasEnoughSpace()) break;
      removeAndMeasure(key);
    }
  }

  const after = getStorageUsage().bytes;
  const freed = before - after;
  console.log(`[localStorageManager] Freed ${(freed / 1024).toFixed(1)} KB. Now at ${(after / 1024).toFixed(1)} KB`);
  return freed;
}

/**
 * Proactive cleanup on app startup — removes stale drafts and expired keys.
 * Lightweight: only targets time-based expiry, not general cleanup.
 */
export function cleanupStaleStorage(): void {
  try {
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // Remove transcript drafts older than 7 days
    const draftPairs = [
      ['liveTranscriptDraft', 'liveTranscriptDraftTimestamp'],
      ['gpscribeTranscriptDraft', 'gpscribeTranscriptDraftTimestamp'],
      ['meetingTranscriptDraft', 'meetingDraftTimestamp'],
    ];
    for (const [draftKey, tsKey] of draftPairs) {
      const ts = localStorage.getItem(tsKey);
      if (ts && now - Number(ts) > SEVEN_DAYS) {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(tsKey);
        console.log(`[localStorageManager] Removed stale draft: ${draftKey}`);
      }
    }

    // Remove expired rate limit key
    const rateLimitUntil = localStorage.getItem('loginRateLimitUntil');
    if (rateLimitUntil && now > Number(rateLimitUntil)) {
      localStorage.removeItem('loginRateLimitUntil');
    }

    // Remove unsaved meeting data older than 24 hours
    try {
      const unsaved = localStorage.getItem('unsaved_meeting');
      if (unsaved) {
        const parsed = JSON.parse(unsaved);
        if (parsed.timestamp && now - parsed.timestamp > TWENTY_FOUR_HOURS) {
          localStorage.removeItem('unsaved_meeting');
          console.log('[localStorageManager] Removed stale unsaved meeting');
        }
      }
    } catch {
      // If it can't be parsed, remove it
      localStorage.removeItem('unsaved_meeting');
    }
  } catch (error) {
    console.warn('[localStorageManager] Stale cleanup failed:', error);
  }
}

/**
 * Safe wrapper around localStorage.setItem.
 * On QuotaExceededError, runs cleanup then retries once.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      console.warn(`[localStorageManager] Quota exceeded for key "${key}". Running cleanup...`);
      cleanupStorage();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.error(`[localStorageManager] Still cannot save "${key}" after cleanup.`, retryError);
        return false;
      }
    }
    console.error(`[localStorageManager] setItem failed for "${key}":`, error);
    return false;
  }
}

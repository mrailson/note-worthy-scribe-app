

# localStorage Quota Management

## Problem

The app stores data across 70+ localStorage keys. When storage fills up (~5MB limit), the Supabase auth token can't be saved, which logs the user out or prevents login entirely.

## Solution

Create a storage management utility that:
1. Monitors localStorage usage
2. Automatically clears non-essential cached data when space is low
3. Ensures critical keys (auth tokens) always have room to be saved
4. Wraps `localStorage.setItem` calls in a safe helper that triggers cleanup on quota errors

## Key Design Decisions

- **Priority tiers**: Keys are classified as critical (auth tokens, never cleared), important (user settings, cleared last), or disposable (caches, drafts, history — cleared first)
- **Reactive cleanup**: Triggered when a `setItem` fails with a QuotaExceededError, rather than running on a timer
- **Proactive check**: A lightweight check runs once on app startup to clear stale data

## Technical Detail

### New file: `src/utils/localStorageManager.ts`

A utility with:

1. **`safeSetItem(key, value)`** — wraps `localStorage.setItem`. On QuotaExceededError, runs cleanup then retries once.

2. **`cleanupStorage()`** — frees space by deleting disposable keys in order:
   - Stale drafts older than 7 days (`liveTranscriptDraft`, `gpscribeTranscriptDraft`, `unsaved_meeting`, `ack_draft_*`)
   - Cached data (`medical_translation_audit`, `turkeyFavorites`, `image-studio-history`, `lg_watch_processed_files`)
   - Large history stores (`gp_history` — can be up to 200 consultation records)
   - Expired rate limit keys (`loginRateLimitUntil`)

3. **`getStorageUsage()`** — returns current usage in bytes and percentage for diagnostics.

4. **Priority classification**:
   - **Critical (never auto-cleared)**: `sb-*-auth-token`, `cso_access_token`
   - **Important (cleared only as last resort)**: User settings keys (`scribeSettings`, `notesViewSettings`, `ai4gp-chat-view-settings`, etc.)
   - **Disposable (cleared first)**: Drafts, caches, audit logs, translation history

### Integration points

- **`src/App.tsx`**: Call `cleanupStaleStorage()` once on mount to proactively remove expired drafts
- **High-volume setItem callers**: Update the following files to use `safeSetItem` instead of raw `localStorage.setItem`:
  - `src/components/LiveTranscript.tsx` (transcript drafts)
  - `src/components/MeetingRecorder.tsx` (unsaved meeting data)
  - `src/components/GPSoapUI.tsx` (GP history — up to 200 records)
  - `src/hooks/useImageStudio.ts` (image generation history)
  - `src/utils/medicalTranslationAudit.ts` (audit log — up to 100 entries)
  - `src/hooks/useWatchFolder.ts` (processed files list)

Other low-volume callers (small boolean/string preferences) don't need updating as they're unlikely to trigger quota issues individually.

### Cleanup order (disposable tier)

```text
1. Expired rate limit keys
2. Transcript drafts older than 7 days
3. Medical translation audit log
4. Turkey translation favourites
5. Image studio history
6. Watch folder processed files list
7. GP consultation history (largest — up to 200 records)
8. Unsaved meeting data older than 24 hours
```

Each step checks if sufficient space has been freed (~500KB headroom) before continuing.

### No UI changes

This is entirely behind-the-scenes. Users won't see any new UI — the cleanup happens silently. A console log will note when cleanup runs and how much space was freed.


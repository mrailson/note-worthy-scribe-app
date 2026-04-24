## Goal

When a signed-in user on the mobile recorder (`/new-recorder`) finishes a recording in **Online** mode, the experience should be:

- Pill stays green ("Online") throughout.
- Upload + transcription happen silently in the background.
- The just-finished recording appears in the local "Recordings (N)" list **immediately** (counter never displays a stale 0).
- No "Sign in to sync" sheet, no extra login link, no "Syncing…" blue dot flicker that the user has to react to.

## Root cause

The mobile recorder currently has **two parallel connectivity/sync systems running side by side**, and they disagree:

| System | Owner | Data source | What it shows |
|---|---|---|---|
| `useRecordingMode` (current) | The Mode Pill ("Live Transcription" / "Offline mode") | `localStorage` preference + `navigator.onLine` | Drives `mode === "live"` everywhere downstream |
| `ConnectionToggle` + `LoginModal` + `syncRecordings.ts` (legacy) | Imported in `NoteWellRecorderMobile.jsx` (line 20) and bundles its own state machine | A separate IndexedDB read via `countPendingRecordings()` and its own `supabase.auth.getSession()` check | Pops the "Sign in to sync" bottom sheet; flips its own pill to "Syncing…"; shows "Offline · N pending" |

The chunked recorder writes recordings to IndexedDB as multi-chunk objects (`status: "local" | "syncing" | "synced"…`) and uploads them through its own `syncRecording(rec)` flow — it never calls `syncPendingRecordings()` from `utils/syncRecordings.ts`. The legacy `syncPendingRecordings()` only inserts a stub `meetings` row with no audio, so even when the toggle "succeeds" it produces nothing useful.

Symptoms map cleanly onto this:

- **"Says Online but says Syncing"** → both the Mode Pill (green Online from `useRecordingMode`) and the legacy `ConnectionToggle` pill (blue "Syncing…" from its own `syncState`) render at once. The legacy pill kicks itself into `syncing` on mount whenever `pendingCount > 0`.
- **"Login link at the top of the recorder page"** → `ConnectionToggle.handleTap` (and any path that re-evaluates auth) calls `supabase.auth.getSession()`; on transient session-refresh edge cases or when the session restore is still in-flight it returns `null`, so it sets `showLogin = true` and `LoginModal` renders the "Sign in to sync" sheet over the recorder.
- **"Recordings (0) hangs"** → `pendingCount` displayed in the legacy toggle is the wrong IndexedDB query path; the recorder card's own `recordings` list (built from `dbAll()`) does populate, but the toggle's "0 pending" sticks until a manual refresh, making the user think nothing was saved.

## Plan

### 1. Remove the legacy `ConnectionToggle` / `LoginModal` / `syncRecordings.ts` path from the mobile recorder

In `src/components/recorder/NoteWellRecorderMobile.jsx`:

- Remove the imports of `ConnectionToggle`, `countPendingRecordings`.
- Delete `pendingCount` state and `refreshPendingCount` (the recorder already has `recordings` from `dbAll()` which is the source of truth).
- Verify `ConnectionToggle` is not rendered anywhere in the JSX — it isn't (confirmed), so removal is import-only.

`ConnectionToggle.tsx`, `LoginModal.tsx`, and `utils/syncRecordings.ts` are not used elsewhere by the recorder. Confirm no other consumers (search project) and either:
- Leave the files in place but unimported (safe), or
- Delete them as dead code (cleaner).

Recommendation: delete them to prevent re-introduction.

### 2. Single source of truth for connectivity

`useRecordingMode` already owns:
- Persisted user preference (`online` | `offline` in localStorage).
- Live `navigator.onLine`.
- An `isAutoFallback` flag for "user wants online but the network dropped".

The Mode Pill (`<ModePill>`) already renders the three correct visual states. No changes needed to the hook.

### 3. Make post-stop sync silent + immediate in Online mode

In the recorder's stop flow (`syncRecording(rec)` and the auto-sync path around line 1770):

- Optimistically push the just-finished recording into the `recordings` array as soon as it's persisted to IndexedDB, so the **"Recordings (N)"** counter increments immediately (no 0 hang). This is largely already the case via `refresh()` after save — confirm `refresh()` is awaited *before* sync starts.
- Keep the per-row status chip ("Uploading…" / "Synced" / "Transcribed") that already exists in the recordings list — that's the right place for sync feedback.
- Do not flip any top-of-page pill to "Syncing…". The Mode Pill stays green.
- Suppress the toast "Back online — resuming sync of N recording(s)" when we're already online and the recording the user just stopped is the only one in the queue (it's not a "rescue" event, just the normal happy path).

### 4. Belt-and-braces: prevent any stray sign-in modal from rendering on the recorder

- After the import removal in step 1, `LoginModal` can no longer mount from the recorder.
- Add a guard so that if a future component tries to surface auth UI on `/new-recorder` while `useAuth().user` exists, it's a no-op. (Defensive, optional.)

### 5. QA checklist

- Sign in, go to `/new-recorder`, ensure pill = green "Online", no "Sign in to sync" sheet ever appears.
- Record 30 seconds → Stop → confirm:
  - Pill stays green Online (no blue "Syncing…" flicker at the top).
  - "Recordings (1)" appears immediately under the recorder card.
  - The new row shows its own "Uploading…" → "Synced" → "Transcribed" lifecycle.
- Toggle Airplane mode mid-recording → verify orange "Offline (no connection)" auto-fallback pill + mid-record `ConnectionBanner`. Restore connection → confirm auto-resume toast and silent upload.
- Sign out → visit `/new-recorder` → confirm normal auth redirect (handled by `ProtectedRoute`/route guard, not by `LoginModal`).

## Files to change

- `src/components/recorder/NoteWellRecorderMobile.jsx` — remove `ConnectionToggle` / `countPendingRecordings` imports, delete `pendingCount` state + `refreshPendingCount` + its `useEffect`, verify no JSX references remain. Tighten the post-stop refresh order so the recordings list updates before sync begins.
- `src/components/ConnectionToggle.tsx` — delete (legacy, no remaining consumers after step 1).
- `src/components/LoginModal.tsx` — delete (only consumed by `ConnectionToggle`).
- `src/utils/syncRecordings.ts` — delete (only consumed by `ConnectionToggle`; the recorder's own `syncRecording` flow is the real path).

## Out of scope (to keep this surgical)

- The `MeetingHistory` (`/meetings`) page is unchanged — the user confirmed the "0" issue was the **in-recorder** counter, not the cloud history.
- No backend / edge function changes. The fix is entirely in the mobile recorder UI layer.
- No change to the `useRecordingMode` hook itself — it already behaves correctly.

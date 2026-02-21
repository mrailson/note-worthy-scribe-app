

## Consolidate Audio Import into Existing Edge Functions

### Problem
The plan requires two new edge functions (`upload-audio-import` and `validate-audio-import-token`), but creating new functions worsens the deployment rate-limiting issue.

### Solution
Extend two existing edge functions with an `action` branching parameter, following the project's established consolidation pattern.

### What Changes

**1. Database migration: `audio_import_sessions` table + storage bucket**

Create a lightweight session table to track QR-based audio import sessions:

```sql
CREATE TABLE public.audio_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token UUID NOT NULL DEFAULT gen_random_uuid(),
  short_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_audio_import_sessions_token ON audio_import_sessions(session_token);
CREATE UNIQUE INDEX idx_audio_import_sessions_short_code ON audio_import_sessions(short_code);
```

RLS: authenticated users can manage their own sessions.

Create the `audio-imports` storage bucket (private) with RLS for service-role uploads.

Also create `audio_import_uploads` table to track individual file uploads:

```sql
CREATE TABLE public.audio_import_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES audio_import_sessions(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS on `audio_import_uploads`: enable Realtime for INSERT events so the desktop browser can subscribe.

**2. Extend `validate-ai-chat-capture-token` with `action: 'audio-import'`**

Add branching logic so when the request body includes `action: 'audio-import'`, it validates against `audio_import_sessions` instead of `ai_chat_capture_sessions`. The existing AI chat capture validation remains the default behaviour.

```text
Request body:
  { token, shortCode }               --> existing AI chat capture validation (unchanged)
  { token, shortCode, action: 'audio-import' } --> audio import session validation
```

Response shape is identical: `{ valid, session_id, user_id }`.

**3. Extend `upload-ai-chat-capture` with `action: 'audio-import'`**

Add branching logic so when the form data includes `action=audio-import`, it:
- Validates against `audio_import_sessions` (instead of `ai_chat_capture_sessions`)
- Uploads to `audio-imports` bucket (instead of `ai-chat-captures`)
- Records in `audio_import_uploads` table (instead of `ai_chat_captured_images`)
- Supports audio MIME types (audio/mpeg, audio/mp4, audio/wav, audio/aac, audio/ogg, audio/webm)

The existing AI chat capture upload logic remains completely unchanged as the default path.

**4. New page: `src/pages/AudioUploadCapture.tsx`**

A mobile-optimised public page at `/audio-upload/:token` (and `/a/:shortCode` for short URLs):
- Calls `validate-ai-chat-capture-token` with `action: 'audio-import'` to validate
- Shows a file picker accepting audio types (.mp3, .m4a, .wav, .aac, .ogg, .webm)
- Uploads via `upload-ai-chat-capture` with `action=audio-import` in form data
- Shows upload progress and success confirmation
- "Upload another" option
- NoteWell branding, clean mobile UX

**5. Register route in `src/App.tsx`**

Add `/audio-upload/:token` and `/a/:shortCode` routes pointing to `AudioUploadCapture`.

**6. Update `SmartphoneRecordingHub.tsx` (Import Audio tab)**

- Generate a session in `audio_import_sessions` when the Import tab is opened (with 6-char short code)
- Generate QR code pointing to `/a/{shortCode}`
- Subscribe to Supabase Realtime on `audio_import_uploads` filtered by `session_id`
- When a file arrives: download from storage, convert to `File`, inject into `CreateMeetingTab`
- Show toast: "Audio file received from phone"
- Display received file count badge

**7. Update `CreateMeetingTab.tsx`**

- Rename "Choose Files" button to "Upload from This Device"
- Expose file injection via a ref/callback so the hub can programmatically add phone-uploaded files

### Architecture Flow

```text
Phone                                Desktop
/a/:shortCode                       SmartphoneRecordingHub (Import tab)
  |                                    |
  | validate-ai-chat-capture-token     | Creates session in
  | (action=audio-import)              | audio_import_sessions
  |                                    |
  | upload-ai-chat-capture             | Subscribes to Realtime
  | (action=audio-import)              | on audio_import_uploads
  |   --> audio-imports bucket         |   |
  |   --> audio_import_uploads row --- |-->| Auto-downloads file
  |                                    |   | Injects into CreateMeetingTab
  v                                    v
"Upload complete!"                   "Audio received from phone"
```

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/validate-ai-chat-capture-token/index.ts` | Add `action: 'audio-import'` branch |
| `supabase/functions/upload-ai-chat-capture/index.ts` | Add `action: 'audio-import'` branch |
| `src/pages/AudioUploadCapture.tsx` | New mobile upload page |
| `src/App.tsx` | Register new routes |
| `src/components/meeting/SmartphoneRecordingHub.tsx` | QR code + Realtime subscription |
| `src/components/meeting/import/CreateMeetingTab.tsx` | Rename button + expose file injection |
| SQL migration | New tables + storage bucket + RLS |

### Why This Approach

- **Zero new edge functions** -- reuses two existing functions with action branching
- Follows the project's established consolidation architecture
- Same session/token/upload pattern as complaints and AI chat capture
- Realtime subscription ensures instant desktop feedback when phone uploads complete

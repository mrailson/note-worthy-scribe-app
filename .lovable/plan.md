

## Photo Capture Feature for Ask AI Chat

### Overview
Add a comprehensive photo capture facility to the Ask AI service chat that allows users to:
1. Generate a QR code to scan on their smartphone for remote photo capture
2. Take photos directly via laptop/PC camera in a modal (similar to LG Capture)
3. Have captured photos added as file attachments ready to send with their next message

### User Experience Flow

**Via the + Button Menu:**
```text
┌──────────────────────────────┐
│  + More Options              │
├──────────────────────────────┤
│  📷  Capture Photo           │ ← Opens camera modal (PC/laptop)
│  📱  Phone Camera (QR)       │ ← Opens QR code modal
│  📎  Attach Files            │ (existing)
│  🌐  Translate Document      │ (existing)
│  💬  Start New Chat          │ (existing)
└──────────────────────────────┘
```

### Feature 1: Phone Camera via QR Code

**QR Code Modal Features:**
- Large, clear QR code display (300x300px)
- Title: "Capture Photos with Phone"
- Instruction text explaining the workflow
- Live counter showing photos received
- Actions:
  - **Copy Link** - Copies capture URL to clipboard
  - **Email Link** - Opens mailto: with pre-filled subject and link
  - **Print QR** - Opens print dialog with formatted QR poster
  - **Send via Accurx** - Copies link with patient-friendly SMS text to clipboard

**Mobile Capture Page (`/ai-capture/:sessionToken`):**
- Validates session token (time-limited, user-specific)
- Camera interface matching LG Capture UX:
  - Beep sound on capture (Web Audio API)
  - Glare detection warning
  - Camera switch button (front/back)
  - Rotation button
  - Grid of captured thumbnails
  - Upload all button
- Photos automatically appear in the parent chat as attachments via Supabase realtime subscription

### Feature 2: Direct PC/Laptop Camera Capture

**Camera Modal (within chat):**
- Opens in a dialog/modal
- Matches LG Camera Modal UX:
  - Beep on capture
  - Glare detection
  - Camera switching
  - Live preview
  - Session capture counter
- Photos immediately added to `uploadedFiles` state as attachments
- Close modal to return to chat with photos attached

### Technical Implementation

**New Components:**

| File | Purpose |
|------|---------|
| `src/components/ai4gp/ChatCameraModal.tsx` | PC/laptop camera capture modal |
| `src/components/ai4gp/ChatQRCaptureModal.tsx` | QR code generation modal with email/print/Accurx |
| `src/pages/AIChatCapture.tsx` | Mobile-friendly capture page for phone scanning |

**New Edge Functions:**

| Function | Purpose |
|----------|---------|
| `validate-ai-chat-capture-token` | Validates session tokens for mobile capture |
| `upload-ai-chat-capture` | Handles image uploads from mobile capture |

**Database Changes:**

| Table | Changes |
|-------|---------|
| `ai_chat_capture_sessions` | New table to store capture session tokens |
| `ai_chat_captured_images` | New table to store captured images |

**Modifications:**

| File | Changes |
|------|---------|
| `src/components/ai4gp/InputArea.tsx` | Add "Capture Photo" and "Phone Camera (QR)" menu items |
| `src/App.tsx` | Add route for `/ai-capture/:sessionToken` |
| `supabase/config.toml` | Register new edge functions |

### Key Patterns Reused

From existing LG Capture implementation:
- `playClickSound()` function (Web Audio API beep)
- Glare detection algorithm
- Camera enumeration and switching
- Canvas-based image capture

From existing Document Capture:
- Session token validation pattern
- Realtime subscription for upload notifications
- Storage bucket upload pattern

From Survey QR Modal:
- QR code generation with `qrcode` library
- Print functionality with styled HTML
- Download as PNG

### Database Schema

```sql
-- Session tokens for AI chat capture
CREATE TABLE ai_chat_capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Captured images
CREATE TABLE ai_chat_captured_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_capture_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_chat_capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_captured_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own capture sessions"
  ON ai_chat_capture_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create capture sessions"
  ON ai_chat_capture_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own captured images"
  ON ai_chat_captured_images FOR SELECT
  USING (session_id IN (
    SELECT id FROM ai_chat_capture_sessions WHERE user_id = auth.uid()
  ));
```

### QR Code Modal Actions Detail

| Action | Behaviour |
|--------|-----------|
| Copy Link | Copies `https://domain.com/ai-capture/{token}` to clipboard |
| Email Link | Opens `mailto:?subject=Photo Capture Link&body=Click to capture photos: {link}` |
| Print QR | Opens new window with printable A4 poster containing QR, title, and instructions |
| Send via Accurx | Copies to clipboard: `Please click this link to send us a photo: {link}` |

### File Summary

**Create (6 files):**
- `src/components/ai4gp/ChatCameraModal.tsx`
- `src/components/ai4gp/ChatQRCaptureModal.tsx`
- `src/pages/AIChatCapture.tsx`
- `supabase/functions/validate-ai-chat-capture-token/index.ts`
- `supabase/functions/upload-ai-chat-capture/index.ts`
- Database migration for new tables

**Modify (2 files):**
- `src/components/ai4gp/InputArea.tsx`
- `src/App.tsx`
- `supabase/config.toml`


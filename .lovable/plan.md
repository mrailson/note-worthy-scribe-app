

# Plan: Add QR Mobile Photo Import & Clinical System Paste to Complaints

## Overview

This plan adds two major features to the Complaints Import modal:

1. **QR-Based Mobile Photo Capture** - Scan a QR code with your phone to photograph handwritten patient letters, then have them automatically appear on your desktop and processed via OCR/Vision
2. **Clinical System Paste** - Copy/paste patient demographics directly from EMIS or SystOne screenshots or text

Both features will leverage existing infrastructure from the Ask AI QR capture system and the Scribe appointments import.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLAINT IMPORT MODAL                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌───────────┐ │
│  │ Full Complaint │ │   Text/Email   │ │  Patient Only  │ │  Mobile   │ │
│  │     (Files)    │ │    (Paste)     │ │ (Demographics) │ │  Capture  │ │
│  └────────────────┘ └────────────────┘ └────────────────┘ └───────────┘ │
│                                                    │            │        │
│                    ┌───────────────────────────────┴────────────┘        │
│                    │                                                      │
│    ┌───────────────┴────────────────┐                                    │
│    │      NEW: QR Capture Modal     │                                    │
│    │   (Reuses AI Chat pattern)     │                                    │
│    └───────────────┬────────────────┘                                    │
│                    │                                                      │
└────────────────────│──────────────────────────────────────────────────────┘
                     │
         ┌───────────▼───────────┐
         │   Mobile Phone Page   │
         │   /complaint-capture  │
         │    /:shortCode        │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Edge Function:       │
         │  upload-complaint-    │
         │  capture              │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Storage Bucket:      │
         │  complaint-captures   │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Realtime Sync to     │
         │  Desktop Modal        │
         └───────────────────────┘
```

---

## Feature 1: QR Mobile Photo Capture

### Database Schema

**New table: `complaint_capture_sessions`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Session identifier |
| user_id | uuid (FK) | Logged-in user |
| session_token | text | Random UUID for validation |
| short_code | text | 6-character code (e.g., "X7K9M2") |
| expires_at | timestamptz | 60 minutes from creation |
| is_active | boolean | Default true |
| created_at | timestamptz | |

**New table: `complaint_captured_images`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Image record identifier |
| session_id | uuid (FK) | Links to capture session |
| file_name | text | Original filename |
| file_url | text | Storage public URL |
| file_size | integer | Size in bytes |
| ocr_text | text | Extracted text from vision |
| processed | boolean | Default false |
| created_at | timestamptz | |

**Storage bucket: `complaint-captures`** (public read)

### New Files

1. **`src/components/complaints/ComplaintQRCaptureModal.tsx`**
   - Desktop modal showing QR code
   - Creates session in `complaint_capture_sessions`
   - Subscribes to `complaint_captured_images` INSERT events via Supabase Realtime
   - Shows count of received photos with thumbnails
   - "Done" button returns captured images to parent component
   - Actions: Copy Link, Email Link, Print QR, Accurx SMS (matches Ask AI pattern)

2. **`src/pages/ComplaintCapture.tsx`**
   - Mobile-optimised page at `/complaint-capture/:shortCode`
   - Camera interface using `facingMode: 'environment'`
   - Gallery upload option for existing photos
   - Client-side compression before upload
   - Calls `upload-complaint-capture` edge function
   - Visual feedback showing upload success

3. **`supabase/functions/upload-complaint-capture/index.ts`**
   - Validates session token (exists, active, not expired)
   - Accepts base64 image data
   - Uploads to `complaint-captures` storage bucket
   - Inserts record into `complaint_captured_images`
   - Triggers Supabase Realtime notification to desktop

4. **`supabase/migrations/YYYYMMDD_complaint_capture_sessions.sql`**
   - Creates both tables
   - Adds trigger to auto-generate 6-character short_code
   - Adds RLS policies for user access
   - Creates storage bucket with public read policy

### Integration in ComplaintImport.tsx

**New Tab: "Mobile Capture"** (between Text/Email and Patient Only)

```text
[ Full Complaint ] [ Text/Email ] [ Mobile Capture ] [ Patient Only ]
                                        ▲
                                   NEW TAB
```

**Tab Content:**
- Prominent QR code button: "Scan with Phone"
- Click opens `ComplaintQRCaptureModal`
- After photos received:
  - Thumbnails displayed
  - "Process All" button runs OCR via `extract-document-text`
  - Extracted text sent to `import-complaint-data` for full extraction
  - Results populate the form

### Mobile Page Routing

Add route in `App.tsx`:
```typescript
<Route path="/complaint-capture/:shortCode" element={<ComplaintCapture />} />
```

---

## Feature 2: Clinical System Paste (EMIS/SystOne)

### Enhanced "Patient Only" Tab

The existing Patient Only tab already supports:
- Screenshot paste (Ctrl+V) with OCR
- Dropzone for files
- Manual text paste button

**Enhancements:**

1. **Visual Clinical System Hints**
   - Add helper text: "Paste from EMIS, SystOne, or Vision"
   - Show small icons for supported clinical systems
   - Indicate: "Ctrl+V to paste screenshot, or paste text directly"

2. **Improved Text Parsing**
   - Reuse regex patterns from `useScribeAppointments.ts`
   - Parse NHS Number (10 digits with optional spaces)
   - Parse DOB (DD Mon YYYY or DD/MM/YYYY formats)
   - Parse Title + Name (Mr/Mrs/Miss/Ms/Dr patterns)
   - Parse Address with postcode extraction
   - Parse phone numbers (UK mobile/landline formats)

3. **Dedicated "Paste Demographics" Button**
   - Positioned prominently in the Patient Only tab
   - Uses `navigator.clipboard.readText()` API
   - Parses pasted text immediately
   - Shows extracted fields in preview

4. **Screenshot Detection Enhancement**
   - When image pasted, detect if it's from EMIS/SystOne
   - Send to `extract-patient-context` (same as Scribe) for better extraction
   - NHS number validation with `validateNHSNumber()` utility

### File Changes for Clinical Paste

**`src/components/ComplaintImport.tsx`**

1. Add clinical system icons and helper text to Patient Only tab header
2. Create `parsePatientDemographicsFromText()` function using Scribe patterns
3. Enhance the "Paste from Clipboard" button to use automatic parsing
4. Add visual feedback showing which fields were extracted

**`src/utils/clinicalSystemPatterns.ts`** (new shared utility)

Extract parsing logic from `useScribeAppointments.ts` into reusable functions:
- `extractNHSNumber(text: string): string | null`
- `extractDateOfBirth(text: string): string | null`
- `extractPatientName(text: string): string | null`
- `extractAddress(text: string): string | null`
- `extractPhoneNumber(text: string): string | null`
- `parsePatientDemographics(text: string): PatientDetailsData`

---

## UI/UX Design

### Mobile Capture Tab

```text
┌────────────────────────────────────────────────┐
│  📱 Mobile Photo Capture                       │
├────────────────────────────────────────────────┤
│                                                │
│   Capture patient letters, handwritten notes   │
│   or documents using your phone's camera       │
│                                                │
│   ┌──────────────────────────────────────┐    │
│   │                                      │    │
│   │    [  📲 Scan QR with Phone  ]       │    │
│   │                                      │    │
│   │    Opens camera on your mobile       │    │
│   │    Photos sync here automatically    │    │
│   │                                      │    │
│   └──────────────────────────────────────┘    │
│                                                │
│   No photos received yet                       │
│                                                │
└────────────────────────────────────────────────┘
```

### After Photos Received

```text
┌────────────────────────────────────────────────┐
│  📱 Mobile Photo Capture              2 photos │
├────────────────────────────────────────────────┤
│                                                │
│   ┌─────┐  ┌─────┐                             │
│   │ 📷 │  │ 📷 │   ← Thumbnails               │
│   └─────┘  └─────┘                             │
│                                                │
│   [  Process & Extract Data  ]                 │
│                                                │
└────────────────────────────────────────────────┘
```

### Patient Only Tab Enhancement

```text
┌────────────────────────────────────────────────┐
│  👤 Patient Details Import                     │
├────────────────────────────────────────────────┤
│                                                │
│   Import from EMIS, SystOne, or Vision         │
│                                                │
│   ┌──────────────────────────────────────┐    │
│   │  Ctrl+V to paste screenshot          │    │
│   │  or drop image/file here             │    │
│   │                                      │    │
│   │  ┌────────┐  ┌────────┐              │    │
│   │  │  EMIS  │  │ SystOne│  ← Hints     │    │
│   │  └────────┘  └────────┘              │    │
│   └──────────────────────────────────────┘    │
│                                                │
│   ─────────── OR ───────────                   │
│                                                │
│   [ 📋 Paste Demographics from Clipboard ]     │
│                                                │
│   Paste text containing patient name, DOB,     │
│   NHS number, address, or phone number         │
│                                                │
└────────────────────────────────────────────────┘
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/complaints/ComplaintQRCaptureModal.tsx` | Desktop QR modal with realtime sync |
| `src/pages/ComplaintCapture.tsx` | Mobile camera capture page |
| `supabase/functions/upload-complaint-capture/index.ts` | Edge function for mobile uploads |
| `supabase/migrations/YYYYMMDD_complaint_capture.sql` | Database tables and storage bucket |
| `src/utils/clinicalSystemPatterns.ts` | Shared patient parsing utilities |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ComplaintImport.tsx` | Add Mobile Capture tab, enhance Patient Only tab |
| `src/App.tsx` | Add `/complaint-capture/:shortCode` route |
| `supabase/config.toml` | Add `upload-complaint-capture` function |

---

## Technical Details

### Session Security
- Sessions expire after 60 minutes
- Short codes are 6 random alphanumeric characters
- Token validation happens server-side in edge function
- RLS policies ensure users can only access their own sessions

### Image Processing Flow
1. Phone captures photo
2. Client compresses to max 1600px, 0.82 quality (Safari-safe)
3. Base64 uploaded to edge function
4. Stored in `complaint-captures` bucket
5. Record inserted triggers Realtime to desktop
6. Desktop processes via `extract-document-text` OCR
7. Text sent to `import-complaint-data` for AI extraction
8. Results populate form fields

### Clinical System Parsing
Reuses proven regex patterns from GP Scribe:
- NHS: `/NHS[:\s]*(\d[\d\s]{8,11}\d)/i` or `/(\d{3}\s?\d{3}\s?\d{4})/`
- DOB: `/(\d{1,2}\s+\w{3}\s+\d{4})/i` or `/(\d{1,2}\/\d{1,2}\/\d{4})/`
- Name: `/((?:Mr|Mrs|Miss|Ms|Dr|Master)\.?\s+[\w\s]+?)/i`
- Phone: `/(0\d{10}|\+44\d{10}|07\d{9})/`
- Postcode: `/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i`

---

## Implementation Order

1. **Database migration** - Create tables and storage bucket
2. **Edge function** - `upload-complaint-capture`
3. **Mobile capture page** - `/complaint-capture/:shortCode`
4. **QR modal** - Desktop component with realtime subscription
5. **Integrate into ComplaintImport** - Add new Mobile Capture tab
6. **Clinical parsing utility** - Extract shared patterns
7. **Enhance Patient Only tab** - Better clinical system support
8. **Testing** - End-to-end flow on mobile and desktop


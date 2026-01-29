
# Infographic-to-Video Animation Feature

## Overview
Add the ability to convert a generated infographic into an animated video where the image gradually reveals from a white background, using Google's Veo API (image-to-video generation with first/last frame capability).

---

## User Flow

1. User clicks **"Create as Infographic"** → selects **Portrait** or **Landscape**
2. Infographic generates as normal (current behaviour)
3. After generation completes, a new **"Create Video"** button appears
4. User clicks "Create Video" → modal shows video generation progress
5. Video downloads automatically as MP4

---

## Technical Implementation

### 1. New Edge Function: `infographic-to-video`

**Location:** `supabase/functions/infographic-to-video/index.ts`

**Purpose:** Accept the infographic image URL/base64, create a white "first frame" image, and call Google's Veo API to generate a reveal animation.

**API Flow:**
- Receive infographic image (base64 or URL)
- Generate a pure white image matching the dimensions (first frame)
- Call Veo API with `first_frame` (white) and `last_frame` (infographic)
- Poll for completion (Veo operations are asynchronous)
- Return video URL or base64

**Key Veo API Parameters:**
```text
model: "veo-2.0-generate-001" or "veo-3.1-generate-preview"
prompt: "Smooth, gradual reveal animation. The image fades in smoothly from pure white, with elements appearing naturally until the full infographic is visible."
first_frame: white image
last_frame: infographic image
aspectRatio: "9:16" (portrait) or "16:9" (landscape)
durationSeconds: 5-8 seconds
```

### 2. New Hook: `useInfographicVideo`

**Location:** `src/hooks/useInfographicVideo.ts`

**Purpose:** Manage the video generation state and API calls.

**Features:**
- `generateVideo(imageUrl: string, orientation: 'portrait' | 'landscape')` - Main function
- Progress tracking with polling (Veo is async)
- Error handling for timeouts and generation failures
- Automatic download when complete

### 3. Updated Modal: `ContentInfographicModal.tsx`

**Changes:**
- After successful infographic generation, show "Create Video" button
- When clicked, trigger video generation flow
- Display video generation progress (separate from image progress)
- Handle video download

### 4. Update `supabase/config.toml`

Add configuration for the new edge function:
```toml
[functions.infographic-to-video]
verify_jwt = true
```

---

## Edge Function Details

### Request Body
```text
{
  imageBase64: string,      // Infographic as base64
  mimeType: string,         // "image/png"
  orientation: "portrait" | "landscape",
  durationSeconds?: number  // Default: 6
}
```

### Response
```text
{
  success: boolean,
  videoUrl?: string,        // Direct URL or base64 data URL
  error?: string
}
```

### Veo API Integration
The function will:
1. Decode the infographic base64
2. Create a matching-size pure white PNG
3. Call Google's Veo API with both frames
4. Poll the operation until complete (max 2 minutes)
5. Fetch and return the generated video

---

## UI Changes

### Infographic Modal Update
After the "Complete!" state, instead of auto-closing, show:
- Success message
- "Download Image" button (current behaviour)
- "Create Reveal Video" button (new)

When "Create Reveal Video" is clicked:
- Button shows loading spinner
- Progress ring updates for video generation
- On completion, video downloads as MP4

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/infographic-to-video/index.ts` | Create | Veo API integration |
| `src/hooks/useInfographicVideo.ts` | Create | Video generation hook |
| `src/components/ContentInfographicModal.tsx` | Modify | Add video generation UI |
| `supabase/config.toml` | Modify | Add function config |

---

## Considerations

### Veo API Availability
- Veo is currently in paid preview via Gemini API
- Uses `GOOGLE_API_KEY` or `GEMINI_API_KEY` (both already configured)
- May have usage limits/quotas

### Video Duration
- Default 5-6 seconds for a smooth reveal
- Could be made configurable if needed

### File Size
- Generated MP4 videos are typically 2-10MB
- Will download directly to user's device

### Fallback
- If Veo API fails, show clear error message
- User can still download the static infographic

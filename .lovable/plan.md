

# Fix PowerPoint Generation Edge Error and Voiceover Pipeline

## Problem

Two issues identified:

1. **Edge Error (400 Bad Request)**: The Gamma API rejects requests when `additionalInstructions` exceeds 5,000 characters. The current code concatenates multiple verbose instruction blocks (British English, images, speaker notes, data integrity rules, custom instructions, NHS branding, colour palette, font style, branding/logo) which frequently breaches this limit.

2. **Voiceover Fallback Risk**: The voiceover hooks must always use the Gamma API for slide generation and never fall back to a local/non-Gamma generator.

## Root Cause (from edge logs)

```text
[Gamma] Create error: 400 -
{"message":"Input validation errors: 1. additionalInstructions must be shorter than or equal to 5000 characters","statusCode":400}
```

## Solution

### Step 1: Truncate and condense `additionalInstructions` in the edge function

**File**: `supabase/functions/generate-powerpoint-gamma/index.ts`

Rewrite the instruction-building block (lines 191-234) to:

- **Condense each instruction** to its essential directive (remove verbose explanations)
- **Add a hard safety cap** at the end: if the final string exceeds 4,900 characters, truncate it cleanly at a sentence boundary before the limit
- **Prioritise**: Core instructions (British English, images, speaker notes) take priority; optional extras (font style, branding, NHS-specific) are appended only if space remains

Condensed instructions example:

| Original (verbose) | Condensed |
|---|---|
| "IMAGES: Every slide MUST include at least one relevant, high-quality image. Use photorealistic AI-generated images..." (~250 chars) | "Every slide must include a high-quality photorealistic image." (~60 chars) |
| "PRESENTER NOTES (MANDATORY): For every card, write detailed presenter notes..." (~450 chars) | "Write detailed presenter notes in the hidden notes field only. Do not add visible notes sections on slides." (~110 chars) |
| "CRITICAL DATA INTEGRITY RULES: 1) ONLY use statistics..." (~480 chars) | "Only use statistics and data explicitly in the source content. Never fabricate figures." (~90 chars) |

Add a final safety truncation:

```typescript
// Hard cap at 4900 chars to leave headroom
if (additionalInstructions.length > 4900) {
  additionalInstructions = additionalInstructions.substring(0, 4900);
  // Trim to last complete sentence
  const lastPeriod = additionalInstructions.lastIndexOf('.');
  if (lastPeriod > 4000) {
    additionalInstructions = additionalInstructions.substring(0, lastPeriod + 1);
  }
}
```

### Step 2: Ensure voiceover never uses a local fallback

**File**: `src/hooks/useGammaPowerPointWithVoiceover.ts`

- Verify that `generateWithGammaAndVoiceover` **only** calls `generate-powerpoint-gamma` (confirmed -- it does)
- Remove the slide count clamp of `Math.max(4, Math.min(10, slideCount))` and align it with the Presentation Studio's maximum of 30 slides
- If Gamma generation fails, throw the error directly rather than falling back to any local generator

**File**: `src/hooks/useGammaPowerPoint.ts`

- Same slide count alignment (allow up to 30)
- No local fallback paths exist here (confirmed clean)

### Step 3: Deploy the updated edge function

Deploy `generate-powerpoint-gamma` after editing to ensure the fix takes effect immediately.

## Technical Details

### Files to modify

1. **`supabase/functions/generate-powerpoint-gamma/index.ts`** -- Condense `additionalInstructions` and add hard character cap
2. **`src/hooks/useGammaPowerPointWithVoiceover.ts`** -- Align slide count limit to 30, confirm no fallback
3. **`src/hooks/useGammaPowerPoint.ts`** -- Align slide count limit to 30

### Testing

After deployment, verify by generating a presentation with:
- Custom instructions filled in
- NHS/healthcare presentation type selected
- Colour palette and branding enabled
- Speaker notes enabled

This combination previously exceeded the 5,000-character limit and should now work within it.

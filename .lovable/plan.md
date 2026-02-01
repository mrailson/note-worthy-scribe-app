
# Plan: Integrate Logo Directly into Image Studio Generated Images

## ✅ IMPLEMENTED

## Overview

Currently, Image Studio only "reserves space" for a logo - it tells the AI to leave a blank area where users can manually overlay their logo afterwards. This approach has proven unreliable and requires additional manual work from users.

This plan implements **true logo integration** where the user's logo is sent directly to the AI image generation model as a reference image, with instructions to incorporate it naturally into the generated design.

## Key Changes

### 1. Frontend Changes (BrandingTab.tsx)

**Replace "Reserve Logo Space" with "Integrate Logo"**

Current behaviour:
- Toggle for "Reserve Logo Space"
- Instructs AI to leave a blank corner

New behaviour:
- Toggle for "Include Logo in Design" 
- Option to use profile logo OR upload a different logo specifically for this image
- New "Upload Different Logo" button when the toggle is enabled
- Logo is passed as a reference image to the AI with integration instructions

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│ [Icon] Include Logo in Design          [Toggle]│
│                                                 │
│ When enabled:                                   │
│ ┌──────────────────────────────────────────────┐│
│ │ Your profile logo:                           ││
│ │ [Logo Preview]  ○ Use this logo              ││
│ │                                              ││
│ │ -- OR --                                     ││
│ │                                              ││
│ │ [Upload Different Logo] ○ Use uploaded logo  ││
│ │ [Uploaded Preview if exists]                 ││
│ └──────────────────────────────────────────────┘│
│                                                 │
│ Logo Placement: [Top Left] [Top Right] ...     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. State Management (useImageStudio.ts & types)

**Update ImageStudioSettings type:**
```typescript
interface ImageStudioSettings {
  // ... existing fields
  
  // Logo Integration (replacing includeLogo/logoPlacement)
  includeLogo: boolean;
  logoSource: 'profile' | 'custom';
  customLogoData: string | null;  // Base64 data URL of uploaded logo
  logoPlacement: LogoPlacementId;
}
```

**Update ImageStudioRequest type:**
```typescript
interface ImageStudioRequest {
  // ... existing fields
  
  // Logo as a reference image
  logoImage?: {
    content: string;       // Base64 data URL
    placement: string;     // 'top-left', 'top-right', etc.
  };
}
```

### 3. Edge Function Changes (ai4gp-image-generation/index.ts)

**Process logo as a reference image:**

When `logoImage` is provided in the request:
1. Add the logo image to `messageContent` array (alongside any other reference images)
2. Add specific prompt instructions for logo integration

**Updated prompt building:**
```typescript
// When logo is provided for integration
if (logoImage) {
  // Add logo to message content as an image
  messageContent.push({
    type: 'image_url',
    image_url: { url: logoImage.content }
  });
  
  // Add integration instructions to prompt
  const placementGuide = {
    'top-left': 'TOP LEFT corner',
    'top-right': 'TOP RIGHT corner',
    'bottom-left': 'BOTTOM LEFT corner',
    'bottom-right': 'BOTTOM RIGHT corner',
    'center-top': 'centered at the TOP'
  };
  
  logoSection = `
LOGO INTEGRATION - CRITICAL REQUIREMENT:
I have provided an image of a logo that MUST be integrated into this design.
- Place the logo in the ${placementGuide[logoImage.placement]} of the image
- The logo should be clearly visible and appropriately sized (typically 80-150px height)
- Ensure the logo has adequate contrast with the background
- Do NOT modify, redraw, or recreate the logo - use it exactly as provided
- The logo should look naturally incorporated into the design
- If the background colour behind the logo placement clashes, add a subtle backdrop or adjust that area
`;
}
```

### 4. Implementation Steps

**Step 1: Update Types**
- Add `logoSource` and `customLogoData` to `ImageStudioSettings` in `src/types/imageStudio.ts`
- Add `logoImage` to `ImageStudioRequest`

**Step 2: Update BrandingTab UI**
- Replace "Reserve Logo Space" card with new "Include Logo in Design" card
- Add radio buttons for profile logo vs custom upload
- Add file upload dropzone for custom logo (similar to ReferenceTab)
- Show preview of selected logo
- Keep logo placement selector

**Step 3: Update useImageStudio Hook**
- Update `DEFAULT_SETTINGS` with new logo fields
- Modify `generateImage` to include logo in request when enabled
- Fetch logo content from URL if using profile logo, or use uploaded data

**Step 4: Update Edge Function**
- Accept new `logoImage` field in request body
- Add logo to `messageContent` array before the text prompt
- Build integration instructions instead of "reserve space" instructions
- Test with both Gemini models

### 5. Technical Considerations

**Logo Size Optimisation:**
- Profile logos are stored in Supabase Storage and fetched by URL
- Need to fetch and convert to base64 before sending to edge function
- Use existing `optimiseImageForUpload` utility to ensure logos are <300KB
- Target size: 512x512px max to avoid bloating the request

**Fetching Profile Logo:**
```typescript
// In generateImage, before building request:
let logoImageData: { content: string; placement: string } | undefined;

if (settings.includeLogo) {
  const logoUrl = settings.logoSource === 'profile' 
    ? practiceContext?.logoUrl 
    : settings.customLogoData;
    
  if (logoUrl) {
    // If it's already base64, use directly
    if (logoUrl.startsWith('data:')) {
      logoImageData = { content: logoUrl, placement: settings.logoPlacement };
    } else {
      // Fetch and convert URL to base64
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      logoImageData = { content: base64, placement: settings.logoPlacement };
    }
    
    // Optimise if needed
    const sizeKB = getBase64SizeKB(logoImageData.content);
    if (sizeKB > 300) {
      const optimised = await optimiseImageForUpload(logoImageData.content, {
        maxSizeKB: 300,
        maxDimension: 512
      });
      logoImageData.content = optimised.optimised;
    }
  }
}
```

**Fallback Behaviour:**
- If logo fetch fails, show toast warning and proceed without logo
- If AI fails to integrate logo properly, user can edit the result

### 6. Files to Modify

| File | Changes |
|------|---------|
| `src/types/imageStudio.ts` | Add `logoSource`, `customLogoData`, update request type |
| `src/components/ai4gp/studio/BrandingTab.tsx` | Replace logo card with new integration UI |
| `src/hooks/useImageStudio.ts` | Update defaults, add logo processing logic |
| `supabase/functions/ai4gp-image-generation/index.ts` | Handle `logoImage`, update prompt building |

### 7. User Experience Flow

1. User opens Image Studio
2. Goes to Branding tab
3. Enables "Include Logo in Design" toggle
4. Chooses between profile logo or uploads a different one
5. Selects placement (top-left, top-right, etc.)
6. Generates image
7. AI receives the logo as a reference image and integrates it into the design
8. User receives image with logo already incorporated

### 8. Alternative Approach Considered (Not Recommended)

**Post-processing overlay:** Generate image first, then overlay logo programmatically using canvas.

**Why not:** 
- Requires client-side canvas manipulation
- Logo placement looks "stuck on" rather than integrated
- Doesn't account for design context (logo might obscure important content)
- AI integration produces more natural, designed results


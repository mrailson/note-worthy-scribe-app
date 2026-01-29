
# Infographic Generation Feature

## Current State

The "Create as Infographic" feature generates infographics from AI response content with a simple two-option flow:

1. User clicks "Create as Infographic" in the AI response menu
2. User selects orientation: **Portrait (A4)** or **Landscape (16:9)**
3. Generation starts immediately with a progress modal

## Technical Implementation

- **Modal:** `src/components/ContentInfographicModal.tsx` - Progress UI during generation
- **Hook:** `src/hooks/useContentInfographic.ts` - Generation logic, edge function call
- **Integration:** `src/components/MessageRenderer.tsx` - Menu item and modal mounting

## Notes

- Default title: "Infographic"
- Default filename: `infographic_YYYY-MM-DD.png`
- Branding/logo features were considered but removed since the image generation model cannot composite external logos into generated images

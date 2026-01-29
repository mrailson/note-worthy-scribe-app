
# Plan: Integrate Practice Logo Support into Infographic Generation

## Summary

This plan adds an optional step before infographic generation where users can choose to include their practice branding and/or logo. The infrastructure already exists in the edge function—we just need to wire the existing branding system into the content infographic flow.

## Current State

The "Create as Infographic" feature in the AI response menu generates infographics without any practice branding. However:
- The edge function (`ai4gp-image-generation`) already fully supports practice branding and logo placement via `practiceContext`, `brandingLevel`, `includeLogo`, and `logoPlacement` parameters
- Practice logos are stored in the `practice_details` table (`logo_url` or `practice_logo_url` columns)
- The `usePracticeContext` hook provides access to `practiceContext.logoUrl`
- The `ImageBrandingDialog` component already exists and provides a user interface for selecting branding options

## Approach

Add a two-step flow:
1. When user selects orientation, show a quick branding confirmation step
2. Allow users to toggle "Include practice branding" and "Include logo space"
3. Pass these settings through to the existing edge function infrastructure

## Technical Changes

### 1. Update ContentInfographicModal Props and Logic

**File:** `src/components/ContentInfographicModal.tsx`

- Add new optional props for branding configuration
- Import and use `usePracticeContext` to access practice details and logo URL
- Add a pre-generation step showing branding options (similar to ImageBrandingDialog but simpler)
- Pass branding settings to `generateInfographic`

### 2. Extend useContentInfographic Hook

**File:** `src/hooks/useContentInfographic.ts`

- Add `practiceContext`, `brandingLevel`, `includeLogo`, and `logoPlacement` to the `ContentInfographicOptions` interface
- Update the edge function call to include these parameters in the request body
- The edge function already handles these parameters—no backend changes needed

### 3. Update MessageRenderer to Pass Practice Context

**File:** `src/components/MessageRenderer.tsx`

- Import `usePracticeContext`
- Pass `practiceContext` to `ContentInfographicModal`

## User Experience

When clicking "Create as Infographic" → Portrait/Landscape:

1. **Pre-generation step** (new quick modal or section):
   - Toggle: "Include practice branding" (Practice name, contact details)
   - Toggle: "Reserve space for logo" (if branding enabled and logo URL exists)
   - Button: "Generate" / "Skip branding"

2. **Generation proceeds** as currently with the progress modal

This keeps the flow quick whilst giving users control over branding.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ContentInfographicModal.tsx` | Add branding options UI, use practice context |
| `src/hooks/useContentInfographic.ts` | Extend options interface, pass branding to edge function |
| `src/components/MessageRenderer.tsx` | Import usePracticeContext, pass to modal |

## Alternative Simpler Approach

If you prefer minimal UI changes, we could:
- Add a simple "Include Practice Branding" checkbox in the orientation flyout submenu
- Store the preference in localStorage
- Use sensible defaults (name-only branding level, logo in top-right if available)

This would require fewer UI changes but less user control.

## Edge Cases Handled

- **No practice details configured:** Branding section shows disabled/empty state with helpful message
- **No logo uploaded:** "Include logo" option is hidden or disabled
- **Practice details partially filled:** Only available fields are included in branding
- **User skips branding:** Generation proceeds exactly as today (no branding)

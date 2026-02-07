
# Add Staff Training PowerPoint Generation to AI Report

## Overview

Add a "Staff PowerPoint" button next to the existing "Staff Infographic" button on the AI Report page. Clicking it opens a small modal (matching the infographic modal style) with a slide count selector (5-10), then generates a fully anonymised PowerPoint via the Gamma API -- designed for Protected Learning Time (PLT) sessions and staff training.

## What Gets Built

### 1. New Hook: `src/hooks/useComplaintPowerPoint.ts`

A dedicated hook modelled on the existing `useComplaintInfographic.ts` and `useMeetingPowerPoint.ts` patterns:

- **Anonymisation**: Reuses the same `anonymiseText()` function from the infographic hook to strip all patient/staff names, NHS numbers, emails, and phone numbers before sending to Gamma
- **Content formatting**: Builds a structured supporting content string from the report data (overview, key learnings, strengths, improvement suggestions, outcome rationale) -- all anonymised
- **Gamma generation**: Calls `generate-powerpoint-gamma` with the start-and-poll pattern (same as meeting PowerPoint and Presentation Studio)
- **Custom instructions**: Prompt emphasises:
  - Friendly, supportive tone -- "learning together as a team"
  - No individual blame, no patient/staff identifiers
  - Suitable for PLT sessions and team training
  - Professional NHS-aligned design
  - British English throughout
  - "Powered by NoteWell AI" attribution on last slide
- **Download handling**: Triggers direct download via the Gamma download URL (same approach as `useMeetingPowerPoint`)
- **State**: Exposes `isGenerating`, `currentPhase`, `error`, and `generatePowerPoint(data, slideCount)` 

### 2. New Component: `src/components/complaints/ComplaintPowerPointModal.tsx`

A small modal matching the infographic modal's design (progress ring, rotating tips, timer):

- **Pre-generation view**: Shows a slide count selector (dropdown or radio group, values 5-10) with a "Generate" button. Brief description: "Create a staff training presentation for PLT sessions"
- **Generating view**: Progress ring with countdown timer (estimated at 10s per slide, rounded up), rotating tips like:
  - "Preparing anonymised complaint summary..."
  - "Building key learnings slides..."
  - "Adding improvement action slides..."
  - "Creating professional NHS-styled design..."
- **Complete view**: Success message with auto-close after 2 seconds
- **Error view**: Error message with close button
- Dynamic time estimate based on selected slide count (e.g. 5 slides = ~1 min, 10 slides = ~2 min)

### 3. UI Integration: `src/pages/ComplaintAIReport.tsx`

- Add a `Presentation` icon button ("Staff PowerPoint") next to the existing "Staff Infographic" button in the title card actions area
- Add state: `showPowerPointModal` and `selectedSlideCount`
- Import and render `ComplaintPowerPointModal` alongside the existing `ComplaintInfographicModal`
- Pass the same anonymised complaint data structure

## Data Flow

```text
User clicks "Staff PowerPoint"
  -> Modal opens with slide count selector (5-10)
  -> User selects count and clicks "Generate"
  -> useComplaintPowerPoint hook:
      1. Anonymises all report data (names, NHS numbers, etc.)
      2. Formats content into structured sections
      3. Calls generate-powerpoint-gamma edge function (start)
      4. Polls for completion (5s intervals, timeout based on slide count)
      5. Triggers download of PPTX file
  -> Modal shows progress, then auto-closes on success
```

## No Edge Function Changes Required

The existing `generate-powerpoint-gamma` edge function already supports everything needed:
- Topic, supporting content, custom instructions, slide count, audience
- Start-and-poll architecture for long-running generations
- PPTX export format

## Files Created/Modified

| File | Change |
|------|--------|
| `src/hooks/useComplaintPowerPoint.ts` | **New** -- hook for Gamma-based complaint PowerPoint generation with anonymisation |
| `src/components/complaints/ComplaintPowerPointModal.tsx` | **New** -- modal with slide count selector (5-10), progress ring, and download handling |
| `src/pages/ComplaintAIReport.tsx` | **Modified** -- add "Staff PowerPoint" button and modal rendering |

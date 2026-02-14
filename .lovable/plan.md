

# Mobile Translation Service Upgrade

## Overview
Replace the old `MobileTranslationInterface` (which uses a basic manual translation system) with the modern Reception Translation service that is currently only available on desktop. This will give mobile users access to the full-featured live chat translation, document translation, training mode, QR codes, audio playback, and content moderation — all wrapped in a touch-friendly smartphone interface.

## Current State
- **Old mobile** (`/mobile-translate`): Uses `MobileTranslationInterface.tsx` with `useManualTranslation` hook — a simpler, separate translation system with basic speech-to-text and no real-time patient connection, no QR codes, no training mode
- **New desktop** (`ReceptionTranslationView.tsx`): Full-featured service with live chat, document translate, speaker modes, patient QR connection, audio playback, content moderation, training mode, report generation — but it renders as a fixed full-screen desktop layout with a two-column chat and sidebar

## Plan

### 1. Create a new Mobile Reception Translation wrapper
Create `src/components/MobileReceptionTranslation.tsx` — a mobile-optimised wrapper that uses the same setup flow (`LiveTranslationSetupModal`) and the same backend hooks (`useReceptionTranslation`) as the desktop version, but with a completely mobile-first UI:

- **Language selection**: Full-screen setup modal (reuse `LiveTranslationSetupModal`)
- **Single-column chat**: Messages stacked vertically (no side-by-side columns) with clear visual distinction between GP and patient messages
- **Sticky bottom toolbar**: Large touch-friendly mic button (centre), speaker mode toggle, and minimal action buttons
- **Swipeable modes**: Toggle between Live Chat and Document Translate via pill tabs at the top
- **Collapsible header**: Shows language badge and session status; collapses when scrolling to maximise chat space
- **Touch-optimised controls**: 44px minimum tap targets, large mic button (64px), bottom-safe-area padding for notched iPhones
- **Audio playback**: Inline play buttons on patient-language messages (same TTS integration)
- **Confirmation flow**: After speech capture, show editable text with Send/Discard/Add More buttons — same as desktop but stacked vertically
- **QR Code**: Accessible via a small button in the header (opens modal)
- **End session**: Confirmation dialog before ending
- **Report download**: Available via a menu (three-dot) button

### 2. Update the MobileTranslation page
Modify `src/pages/MobileTranslation.tsx` to render the new `MobileReceptionTranslation` component instead of the old `MobileTranslationInterface`.

### 3. Keep the old component as fallback
The old `MobileTranslationInterface.tsx` will not be deleted immediately, just unused, so it can serve as a rollback if needed.

### 4. Routing remains unchanged
- `/mobile-translate` route stays the same
- Desktop `/gp-translation` continues to redirect mobile users to `/mobile-translate`
- Header navigation logic stays the same

---

## Technical Details

### New component structure
```
MobileReceptionTranslation.tsx
  -- State: setup phase vs active session
  -- Setup phase: renders LiveTranslationSetupModal (full screen)
  -- Active session phase:
       -- Header bar (language, status, menu)
       -- Chat area (single column, ScrollArea)
       -- Bottom bar (speaker toggle, mic button, send controls)
```

### Key mobile adaptations from the desktop ReceptionTranslationView
| Desktop Feature | Mobile Adaptation |
|---|---|
| Two-column chat (English + Patient language) | Single column: show both texts stacked within each message bubble |
| 5 chat view modes (standard, recent, patient-focus, etc.) | Simplified to 2: "Full" (all messages) and "Latest" (last message only) |
| Fixed full-screen with sidebar | Full viewport with bottom toolbar, no sidebar |
| Toolbar with many buttons | Condensed into header with overflow menu |
| Patient sidebar with QR | QR in a modal, accessible from header button |
| Speaker mode selector component | Pill toggle above the mic button: "You" / "Patient" |
| Document translate tab | Swipeable tab at top |
| Settings modal | Accessible from menu |
| Training mode banner | Slim banner below header |

### Hooks and services reused (no duplication)
- `useReceptionTranslation` — real-time translation via Supabase channels
- `LiveTranslationSetupModal` — session creation
- `SpeakerModeSelector` or simplified inline version
- `PatientSpeakingPrompt` — visual cue when patient is speaking
- TTS audio playback logic (same edge functions)
- Content moderation (same blocked/warning dialogs)
- Report generation (`generateTranslationReportDocx`)
- `usePracticeContext` for practice name

### Mobile-specific considerations
- Debounced viewport resize handling (already in memory)
- iOS Safari keyboard workarounds for the text editing area
- `pb-safe` padding for notched devices
- `WebkitOverflowScrolling: 'touch'` for smooth scrolling
- Lazy-load document translation panel to reduce initial bundle
- Web Speech API language code mapping (reuse `getWebSpeechLanguageCode`)


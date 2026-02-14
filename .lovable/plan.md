

## Quick-Pick Intro Statement Button

### Overview

Add a one-tap "Send Intro" button that instantly sends a pre-written introductory and consent message to the patient in their language. This saves staff from having to speak the entire consent explanation and ensures consistent, professional wording every time.

### What the Intro Message Covers

The message (translated into the patient's language) will say:

> "Welcome to {Practice Name}. We would like to use our translation service to help us communicate with you today. A staff member will control the session. When you see the large green microphone, you can speak naturally in your own language. When you have finished speaking, please indicate to the staff member and they will activate the translation. Are you happy for us to use this service?"

### How It Works

1. A small button with a speech/hand-wave icon labelled "Send Intro" appears in the toolbar (near the QR Code button)
2. Clicking it immediately sends the intro message as a "staff" message, which gets translated into the patient's language and appears on both the GP and patient screens
3. The button becomes disabled/changes to "Intro Sent" after use (to avoid duplicate sends), resettable per session
4. The practice name is pulled from the existing `practiceContext` (already available in the component)

### Technical Details

**New constant object: `INTRO_STATEMENTS`** (in `ReceptionTranslationView.tsx` or a new constants file)
- A `Record<string, string>` mapping language codes to the pre-translated intro message
- English version used as the `originalText` when sending
- Covers all 30+ languages already supported in the component
- Uses `{practice}` placeholder replaced with the actual practice name at runtime

**Modified: `src/components/admin-dictate/ReceptionTranslationView.tsx`**
- Add `introSent` boolean state (defaults to `false`)
- Add `handleSendIntro` function that:
  - Calls `sendMessage(englishIntroText, 'staff')` with the English version
  - Sets `introSent = true`
  - Shows a success toast
- Add a toolbar button next to the QR Code button (visible in `live-chat` mode)
- Button shows `MessageSquareText` icon + "Send Intro" label
- After sending: icon changes to a check mark, label changes to "Intro Sent", button is disabled
- Works in both real and training modes

**Why send as English rather than pre-translated?**
The existing `sendMessage('staff')` pipeline already handles translation to the patient's language via the edge function. Sending the English text ensures the translated version appears naturally in the chat alongside the English original, consistent with all other messages.

### UI Placement

The button sits in the top toolbar row alongside "Voice", "QR Code", and "History" buttons -- making it easy to find and tap at the start of any session.

### Files to Change

| File | Change |
|------|--------|
| `src/components/admin-dictate/ReceptionTranslationView.tsx` | Add `introSent` state, `handleSendIntro` handler, toolbar button, English intro text constant |


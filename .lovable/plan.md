

## AI-Driven Training Mode for Translation Service

### Overview

Add a "Training Mode" option to the translation setup flow. When enabled, the patient side is played automatically by AI, generating realistic patient replies in the selected language. This lets staff practise the full translation workflow -- speaking, confirming, switching speakers -- without needing a real patient present.

### How It Works

1. **Setup Modal** -- Add a "Training Mode" toggle to `LiveTranslationSetupModal`. When checked, a training scenario selector appears (e.g. "New patient registration", "Prescription collection", "Appointment booking").

2. **Training Session Flow**:
   - Staff speaks in English as normal, confirms and sends
   - Instead of waiting for a real patient response, the system auto-generates a realistic patient reply using Lovable AI (via a new edge function)
   - The AI reply arrives in the patient's language, gets translated to English, and appears in the chat -- exactly as it would in a real session
   - The speaker auto-switches back to staff, ready for the next turn
   - A visible "TRAINING MODE" badge is shown so users never confuse it with a real session

3. **AI Patient Persona** -- The edge function receives the conversation history, selected language, and scenario context. It responds as a realistic patient would -- sometimes confused, sometimes asking clarifying questions, using natural speech patterns.

### Technical Changes

**New File: `supabase/functions/translation-training-reply/index.ts`**
- Edge function that calls Lovable AI Gateway (`google/gemini-3-flash-preview`)
- System prompt instructs the model to role-play as a patient in a GP reception scenario
- Receives: conversation history, patient language code, scenario type
- Returns: a realistic patient reply in the target language
- Handles 429/402 rate limit errors gracefully

**Modified File: `src/components/admin-dictate/LiveTranslationSetupModal.tsx`**
- Add a "Training Mode" toggle (Switch component) below the language selector
- When enabled, show a scenario dropdown (New patient registration, Prescription collection, Appointment booking, General enquiry)
- Pass `isTrainingMode` and `trainingScenario` to `onSessionCreated` callback (extend its signature)

**Modified File: `src/components/admin-dictate/ReceptionTranslationView.tsx`**
- Accept new props: `isTrainingMode` and `trainingScenario`
- Show a prominent "TRAINING MODE" banner at the top when active
- After `handleConfirmSend` processes a staff message, if training mode is on:
  - Wait 1-2 seconds (simulating patient thinking)
  - Call the `translation-training-reply` edge function with conversation context
  - Insert the AI-generated patient reply via `sendMessage(reply, 'patient')`
  - Auto-switch back to staff mode
- Hide the QR code sidebar in training mode (no real patient needed)

**Modified Files: Wrapper components**
- `TranslationServicePanel.tsx` -- pass through `isTrainingMode` and `trainingScenario`
- `DictationTranslationWrapper.tsx` -- pass through `isTrainingMode` and `trainingScenario`

### Edge Function: `translation-training-reply`

```text
POST /translation-training-reply
Body: {
  conversationHistory: [{ speaker, englishText, translatedText }],
  patientLanguage: "es",
  scenario: "appointment_booking"
}
Response: {
  patientReply: "Necesito una cita para el lunes por favor"
}
```

The system prompt will instruct the model to:
- Respond in the patient's language only
- Stay in character as a patient at a GP reception
- Keep replies short and natural (1-2 sentences)
- Occasionally ask clarifying questions
- Match the scenario context (registration details, medication names, etc.)

### UX Details

- Training mode badge: amber/yellow colour with "TRAINING MODE" text, visible at all times
- AI "typing" indicator shown while generating the reply (pulsing dots)
- Conversation is not saved to the database (no session record created for training)
- The QR sidebar is replaced with a "Training Tips" panel showing helpful hints about the workflow

### Files Summary

| File | Action |
|------|--------|
| `supabase/functions/translation-training-reply/index.ts` | New |
| `src/components/admin-dictate/LiveTranslationSetupModal.tsx` | Modified |
| `src/components/admin-dictate/ReceptionTranslationView.tsx` | Modified |
| `src/components/ai4gp/TranslationServicePanel.tsx` | Modified |
| `src/components/scribe/DictationTranslationWrapper.tsx` | Modified |


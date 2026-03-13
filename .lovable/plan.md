

## Fix: Patient Summary Should Reflect Actual Interaction Type

### Problem
The system prompt for `generate-patient-translation-summary` assumes every session is a clinical consultation ("Your doctor has seen you", "treatment advice"). When the actual conversation was an appointment request at reception, the summary is misleading and inaccurate.

### Root Cause
The prompt says "overview of what happened during the visit" — this biases the AI toward clinical language. It needs explicit instruction to accurately reflect the nature of the interaction (reception enquiry, appointment booking, prescription collection, etc.) based on the actual conversation content.

### Fix — Update Edge Function Prompt

**File**: `supabase/functions/generate-patient-translation-summary/index.ts`

Update the system prompt to:

1. **Identify the interaction type first** — reception enquiry, appointment booking, prescription pickup, registration, clinical consultation, etc.
2. **Use appropriate language** — "You visited the reception to book an appointment" not "Your doctor has seen you"
3. **Be specific to what actually happened** — extract real details from the conversation (e.g. "appointment with Dr Smith on Friday at 2pm") rather than generic filler
4. **Never fabricate clinical content** — if no clinical discussion happened, don't imply one did

Key prompt additions:
- "IMPORTANT: Most sessions are GP RECEPTION interactions (booking appointments, asking questions, collecting prescriptions) — NOT clinical consultations. Read the conversation carefully and summarise ONLY what actually happened."
- "If the patient was booking or requesting an appointment, say so clearly. Do NOT use clinical language like 'the doctor saw you' or 'treatment advice' unless a doctor actually provided clinical advice in the conversation."
- "Be SPECIFIC — include actual details from the conversation (doctor names, dates, times, reasons). Never use vague generic summaries."

Also increase `max_tokens` from 1500 to 2000 to ensure longer conversations aren't truncated.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-patient-translation-summary/index.ts` | Rewrite system prompt to be context-aware and specific |


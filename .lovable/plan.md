
# Consolidated NoteWell Outcome Prompt + Toggle-Aware Wording (Refined)

## Overview

Replace the current system prompt with the finalised NoteWell consolidated prompt, add a "Use formal outcome labels in patient letters" toggle to the questionnaire UI, normalise "rejected" before it reaches any prompt, remove conditional escalation logic, and pass the toggle value through to regeneration.

---

## Changes

### 1. Add toggle to QuestionnaireData and UI

**File:** `src/components/ComplaintOutcomeQuestionnaire.tsx`

- Add `use_formal_outcome_labels: boolean` to the `QuestionnaireData` interface (line 18), defaulting to `false` in the initial state (line 70).
- Place a `Switch` toggle in Step 3 directly below the outcome `Select` dropdown (after line 1122), inside the same blue card. Label: **"Use formal outcome labels in patient letters"** (plural, matching prompt language). Helper text: *"When off, the letter uses plain, patient-centred language instead of formal labels like 'Upheld' or 'Not upheld'."*
- The toggle value flows into `finalData` and is passed to the edge function via `questionnaireData`.

### 2. Replace the entire system prompt

**File:** `supabase/functions/generate-complaint-outcome-letter/index.ts` (lines 194-240)

Replace the current `systemPrompt` variable with the full consolidated NoteWell prompt:

```text
You are a professional NHS GP practice complaints officer, writing formal
written complaint outcome letters in line with:
- NHS complaints regulations
- Care Quality Commission (CQC) expectations
- Parliamentary and Health Service Ombudsman (PHSO) escalation requirements

You must act fairly, transparently, and professionally at all times.

CORE REQUIREMENTS (MANDATORY):
- Reference the original complaint and what was investigated
- Clearly state the outcome of the investigation (see Outcome Wording Rules)
- Explain the reasoning for the decision using only provided information
- Describe any actions taken, learning, or improvements (if applicable)
- Explain the right to escalate to the Parliamentary and Health Service Ombudsman
- Use British English only (spellings and grammar)
- Use UK date format: DD Month YYYY

NEVER FABRICATE:
- Medical facts, events, clinical reasoning, actions, or examples
- If information is not explicitly provided, do not invent it
- If required information is missing, state that it was not available in the
  provided materials
- Every statement must be traceable to supplied complaint, investigation, or
  questionnaire data
- Where appropriate, quote or closely paraphrase the original complaint wording

TONE CONTROL:
{dynamically set from questionnaire}
- Always remain respectful, calm, and patient-centred
- Never sound dismissive, defensive, or adversarial

OUTCOME WORDING RULES (TOGGLE-AWARE):
Always clearly state the outcome of the complaint.

If "Use formal outcome labels in patient letters" = YES:
- Include exactly one of: "Upheld", "Partially upheld", or "Not upheld"
- Never use the word "Rejected"
- Immediately follow the label with a plain-English explanation

If "Use formal outcome labels in patient letters" = NO:
- Do not use the words upheld, partially upheld, not upheld, or rejected
- State the outcome in plain English covering: what was reviewed, what was found,
  what was agreed or not agreed, and why (based only on supplied facts)
- When labels are OFF, select the narrative outcome paragraph that corresponds
  exactly to the internal outcome decision provided -- do not let tone override
  the paragraph selection
- Use the appropriate paragraph:
  * Not upheld: "Following a careful review of the information provided, the
    consultation record, and the investigation findings, we did not find evidence
    that the care provided fell below the expected standard based on the
    information available to us."
  * Partially upheld: "Our review found that while some aspects of care met
    appropriate standards, there were areas where improvements were needed,
    particularly in relation to the issues identified during the investigation."
  * Upheld: "Our review identified that aspects of care and/or process did not
    meet the standard we expect, and we are sorry for this."
- Do not minimise the patient's experience

ESCALATION REQUIREMENT (MANDATORY):
- ALL letters, regardless of outcome, must include clear, neutral wording
  explaining the right to escalate to the Parliamentary and Health Service
  Ombudsman
- Do not discourage escalation or express opinion on likelihood of success

FORMATTING:
- Start the letter with the date (no letterhead)
- Do not duplicate addresses
- End with "Yours sincerely" signature block
- No decorative formatting or emojis
- Do not include "*Signature*" or signature placeholders
- Include practice contact details in the letter content or signature area only
- Never include personal email addresses or phone numbers

FINAL QUALITY CHECK:
- No invented facts or assumptions
- Outcome is clear and consistent with the internal decision
- Tone matches questionnaire setting
- Letter reads as calm, respectful, and proportionate
- Language is suitable for CQC inspection and Ombudsman review
```

The `{dynamically set from questionnaire}` placeholder is filled by the existing `toneInstruction` variable (lines 185-192), which remains unchanged.

### 3. Normalise "rejected" to "not_upheld" before building prompts

**File:** `supabase/functions/generate-complaint-outcome-letter/index.ts` (after line 21)

Add normalisation immediately after receiving `outcomeType`:

```typescript
const outcomeForLetter =
  outcomeType === 'rejected' ? 'not_upheld' : outcomeType;
```

Then use `outcomeForLetter` (not `outcomeType`) everywhere in prompt construction -- specifically in the user prompt's `Outcome:` line (line 357) and any conditional strings. The original `outcomeType` is only used for DB operations.

This is the single biggest robustness improvement: the LLM never sees "rejected".

### 4. Add toggle value to the user prompt

**File:** `supabase/functions/generate-complaint-outcome-letter/index.ts` (line 357)

In the `========== OUTCOME DECISION ==========` section, change:

```
Outcome: ${outcomeType}
```

to:

```
Outcome: ${outcomeForLetter}
Patient Letter Style:
Use formal outcome labels in patient letters: ${useFormalLabels}
```

Where `useFormalLabels` reads from `questionnaireData?.use_formal_outcome_labels === true ? 'YES' : 'NO'`, defaulting to `NO`.

### 5. Remove conditional escalation logic entirely

**File:** `supabase/functions/generate-complaint-outcome-letter/index.ts` (lines 242-254)

Delete the conditional:

```typescript
const escalationText = outcomeType === 'rejected' || outcomeType === 'partially_upheld'
  ? `If you remain dissatisfied...`
  : '';
```

Replace with unconditional escalation text (mandatory for all outcomes per the consolidated prompt):

```typescript
const escalationText = `If you remain dissatisfied with our response, you have the right to take your complaint to the Parliamentary and Health Service Ombudsman. They provide a free service for people who have a complaint about NHS care that cannot be resolved locally.

You can contact them at:
Parliamentary and Health Service Ombudsman
Millbank Tower
Millbank
London SW1P 4QP
Phone: 0345 015 4033
Website: www.ombudsman.org.uk

You should contact the Ombudsman within one year of the events you want to complain about, or within one year of when you first became aware of the problem.`;
```

No condition, no dead logic.

### 6. Update the regeneration prompt + pass toggle deterministically

**File:** `supabase/functions/regenerate-outcome-letter/index.ts`

Two changes:

**a) Add to the "Standard requirements" section (lines 49-56):**

```
- Preserve the outcome label style used in the current letter. If the letter uses
  formal labels (Upheld / Partially upheld / Not upheld), keep them. If it uses
  plain patient-centred language without labels, maintain that style.
- Never use the word "Rejected" -- use "Not upheld" instead.
- Always remain respectful, calm, and patient-centred. Never sound dismissive,
  defensive, or adversarial.
- If required information is missing, state that it was not available in the
  provided materials rather than inventing details.
```

**b) Accept and pass the toggle value into the regeneration user prompt:**

Update `ComplaintDetails.tsx` (line 1297) to also pass `questionnaireData` (or at minimum the toggle) when calling the regeneration function. If the stored questionnaire data is available, pass it. If not, infer from the letter content:

In the edge function's user prompt, add:

```
Use formal outcome labels in patient letters: YES/NO
```

This is read from the request body if provided. If not provided, the function infers it deterministically by checking whether the current letter contains "Outcome: Upheld", "Outcome: Partially upheld", or "Outcome: Not upheld" -- if yes, it's formal; otherwise plain.

### 7. Pass toggle from ComplaintDetails to regeneration

**File:** `src/pages/ComplaintDetails.tsx` (lines 1297-1305)

Update the regeneration call to also pass the toggle value. Fetch the stored questionnaire data from the complaint outcome record, or infer from the letter. Minimal change: add a `useFormalLabels` field to the request body, defaulting to `false` if unknown.

---

## Files Modified

| File | Summary |
|------|---------|
| `src/components/ComplaintOutcomeQuestionnaire.tsx` | Add `use_formal_outcome_labels` to interface and state; add Switch toggle in Step 3 below outcome selector |
| `supabase/functions/generate-complaint-outcome-letter/index.ts` | Replace system prompt with consolidated NoteWell prompt; normalise "rejected" to "not_upheld" before prompt; add toggle to user prompt; make escalation unconditional |
| `supabase/functions/regenerate-outcome-letter/index.ts` | Add label-style preservation rules; accept and use toggle value; add missing-info instruction |
| `src/pages/ComplaintDetails.tsx` | Pass `useFormalLabels` to regeneration edge function |

## What Does NOT Change

- Database schema (toggle is passed within `questionnaireData` JSON, no new columns needed)
- DB mapping of `not_upheld` to `rejected` on line 738 of questionnaire (kept for backward compatibility)
- AI analysis function (`analyze-complaint-outcome`)
- Acknowledgement letter functions
- Demo response loading
- Compliance checks logic
- Other calling sites continue working with the default (NO formal labels)

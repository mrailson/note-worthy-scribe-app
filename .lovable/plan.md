

# Add Value Judgements Toggle to AI Call Summary

## What This Does

Adds an "Include Value Judgements" toggle to the **AI Call Summary** dialog (AudioAIReviewDialog), matching the one already added to Critical Friend Review. When switched **on**, the AI will include tone assessments (e.g., "Patient: Dismissive", "Staff: Good"), opinions on call handling quality, and subjective commentary. When **off** (default, current behaviour), it stays factual-only.

## User-Facing Change

- A new toggle switch appears in the AI Call Summary dialog header, alongside the existing "Names redacted/visible" toggle
- Label: **"Include Value Judgements"** with contextual description
- When **off** (default): Current factual-only behaviour — no tone, no opinions
- When **on**: Adds tone assessment, handling quality ratings, and key lessons/recommendations sections
- When toggled on, the user can click "Re-analyse" to regenerate with value judgements included
- The toggle state is passed to the edge function on re-analysis

## Technical Changes

### 1. Frontend: `src/components/AudioAIReviewDialog.tsx`

- Add `includeValueJudgements` state (default: `false`)
- Add a `Switch` component in the controls row next to the names toggle
- Pass the boolean through the `onReAnalyse` callback

### 2. Frontend: `src/components/InvestigationEvidence.tsx`

- Update the `onReAnalyse` callback (lines 1153-1178) to accept and pass `includeValueJudgements` to the edge function
- Update the auto-generate call (lines 889-891) — keeps default factual-only behaviour

### 3. Backend: `supabase/functions/generate-audio-review/index.ts`

- Accept `includeValueJudgements` (boolean, default `false`) from the request body
- When `true`, use an expanded prompt that includes:
  - **Tone Assessment** section — Patient tone, Staff tone, with descriptive labels
  - **Handling Quality** — Assessment of how the call was managed
  - **Key Lessons and Recommendations** — Suggestions for improvement
- When `false` (default), keep the current factual-only prompt unchanged

### 4. Prompt Addition for Value Judgements Mode

When enabled, the following sections are appended to the output structure:

```
## 5. Tone Assessment
Assess the tone and demeanour of each party:
- **Patient/Caller tone**: (e.g., Calm, Frustrated, Dismissive, Anxious, Assertive)
- **Staff tone**: (e.g., Professional, Dismissive, Empathetic, Defensive)
- **Overall handling**: (e.g., Good, Needs Improvement, Poor)

## 6. Key Lessons and Recommendations
Based on the call, identify learning points and suggestions for practice improvement.
```

The "ABSOLUTE RULES" section is also adjusted to permit subjective commentary when value judgements are enabled.

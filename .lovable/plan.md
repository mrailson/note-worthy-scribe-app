

# Add Value Judgements Toggle to AI Critical Friend Review

## What This Does

Adds a slider/toggle to the Critical Friend Review section that controls whether the AI includes **value judgements and opinions** in its output. When switched **off**, the review will only describe factual observations — no tone assessments, no opinions on quality, no subjective commentary. When switched **on** (default, current behaviour), it includes the full supportive commentary with opinions on strengths, tone analysis of call transcripts, etc.

## User-Facing Change

- A new toggle switch appears in the Critical Friend Review header area, next to the "Regenerate Review" button
- Label: **"Include Value Judgements"** with a short description beneath
- When **on**: Current behaviour — warm, opinionated review with tone analysis and subjective assessments
- When **off**: Factual-only mode — describes what was found, what was documented, what evidence exists, without expressing views on quality or tone
- The toggle state is passed to the edge function when generating/regenerating a review
- Existing saved reviews are not affected; the toggle only applies when generating a new review

## Technical Changes

### 1. Frontend: `src/components/CriticalFriendReview.tsx`

- Add a `Switch` component (from `@/components/ui/switch`) with state `includeValueJudgements` (default: `true`)
- Place it in the header area between the title and the generate button
- Pass the boolean to the edge function call in `generateReview()`
- Persist the preference in the component state (no need for localStorage — it resets per session, which is appropriate as users may want different settings per complaint)

### 2. Backend: `supabase/functions/ai-investigation-assistant/index.ts`

- Accept `include_value_judgements` (boolean, default `true`) from the request body
- When `false`, modify the `critical_friend_review` system prompt and user prompt to:
  - Remove instructions about being "warm", "supportive", "celebratory"
  - Remove "Strengths Identified" section (that's an opinion)
  - Replace with a factual structure: "Evidence Summary", "Documentation Review", "Process Observations", "Gaps Identified"
  - Explicitly instruct: "Do NOT provide opinions, tone assessments, value judgements, or subjective commentary. Only describe what is documented, what evidence exists, and what factual gaps are present."
  - Remove tone analysis instructions for phone call transcripts
- When `true` (default), keep the existing prompt unchanged

### 3. Prompt for Factual-Only Mode

```
You are an NHS complaint investigation document reviewer. Your role is to
provide a factual summary of the investigation documentation — what evidence
has been gathered, what has been documented, and what factual gaps exist.

CRITICAL RULES:
- Do NOT express opinions or value judgements
- Do NOT assess tone, attitude, or communication quality
- Do NOT use words like "excellent", "good", "concerning", "impressive", "thorough"
- Do NOT comment on the emotional or interpersonal aspects of phone calls or consultations
- ONLY describe what is factually documented and what is not
- Use neutral, descriptive language throughout

Structure:
**Evidence Summary** — List what documentation and evidence has been collected
**Process Observations** — Factual description of the investigation steps taken
**Documentation Gaps** — Any factual gaps where evidence or documentation appears absent
**Regulatory Checklist** — Whether key NHS complaint-handling process steps are documented
```




# Plan: Auto-Generate Questionnaire Fields from Evidence (No New Edge Function)

## What This Does
Adds "Auto-fill from Evidence" buttons to each field in the outcome questionnaire modal. Instead of creating a new edge function, this extends the existing `generate-demo-response` function with an `action` parameter to support evidence-based generation alongside its current demo generation mode.

## Approach: Extend `generate-demo-response`

The `generate-demo-response` edge function already returns the exact same four fields (`key_findings`, `actions_taken`, `improvements_made`, `additional_context`) and is already wired up in the questionnaire component. We will add branching logic so it can operate in two modes:

- **`action: "demo"`** (default / current behaviour) -- generates generic responses from complaint description only
- **`action: "evidence"`** -- fetches all investigation evidence from the database and generates accurate, evidence-based answers

This avoids adding a new edge function entirely.

## Changes

### 1. `supabase/functions/generate-demo-response/index.ts`

**Add Supabase client initialisation** (needed for evidence queries):
- Import `createClient` from Supabase
- Create client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**Add `action` parameter handling:**
- Parse `action` from the request body (default to `"demo"` for backwards compatibility)
- When `action === "evidence"`, require `complaintId` parameter

**Add evidence-fetching logic** (reuses the same queries from the outcome letter function):
- `complaint_investigation_findings` (summary, findings, evidence notes, critical friend review)
- `complaint_investigation_decisions` (reasoning, corrective actions, lessons learned)
- `complaint_investigation_evidence` (file descriptions, AI summaries -- capped at 20, summaries truncated to 1000 chars)
- `complaint_investigation_transcripts` (transcript text -- capped at 10, truncated to 2000 chars)
- `complaint_involved_parties` (staff responses)
- `complaint_notes` (internal notes)

**Add evidence-specific AI prompt:**
- System prompt: NHS complaints investigation analyst generating questionnaire field answers based strictly on provided evidence
- User prompt: includes all evidence context, asks for the four fields
- Uses `google/gemini-3-flash-preview` model (default per guidelines)
- Uses tool calling for structured output (returns the four fields reliably)

**Preserve existing demo logic untouched** -- only runs when `action` is not `"evidence"`

**Add 429/402 rate-limit error handling** (currently missing from this function)

### 2. `src/components/ComplaintOutcomeQuestionnaire.tsx`

**New state variables:**
- `isGeneratingFromEvidence` (boolean) -- loading state for evidence-based generation
- `generatingEvidenceField` (string | null) -- tracks which specific field is generating

**New function: `loadFromEvidence(field)`**
- Calls `generate-demo-response` with `{ action: "evidence", complaintId, field }` (field is optional, used for logging/future per-field support)
- On success, populates the specified field in the `data` state
- Shows toast on error (including specific messages for rate limits)

**New function: `loadAllFromEvidence()`**
- Calls `generate-demo-response` with `{ action: "evidence", complaintId }`
- Populates all four fields at once
- All generated content remains fully editable

**UI additions on Step 1:**
- An "Auto-fill All from Evidence" button at the top of the step, styled distinctly (e.g., outlined blue with a `ClipboardCheck` icon)
- Each field gets a second icon button (using `ClipboardCheck` icon) next to the existing `Sparkles` demo button, titled "Generate from evidence"
- Both button types show a loading spinner when active and are disabled during generation

**UI additions on Step 2:**
- The "Additional Context" field also gets the evidence-based generation button

## Visual Layout (Step 1)

```text
+-------------------------------------------------------+
| Brief Summary of Key Findings *                       |
| +---------------------------------------------------+ |
| |                                                   | |
| +---------------------------------------------------+ |
| [ Mic ] [ Sparkles (demo) ] [ ClipboardCheck (evidence) ] |
|                                                       |
| Actions Already Taken or Planned                      |
| +---------------------------------------------------+ |
| |                                                   | |
| +---------------------------------------------------+ |
| [ Mic ] [ Sparkles (demo) ] [ ClipboardCheck (evidence) ] |
|                                                       |
| Service Improvements Made                             |
| +---------------------------------------------------+ |
| |                                                   | |
| +---------------------------------------------------+ |
| [ Mic ] [ Sparkles (demo) ] [ ClipboardCheck (evidence) ] |
|                                                       |
|          [ Auto-fill All from Evidence ]              |
+-------------------------------------------------------+
```

## Technical Detail

### Edge function branching logic

```text
parse action from request body (default: "demo")

if action === "evidence":
  require complaintId
  initialise Supabase client
  fetch: findings, decisions, evidence files, transcripts, parties, notes
  build evidence context (with truncation)
  call AI with evidence-specific prompt + tool calling
  return { success: true, demoResponse: { key_findings, actions_taken, improvements_made, additional_context } }

else (action === "demo"):
  [existing logic unchanged]
```

### AI prompt for evidence mode

The system prompt will instruct the AI to:
- Act as an NHS complaints investigation analyst
- Generate content based strictly on the provided evidence -- never fabricate
- Use British English
- Keep each field concise (50-150 words)
- For `key_findings`: summarise the main investigation findings
- For `actions_taken`: describe corrective actions from the evidence and decisions
- For `improvements_made`: describe service improvements and lessons learned
- For `additional_context`: provide relevant background, staff perspectives, mitigating factors

### Tool calling for structured output

```text
tool: generate_questionnaire_fields
parameters:
  key_findings: string (required)
  actions_taken: string (required)
  improvements_made: string (required)
  additional_context: string (required)
```

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/generate-demo-response/index.ts` | Add evidence mode with DB queries, evidence-specific prompt, tool calling, and rate-limit handling |
| `src/components/ComplaintOutcomeQuestionnaire.tsx` | Add evidence-generation buttons, state, and handler functions |

No new edge functions are created. The existing `generate-demo-response` function is redeployed with the expanded logic.

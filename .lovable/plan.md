

# Plan: Include Evidence and Transcripts in Outcome Letter Generation

## Problem
When generating complaint outcome letters, the AI is not considering much of the evidence that users have added. This is because the edge function only fetches a limited set of data (investigation findings, decisions, staff responses, and notes) but completely ignores two key evidence sources:

1. **Uploaded evidence files** (documents, images, etc.) with their descriptions and AI summaries
2. **Audio transcripts** from recorded conversations
3. **Critical Friend Review** text (stored in the findings table but not included in the query)

## Root Cause
The `generate-complaint-outcome-letter` edge function queries four tables but misses two critical ones entirely, and under-selects from a third:

| Currently fetched | Missing |
|---|---|
| `complaint_investigation_findings` (summary, findings, evidence_notes) | `complaint_investigation_evidence` (file descriptions + AI summaries) |
| `complaint_investigation_decisions` (reasoning, actions, lessons) | `complaint_investigation_transcripts` (transcript text from audio recordings) |
| `complaint_involved_parties` (staff responses) | `critical_friend_review` column from findings table |
| `complaint_notes` (internal notes) | |

## Changes

### 1. `supabase/functions/generate-complaint-outcome-letter/index.ts`

**Add query for evidence files (~after line 380):**
- Fetch from `complaint_investigation_evidence` where `complaint_id` matches
- Select `file_name`, `evidence_type`, `description`, and `ai_summary`
- Only include records that have a `description` or `ai_summary` (empty records add no value)

**Add query for audio transcripts (~after the evidence query):**
- Fetch from `complaint_investigation_transcripts` where `complaint_id` matches
- Select `transcript_text` and `audio_duration_seconds`
- Only include records that have `transcript_text`

**Update findings query (~line 358) to include `critical_friend_review`:**
- Add `critical_friend_review` to the select fields

**Expand the investigation context block (~lines 409-433):**
- Add a new "EVIDENCE FILES" section listing each file's name, type, description, and AI summary
- Add a new "AUDIO TRANSCRIPTS" section with transcript text (truncated to prevent token overflow)
- Add the "CRITICAL FRIEND REVIEW" section if present in findings

**Update the user prompt (~line 435):**
- Reference the new evidence and transcript data in the instructions

**Increase `max_tokens` (~line 526) from 2000 to 3000:**
- With more evidence context, the AI may need more room for a thorough letter

### 2. Token Management
To prevent the prompt from exceeding token limits with very large transcripts or many evidence files:
- Truncate individual transcript texts to 2000 characters each
- Truncate individual AI summaries to 1000 characters each
- Cap the total number of evidence items at 20
- Cap the total number of transcripts at 10

## Technical Detail

New queries to add:

```text
complaint_investigation_evidence
  -> select: file_name, evidence_type, description, ai_summary
  -> filter: complaint_id = complaintId
  -> filter: description IS NOT NULL OR ai_summary IS NOT NULL

complaint_investigation_transcripts
  -> select: transcript_text, audio_duration_seconds
  -> filter: complaint_id = complaintId
  -> filter: transcript_text IS NOT NULL
```

New context sections in the prompt:

```text
EVIDENCE FILES AND SUMMARIES:
- [file_name] ([evidence_type]): [description]
  AI Summary: [ai_summary]

AUDIO TRANSCRIPTS FROM INVESTIGATION:
- Recording ([duration]): [transcript_text (truncated)]

CRITICAL FRIEND REVIEW:
[critical_friend_review text]
```

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/generate-complaint-outcome-letter/index.ts` | Add evidence + transcript queries, expand context block, update prompt, increase max_tokens |

The edge function will be redeployed after the changes.


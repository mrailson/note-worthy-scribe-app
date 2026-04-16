# Deprecated Edge Functions

Functions moved here are no longer deployed. They are kept for reference only.

## 2026-04-16 — Phase 2 Cleanup (21 functions archived)

### Batch 1 — Dead code / zombie chains (11 functions)

| # | Function | Lines | Reason |
|---|---|---|---|
| 1 | `audio-transcription` | 113 | Caller `NHSMeetingNotes.tsx` has no route — dead page |
| 2 | `recorder-websocket-transcription` | 141 | Caller `RecorderNoAGC.tsx` → unrouted `DeepgramTest.tsx` |
| 3 | `generate-meeting-notes-compare` | 194 | Caller `MeetingNotesGenerator.tsx` → unrouted `NHSMeetingNotes.tsx` |
| 4 | `generate-meeting-notes-ten-styles` | 194 | Superseded by `generate-multi-type-notes` |
| 5 | `generate-consolidated-meeting-notes` | 366 | Superseded — only called by `auto-generate-meeting-notes` internally |
| 6 | `send-meeting-summary` | 156 | Superseded by `deliver-mobile-meeting-email` + `send-meeting-email-resend` |
| 7 | `ai-api-test` | 406 | Caller `AITestModal.tsx` — no route in App.tsx |
| 8 | `api-testing-service` | 457 | Caller `APITesting.tsx` — no route in App.tsx |
| 9 | `nhs-verification-service` | 128 | Caller `APITesting.tsx` — no route in App.tsx |
| 10 | `challenge-verify-service` | 125 | Caller `APITesting.tsx` — no route in App.tsx |
| 11 | `clinical-verification-batch-test` | 163 | Test/debug dashboard — not production |

### Batch 2 — LG Capture feature removal (10 functions)

LG Capture (Lloyd George record digitisation) was discontinued. All routes, pages, and admin tabs removed.

| # | Function | Lines | Reason |
|---|---|---|---|
| 12 | `lg-ask-ai` | 127 | LG Capture discontinued |
| 13 | `lg-batch-report` | 462 | LG Capture discontinued |
| 14 | `lg-bulk-download` | 171 | LG Capture discontinued |
| 15 | `lg-generate-pdf` | 1,796 | LG Capture discontinued |
| 16 | `lg-ocr-batch` | 259 | LG Capture discontinued |
| 17 | `lg-process-patient` | 2,925 | LG Capture discontinued |
| 18 | `lg-process-summary` | 2,283 | LG Capture discontinued |
| 19 | `lg-snomed-quality-gate` | 371 | LG Capture discontinued |
| 20 | `lg-validate-upload` | 228 | LG Capture discontinued |
| 21 | `lg-verify-service` | 493 | LG Capture discontinued |

**Total lines archived:** ~10,758

### Also cleaned

- Removed all 10 LG Capture routes from `App.tsx`
- Removed LG Capture tab from System Admin monitoring
- Removed LG entries from `PageRouteAudit.tsx`
- Removed 21 entries from `EdgeFunctionAuditData.ts`
- Removed 14 entries from `supabase/config.toml`

## How to Restore

Move the function folder back to `supabase/functions/<name>/` and redeploy.

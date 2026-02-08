# Archived Edge Functions

**Date:** 2026-02-08
**Classification:** Tier 2 + Tier 3 SAFE candidates (no code references, no invocations in 30 days)

## Purpose

These edge functions have been moved out of `supabase/functions/` to **stop them being deployed** on every Lovable save. This reduces the number of Management API calls and mitigates Supabase deployment rate-limiting (HTTP 429).

## Criteria for Archival

All functions in this folder met **every** condition below:

1. **No references in `src/`** — not invoked via `supabase.functions.invoke()` or `/functions/v1/` URL patterns
2. **No references in other edge functions** — not called by any active function
3. **No references in SQL migrations, cron jobs, or triggers** — not used by `pg_cron` or database triggers
4. **Zero invocations in the last 30 days** — confirmed via Supabase function logs

## Tier 2 — Archived 2026-02-08

| # | Function Name | Reason |
|---|---|---|
| 1 | `medical-ocr-verification` | Unused OCR verification service |
| 2 | `meeting-completion-handler` | Superseded by `meeting-completion-processor` |
| 3 | `nhs-vaccination-guidance` | Standalone NHS guidance — no code refs |
| 4 | `cleanup-orphaned-versions` | One-time cleanup utility |
| 5 | `fix-orphaned-transcript-chunks` | One-time repair utility |
| 6 | `import-snomed-codes` | One-time SNOMED import utility |
| 7 | `import-snomed-bulk` | One-time SNOMED bulk import utility |
| 8 | `policy-resolve` | ICB policy resolver — no code refs |
| 9 | `smart-web-search` | Tavily-based web search — no code refs |
| 10 | `openai-realtime-token` | Superseded by `openai-realtime-session` |
| 11 | `identify-speakers` | Speaker identification — no code refs |
| 12 | `gpt5-clinical-reviewer` | Superseded by `gpt5-fast-clinical` |
| 13 | `update-meeting-context` | Meeting context updater — no code refs |

## Additional Archives — 2026-02-08

| # | Function Name | Reason |
|---|---|---|
| 20 | `import-icb-formulary-seed` | One-time ICB formulary seed script — no config entry, no client refs |

## Tier 3 (GREEN batch 1) — Archived 2026-02-08

| # | Function Name | Reason |
|---|---|---|
| 14 | `api-key-test` | Debug utility — no code refs, no logs 30d |
| 15 | `generate-image` | DALL-E image gen — no code refs, no logs 30d |
| 16 | `drug-vocabulary` | Drug vocabulary builder — no code refs, no logs 30d |
| 17 | `medical-translation-cross-check` | Multi-service translation — no code refs, no logs 30d |
| 18 | `generate-dual-consultation-summary` | Dual consultation summary — no code refs, no logs 30d |
| 19 | `generate-ppt-from-content` | PPT generator — empty directory, config-only entry removed |

### Tier 3 candidates NOT archived (active references found)

The following were initially proposed for archival but **verification search found active code references**. They remain in `supabase/functions/`:

| Function | Referenced In |
|---|---|
| `generate-meeting-notes-compare` | `src/components/MeetingNotesGenerator.tsx:198` |
| `generate-notes-styles` | `src/components/MobileNotesSheet.tsx:569` |
| `admin-clear-old-chats` | `src/components/admin/StorageManagement.tsx:499` |
| `email-translation-quality` | `src/components/EmailHandler.tsx:134` |
| `generate-audio-review` | `src/components/InvestigationEvidence.tsx:670,712` |
| `notify-login-rate-limit` | `supabase/functions/check-login-rate-limit/index.ts:149` |
| `smart-source-router` | `supabase/functions/ai-4-pm-chat/index.ts:1972` |
| `bnf-updates-fetcher` | Called by `smart-source-router` |
| `nhs-guidance-fetcher` | Called by `smart-source-router` |
| `nice-guidance-fetcher` | Called by `smart-source-router` |
| `mhra-alerts-fetcher` | Called by `smart-source-router` |

## How to Restore

To restore any function:

1. Move its folder back to `supabase/functions/<function-name>/`
2. Add any required `[functions.<function-name>]` block to `supabase/config.toml`
3. Redeploy (Lovable will auto-deploy on next save)

```bash
# Example: restore generate-image
mv supabase/functions__archive/generate-image supabase/functions/generate-image
```

## Related Documentation

- Tier 1 cleanup record: `docs/edge-function-cleanup/2026-02-07-tier1.md`
- This archive: `supabase/functions__archive/`

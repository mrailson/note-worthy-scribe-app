# Standardise Meeting Recorder to Claude Sonnet 4.6

## Goal
Every service involved in generating meeting notes will use **Claude Sonnet 4.6** (`claude-sonnet-4-6`). Secondary helpers (titles, overviews, Q&A, coach analysis, dual-transcript consolidation, hallucination repair, post-gen QC) currently use mixed providers (Gemini 3 Flash, GPT-4o, legacy Sonnet `claude-sonnet-4-20250514`). All will be moved to Sonnet 4.6 except the parallel chunking reduce step which stays on Haiku 4.5 for speed (Sonnet 4.6 used for the final reduce).

## Current state (audit)
| Service | Current model | Action |
|---|---|---|
| `auto-generate-meeting-notes` (orchestrator) | `MEETING_PRIMARY_MODEL` = `claude-sonnet-4-6` ✓ | Update fallback chain only |
| Long-transcript map step | `claude-haiku-4-5` | Keep (speed); reduce step → Sonnet 4.6 ✓ already |
| Post-gen QC inside same fn | `claude-haiku-4-5-20251001` | Move to `claude-sonnet-4-6` |
| `generate-meeting-notes-claude` (QC + Haiku passes) | `claude-haiku-4-5-20251001`, `gemini-3-flash-preview` | Switch all to `claude-sonnet-4-6` |
| `generate-meeting-notes` | `claude-sonnet-4-20250514` (legacy) | → `claude-sonnet-4-6` |
| `repair-transcript-hallucinations` | `claude-sonnet-4-20250514` (legacy) | → `claude-sonnet-4-6` |
| `generate-meeting-title` | `google/gemini-3-flash-preview` | → Anthropic `claude-sonnet-4-6` |
| `generate-meeting-overview` | `google/gemini-3-flash-preview` | → `claude-sonnet-4-6` |
| `meeting-qa-chat` | `google/gemini-3-flash-preview` | → `claude-sonnet-4-6` |
| `meeting-coach-analyze` | `google/gemini-3-flash-preview` | → `claude-sonnet-4-6` |
| `consolidate-dual-transcripts` | `google/gemini-3-flash-preview` | → `claude-sonnet-4-6` |
| `live-meeting-notes-generator` | `gpt-4o-mini` | → `claude-sonnet-4-6` |
| `clean-transcript` | `gpt-4o` | → `claude-sonnet-4-6` |
| `triple-check-transcription` | `gpt-4o-mini` | → `claude-sonnet-4-6` |

## Database change
Update `system_settings`:
- `MEETING_PRIMARY_MODEL` already `claude-sonnet-4-6` — leave.
- Update `ALLOWED_PRIMARY_MODELS` constant in code to `['claude-sonnet-4-6']` only (single canonical option) and adjust the admin LLM diagnostics page accordingly.

## Fallback chain (auto-generate-meeting-notes)
Replace the multi-provider chain with Sonnet-only resilience:

```text
attempt 1: claude-sonnet-4-6   (primary, 30s timeout)
attempt 2: claude-sonnet-4-6   (retry with backoff, 60s)
attempt 3: claude-sonnet-4-6   (final retry, 90s)
```
No cross-provider fallback — Sonnet only, as requested. If all three attempts fail, return a clean error so the user can retry. (We can revisit if Anthropic outages become an issue.)

## Code changes

### Edge functions
1. **`supabase/functions/auto-generate-meeting-notes/index.ts`**
   - `DEFAULT_GENERATION_MODEL` stays `claude-sonnet-4-6`.
   - `ALLOWED_PRIMARY_MODELS = ['claude-sonnet-4-6']`.
   - Rewrite `getFallbackChain()` to return `['claude-sonnet-4-6','claude-sonnet-4-6','claude-sonnet-4-6']`.
   - QC pass (line ~2771): `model: 'claude-sonnet-4-6'`, update `model_used` labels.
   - Map/reduce: keep Haiku for parallel map; reduce already Sonnet.

2. **`supabase/functions/generate-meeting-notes-claude/index.ts`**
   - Replace `claude-haiku-4-5-20251001` (lines 551, 1045) and `model_used` strings with `claude-sonnet-4-6`.
   - Replace `google/gemini-3-flash-preview` (line 448) with Sonnet 4.6 via Anthropic.
   - `effectiveModelOverride` always resolves to `claude-sonnet-4-6`.

3. **`supabase/functions/generate-meeting-notes/index.ts`** (line 205) — `claude-sonnet-4-20250514` → `claude-sonnet-4-6`.

4. **`supabase/functions/repair-transcript-hallucinations/index.ts`** (line 162) — `claude-sonnet-4-20250514` → `claude-sonnet-4-6`.

5. **`generate-meeting-title`, `generate-meeting-overview`, `meeting-qa-chat`, `meeting-coach-analyze`, `consolidate-dual-transcripts`, `live-meeting-notes-generator`, `clean-transcript`, `triple-check-transcription`** — replace gateway/OpenAI calls with Anthropic Sonnet 4.6 calls. Keep existing prompts. Use `ANTHROPIC_API_KEY` (already configured for the other Claude functions).

### Frontend
6. **`src/components/meeting-history/LlmModelBadge.tsx`** — default already `claude-sonnet-4-6`. Remove obsolete labels (`gemini-3-flash`, `claude-haiku-*`) since they will no longer appear.
7. **`src/components/meeting-notes/NotesGenerationBadges.tsx`** — keep label logic but Gemini badge will effectively never render.
8. **`src/utils/resolveMeetingModel.ts`** — simplify: helper now always returns `'claude-sonnet-4-6'` (or `undefined` to let server default). Auto-migrate any saved `gemini-3-flash` / `gemini-3.1-pro*` localStorage values to `'default'`.
9. **`src/pages/Settings.tsx`** (regenerate-LLM dropdown) — collapse options to: *Default (Sonnet 4.6)*. Remove Gemini choices.
10. **Admin `/admin/llm-diagnostics`** — show only Sonnet 4.6 as the selectable primary; keep diagnostics read-only.

## Memory update
Update Core memory rule:
> Meeting notes default model: `claude-sonnet-4-6` for ALL services (titles, overviews, notes, QC, Q&A, coach, consolidation, hallucination repair, live notes, transcript cleaning). Parallel-chunk MAP step keeps `claude-haiku-4-5` for speed; REDUCE step is Sonnet 4.6. No cross-provider fallback — three Sonnet retries only. `MEETING_PRIMARY_MODEL` is locked to `claude-sonnet-4-6`.

Replace the existing Gemini 3 Flash default rule.

## Risks / notes
- **Cost & latency**: Sonnet 4.6 is slower and pricier than Gemini 3 Flash for the lightweight helpers (titles, overviews). Title generation latency may rise from ~1s to ~3-5s.
- **No multi-provider safety net**: if Anthropic has an outage, all meeting AI features fail. We can re-add a GPT-5 emergency fallback later if needed — say the word.
- **Rate limits**: Anthropic per-minute token limits may bite under heavy concurrent load (multiple meetings finishing at once). We will keep the existing 30s per-attempt timeout and exponential backoff.

## Out of scope
- GP Scribe, Ask AI, Translation, Voice Agent — these are not part of the Meeting Recorder pipeline and remain on their current models.

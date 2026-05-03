## Expand Sonnet 4.6 capacity for long meetings

Edit `supabase/functions/auto-generate-meeting-notes/index.ts`:

1. **Line 2069** — `OVERRIDE_PER_ATTEMPT_TIMEOUT_MS`: `180_000` → `300_000` (5 min per attempt for manual Regenerate Notes; auto path stays 90s).
2. **Line 2137** — Anthropic `max_tokens`: `16000` → `32000` (Sonnet 4.6 supports up to 64k output; prevents truncation on long detailed minutes).

The existing log line at 2433 reads the constant dynamically, so it'll print `300s` automatically. No DB or schema changes.

Then update `mem://index.md` core rule to reflect: auto path 90s, override path 300s, max_tokens 32k.

Approve to apply.
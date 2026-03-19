

## Plan: Add LLM Model Selector for Meeting Note Regeneration

### What it does
Adds a new settings card (near Meeting Retention Policy) with a slider/select to choose which LLM is used when you manually click "Regenerate Notes". The selection persists in the database and defaults to the current model (Gemini 3 Flash).

### Options
1. **Gemini 3 Flash** (current default) — fast, good quality
2. **Claude 4 Opus** — Anthropic's most advanced model, for quality comparison

### Changes

**1. Settings UI (`src/pages/Settings.tsx`)**
- Add a new Card below Meeting Retention Policy titled "AI Model for Note Regeneration"
- Use a `Select` dropdown (consistent with retention policy UI) with two options:
  - `gemini-3-flash` — "Gemini 3 Flash (Default — Fast)"
  - `claude-4-opus` — "Claude 4 Opus (Advanced — Quality Test)"
- Save selection to `user_settings` table (or `nres_user_settings` if appropriate) — need to check which table stores user prefs
- Load saved preference on mount

**2. Database: Store preference**
- Add a column `regenerate_llm_preference` (text, default `'gemini-3-flash'`) to the user's settings record, or store in `localStorage` + pass to the edge function. Given this is a test/comparison feature, localStorage is simpler and avoids a migration.
- Store in `localStorage` key `meeting-regenerate-llm` with values `gemini-3-flash` or `claude-4-opus`.

**3. Pass model choice to edge function**
- In `FullPageNotesModal.tsx` (`handleRegenerateNotes`), read the localStorage preference and pass it as `modelOverride` in the body to `generate-meeting-notes-claude`.
- Also update the other regeneration call sites (MeetingHistory.tsx action menu, SafeModeNotesModal.tsx) if they invoke the same function.

**4. Edge function update (`supabase/functions/generate-meeting-notes-claude/index.ts`)**
- Accept optional `modelOverride` parameter from the request body.
- If `modelOverride === 'claude-4-opus'`:
  - Call Anthropic API directly using `ANTHROPIC_API_KEY` (already available as a secret)
  - Use model `claude-sonnet-4-20250514` (latest advanced Claude)
  - Same system prompt and post-processing
- Otherwise, use existing Gemini 3 Flash flow (no change to default behaviour).

### Technical details

```text
Settings UI (Select dropdown)
  └──► localStorage['meeting-regenerate-llm']

FullPageNotesModal / MeetingHistory
  └──► reads localStorage
  └──► passes modelOverride to edge function

generate-meeting-notes-claude (edge function)
  ├── modelOverride === 'claude-4-opus'
  │     └── Anthropic API (claude-sonnet-4-20250514)
  └── default
        └── Lovable AI Gateway (gemini-3-flash-preview)
```

### Files to modify
- `src/pages/Settings.tsx` — new card with Select dropdown
- `src/components/FullPageNotesModal.tsx` — read preference, pass to invoke
- `supabase/functions/generate-meeting-notes-claude/index.ts` — accept modelOverride, add Claude API path


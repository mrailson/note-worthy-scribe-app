

## Quick Guide — hosted inside `analyse-policy-gaps`

### Approach
Add an `action` field to the request body of `analyse-policy-gaps`. When `action === 'quick-guide'`, the function runs a different prompt and returns the quick guide markdown instead of the gap analysis JSON. Default behaviour (no action or `action === 'analyse'`) remains unchanged.

### Edge function change (`supabase/functions/analyse-policy-gaps/index.ts`)

- After parsing the request body, check for `action`:
  - `'quick-guide'` → use dedicated quick guide system prompt (the 7-section structure: Purpose, When This Applies, Key Staff Responsibilities, Step-by-Step Process, Documentation Requirements, If Something Goes Wrong, Quick Reminders). Return `{ success: true, quick_guide: string }`.
  - Anything else → existing gap analysis logic, untouched.
- Same auth, same CORS, same 200k char limit, same model (`gemini-3-flash-preview`), `max_tokens: 4096` (one-page output).

### Frontend changes

**`src/pages/PolicyServiceViewPolicy.tsx`**
- Add state: `isGeneratingGuide`, `guideContent`, `isGuideOpen`.
- Add a "Quick Guide" button (using `Zap` or `BookOpen` icon) in the action buttons row alongside Print, Copy, Download.
- On click: call `supabase.functions.invoke('analyse-policy-gaps', { body: { action: 'quick-guide', extracted_text: policy.policy_content } })`.
- On success: set `guideContent` and open the existing `AIResponsePanel` sheet.
- `AIResponsePanel` already provides Copy, Word Download, Print, and Email — no changes needed there.

**`src/pages/PolicyServiceMyPolicies.tsx`**
- Add a small "Quick Guide" icon button on each completed policy card.
- Needs the policy content available — check if the list query already fetches `policy_content`. If not, add it to the select or fetch on-demand when the button is clicked.

### No new files, no new edge functions, no database changes.


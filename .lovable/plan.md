

## Feature: Ask AI Profile Context Settings

### Overview
Add per-field toggle controls that let users choose which personal and practice details are injected into the Ask AI system prompt. Uses the existing `ai4gp_preferences` JSON blob in `user_settings` — no new tables or migrations required.

### Files to Modify

**1. `src/hooks/useAI4GPService.ts`**

- Add new state variables for all 12 `profileContext_*` toggles with sensible defaults (master on, name/practice name/signatures on, address/phone/email/website/manager/PCN/neighbourhood off).
- Include these in the `preferences` object inside `saveUserSettings()` so they persist via the existing upsert.
- Load them back from stored preferences in the settings-load effect.
- Add all 12 keys to the debounce `useEffect` dependency array.
- Modify `buildSystemPrompt()` signature to accept a `prefs` parameter (the preferences object). Gate the entire practice context block behind `prefs.profileContext_enabled !== false`. Within that block, wrap each field injection (practice name, address, phone, email, website, user name, user email, manager, PCN, neighbourhood, signatures) behind its corresponding `profileContext_show*` check. Also gate the "EXAMPLES OF CORRECT USAGE" lines the same way.
- Expose the new state + setters from the hook's return object.

**2. `src/components/ai4gp/SettingsModal.tsx`**

- Add new props for the 12 `profileContext_*` values and their change handlers.
- Add a `practiceContext` prop (the resolved practice data) so toggle labels can show current values.
- Add a new **6th tab** called "Context" (icon: `User` or `Building2`) to the tab bar (change grid from `grid-cols-5` to `grid-cols-6`).
- Tab content structure:
  - **Master toggle**: "Include my profile details in AI responses" → `profileContext_enabled`
  - When master is ON, show grouped toggles:
    - **Your Details** section: Name, Email, Signatures
    - **Practice Details** section: Practice Name, Address, Phone, Email, Website, Practice Manager
    - **Network** section: PCN, Neighbourhood
  - Each toggle row shows the field label and the current value in muted text beneath (e.g. "Dr Smith", "Oak Lane Medical Practice").
  - When master is OFF, grey out / hide individual toggles.
  - **Live preview box** at the bottom showing the exact context text that will be injected, updating reactively as toggles change. Reuse the same field-gating logic from `buildSystemPrompt` to generate preview text.
- Wire save via the existing `onSaveSettings` callback (already debounced).

**3. `src/components/AI4GPService.tsx`**

- Pass the new `profileContext_*` state values and setters from the hook through to `<SettingsModal>`.
- Pass `practiceContext` (already available in this component) to `<SettingsModal>` for the value previews.

### Implementation Details

- **Default behaviour preserved**: All checks use `!== false` so existing users without these keys see no change — everything remains included.
- **No migrations**: Keys are added to the existing JSON blob; Supabase handles arbitrary JSON in `setting_value`.
- **Prompt gating pattern**:
```typescript
// In buildSystemPrompt:
if (prefs.profileContext_enabled !== false) {
  if (prefs.profileContext_showPracticeName !== false && practiceContext.practiceName) {
    prompt += `\n${entityLabel} Name: ${practiceContext.practiceName}`;
  }
  // ... same pattern for each field
}
```

- **Live preview** generates a read-only text block using the same conditional logic, so users see exactly what the AI will receive.

### Scope
- No new Supabase tables, edge functions, or migrations
- No changes to `usePracticeContext.ts` — it continues fetching all data; the filtering happens at prompt-build time
- Approximately 3 files modified


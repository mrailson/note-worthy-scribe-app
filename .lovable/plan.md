

## Plan: Improve Quick Guide Preview & Persist Generated Outputs

### Part 1: Word Preview — Document-Style Layout

The current Word preview uses a plain `prose` block with a grey-ish background. Replace with a white A4-style card with proper margins, shadows, and document-like typography to simulate a real Word document.

**Changes to `src/components/policy/QuickGuideDialog.tsx`:**
- Replace the `ScrollArea` wrapper with a white background panel styled like an A4 page (white bg, subtle drop shadow, generous padding, max-width constrained)
- Add a document-style header showing the policy title, audience badge, and practice name
- Use a clean serif or system font for body text to feel more "document-like"
- Keep ReactMarkdown rendering but style headings as bold blue (NHS style) and lists with proper indentation

### Part 2: Persist Quick Guide Outputs to Supabase Storage

Currently only `last_quick_guide` metadata (filename, audience, date) is saved — the actual content is discarded after download. We need to store the generated content so it can be reviewed/downloaded later.

**Approach — Store files in Supabase Storage:**

1. **Create a `quick-guides` storage bucket** (or use existing policy storage)
2. **On generation**, upload the Word markdown text (as `.md`) or infographic image (as `.png`) to `quick-guides/{userId}/{policyId}/{timestamp}_{type}.{ext}`
3. **Update `metadata.quick_guides`** on the policy_completion to store an array of generated guides (not just `last_quick_guide`), each with: `{ id, type, audience, fileName, storagePath, generatedAt }`
4. **Cap at ~10 guides per policy** to prevent unbounded growth

**Changes to `src/components/policy/QuickGuideDialog.tsx`:**
- After generation, upload content to Supabase Storage before showing preview
- Pass back the storage path in the `QuickGuideOutput` type

**Changes to `src/pages/PolicyServiceMyPolicies.tsx`:**
- Update `onGenerated` to append to `metadata.quick_guides[]` array instead of overwriting `last_quick_guide`
- On the policy card, show a small indicator (e.g. badge count) when guides exist
- Add a way to view/download past guides (small dropdown or expandable section on the card)

**Changes to `src/pages/PolicyServiceViewPolicy.tsx`:**
- Similar: show list of saved guides with download/preview buttons

### Part 3: Review Past Guides

Add a small "Quick Guides" section or popover on each policy card showing saved guides with:
- Type icon (Word/Infographic)
- Audience label
- Date generated
- Download button (fetches from storage)
- Preview button (re-opens the preview modal with stored content)

### Files to change

1. **`src/components/policy/QuickGuideDialog.tsx`** — A4-style white preview layout + upload to storage on generation
2. **`src/types/quickPick.ts`** or new type file — extend `QuickGuideOutput` with `storagePath`
3. **`src/pages/PolicyServiceMyPolicies.tsx`** — persist array of guides, show badge/list on cards
4. **`src/pages/PolicyServiceViewPolicy.tsx`** — show saved guides list with download/preview


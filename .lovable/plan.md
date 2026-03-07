

## Plan: Auto-save Generated Updated Version to Policy Card

### Problem
Currently, the "Generate Updated Version" button on the Update Policy page (`/policy-service/update`) generates an updated policy and displays it in a preview panel (step 3), but doesn't save it back to the user's existing policy card in My Policies. The user must manually handle this.

### Solution
After generating the updated policy content, automatically match it to the user's existing `policy_completions` record (by policy type name), then create a new version in `policy_versions` and update the `policy_completions` record — all without requiring the user to do anything extra.

### Changes

**1. `src/pages/PolicyServiceUpdate.tsx`**
- Import `usePolicyCompletions` and `usePolicyVersions` hooks
- After `generateUpdatedPolicy` succeeds (in `handleGenerateUpdated`):
  - Search existing completions for a matching policy by title/type (fuzzy match on `policy_type` from gap analysis)
  - If a match is found:
    - Call `ensureInitialVersion` to guarantee a v1.0 exists
    - Call `createVersion` with change type `content_change`, the updated content, and a summary referencing the gap analysis fixes
    - Update the completion record with the new content
    - Show a success toast: "Saved as v{X.Y} on your policy card"
  - If no match is found:
    - Save as a new completion via `saveCompletion`
    - Show toast: "Saved as a new policy"
- Remove or simplify step 3 (the preview) — still show it but with a "Saved" confirmation badge instead of requiring manual action
- Add a "View in My Policies" button to navigate to `/policy-service/my-policies` after save

**2. `src/components/policy/GapAnalysisResults.tsx`**
- Update button text from "Generate Updated Version" to "Fix Issues & Save New Version" (clearer intent)
- Update the info box text to explain that changes will be saved automatically

**3. No database changes required** — all existing tables (`policy_completions`, `policy_versions`) already support this workflow.

### Matching Logic
- Fetch user's completions via `usePolicyCompletions`
- Match `gapAnalysis.policy_type` against `completion.policy_title` using case-insensitive contains/similarity
- If multiple matches, use the most recently updated one

### User Flow (After)
1. Upload policy → Extract text
2. View gap analysis results → Click "Fix Issues & Save New Version"
3. AI generates updated content → Automatically saved as new version on the matching policy card
4. User sees success confirmation with link to My Policies


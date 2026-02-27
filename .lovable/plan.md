
You’re absolutely right: the issue is route/component mismatch, not the tab wrapping.

## What I found
- `/NRESDashboard` currently renders **`SDADashboard`** (in `src/App.tsx`).
- The Document Vault was added to **`NRESDashboard.tsx`**, which is used by `/nres` (legacy/admin-style route), not your active dashboard.
- So you won’t see Document Vault on `/NRESDashboard` until it is added inside `SDADashboard.tsx`.

## Implementation approach
1. **Keep `/NRESDashboard` as the primary route** (as requested).
2. **Add Document Vault to `SDADashboard.tsx`** (the dashboard you are actually using):
   - Import `NRESDocumentVault`.
   - Add a new top-level tab trigger (e.g. `value="document-vault"`).
   - Add matching `<TabsContent value="document-vault">` rendering `<NRESDocumentVault />`.
   - Add icon (`FolderLock`) and compact mobile label (`Vault`) to match existing SDA tab style.
3. **Do not change backend logic**:
   - Existing vault hooks, permissions, inheritance, and RLS remain as already implemented.
   - No new DB migration needed for this visibility fix.
4. **Optional clean-up (recommended after this fix)**:
   - Keep vault in both `/nres` and `/NRESDashboard` for now to avoid breakage.
   - In a follow-up, we can retire or relabel the legacy `/nres` route to prevent future confusion.

## Files to update
- `src/pages/SDADashboard.tsx`
  - Add imports: `NRESDocumentVault`, `FolderLock`.
  - Add new `TabsTrigger`.
  - Add corresponding `TabsContent`.
- No other file changes required for the immediate fix.

## Validation steps
1. Open `/NRESDashboard`.
2. Confirm **Document Vault** appears in the same top tab row as Executive Summary / Evidence Library / Claims & Oversight.
3. Open Document Vault tab and verify:
   - Folder list loads.
   - Create folder works.
   - Upload works.
   - Search only returns accessible items.
4. Quick regression:
   - Existing tabs still switch correctly.
   - Claims & Oversight behaviour unchanged.

## Technical note
This is the key mismatch in routing today:
```text
/nres           -> NRESDashboard (where vault was added)
/NRESDashboard  -> SDADashboard  (where user is working)
```
So the fix is to integrate the vault into `SDADashboard.tsx`.



## Fix: Document Vault UI Freeze on File Deletion

### Problem
When deleting a file in the production Document Vault, the UI freezes and requires a page refresh. This works fine in the test environment, suggesting the issue relates to production data volume or edge function latency.

### Root Cause Analysis
The freeze is caused by multiple competing operations happening simultaneously when the delete button is clicked:

1. **The delete mutation** calls Supabase storage removal + database delete
2. **The `onSuccess` callback** immediately fires `queryClient.invalidateQueries()` for both folders AND files, triggering re-fetches
3. **The audit log** (`logVaultAction`) runs inside `onSuccess` and calls two async operations in parallel: a profile lookup AND the `get-client-info` edge function (which may cold-start in production, taking several seconds)
4. **The tree cache update** (lines 1252-1268) iterates over all cached tree nodes synchronously
5. All of this happens while the dialog is closing and React is re-rendering

In production, with more data and potential edge function cold starts, these competing operations overwhelm the UI thread.

### Solution

**1. Make the audit log fully non-blocking in the delete mutation** (`useNRESVaultData.ts`)
- Wrap the `logVaultAction` call in a `setTimeout(..., 0)` or use `.catch()` without awaiting, ensuring it never blocks query invalidation or UI updates

**2. Separate dialog closure from the delete operation** (`VaultContentView.tsx`)
- Close the delete dialog and clear state immediately on click
- Then trigger the delete operation after a microtask yield, preventing the dialog animation and delete mutation from competing for the main thread

**3. Add a small yield before query invalidation** (`useNRESVaultData.ts`)
- Insert a `setTimeout` before `invalidateQueries` to let React finish the dialog close animation first

### Technical Changes

**File: `src/hooks/useNRESVaultData.ts`** (lines ~312-317)
- In the `onSuccess` handler of `useDeleteVaultItem`, wrap the audit log in a `queueMicrotask` or `setTimeout` so it runs after the UI has updated
- Keep `invalidateQueries` as-is but ensure it does not compete with the audit log

**File: `src/components/nres/vault/VaultContentView.tsx`** (lines ~1248-1272)
- Restructure the delete button handler to:
  1. Capture the delete target details
  2. Close the dialog immediately (`setDeleteTarget(null)`, `setDeleteConfirmText('')`)
  3. Update tree cache if in tree view
  4. Call `onDelete` after a `requestAnimationFrame` or `setTimeout(0)` yield

This ensures the UI remains responsive by separating the visual updates (dialog close, tree cache cleanup) from the async network operations (storage delete, DB delete, audit log, query refetch).


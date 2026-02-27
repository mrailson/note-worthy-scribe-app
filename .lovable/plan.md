
# Add "Remove All Permissions" Button

## What changes
Add a "Remove All" button next to the "Current Permissions" heading that deletes all explicit permission entries for the current folder/file in one action, with a confirmation prompt to prevent accidental clicks.

## Details

### File: `src/components/nres/vault/VaultPermissionManager.tsx`

1. **Add a "Remove All" mutation** -- a new `useMutation` that deletes all `shared_drive_permissions` rows matching the current `targetId` and `targetType`. On success, invalidate the relevant query keys and show a success toast.

2. **Add a confirmation state** -- a simple `showRemoveAllConfirm` boolean state. Clicking "Remove All" shows an inline confirmation (e.g. "Are you sure? Remove All / Cancel") rather than immediately deleting, to prevent accidental removal.

3. **Add the button to the UI** -- in the "Current Permissions" header row (line 513), next to the existing badge count, add a small destructive "Remove All" button (only visible when there are existing permissions). When confirmed, it calls the bulk delete mutation.

### Technical detail
- The bulk delete query: `supabase.from('shared_drive_permissions').delete().eq('target_id', targetId).eq('target_type', targetType)`
- This only removes explicit overrides; the default "All NRES Users -- Viewer" row is a visual indicator and is unaffected.
- The button will use `variant="ghost"` with destructive text styling and a `Trash2` icon, sized small to sit inline with the heading.

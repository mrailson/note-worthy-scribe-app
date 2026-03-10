

## Plan: Add Document Sign-Off Module Access Toggle

### What needs to change

The `document_signoff_access` flag already exists in the `user_roles` database table and is already used for access gating in `DocumentApproval.tsx` and the Header menu. However, it is missing from the Practice User Management UI, so practice managers cannot toggle it for their users.

### Changes (all in `src/components/PracticeUserManagement.tsx`)

1. **Add to `ModuleAccessState` interface** (line 81): Add `document_signoff_access: boolean`

2. **Add to all default/reset objects** (3 locations — lines 163-179, 482-498, 551-567): Add `document_signoff_access: false` (or read from user data when editing)

3. **Add to edit modal population** (line 482-498): Read `user.document_signoff_access` when populating the form for editing

4. **Add Switch toggle in the modal UI** (after the Complaints Service toggle, ~line 1040): Add a new toggle for "Document Sign-Off" following the same pattern as the other toggles

5. **Add badge in the user table** (after the Complaints badge, ~line 768): Show a "Sign-Off" badge when the user has `document_signoff_access`

6. **Add to email preview labels** (~line 587): Add `document_signoff_access: 'Document Sign-Off'` to the `moduleLabels` map

### No database or edge function changes needed
The `document_signoff_access` column already exists in `user_roles` and is already handled by the `update-user-practice-manager` edge function (it processes `module_access` generically).


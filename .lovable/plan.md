

# NRES Document Vault - Implementation Plan

## Overview
A permission-controlled document management system embedded as a new tab within the NRES Dashboard. It reuses the existing `shared_drive_files`, `shared_drive_folders`, and `shared_drive_permissions` tables, adding an NRES-specific scope identifier and permission management UI.

All NRES Dashboard users get unrestricted access by default. Admins and folder creators can then restrict specific folders/files to particular users with granular read/upload/delete controls. Items a user cannot access are completely hidden from their view.

---

## Key Design Decisions

- **Reuse existing tables**: The `shared_drive_files`, `shared_drive_folders`, and `shared_drive_permissions` tables already exist with full RLS policies and a `has_shared_drive_permission` database function. We will add an `nres_vault` scope marker to distinguish NRES vault content from general Shared Drive content.
- **NRES users get full access by default**: Any user with NRES service activation automatically has unrestricted access. Permission restrictions are opt-in per folder/file.
- **Inheritance**: Subfolder permissions inherit from parent by default (using the existing `is_inherited` column), overridable per subfolder.
- **Hidden restricted items**: Users only see folders/files they have access to (enforced via RLS).
- **Search respects permissions**: Search queries go through the same RLS-protected tables, so results naturally exclude items the user cannot access.

---

## Implementation Steps

### 1. Database Changes

**Add scope column to folders and files tables:**
- Add a `scope` column (text, default `'general'`) to `shared_drive_folders` and `shared_drive_files` to distinguish NRES vault content (`'nres_vault'`) from general Shared Drive files.

**Create a `has_nres_vault_access` security definer function:**
- Checks if a user has NRES service activation (via `user_service_activations` table).
- Used in RLS policies so NRES users automatically see all NRES vault content unless explicitly restricted.

**Update RLS policies on `shared_drive_folders` and `shared_drive_files`:**
- Extend SELECT policies: for `scope = 'nres_vault'`, grant access if the user has NRES activation AND is not explicitly set to `no_access` on that item.
- Extend INSERT/UPDATE/DELETE policies similarly for NRES-scoped items.

**Create a `check_nres_vault_permission` function:**
- Returns the effective permission level for a user on a given folder/file, considering inheritance from parent folders.
- Used by the UI to determine which actions to show (upload button, delete button, etc.).

### 2. New Components

**`NRESDocumentVault.tsx`** (main container component):
- Renders inside the NRES Dashboard as a new tab ("Document Vault" with a `FolderLock` icon).
- Contains the folder tree, content view, breadcrumbs, toolbar, and search.
- All queries filter by `scope = 'nres_vault'`.
- Adapts layout for mobile (iPhone detection already exists in the dashboard).

**`VaultPermissionManager.tsx`** (dialog component):
- Shown when an admin or folder creator clicks a "Manage Access" option on a folder or file.
- Lists current permissions with user names and permission levels.
- Allows adding/removing users and setting their access level (viewer, editor, no_access).
- Shows inherited vs. explicit permissions clearly.

**`VaultFolderTree.tsx`** (navigation pane):
- Collapsible folder tree for the left sidebar, similar to `SharedDriveNavigationPane` but scoped to NRES vault.

**`VaultContentView.tsx`** (content area):
- Displays folders and files in list or grid view.
- Context menu with actions based on user's effective permission (view, download, upload, delete, manage access).
- Action buttons conditionally rendered based on permissions.

**`VaultToolbar.tsx`** (toolbar):
- Search bar (results respect RLS - only accessible items returned).
- New Folder / Upload buttons (shown only if user has upload permission on current folder).
- View mode toggle (list/grid).
- Bulk actions (download, delete) for selected items.

### 3. Hooks

**`useNRESVaultPermissions.ts`:**
- Hook to check the current user's effective permission on a given folder/file.
- Calls the `check_nres_vault_permission` database function.
- Caches results with React Query.

**`useNRESVaultData.ts`:**
- Hook to load folders and files for the current directory, filtered by `scope = 'nres_vault'`.
- Handles search, sorting, and breadcrumb path loading.
- All queries go through RLS, so hidden items are automatically excluded.

### 4. Integration into NRES Dashboard

**Update `NRESDashboard.tsx`:**
- Add a third tab: "Document Vault" alongside "Dashboard" and "Claims & Oversight".
- Render the `NRESDocumentVault` component inside the new tab content.

### 5. Storage

- Reuses the existing `shared-drive` Supabase storage bucket.
- Files uploaded via the vault use a path prefix like `nres-vault/{user_id}/{timestamp}.{ext}` for organisation.

---

## Technical Details

### Database Migration SQL (summary)

```text
1. ALTER TABLE shared_drive_folders ADD COLUMN scope text DEFAULT 'general';
2. ALTER TABLE shared_drive_files ADD COLUMN scope text DEFAULT 'general';
3. CREATE INDEX on both tables for scope column.
4. CREATE FUNCTION has_nres_vault_access(user_id uuid) - checks user_service_activations.
5. CREATE FUNCTION check_nres_vault_permission(user_id, target_id, target_type) 
   - returns effective permission considering inheritance.
6. UPDATE RLS policies to include NRES vault logic.
```

### Permission Resolution Logic

```text
For a given user + folder/file:
1. If user has no NRES activation -> no access (hidden)
2. If explicit permission exists on this item -> use it
3. If no explicit permission, check parent folder (inheritance)
4. If no explicit permission anywhere in chain -> full access (NRES default)
5. If any ancestor has 'no_access' explicitly set -> no access
```

### File Count Estimate
- ~6 new component files
- ~2 new hook files  
- ~1 database migration
- ~2 modified files (NRESDashboard.tsx, types)




## Document Vault V2 — Live Implementation for ENN Only

### What We're Doing
Replace the ENN Document Vault with the full V2 design shown in the screenshots. NRES continues to use the existing V1 vault untouched. The V2 vault will use real data from the `enn_vault` scoped hooks — not static HTML.

### Design (from screenshots)
Six tabs: **Folders** (existing tree/folder view), **Latest edits** (sorted by `updated_at`), **New uploads** (sorted by `created_at`), **My documents** (filtered by `created_by = user.id`), **Favourites** (starred items), **All documents** (flat list of every file).

Each tab has: search/filter input, file-type filter chips (All types, .docx, .pdf, .xlsx), document table with type badges, user avatars, relative timestamps, and star/favourite toggle.

### Plan

**Step 1 — New hooks for V2 data views**
Add to `useNRESVaultData.ts`:
- `useAllVaultFiles(scope)` — fetches all files across all folders (no folder filter), used by Latest edits, New uploads, My documents, All documents tabs
- `useVaultFavourites(scope)` — fetches user's starred files from a new `vault_favourites` table
- `useToggleFavourite(scope)` — mutation to star/unstar a file

**Step 2 — Database migration for favourites**
Create `vault_favourites` table:
- `id` (uuid, PK), `user_id` (uuid, FK → auth.users), `file_id` (uuid, FK → shared_drive_files), `scope` (text), `created_at` (timestamptz)
- Unique constraint on `(user_id, file_id)`
- RLS: users can only read/write their own rows

**Step 3 — Create `ENNDocumentVaultV2` component**
New file `src/components/enn/vault/ENNDocumentVaultV2.tsx`:
- Tabbed UI with 6 tabs matching the V2 design
- **Folders tab**: Reuses existing `VaultContentView`, `VaultBreadcrumbs`, `VaultToolbar` components with `scope="enn_vault"`
- **Latest edits tab**: All files sorted by `updated_at` desc, grouped by time period (Today, This week, Earlier), columns: Document+path, Type badge, Edited by (avatar+name), When, Star
- **New uploads tab**: Same layout, sorted by `created_at` desc, "Uploaded by" column
- **My documents tab**: Filtered to `created_by = current user`, columns: Document+path, Type, Uploaded date, Last edited, Star
- **Favourites tab**: Only starred files, columns: Document+path, Type, Location (folder path), Last edited, Star
- **All documents tab**: Every file flat, columns: Document+path, Type, Location, Edited by, Last edited, Star
- Each non-folder tab includes: search input, filter chips (All types, .docx, .pdf, .xlsx), styled document table
- Keeps the existing vault info cards (what to store, hygiene tips, important notice) on the Folders tab
- Retains all existing mutation capabilities (create folder, upload, delete, rename, move, copy)

**Step 4 — Shared sub-components**
Create helper components in `src/components/enn/vault/`:
- `VaultDocumentTable.tsx` — reusable table with type badges, user avatars (initials circle), relative timestamps, star toggle
- `VaultFileTypeFilter.tsx` — filter chip row (All types, .docx, .pdf, .xlsx)

**Step 5 — Wire up in ENN dashboard**
Change `ENNDashboard.tsx` to import and render `ENNDocumentVaultV2` instead of `<NRESDocumentVault scope="enn_vault" />`.

**Step 6 — Remove V2 preview banner from ENN vault**
Since ENN now IS V2, the "Version 2 coming soon" banner and preview modal are not needed in the ENN vault.

### Files to create
| File | Purpose |
|------|---------|
| `src/components/enn/vault/ENNDocumentVaultV2.tsx` | Main V2 vault component with 6 tabs |
| `src/components/enn/vault/VaultDocumentTable.tsx` | Reusable document table with badges/avatars/stars |
| `src/components/enn/vault/VaultFileTypeFilter.tsx` | File type filter chips |
| Migration SQL | `vault_favourites` table |

### Files to modify
| File | Change |
|------|--------|
| `src/hooks/useNRESVaultData.ts` | Add `useAllVaultFiles`, `useVaultFavourites`, `useToggleFavourite` hooks |
| `src/pages/ENNDashboard.tsx` | Switch to `ENNDocumentVaultV2` |

### NRES safety
NRES vault is completely untouched — it continues rendering `<NRESDocumentVault scope="nres_vault" />` with no changes to its component, hooks (all default to `'nres_vault'`), or data.


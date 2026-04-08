

## Plan: Upgrade NRES Document Vault to V2 Layout

### What We're Doing
Replace the current NRES Document Vault (single folder view with V2 preview banner) with the full V2 tabbed interface already live on ENN. This brings six tabs (Folders, Latest Edits, New Uploads, My Documents, Favourites, All Documents), the unified toolbar, file-type filters, collapsible guidance cards, and the document table with avatars, type badges, and favourites.

### Safety Guarantees
- **No database changes** — all V2 hooks (`useAllVaultFiles`, `useVaultFolderMap`, `useVaultFavourites`, `useToggleFavourite`) already accept a `scope` parameter and will use `nres_vault`
- **No folder/file data affected** — the same queries, same storage bucket paths, same scope filtering
- **No permission changes** — same `useVaultPermission` and `useIsVaultAdmin` hooks used identically
- **All existing vault components shared** — `VaultContentView`, `VaultBreadcrumbs`, `VaultPermissionManager`, `VaultSettingsModal`, `VaultDocumentTable`, `VaultFileTypeFilter` are all reused

### Changes

| File | Action |
|---|---|
| `src/components/nres/vault/NRESDocumentVault.tsx` | **Rewrite** — adopt the ENNDocumentVaultV2 structure with `SCOPE = 'nres_vault'`. Remove the V2 preview banner and `VaultV2PreviewModal` import. Keep NRES-specific branding (title says "NRES Document Vault", naming prefix uses `NRES_`). Retain the "Proposed Folder Structure & Access Matrix" download link in the guidance cards. Add the six-tab navigation, file-type filters, favourites, and document table views. |
| `src/pages/SDADashboard.tsx` | No change needed — already imports `NRESDocumentVault` |
| `src/pages/NRESDashboard.tsx` | No change needed — already imports `NRESDocumentVault` |

### Technical Detail
The rewrite is essentially a copy of `ENNDocumentVaultV2.tsx` with three substitutions:
1. `SCOPE = 'nres_vault'` instead of `'enn_vault'`
2. Card title: "NRES Document Vault" instead of "ENN Document Vault"
3. Guidance card naming example uses `NRES_Policy_...` prefix
4. Retains the "Proposed Folder Structure & Access Matrix" download link (NRES-only)
5. Removes the V2 preview banner (no longer needed — this IS V2)
6. Removes the `VaultV2PreviewModal` import

All shared components (`VaultDocumentTable`, `VaultFileTypeFilter`, `VaultContentView`, etc.) are already in place and scope-aware — no modifications needed.


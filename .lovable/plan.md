

## Plan: ENN People Directory + Independent ENN Document Vault

### What We're Doing
Two changes: (1) Give the ENN dashboard its own People Directory with the correct ENN practices, ICB, and Rebecca Gane as defaults — completely separate from NRES people. (2) Create the ENN Document Vault with its own folder structure (copied from the existing NRES structure) using `scope = 'enn_vault'`, ensuring complete data isolation.

---

### Part 1: ENN People Directory

**Problem**: The ENN dashboard currently wraps everything in `NRESPeopleProvider` which loads NRES default people (Maureen Green, Malcolm Railson, Amanda Taylor, etc.). These are wrong for ENN.

**Solution**:

1. **Create `src/data/ennPeopleDirectory.ts`** — new defaults file with ENN-specific people:
   - Rebecca Gane (RG) — Transformation Manager, 3Sixty Care Partnership
   - Representatives from each of the 10 ENN practices (from the uploaded image):
     - Parklands Surgery
     - The Cottons Medical Centre
     - Spinney Brook Medical Centre
     - Woodford Surgery (Spinney Branch)
     - Nene Valley Surgery
     - The Meadows Surgery
     - Higham Ferrers Surgery
     - Marshalls Road Surgery
     - Harborough Fields Surgery
     - Rushden Medical Centre
     - Oundle Medical Practice
   - ICB representative(s)
   - Practice addresses from the uploaded table
   
2. **Create `src/contexts/ENNPeopleContext.tsx`** — identical structure to `NRESPeopleContext` but initialised with ENN defaults. This keeps the two completely independent.

3. **Update `src/pages/ENNDashboard.tsx`** — replace `NRESPeopleProvider` with `ENNPeopleProvider` so all child components (Finance & Governance, Action Log, PersonSelect) automatically use ENN people instead of NRES people.

---

### Part 2: Independent ENN Document Vault

**Problem**: The ENN dashboard currently renders `<NRESDocumentVault />` which hardcodes `scope: 'nres_vault'` in every query and mutation. ENN users see NRES folders and files.

**Solution**:

1. **Make all vault hooks scope-aware** — update `useNRESVaultData.ts`:
   - Every hook (`useVaultFolders`, `useVaultFiles`, `useVaultBreadcrumbs`, `useVaultSearch`, `useCreateVaultFolder`, `useUploadVaultFile`, `useDeleteVaultItem`, `useRenameVaultItem`, `useMoveVaultItem`, `useCopyVaultFile`, `useUpdateFileDescription`, `useReplaceVaultFile`) gains an optional `scope` parameter, defaulting to `'nres_vault'`
   - All `.eq('scope', 'nres_vault')` becomes `.eq('scope', scope)`
   - All `.insert({ scope: 'nres_vault' })` becomes `.insert({ scope })`
   - All React Query keys include scope: `['nres-vault-folders', parentId]` → `['vault-folders', scope, parentId]`
   - Storage path prefix changes from `nres-vault/` to use the scope value

2. **Make `NRESDocumentVault.tsx` accept a `scope` prop** — default `'nres_vault'`, pass through to all hooks. Update naming hint text to show `ENN_` prefix when scope is `enn_vault`.

3. **Update `ENNDashboard.tsx`** — pass `scope="enn_vault"` to the vault component.

4. **Database migration** — insert the full NRES folder structure as new rows with `scope = 'enn_vault'` (new UUIDs, same names and hierarchy). This gives ENN ~153 pre-built folders matching the NRES structure. No files are copied — just the empty folder skeleton.

5. **Update vault audit logging** — ensure `useNRESVaultAudit.ts` also passes scope so ENN audit entries are distinguishable.

---

### Technical Details

**Files to create**:
| File | Purpose |
|------|---------|
| `src/data/ennPeopleDirectory.ts` | ENN default people + groups + practice addresses |
| `src/contexts/ENNPeopleContext.tsx` | Independent state provider for ENN people |

**Files to modify**:
| File | Change |
|------|--------|
| `src/hooks/useNRESVaultData.ts` | Add `scope` param to all 12+ hooks, update query keys |
| `src/hooks/useNRESVaultAudit.ts` | Add `scope` param to audit logging |
| `src/components/nres/vault/NRESDocumentVault.tsx` | Accept `scope` prop, pass to hooks, conditional branding |
| `src/pages/ENNDashboard.tsx` | Switch to `ENNPeopleProvider`, pass `scope="enn_vault"` to vault |

**Database migration**:
- Recursive INSERT of ~153 folder rows with `scope = 'enn_vault'`, preserving the parent-child hierarchy with new UUIDs

**Zero regression guarantee**: All existing NRES code continues to work unchanged — the `scope` parameter defaults to `'nres_vault'` everywhere, so no existing queries or cache keys are affected.




## Move Evidence from Claim-Level to Staff-Line-Level

### What changes

Evidence uploads move from a single panel at the bottom of the claim card to being **inline with each staff member row**. Each staff line gets its own evidence requirements based on their category:

- **Buy-Back staff**: SDA Slot Type + SDA Rota (mandatory) + LTC Slot Type + LTC Rota (mandatory)
- **New SDA staff**: SDA Slot Type + SDA Rota (mandatory) + LTC Slot Type + LTC Rota (optional, not mandatory)

### Database migration

Add a `staff_index` column to `nres_claim_evidence`:

```sql
ALTER TABLE public.nres_claim_evidence
  ADD COLUMN staff_index INTEGER;
```

This links each evidence file to a specific staff line within the claim (matching the array index in `staff_details`). Existing claim-level evidence (where `staff_index IS NULL`) continues to work but new uploads will always include the staff index.

### UI changes

**Remove** the standalone `ClaimEvidencePanel` below the staff table.

**Add** an expandable evidence row beneath each staff member row in the table. After each staff member's main row (and notes row), render a collapsible evidence section showing:
- For Buy-Back staff: 4 evidence slots (SDA Slot Type, SDA Rota, LTC Slot Type, LTC Rota) — all mandatory
- For New SDA staff: 4 evidence slots — SDA pair mandatory, LTC pair optional (shown but not required for submission)

Each slot shows the upload button, uploaded file name, view/delete actions — same UI as current `EvidenceSlot` component but scoped to that staff member.

An expand/collapse toggle on each staff row (e.g., a chevron or "Evidence" button) reveals the evidence slots inline.

### Hook changes

**`useNRESClaimEvidence.ts`**: 
- Update `uploadEvidence` to accept `staffIndex` parameter and store it
- Update `uploadedTypes` to be keyed by `staffIndex` → `evidenceType` (nested map)
- Add helper `getFilesForStaff(staffIndex)` and `getUploadedTypesForStaff(staffIndex)`

**`ClaimEvidencePanel.tsx`**:
- Refactor `EvidenceSlot` into a reusable exported component
- Create new `StaffLineEvidence` component that renders the appropriate slots for a single staff member
- Update `useEvidenceComplete` to check per-staff-line: all Buy-Back staff must have all 4 mandatory docs; New SDA staff must have SDA pair

### Submission gating

Submit button disabled unless:
- Every **Buy-Back** staff line has all mandatory evidence uploaded (SDA + LTC)
- Every **New SDA** staff line has all mandatory SDA evidence uploaded
- Declaration confirmed

### Files affected

| File | Change |
|------|--------|
| New migration | Add `staff_index` column to `nres_claim_evidence` |
| `useNRESClaimEvidence.ts` | Add `staff_index` to uploads, restructure state by staff index |
| `ClaimEvidencePanel.tsx` | Export `EvidenceSlot`, create `StaffLineEvidence`, update `useEvidenceComplete` for per-line checking |
| `BuyBackClaimsTab.tsx` | Remove claim-level evidence panel, add inline evidence per staff row, update submission gating logic |
| `supabase/types.ts` | Add `staff_index` to evidence type |


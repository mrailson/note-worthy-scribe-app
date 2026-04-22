

## Plan: Show Uploaded Supporting Evidence in Management, SNO Approver, and SNO Finance Views

### Problem

The Verifier (Management), SNO Approver (Director), and SNO Finance dashboards only display Part A / Part B status pills but do not show the actual uploaded evidence files. Users in these roles cannot view or download the supporting documents that practices have uploaded with their claims.

### What Changes

**1. `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` (Management View)**

- Import `useNRESClaimEvidence`, `useNRESEvidenceConfig`, and `StaffLineEvidence` from `ClaimEvidencePanel`
- Inside the expanded claim card (after the staff line items table, around line 465), add a read-only evidence section for each staff member
- For each staff line, render `StaffLineEvidence` with `canEdit={false}` so files are visible and downloadable but not editable
- The `useNRESClaimEvidence` hook will be called with the claim ID to fetch all uploaded files

**2. `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` (SNO Approver / SNO Finance View)**

- Same approach: import `useNRESClaimEvidence`, `useNRESEvidenceConfig`, and `StaffLineEvidence`
- Inside the expanded claim card (after the staff line items table, around line 636), add the same read-only evidence section
- Render `StaffLineEvidence` with `canEdit={false}` for each staff member

**3. Practice View Check (`BuyBackPracticeDashboard.tsx`)**

- Already imports and uses `useNRESClaimEvidence` and `StaffLineEvidence` — no changes needed. Evidence is already visible in the practice view.

### Technical Details

- `StaffLineEvidence` already supports read-only mode via `canEdit={false}` — upload/delete buttons are hidden, only download links are shown
- `useNRESClaimEvidence(claimId)` provides `getUploadedTypesForStaff(staffIndex)` and `getFilesForStaff(staffIndex)` which map files to staff lines
- The evidence section will appear as a collapsible area below each claim's staff table, consistent with the practice view's pattern
- No database or edge function changes are required — the hooks already handle data fetching via existing RLS-secured queries


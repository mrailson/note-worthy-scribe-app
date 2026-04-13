

## Plan: Simplify Create Claims to Single-Entry Submissions

### What's changing

The current "Create Claims" UI uses a two-step flow: add lines to a staging table, then click "Declare & Submit" on each one individually. This is confusing because it looks like a batch system but each line is already independent.

The new design will be a single-entry form: fill in one staff member's details, click "Declare & Submit", and it creates one claim line in the database. The form then resets for the next entry. Each submission = one claim = one invoice.

### Changes

**File: `src/components/nres/claims/CreateClaimPanel.tsx`** (rewrite)

- Remove the `lines` array state and staging table entirely
- Replace with a single inline form with all fields (Staff Member, Category, Role, GL Code, Allocation, Max Rate) in a clean grid layout
- Single "Declare & Submit" button at the bottom
- On submit: creates the claim line and immediately submits it (same logic as current `handleDeclareAndSubmit`)
- Form resets after successful submission
- Add a success toast confirming the claim ref
- Keep month/year selectors and practice display at the top

The hook (`useNRESClaims.ts`) and all other components remain unchanged -- the backend already treats each `claim_lines` row as an independent entity with its own `claim_ref`, status pipeline, and eventual invoice path.

### UI layout (approximate)

```text
┌─────────────────────────────────────────────────┐
│ 📋 Create Claim — Brackley & Towcester PCN Ltd  │
│                                                 │
│ Claim Month: [April ▾]  Year: [2026 ▾]         │
│                                                 │
│ ┌─────────────┬─────────────┬─────────────┐     │
│ │ Staff Member│ Category    │ Role        │     │
│ │ [________] │ [▾ Select]  │ [▾ Select]  │     │
│ ├─────────────┼─────────────┼─────────────┤     │
│ │ GL Code     │ Allocation  │ Max Rate £  │     │
│ │ [▾ Select]  │ [________] │ [________]  │     │
│ └─────────────┴─────────────┴─────────────┘     │
│                                                 │
│              [✓ Declare & Submit]                │
└─────────────────────────────────────────────────┘
```


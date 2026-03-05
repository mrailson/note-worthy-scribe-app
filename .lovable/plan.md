

## Batch Policy Generation Feature

### Overview
Add a toggle to the Create New Policy page that switches between single-policy mode (default) and batch mode. In batch mode, users can add up to 3 policies to a visible basket, then queue them all at once — subject to a hard limit of 3 total active jobs (pending + generating + enhancing).

### UI Design

```text
┌─────────────────────────────────────────────────┐
│  Create New Policy                              │
│                                                 │
│  ┌─ Mode Toggle ─────────────────────────────┐  │
│  │  Single Policy ○────● Batch Mode          │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Select Policy Type                             │
│  Search and select policies to add to your batch│
│  ┌───────────────────────────────────────────┐  │
│  │ [Search policies...]                      │  │
│  │ ▼ Clinical (20)                           │  │
│  │   ○ Cervical Screening        [+ Add]     │  │
│  │   ○ Chaperone Policy          [+ Add]     │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Batch Queue (1/3) ──────────────────────┐   │
│  │  ✓ Cervical Screening            [✕]     │   │
│  │  (2 more slots available)                │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  [Cancel]                  [Generate 1 Policy]  │
└─────────────────────────────────────────────────┘
```

### Behaviour

1. **Toggle** — A `Switch` component at the top: "Single Policy" (default) vs "Batch Mode". When off, current single-select RadioGroup behaviour is unchanged.

2. **Batch mode on** — The `PolicyTypeSelector` switches from RadioGroup to a list with an "Add to Batch" button per policy row. Selected policies appear in a basket panel below.

3. **Slot calculation** — On mount, query `policy_generation_jobs` for the user's active jobs (status in `pending`, `generating`, `enhancing`). Available slots = `3 - activeCount`. If 0 slots, batch toggle is disabled with a message: "You already have 3 policies in the queue."

4. **Basket** — Shows selected policies with remove (✕) buttons. Counter shows "X/3" where 3 is the max minus active. Disables "Add" buttons when full.

5. **Generate button** — Label updates dynamically: "Generate Policy" / "Generate 2 Policies" / "Generate 3 Policies". Confirmation dialog lists all selected policies.

6. **Submission** — Inserts one `policy_generation_jobs` row per selected policy, then fires the queue kick once.

### Technical Changes

**File: `src/pages/PolicyServiceCreate.tsx`**
- Add state: `batchMode`, `selectedPolicies: PolicyReference[]`, `activeJobCount`
- On mount, fetch active job count for the user
- Compute `availableSlots = 3 - activeJobCount`
- In batch mode, pass `onAddToBatch` callback to `PolicyTypeSelector` instead of `onSelect`
- Render batch basket panel when `batchMode` is on
- Update `handleConfirmGenerate` to loop and insert multiple jobs
- Update confirmation dialog to list all selected policy names

**File: `src/components/policy/PolicyTypeSelector.tsx`**
- Accept new optional props: `batchMode`, `selectedPolicies`, `onAddToBatch`, `onRemoveFromBatch`, `maxSelections`
- When `batchMode` is true, replace RadioGroup with a plain list; each row shows an "Add" button (or "Added ✓" if already selected)
- No other structural changes needed

### Constraints
- No database changes required — uses existing `policy_generation_jobs` table
- Single mode remains the default and works exactly as today
- Hard limit of 3 total active jobs enforced both in UI (slot count) and re-checked at submission time


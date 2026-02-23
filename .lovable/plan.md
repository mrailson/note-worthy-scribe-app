

## Centralised Programme Board People Directory

### Overview
Create a single, shared people directory that serves as the source of truth for all programme board members and stakeholders. This directory will be used across the Action Log, Programme Delivery Schedule, and Risk Register, providing consistent owner/assignee dropdowns and a single place to add, edit, or remove people and their roles.

### What You Will Get
- A new **"People Directory"** data file containing all current board members, their initials, roles, and organisations (pre-populated from the Terms of Reference and existing data)
- A **People Manager dialog** accessible from a shared icon button, allowing you to add, edit, and delete people in one place
- **Owner/Assignee dropdowns** in the Action Log, Programme Delivery Schedule, and Risk Register edit dialogs that all pull from the same people list
- Owner tooltips across all three tools showing full name and role on hover

### People to Pre-populate (from ToR and existing data)

| Initials | Name | Role | Organisation |
|----------|------|------|-------------|
| MJG | Maureen Green | Programme Director | PML |
| MR | Malcolm Railson | Digital & Estates Lead | NRES |
| AT | Amanda Taylor | Managerial Lead | NRES |
| LH | Lucy Hibberd | Supporting Managerial Lead | NRES - Bugbrooke |
| AW | Alex Whitehead | Supporting Digital & Estates Lead | NRES - The Parks |
| DMG | Dr Mark Gray | SRO / Chair | PML |
| DSE | Dr Simon Ellis | Clinical Lead | Towcester Medical Centre |
| DMC | Dr Muhammed Chisti | Supporting Clinical Lead | The Parks |

### Changes Required

#### 1. New shared data file: `src/data/nresPeopleDirectory.ts`
- Define a `ProgrammePerson` interface: `id`, `initials`, `name`, `role`, `organisation`, `isActive`
- Export a default list pre-populated with the people above
- Export helper functions: `getPersonByInitials()`, `getPersonLabel()` (returns "initials - full name")

#### 2. New shared component: `src/components/sda/PeopleDirectoryDialog.tsx`
- A modal listing all people in a clean table
- Add, Edit, and Delete people with fields: Name, Initials, Role, Organisation, Active toggle
- Audit trail of people changes (added/edited/removed) with user email and timestamp
- Accessible via a Users icon button that can be placed in any toolbar

#### 3. New shared component: `src/components/sda/PersonSelect.tsx`
- A reusable `Select` dropdown showing all active people from the directory
- Displays initials and full name in the dropdown
- Accepts `value` (initials) and `onChange` props
- Used as a drop-in replacement for free-text owner/assignee fields

#### 4. Update `ActionLogTable.tsx`
- Remove the hardcoded `ownerDetails` lookup (lines 40-45)
- Import and use the shared people directory for owner tooltips
- Replace the free-text Owner input in `ActionLogEditDialog.tsx` with the `PersonSelect` component

#### 5. Update `TaskEditDialog.tsx` (Programme Delivery Schedule)
- Replace the free-text "Assigned To" input with the `PersonSelect` component
- Existing assignee values will still display correctly (matched by name or initials)

#### 6. Update `RiskEditDialog.tsx` (Risk Register)
- Replace the free-text "Owner" input with the `PersonSelect` component

#### 7. Update `SDAFinanceGovernance.tsx`
- Replace the hardcoded `seniorLeadership` array with data sourced from the shared people directory
- Maintain the existing visual layout (cards with icons, voting badges)

### Technical Details

**State management**: The people directory will use React context (`NRESPeopleContext`) wrapping the NRES Dashboard, providing `people`, `addPerson`, `updatePerson`, and `deletePerson` functions to all child components. This avoids prop drilling and ensures all three tools always see the same list.

**Data flow**: Initial data loaded from `nresPeopleDirectory.ts` into context state. All mutations update context state in-memory (matching the existing pattern used by Action Log and Programme Plan).

**Backward compatibility**: Existing data that uses full names (e.g. "Maureen Green" in the Programme Plan) or initials (e.g. "MJG" in Action Log) will be matched against both the `name` and `initials` fields in the directory.

### Files to Create
- `src/data/nresPeopleDirectory.ts` -- shared people data and types
- `src/contexts/NRESPeopleContext.tsx` -- React context provider
- `src/components/sda/PeopleDirectoryDialog.tsx` -- people management modal
- `src/components/sda/PersonSelect.tsx` -- reusable person picker dropdown

### Files to Modify
- `src/components/sda/ActionLogTable.tsx` -- use shared directory, remove hardcoded lookup
- `src/components/sda/ActionLogEditDialog.tsx` -- use PersonSelect for Owner
- `src/components/sda/programme-plan/TaskEditDialog.tsx` -- use PersonSelect for Assigned To
- `src/components/sda/risk-register/RiskEditDialog.tsx` -- use PersonSelect for Owner
- `src/components/sda/SDAFinanceGovernance.tsx` -- source leadership from shared directory
- NRES Dashboard wrapper component -- wrap with `NRESPeopleProvider`

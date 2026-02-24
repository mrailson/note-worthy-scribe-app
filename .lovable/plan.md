

## Groups and Email Addresses for the People Directory

### Overview
Extend the centralised People Directory to support **groups** (e.g., "PMs", "Clinical Team", "ICB Representatives") alongside individuals, and add **email addresses** to both. Groups and individuals will appear in the dropdowns across the Action Log, Programme Delivery Schedule, and Risk Register, as well as the Executive Summary governance section.

### What You Will Get
- **Email field** added to every person in the directory (existing and new)
- **Groups** as a new concept: a named collection with its own email address, role label, and member list
- **People Directory Dialog** updated with two tabs: "Individuals" and "Groups", each with full add/edit/delete capability
- **PersonSelect dropdown** updated to show both individuals and groups, visually separated with group labels
- **Audit trail** extended to cover group changes (added/edited/deleted groups)

### Data Changes

**ProgrammePerson** gains an `email` field:
| Field | Type | Notes |
|-------|------|-------|
| email | string (optional) | e.g. "maureen.green@nhs.net" |

**New ProgrammeGroup interface**:
| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | e.g. "Programme Managers" |
| abbreviation | string | e.g. "PMs" |
| email | string | Group email, e.g. "pms@nres.nhs.net" |
| description | string | Brief purpose |
| memberIds | string[] | References to ProgrammePerson IDs |
| isActive | boolean | Active toggle |

### Changes Required

#### 1. Update data file (`src/data/nresPeopleDirectory.ts`)
- Add `email?: string` to the `ProgrammePerson` interface
- Define a new `ProgrammeGroup` interface
- Add a `defaultGroups` array with sensible defaults (e.g., "Programme Managers", "Clinical Leads")
- Add helper functions: `getGroupByName()`, `getGroupLabel()`

#### 2. Update context (`src/contexts/NRESPeopleContext.tsx`)
- Add `groups` state initialised from `defaultGroups`
- Add CRUD functions: `addGroup`, `updateGroup`, `deleteGroup`
- Extend audit log to cover group operations
- Expose `groups` and group CRUD via the context

#### 3. Update People Directory Dialog (`src/components/sda/PeopleDirectoryDialog.tsx`)
- Add a **Tabs** component with "Individuals" and "Groups" tabs
- **Individuals tab**: add an Email field to the add/edit form; display email in the table
- **Groups tab**: table listing groups with name, abbreviation, email, member count; add/edit/delete with a form that includes a multi-select for members
- Audit trail remains unified across both tabs

#### 4. Update PersonSelect dropdown (`src/components/sda/PersonSelect.tsx`)
- Show two `SelectGroup` sections: "Individuals" and "Groups"
- Individuals show "initials - name" as before
- Groups show "abbreviation - group name"
- Group values prefixed with `group:` to distinguish from individual initials (e.g., `group:PMs`)

#### 5. Update ActionLogEditDialog (`src/components/sda/ActionLogEditDialog.tsx`)
- The Owner field already uses `PersonSelect`, so groups will appear automatically
- No additional changes needed beyond the PersonSelect update

#### 6. Update ActionLogTable owner tooltips (`src/components/sda/ActionLogTable.tsx`)
- Extend the owner tooltip lookup to also check groups when the value starts with `group:`
- Show group name, email, and member list in the tooltip

#### 7. Update SDAFinanceGovernance (`src/components/sda/SDAFinanceGovernance.tsx`)
- Display email addresses alongside people in the Senior Leadership section
- No group-specific changes needed here as it already sources from the directory

### Technical Details

**Group value convention**: In dropdowns and data, group selections are stored as `group:<abbreviation>` (e.g., `group:PMs`). This allows the system to distinguish between an individual with initials "PM" and a group abbreviated "PMs".

**Backward compatibility**: Existing owner values (initials or names) remain valid. The updated `PersonSelect` will still resolve them correctly.

**State management**: Groups follow the same in-memory `useState` pattern as individuals. Both share a single audit trail.

### Files to Modify
- `src/data/nresPeopleDirectory.ts` -- add email field, group interface, default groups
- `src/contexts/NRESPeopleContext.tsx` -- add groups state and CRUD, extend audit
- `src/components/sda/PeopleDirectoryDialog.tsx` -- add tabs, email field, groups management
- `src/components/sda/PersonSelect.tsx` -- show grouped dropdown with individuals and groups
- `src/components/sda/ActionLogTable.tsx` -- extend owner tooltip for groups
- `src/components/sda/SDAFinanceGovernance.tsx` -- display emails in leadership cards


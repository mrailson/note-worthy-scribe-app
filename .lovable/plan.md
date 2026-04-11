

## Plan: Add "Attending Meeting" GP/PM Roles to Management Rates

### What This Does

Extends the NRES Management Rates system so that individual GP Partners and Practice Managers can be added as management roles with their practice assignment. These people will then appear as selectable options in the "Add Time Entry" form on the Management Time tab, allowing meeting attendance to be claimed.

### Changes

**1. Extend `ManagementRoleConfig` interface** (both `useNRESBuyBackRateSettings.ts` and `useNRESManagementTime.ts`)
- Add `member_practice?: string` field to assign each person to a specific practice from the existing `MEMBER_PRACTICES` list
- Add `role_type?: 'management' | 'attending_meeting'` field to distinguish regular management roles from attending-meeting GP/PM entries

**2. Update Settings Modal — Management Rates table** (`BuyBackAccessSettingsModal.tsx`)
- Add a "Practice" column with a `Select` dropdown populated from `MEMBER_PRACTICES`
- Add a "Type" column or integrate it into the existing Role column (e.g. pre-populated with "Attending Meeting — GP" or "Attending Meeting — PM")
- When clicking "Add Management Role", offer a second button or extend the existing one: "Add Attending Meeting Role" which pre-fills:
  - Role label: "Attending Meeting — GP" or "Attending Meeting — PM"
  - Hourly rate: £100 (GP) or £50 (PM)
  - Requires selecting a practice from the dropdown
- Keep full inline edit/delete capability as already exists

**3. Update Management Time Tab create form** (`ManagementTimeTab.tsx`)
- The existing "Person" dropdown already shows all `activeRoles` — no structural change needed
- The new attending-meeting roles will automatically appear since they use the same `management_roles_config` array
- The display will show: `{person_name} — Attending Meeting — GP ({practice_name})`

### Technical Details

- No database schema changes required — `management_roles_config` is a JSONB column that already stores the full config array
- Practice assignment stored as a string matching `MEMBER_PRACTICES` values
- `role_type` field allows filtering/grouping in future if needed
- The "Add Attending Meeting Role" button will prompt for GP or PM type and pre-fill the rate accordingly


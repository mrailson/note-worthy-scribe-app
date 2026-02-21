

## Add Invoice Status Tracking to NRES Hours Entries

### Overview
Add the ability for admins to mark hours entries as "Invoiced to SNO/PML" -- individually or in bulk -- with a date invoiced and an audit trail of who made the update.

### Database Changes

**Add 3 new columns to `nres_hours_entries` table:**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `invoice_status` | text | `null` | Values: `null` (not invoiced), `'invoiced'` |
| `invoiced_date` | date | `null` | The date the entry was invoiced to SNO/PML |
| `invoiced_by` | uuid | `null` | The user ID of the admin who marked it as invoiced |

Migration SQL:
```sql
ALTER TABLE nres_hours_entries
  ADD COLUMN invoice_status text DEFAULT NULL,
  ADD COLUMN invoiced_date date DEFAULT NULL,
  ADD COLUMN invoiced_by uuid DEFAULT NULL;
```

### UI Changes (AdminClaimsReport.tsx only)

**1. Checkbox column in the Detailed view**
- Add a checkbox on each row for bulk selection (only on uninvoiced entries).
- Add a "Select All" checkbox in the header.
- Show a floating action bar when entries are selected with:
  - Count of selected entries
  - A "Mark as Invoiced" button that opens a small dialog/popover to confirm and pick the invoice date (defaults to today)

**2. Invoice status badge on each row**
- Uninvoiced entries: no badge (or a subtle "Pending" label)
- Invoiced entries: a green "Invoiced" badge showing the date, with a hover card showing who marked it and when

**3. Individual toggle**
- In the detailed view, each row gets a small button/icon to mark a single entry as invoiced (or to undo an invoiced status)

**4. Filter by invoice status**
- Add a filter dropdown: "All", "Pending", "Invoiced" so admins can quickly see what still needs invoicing

**5. CSV export update**
- Add `Invoice Status`, `Invoiced Date`, and `Invoiced By` columns to the CSV export

### Technical Details

**File: `src/components/nres/hours-tracker/AdminClaimsReport.tsx`**
- Add `selectedEntries` state (Set of entry IDs) for bulk selection
- Add `invoiceFilter` state for filtering by status
- Add `handleMarkInvoiced(entryIds: string[], date: string)` function that updates the entries via Supabase and records the current user's ID as `invoiced_by`
- Add `handleUnmarkInvoiced(entryId: string)` to allow reversing the status
- Update the `AllEntry` and `DetailedEntry` interfaces to include the new fields
- Update `fetchAllData` to include the new columns (already covered by `select('*')`)
- Update the detailed table to show checkboxes, status badges, and action buttons
- Update `exportCSV` to include the new columns

**File: `src/types/nresHoursTypes.ts`**
- Update `NRESHoursEntry` interface to include `invoice_status`, `invoiced_date`, `invoiced_by`

### Workflow

```text
Admin opens Admin Claims Report
  --> Switches to Detailed view
  --> Filters to "Pending" entries
  --> Selects entries via checkboxes (individually or "Select All")
  --> Clicks "Mark as Invoiced"
  --> Confirms date (defaults to today)
  --> Entries updated with status, date, and admin's user ID
  --> Badge changes to "Invoiced" with date shown
```

### Security
- Only the existing admin users (ADMIN_EMAILS list + system admins) can see and use this feature, as it lives within the `AdminClaimsReport` component which already gates access.
- The `invoiced_by` field uses the authenticated user's ID from the auth context for a full audit trail.


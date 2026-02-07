
# Plan: Add Compliments Capture to the Complaints System

## Overview

Extend the existing NHS Complaints Management System to also capture **Compliments** — positive feedback about the practice, staff, and services. Compliments will live alongside complaints as a unified "Patient Feedback" system, with their own streamlined workflow, reference numbering (CMPL prefix), and a dedicated dashboard card showing totals. The system will be much lighter-weight than complaints (no acknowledgement letters, outcome questionnaires, or compliance checklists needed) but will share the same underlying infrastructure where appropriate.

---

## What Will Change For You

- A new **"Compliments"** dashboard card will appear on the main complaints page, showing a count of compliments received
- A new **"New Compliment"** tab will be added for quick entry of compliments
- Compliments will appear in a dedicated **"View Compliments"** tab with search and filtering
- Each compliment will have its own detail view, reachable at `/compliments/:id`
- Compliments will use a **CMPL** prefix for reference numbers (e.g., CMPL260001)
- The page title will update to reflect "Complaints & Compliments"
- Reports will include compliments data alongside complaints

---

## Key Design Decisions

1. **Separate table, not a column on complaints**: Compliments have a simpler data model (no priority, no consent, no outcomes, no compliance checklists). Using the existing `complaints` table would require making many NOT NULL columns nullable and adding complex conditional logic everywhere. A dedicated `compliments` table keeps things clean.

2. **Shared categories**: Compliments will reuse the same category options (Clinical Care, Staff Attitude, Appointments, etc.) so you can see patterns across both complaints and compliments.

3. **Lightweight workflow**: No acknowledgement letters, no outcome letters, no compliance tracking. Just log, optionally share with staff, and close.

4. **Staff recognition**: A "Share with Staff" feature to forward compliments to named staff members, boosting morale.

---

## Technical Details

### 1. Database Migration

Create a new `compliments` table:

```text
compliments
  - id (uuid, PK)
  - reference_number (text, NOT NULL) -- auto-generated CMPL prefix
  - patient_name (text, NOT NULL)
  - patient_contact_email (text, nullable)
  - patient_contact_phone (text, nullable)
  - compliment_date (date, NOT NULL) -- when the compliment was received
  - compliment_title (text, NOT NULL)
  - compliment_description (text, NOT NULL)
  - category (text, NOT NULL) -- reuses complaint categories
  - staff_mentioned (text[], nullable) -- staff being praised
  - location_service (text, nullable)
  - source (text, default 'patient') -- patient, nhs_choices, letter, verbal, etc.
  - status (text, default 'received') -- received, shared, archived
  - shared_with_staff (boolean, default false)
  - shared_at (timestamptz, nullable)
  - notes (text, nullable) -- internal notes
  - created_by (uuid, NOT NULL) -- auth user who logged it
  - practice_id (uuid, nullable) -- FK to gp_practices
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())
```

Plus:
- A `generate_compliment_reference()` function producing `CMPL` + YY + 4-digit sequence
- A trigger to auto-assign reference numbers on INSERT
- RLS policies mirroring the complaints table (authenticated users can CRUD)
- An index on `reference_number` and `practice_id`

### 2. New Pages & Components

**New files to create:**
- `src/pages/ComplimentDetails.tsx` -- Detail view for a single compliment (much simpler than complaint details)
- `src/components/compliments/ComplimentsSummaryView.tsx` -- Summary card list (mirrors ComplaintsSummaryView)

**Route addition in `App.tsx`:**
- `/compliments/:id` mapped to `ComplimentDetails`

### 3. Updates to Existing Files

**`src/pages/ComplaintsSystem.tsx`** (the main page):
- Update page title to "Complaints & Compliments"
- Add a **Compliments count** dashboard card (green/teal themed) alongside the existing Total/Open/Overdue/Closed cards
- Add a **"Compliments"** tab to the main TabsList
- Add a **"New Compliment"** tab (or section within the Compliments tab)
- Implement `fetchCompliments()` to load compliments from the new table
- Add a simplified form for logging compliments (patient name, date, title, description, category, staff mentioned, source)
- Add a compliments list view with search and category filtering

**`src/pages/ComplimentDetails.tsx`** (new page):
- Display compliment details in a clean, celebratory layout
- Show staff mentioned with option to "Share with Staff" (mark as shared)
- Option to add internal notes
- Delete functionality
- Export to Word

### 4. Compliment Entry Form Fields

The form will be simpler than complaints:
- Patient/source name (required)
- Contact email (optional)
- Date received (required, defaults to today)
- Title/subject (required)
- Description (required)
- Category (required, same dropdown as complaints)
- Staff mentioned (optional, comma-separated)
- Location/service (optional)
- Source (dropdown: Patient, NHS Choices Review, Letter, Verbal, Card, Email, Other)

### 5. Dashboard Integration

The existing 4-card dashboard grid will expand to include a 5th card:
- **Compliments** card showing total count with a warm green/teal colour
- Clicking it filters to show compliments in the compliments tab
- The card will also show "This Month" count as a subtitle

### 6. Reports Integration

The existing `HierarchicalReports` component will be updated to include a compliments section showing:
- Total compliments vs complaints ratio
- Most complimented categories
- Most mentioned staff members
- Monthly trends

---

## Implementation Order

1. Database migration (table, function, trigger, RLS, indexes)
2. Update `ComplaintsSystem.tsx` with new tabs, dashboard card, form, and list view
3. Create `ComplimentDetails.tsx` page
4. Create `ComplimentsSummaryView.tsx` component
5. Add route in `App.tsx`
6. Update page title and SEO metadata

---

## What Won't Change

- All existing complaint functionality remains untouched
- Existing complaint workflows, letters, compliance, and audit trails are unaffected
- The complaint form, detail view, and all related edge functions stay the same
- No changes to any edge functions or external API integrations

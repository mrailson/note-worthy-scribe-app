

# KO41b Annual Return Report with Overview Guide

## Overview
Build a KO41b Annual Return Report feature with two parts: (1) an informative overview page explaining what the KO41b is, how it works, and linking to the NHS SDCS portal, and (2) a data report page that auto-populates from existing complaints data matching the NHS form format.

---

## 1. Overview and Guidance Page

A welcoming, non-technical landing page for practices explaining the KO41b return. This will be the first thing users see when they navigate to the KO41b section.

### Content sections:
- **What is the KO41b?** - Plain-English explanation that it's a statutory annual return to NHS England reporting written complaints received during the financial year (1 April - 31 March)
- **Who needs to complete it?** - All GP practices must submit
- **When is it due?** - Submission window (typically May - July each year)
- **What information is needed?** - Summary of the 5 sections (summary, age, complainant status, subject area, staff group) with simple descriptions
- **How this tool helps** - Explains that the system auto-calculates values from the practice's complaints data, which can then be transferred to the official SDCS portal
- **Important notes** - Key rules (only written complaints, oral-then-recorded count, multiple subjects per complaint allowed, etc.)
- **Link to the SDCS portal** - Prominent button linking to `https://datacollection.sdcs.digital.nhs.uk/`
- **NHS England contact details** - Support email addresses for technical and data definition queries
- A "Generate My KO41b Report" button that navigates to the data report

### Design:
- Clean card-based layout with NHS blue accents
- Step-by-step numbered visual guide
- Collapsible FAQ-style sections for detailed guidance
- Prominent external link button to the SDCS submission portal

---

## 2. KO41b Data Report Page

Auto-populated from the complaints database, presented in 5 sections matching the NHS SDCS form.

### Section 1: Summary Information
- **Total Brought Forward**: Complaints with status not 'closed' created before 1 April of reporting year
- **Total New**: Complaints created in the reporting period (1 April - 31 March)
- **Number Upheld**: From `complaint_investigation_decisions` where `decision_type` contains 'uphold' (exact match)
- **Number Partially Upheld**: Where `decision_type` = 'partially_uphold'
- **Number Not Upheld**: Where `decision_type` = 'reject' or 'not_upheld'
- **Total Resolved**: Auto-calculated (sum of above three)
- **Total Carried Forward**: Auto-calculated (Brought Forward + New - Resolved)

### Section 2: Age of Patient (new complaints only)
Age bands from `patient_dob`: Under 1, 1-4, 5-14, 15-24, 25-34, 35-44, 45-54, 55-64, 65-74, 75-84, 85+, Age Unknown. Must sum to Total New.

### Section 3: Status of Complainant (new complaints only)
From `complaint_on_behalf` field: Patient (false), Relative/Carer/Representative (true), Unknown. Must sum to Total New.

### Section 4: Subject Area (new complaints only)
Mapped from `category` enum values to KO41b subjects:
- `clinical_care`, `Clinical Care & Treatment`, `Test Results & Follow-Up` -> Clinical treatment
- `communication`, `Communication Issues`, `staff_attitude`, `Staff Attitude & Behaviour` -> Communication, attitude, conduct
- `facilities`, `Facilities & Environment` -> Premises
- `appointment_system`, `Appointments & Access`, `Administration`, `waiting_times` -> Administration incl. appointments
- `medication`, `Prescriptions` -> Prescribing
- `referrals` -> Referrals
- `Confidentiality & Data` -> Confidentiality
- `billing`, `Digital Services`, `other` -> Other

Total can be >= Total New (one complaint may cover multiple subjects).

### Section 5: Staff Group (new complaints only)
From `staff_mentioned` array, pattern-matching names/titles:
- Contains "Dr" or "GP" -> Practitioner
- Contains "Nurse" -> Nursing
- Contains "Receptionist", "Admin", "Manager", "Secretary" -> Administration/Reception
- Fallback -> Other / No staff involved

Total can be >= Total New.

### Features:
- Financial year selector (defaults to 2024-25)
- All auto-calculated values shown in editable fields for manual adjustment
- Validation indicators (green tick when totals match, warning when they don't)
- Print/export to PDF for practice records
- "Back to Overview" navigation
- Link to SDCS portal for final submission

---

## Technical Plan

### Files to Create

1. **`src/pages/KO41bReport.tsx`**
   - The overview/guidance page with all explanatory content
   - "Generate Report" button navigating to the data view
   - Contains the tabbed/stepped report sections inline (overview tab + 5 data tabs)
   - Uses existing Card, Tabs, Collapsible, Button components

2. **`src/hooks/useKO41bData.ts`**
   - Fetches complaints for the selected practice and financial year from Supabase
   - Fetches related `complaint_investigation_decisions` for outcomes
   - Calculates all KO41b values across the 5 sections
   - Returns structured data with override capability

### Files to Modify

3. **`src/App.tsx`**
   - Add lazy import for `KO41bReport`
   - Add route: `/complaints/ko41b-report`

4. **`src/pages/ComplaintsSystem.tsx`**
   - Add a navigation button/link to the KO41b report in the toolbar area (e.g. a "KO41b Annual Return" button with a BarChart3 or FileText icon)


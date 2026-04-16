

## Goal

Update the **Claims Scheme Guide** (the 7-tab modal opened from the SDA & Buy-Back Claims page) so all tabs reflect the latest scheme — specifically extending coverage beyond Buy-Back / New SDA to also document **GP Locum**, **Meeting Attendance**, and **NRES Management** claim categories.

## What's missing today

The guide currently only describes Buy-Back and New SDA staff. The system actually supports **5 claim categories**:
1. Buy-Back (existing — documented)
2. New SDA (existing — documented)
3. **GP Locum** — £750/day, £375/session, no on-costs (not in guide)
4. **Meeting Attendance** — £85/hr GP, £45/hr PM, attendance-driven (not in guide)
5. **NRES Management** — hourly × weekly hours × working weeks per month (not in guide)

## Changes (single file: `src/components/nres/hours-tracker/ClaimsUserGuide.tsx`)

### 1. Overview tab — extend "Categories of Staff"
Add three new callout boxes after Buy-Back and New SDA:
- **GP Locum** (purple) — locum cover for SDA sessions, billed at fixed £750/day or £375/session, no on-costs
- **Meeting Attendance** (sky) — GPs/PMs paid per attended SDA governance meeting at £85/hr (GP) or £45/hr (PM)
- **NRES Management** (slate) — Neighbourhood Manager / Programme Lead / Mgmt Lead time at agreed hourly rates × hours/week × working weeks in month (excludes bank holidays)

### 2. How to Claim tab — add category-specific notes
Append a "Category-Specific Workflow Notes" section explaining:
- GP Locum: role auto-locked to "GP Locum", choose Days/Sessions, value = total worked that month
- Meeting Attendance: hours come from the Meeting Schedule log, not manual entry
- NRES Management: select the named role from the dropdown, hourly rate auto-fills, enter weekly hours

### 3. Evidence tab — add category-specific evidence requirements
New callouts:
- GP Locum: locum invoice/timesheet (mandatory), session/day breakdown
- Meeting Attendance: meeting agenda + attendance log (auto-captured from Meeting Schedule)
- NRES Management: timesheet of hours worked per week + activity summary

### 4. Rates & Caps tab — add three new rate tables
- **GP Locum rates**: £750/day, £375/session, no on-costs, max 23 days or 46 sessions/month
- **Meeting Attendance rates**: pulled from `rateSettings.meeting_gp_rate` (£85/hr) and `meeting_pm_rate` (£45/hr)
- **NRES Management rates**: render `rateSettings.management_roles_config` (person, label, hourly rate, max hours/week)

### 5. Claim Rules tab — add category nuances
- GP Locum & Meeting Attendance: no Part B evidence required (additional/sessional, not bought back)
- NRES Management: working-weeks-per-month auto-excludes bank holidays
- Locum daily rate is a **cap** — claim less if invoice is lower

### 6. Status Guide tab
No changes — workflow is identical across all categories.

### 7. FAQ tab — add 5 new Q&As
- "How do GP Locum claims differ from Buy-Back?"
- "How is Meeting Attendance calculated?"
- "Why don't Meeting/Locum claims need Part B evidence?"
- "How are NRES Management working weeks calculated?"
- "Can one staff member appear in multiple categories?"

### 8. Header tweak
Update guide subtitle to: *"Complete guide — all 5 claim categories, evidence, rates, claim steps, approvals & FAQ"*

## Props / data wiring

`ClaimsUserGuide` already receives `rateSettings` (which contains `meeting_gp_rate`, `meeting_pm_rate`, `management_roles_config`) — no new props needed. Tabs will read these directly to render dynamic rate tables.

## Out of scope

- No changes to claim logic, dashboards, or database
- No changes to the 7-tab structure (just richer content within each tab)
- Status workflow stays identical for all categories


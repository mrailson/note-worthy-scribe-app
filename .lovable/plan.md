
# Plan: PLT Planning Feature for Practice Managers

## Overview

This plan adds a **PLT Planning** (Protected Learning Time) category to the Practice Manager interface, complete with the 2026/27 PLT Calendar dates and AI-powered prompts for planning comprehensive training sessions.

---

## What You'll Get

### 1. New "PLT Planning" Quick Pick Card
A new card in the PM home screen grid (alongside Documents, Respond, Workforce, etc.) with:
- **Icon**: GraduationCap with a magenta/pink gradient (matching your PLT Calendar branding)
- **Label**: "PLT Planning"
- **Description**: Plan Protected Learning Time sessions with AI assistance

### 2. PLT Calendar Display
When you click "PLT Planning", you'll see:
- **2026/27 PLT Calendar** showing all dates from your reference image
- Dates displayed in a clean list format with:
  - Date badge (e.g., "25 Feb", "18 Mar")
  - Type indicator (Countywide or Practice/PCN)
  - Year marker for dates spanning 2026-2027
- Visual styling matching your PLT Calendar design (pink/magenta theme)

### 3. AI Training Session Ideas
After the calendar, subcategories for planning PLTs:

| Subcategory | Prompts |
|-------------|---------|
| **Plan a PLT** | Create comprehensive PLT session plans with objectives, timings, activities |
| **Difficult Situations** | Handling patient aggression at reception, telephone conflict, de-escalation |
| **Clinical Topics** | Safeguarding updates, infection control refresher, medication safety |
| **Admin & Systems** | EMIS/SystmOne training, coding updates, telephone triage protocols |
| **Wellbeing & Team** | Staff wellbeing sessions, team building, resilience training |
| **Compliance** | CQC key questions, information governance, fire safety refreshers |

### 4. Training Session Prompt Examples

**Difficult Situations (as requested):**
- "Plan a PLT session on handling patients shouting at reception - include role play scenarios, de-escalation techniques, and when to escalate"
- "Create training materials for handling aggressive callers on the telephone"
- "Design a conflict resolution workshop for reception staff"
- "Create a session on managing difficult conversations with patients about capacity and waiting times"

**Other Useful PM Training Ideas:**
- "Plan a PLT on safeguarding adults - include case studies and practice scenarios"
- "Create a reception training session on telephone triage using the 6 Cs"
- "Design a session on understanding QOF requirements for clinical coders"
- "Plan training on complaints handling for all staff"
- "Create a session on GDPR and patient confidentiality refresher"

---

## PLT Calendar Data (2026/27)

Based on your image, the following dates will be displayed:

| Date | Type | Year |
|------|------|------|
| 25 Feb | Countywide | 2026 |
| 18 Mar | Countywide | 2026 |
| 15 Apr | Practice/PCN | 2026 |
| 13 May | Countywide | 2026 |
| 10 Jun | Practice/PCN | 2026 |
| 8 Jul | Countywide | 2026 |
| 9 Sep | Practice/PCN | 2026 |
| 7 Oct | Countywide | 2026 |
| 11 Nov | Practice/PCN | 2026 |
| 13 Jan | Countywide | 2027 |
| 10 Feb | Practice/PCN | 2027 |
| 10 Mar | Countywide | 2027 |

---

## Mobile Quick Pick

Adding "PLT Planning" to the mobile PM quick picks (replacing one less-used option):
- **Label**: "PLT Planning"
- **Prompt**: "Help me plan a Protected Learning Time session for our practice"

---

## Technical Implementation

### Files to Modify

1. **`src/components/ai4gp/pmPromptCategories.ts`**
   - Add new `plt-planning` main category with subcategories
   - Import `CalendarDays` or `GraduationCap` icon
   - Add pink/magenta gradient to match PLT branding

2. **`src/components/ai4gp/PMHomeScreen.tsx`**
   - Add special handling for PLT Planning category
   - Display PLT Calendar dates when this category is selected
   - Add new view type for calendar display

3. **`src/components/ai4gp/MobileRoleQuickPicks.tsx`**
   - Add "PLT Planning" to PM_QUICK_PICKS array

4. **New file: `src/components/ai4gp/PLTCalendar.tsx`**
   - Standalone component to display the 2026/27 PLT dates
   - Styled with pink/magenta theme matching your reference
   - Shows type badges (Countywide vs Practice/PCN)
   - Highlights upcoming dates

### Category Structure

```text
PLT Planning (main category)
  |
  +-- PLT Calendar (special view - shows date list)
  |
  +-- Plan a PLT
  |     +-- General PLT Plan
  |     +-- 1-Hour Session
  |     +-- 2-Hour Session  
  |     +-- Half-Day Session
  |
  +-- Difficult Situations
  |     +-- Patient Aggression (Reception)
  |     +-- Telephone Conflict
  |     +-- De-escalation Training
  |     +-- Conflict Resolution
  |
  +-- Clinical Training
  |     +-- Safeguarding Updates
  |     +-- Infection Control
  |     +-- Medication Safety
  |     +-- Clinical Emergencies
  |
  +-- Admin & Systems
  |     +-- EMIS/SystmOne
  |     +-- Coding Updates
  |     +-- Telephone Triage
  |     +-- New Starter Induction
  |
  +-- Wellbeing & Team
  |     +-- Staff Wellbeing
  |     +-- Team Building
  |     +-- Resilience
  |     +-- Stress Management
  |
  +-- Compliance Training
        +-- CQC Key Questions
        +-- Information Governance
        +-- Fire Safety
        +-- Health & Safety
```

### PLT Calendar Component Design

The PLT Calendar will display as a styled list:

```text
+------------------------------------------+
|           2026/27 PLT Calendar           |
+------------------------------------------+
| [25 Feb] Countywide              [2026]  |
| [18 Mar] Countywide                      |
| [15 Apr] Practice/PCN                    |
| [13 May] Countywide                      |
| [10 Jun] Practice/PCN                    |
| [8 Jul]  Countywide                      |
| [9 Sep]  Practice/PCN                    |
| [7 Oct]  Countywide                      |
| [11 Nov] Practice/PCN                    |
| [13 Jan] Countywide              [2027]  |
| [10 Feb] Practice/PCN                    |
| [10 Mar] Countywide                      |
+------------------------------------------+
```

- Date badges in pink/magenta
- Type labels colour-coded (Countywide = purple, Practice/PCN = lighter purple)
- Year markers shown on first date of each year
- Upcoming dates highlighted

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| PM Home Screen | New "PLT Planning" card in category grid |
| PM Categories | New main category with 6 subcategories and ~24 prompts |
| PLT Calendar | New component showing 2026/27 dates |
| Mobile Quick Picks | New "PLT Planning" option added |
| Styling | Pink/magenta gradient theme for PLT branding |

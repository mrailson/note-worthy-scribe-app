
# Mock CQC Inspection Service

A new service enabling Practice Managers to conduct simulated CQC inspections focusing on Safe and Well-led domains, with comprehensive evidence management and professional Word report generation.

## Overview

The Mock CQC Inspection service will provide a supportive, "critical friend" experience that helps practices identify compliance gaps before a real CQC inspection. Users select a practice/site, work through structured inspection elements organised by domain, mark each as met/not met, attach or describe evidence, and receive a priority-focused improvement report.

## User Journey

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Select Site    │ ──▶ │ Start Inspection│ ──▶ │ Work Through    │
│  (Practice)     │     │ (creates session)│     │ Elements        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
        ┌───────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  FOR EACH INSPECTION ELEMENT:                                    │
│  • View element name + evidence guidance blurb                   │
│  • Quick pick: Met / Partially Met / Not Met / Not Applicable    │
│  • Attach evidence (link existing, upload new, or add notes)     │
│  • Add improvement comments                                       │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│ Complete        │ ──▶ │ Generate Word   │
│ All Sections    │     │ Priority Report │
└─────────────────┘     └─────────────────┘
```

## Key Features

1. **Practice/Site Selection** - Use existing practice selector pattern from LGCaptureLanding
2. **Domain-Organised Structure** - Safe (priority) and Well-led (priority), with Effective, Caring, Responsive available
3. **Inspection Elements** - Pre-defined CQC KLOEs with evidence guidance
4. **Quick Pick Status** - Met, Partially Met, Not Met, Not Applicable
5. **Flexible Evidence** - Link from CQC Evidence repository, upload new files, or describe in notes
6. **Time Guidance** - Suggested time per domain (no countdown)
7. **Progress Tracking** - Visual progress through domains and overall completion
8. **Priority Report** - Word document highlighting gaps, ordered by priority

## Technical Implementation

### New Database Tables

**mock_inspection_sessions**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| practice_id | uuid | FK to gp_practices |
| user_id | uuid | FK to auth.users |
| status | text | draft, in_progress, completed |
| started_at | timestamptz | When inspection began |
| completed_at | timestamptz | When inspection finished |
| report_generated_at | timestamptz | When report was generated |
| created_at | timestamptz | Record creation |

**mock_inspection_elements**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| session_id | uuid | FK to sessions |
| domain | text | safe, effective, caring, responsive, well_led |
| element_key | text | Unique identifier (e.g., S1, S2, W1) |
| element_name | text | Display name |
| evidence_guidance | text | What evidence to look for |
| status | text | not_assessed, met, partially_met, not_met, not_applicable |
| evidence_notes | text | User's evidence description |
| improvement_comments | text | Suggested improvements |
| evidence_files | jsonb | Array of {type, url/id, name} |
| assessed_at | timestamptz | When this element was assessed |

**mock_inspection_element_templates** (seed data)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| domain | text | CQC domain |
| element_key | text | Unique key |
| element_name | text | Display name |
| evidence_guidance | text | Evidence requirements |
| priority | integer | Display order within domain |
| is_priority_domain | boolean | Safe/Well-led = true |

### New Files

**Pages & Components**
- `src/pages/MockCQCInspection.tsx` - Main service page with practice selection and session management
- `src/components/mock-cqc/InspectionDashboard.tsx` - Progress overview with domain cards
- `src/components/mock-cqc/InspectionElement.tsx` - Individual element assessment card
- `src/components/mock-cqc/EvidenceAttachment.tsx` - Evidence linking/upload/notes panel
- `src/components/mock-cqc/DomainSection.tsx` - Collapsible domain with its elements
- `src/components/mock-cqc/StatusQuickPick.tsx` - Met/Not Met quick selection buttons
- `src/components/mock-cqc/InspectionReport.tsx` - Report preview before download

**Utilities**
- `src/utils/generateMockInspectionReport.ts` - Word document generation using docx library

**Edge Function**
- `supabase/functions/generate-mock-inspection-report/index.ts` - AI-enhanced report with prioritised recommendations

**Hooks**
- `src/hooks/useMockInspection.ts` - Session and element state management

### Inspection Elements (Seed Data)

**Safe Domain (Priority)** - 12 elements
- S1: Safeguarding policies and procedures
- S2: Infection prevention and control
- S3: Medicines management
- S4: Equipment safety and maintenance
- S5: Staff recruitment and DBS checks
- S6: Health and safety risk assessments
- S7: Fire safety and emergency procedures
- S8: Significant event analysis and learning
- S9: Patient safety alerts and recalls
- S10: Chaperone policy and training
- S11: Clinical supervision arrangements
- S12: Premises safety and security

**Well-led Domain (Priority)** - 12 elements
- W1: Governance framework and accountability
- W2: Staff training and appraisals
- W3: Complaints handling and learning
- W4: Quality improvement initiatives
- W5: Business continuity planning
- W6: Information governance and GDPR
- W7: Staff engagement and wellbeing
- W8: Partnership working
- W9: Financial management
- W10: CQC registration compliance
- W11: Policy review and version control
- W12: Leadership visibility and communication

**Other Domains** (8 elements each for Effective, Caring, Responsive)

### Word Report Structure

1. **Cover Page** - Practice name, inspection date, overall score
2. **Executive Summary** - High-level findings with traffic light summary
3. **Priority Actions** - Items marked Not Met, ordered by domain priority
4. **Domain-by-Domain Breakdown** - Each element with status, evidence, comments
5. **Recommendations** - AI-generated improvement suggestions
6. **Evidence Index** - List of attached/referenced evidence
7. **Appendix** - Full assessment checklist

### Access Control

- Add `mock_inspection_access` to `user_modules` table
- RLS policies scoped to user's practice via `user_roles.practice_id`
- Service visibility controlled via `useServiceActivation` hook

### Navigation Integration

- Add "Mock CQC Inspection" to service menu (similar to LG Capture, CQC Compliance)
- Route: `/mock-cqc-inspection`

## Critical Friend Approach

The UI will use supportive language throughout:
- "Let's check your evidence" instead of "You are missing..."
- "This area could be strengthened" instead of "Failed"
- Traffic light colours with green as default assumption
- Encouraging progress messages
- Practical, actionable improvement suggestions

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/MockCQCInspection.tsx` | Create | Main service page |
| `src/components/mock-cqc/*.tsx` | Create | Component suite (6 files) |
| `src/hooks/useMockInspection.ts` | Create | State management hook |
| `src/utils/generateMockInspectionReport.ts` | Create | Word document generation |
| `supabase/functions/generate-mock-inspection-report/index.ts` | Create | AI report enhancement |
| `supabase/migrations/[timestamp]_mock_inspection_tables.sql` | Create | Database schema + seed data |
| `src/App.tsx` | Modify | Add route |
| `src/components/Header.tsx` or service menu | Modify | Add navigation item |

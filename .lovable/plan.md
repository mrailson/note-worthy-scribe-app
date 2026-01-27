
# Policy Management Service - Implementation Plan

## Overview

This plan outlines the development of a new **Policy Management Service** for Notewell, enabling NHS GP Practice Managers to create, update, and maintain practice policies using AI-powered generation. The service will be accessible via the "Select Service" dropdown menu and follows the established patterns for service integration within Notewell.

---

## User Journeys (MVP Scope)

The service delivers three core user flows:

1. **Create New Policy** - Generate a compliant policy from scratch using practice profile and current NHS guidance
2. **Update Existing Policy** - Upload a current policy for gap analysis and generate an updated version  
3. **Policy Checklist** - Display recommended policies based on practice profile with quick-create actions

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
├─────────────────────────────────────────────────────────────────┤
│  PolicyServiceLanding.tsx          (3 action cards)             │
│  CreatePolicyWizard.tsx            (Steps 1-3)                  │
│  UpdatePolicyWizard.tsx            (Upload → Analyse → Preview) │
│  PolicyChecklist.tsx               (Categorised policy list)    │
│  PolicyPreview.tsx                 (View & download)            │
│  PolicyDocxExport.ts               (.docx generation)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                      │
├─────────────────────────────────────────────────────────────────┤
│  generate-policy           (AI policy generation)               │
│  analyse-policy-gaps       (Gap analysis for existing policies) │
│  extract-policy-text       (Parse uploaded .docx/.pdf)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase Database (public)                    │
├─────────────────────────────────────────────────────────────────┤
│  practice_profiles         (Extended with policy-specific data) │
│  policy_templates          (Existing - policy metadata)         │
│  policy_generations        (New - log each generation)          │
│  policy_reference_library  (New - 60+ policies with guidance)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation Steps

### Phase 1: Database Schema Extensions

**1.1 Create `policy_reference_library` table**

Stores the master list of 60+ policies with their CQC KLOE mapping, priority level, and primary guidance sources (as defined in specification sections 3.1–3.6).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| policy_name | TEXT | Full policy title |
| category | TEXT | Clinical / IG / H&S / HR / Patient Services / Business Continuity |
| cqc_kloe | TEXT | Safe / Effective / Caring / Responsive / Well-led |
| priority | TEXT | Essential / Recommended / Service-specific |
| guidance_sources | JSONB | Array of primary legislation/guidance references |
| required_services | TEXT[] | Services that require this policy (e.g. minor_surgery) |
| required_roles | TEXT[] | Roles needed (e.g. caldicott_guardian, dpo) |
| is_active | BOOLEAN | Enable/disable policy |
| created_at | TIMESTAMPTZ | Creation timestamp |

**1.2 Create `policy_generations` table**

Logs each policy generation for audit trail and potential re-download.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| practice_id | UUID | FK to gp_practices |
| policy_reference_id | UUID | FK to policy_reference_library |
| generation_type | TEXT | 'new' or 'update' |
| input_document_url | TEXT | URL of uploaded document (for updates) |
| generated_content | TEXT | Full policy markdown |
| metadata | JSONB | Title, version, dates, references used |
| gap_analysis | JSONB | Gaps identified (for updates) |
| created_at | TIMESTAMPTZ | Generation timestamp |

**1.3 Extend `gp_practices` table**

Add columns for policy-specific personnel (most already exist, verify and add missing):

| Column | Type | Description |
|--------|------|-------------|
| practice_manager_name | TEXT | Practice Manager full name |
| lead_gp_name | TEXT | Lead GP / Clinical Lead |
| caldicott_guardian | TEXT | Caldicott Guardian name |
| dpo_name | TEXT | Data Protection Officer |
| safeguarding_lead_adults | TEXT | Adult safeguarding lead |
| safeguarding_lead_children | TEXT | Child safeguarding lead |
| infection_control_lead | TEXT | IPC lead |
| complaints_lead | TEXT | Complaints handler |
| health_safety_lead | TEXT | H&S responsible person |
| fire_safety_officer | TEXT | Fire safety responsible |
| list_size | INTEGER | Approximate patient count |
| services_offered | JSONB | { minor_surgery: bool, dispensing: bool, ... } |
| local_contacts | JSONB | MASH numbers, LMC details, etc. |

---

### Phase 2: Edge Functions

**2.1 `generate-policy` Edge Function**

Generates a complete policy document using AI (Lovable AI or Claude):

- **Input**: policy_reference_id, practice_id, optional custom instructions
- **Process**:
  1. Fetch policy reference (guidance sources, CQC KLOE)
  2. Fetch practice profile (all personnel, services, contacts)
  3. Build system prompt (NHS policy writer expert)
  4. Build user prompt (practice details + regulatory context)
  5. Stream AI response
  6. Parse response into metadata + policy content sections
  7. Save to policy_generations table
- **Output**: { success: true, generation_id, policy_content, metadata }

**2.2 `analyse-policy-gaps` Edge Function**

Analyses an uploaded policy and identifies gaps:

- **Input**: extracted_text, detected_policy_type
- **Process**:
  1. Fetch current guidance sources for policy type
  2. Use AI to compare existing policy against current standards
  3. Identify: outdated references, missing sections, gaps
  4. Return structured analysis
- **Output**: { policy_type, gaps[], outdated_references[], missing_sections[], last_review_date }

**2.3 `extract-policy-text` Edge Function**

Extracts text from uploaded .docx or .pdf files:

- **Input**: file (base64 or file URL)
- **Process**: Parse using existing mammoth (Word) or pdfjs (PDF) libraries
- **Output**: { extracted_text, detected_policy_type, metadata }

---

### Phase 3: Frontend Components

**3.1 Policy Service Landing Page (`/policy-service`)**

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Policy Management Service                      │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  📄 + Create    │  │  🔄 Update      │  │  ✓ Checklist    │  │
│  │  New Policy     │  │  Existing       │  │                  │  │
│  │                 │  │  Policy         │  │                  │  │
│  │  Generate a     │  │  Upload for     │  │  See recommended │  │
│  │  professional,  │  │  gap analysis   │  │  policies for    │  │
│  │  compliant      │  │  and refresh    │  │  your practice   │  │
│  │  policy         │  │                 │  │                  │  │
│  │  [Get Started]  │  │  [Upload]       │  │  [View List]     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**3.2 Create Policy Wizard (`/policy-service/create`)**

Three-step wizard:

- **Step 1: Select Policy Type** - Searchable, categorised list with CQC KLOE badges and priority indicators
- **Step 2: Confirm Practice Details** - Pre-populated from profile, editable inline, role-specific fields shown conditionally
- **Step 3: Generation & Preview** - Loading state (15-30s), success message, scrollable preview, download button, "Request Changes" option

**3.3 Update Policy Wizard (`/policy-service/update`)**

Three-step wizard:

- **Step 1: Upload Document** - Drag-and-drop zone, .docx/.doc/.pdf accepted, 10MB max
- **Step 2: Analysis Results** - Detected policy type, gaps identified, outdated references, missing sections, options: "Generate Updated Version" or "Just Show Gaps"
- **Step 3: Review Updated Policy** - Changes summary, highlighted preview, download options (clean .docx or with track changes)

**3.4 Policy Checklist (`/policy-service/checklist`)**

Categorised display grouped by:
- Essential Policies (CQC Regulated)
- Recommended for Your Services
- Optional but Good Practice

Each row shows: Policy Name | CQC KLOE badge | Priority badge | [Create] button

Export option: Download Full Checklist as PDF

**3.5 Reusable Components**

- `PolicyTypeSelector.tsx` - Searchable policy picker with categories
- `PracticeDetailsForm.tsx` - Inline-editable practice profile for policy generation
- `PolicyPreviewPanel.tsx` - Formatted markdown viewer with references list
- `GapAnalysisResults.tsx` - Visual display of identified gaps
- `PolicyDocxExport.ts` - Word document generation using `docx` library

---

### Phase 4: Service Integration

**4.1 Add to Service Visibility**

Update `src/hooks/useServiceVisibility.ts`:
```typescript
export interface ServiceVisibility {
  // ... existing services
  policy_service: boolean;
}
```

**4.2 Add to Service Activation**

Update `src/hooks/useServiceActivation.ts`:
```typescript
export type ServiceType = '...' | 'policy_service';
```

**4.3 Add to Header Menu**

Update `src/components/Header.tsx` to include Policy Service in the "Select Service" dropdown:
```tsx
{hasModuleAccess('policy_service') && isServiceVisible('policy_service') && (
  <DropdownMenuItem onClick={() => navigate('/policy-service')}>
    <FileText className="h-4 w-4 mr-2" />
    Policy Service
  </DropdownMenuItem>
)}
```

**4.4 Add Route**

Update routing to include:
- `/policy-service` → PolicyServiceLanding
- `/policy-service/create` → CreatePolicyWizard
- `/policy-service/update` → UpdatePolicyWizard
- `/policy-service/checklist` → PolicyChecklist

---

### Phase 5: Word Document Generation

**5.1 `generatePolicyDocx.ts` Utility**

Creates professional NHS-styled policy documents following the template structure from the specification:

1. **Header**: Practice logo placeholder, Policy Title, Practice Name, Document Control Box
2. **Document Control Table**: Version, Effective Date, Review Date, Author, Approved By
3. **Standard Sections** (per specification 6.3):
   - Purpose
   - Scope
   - Definitions
   - Roles & Responsibilities
   - Policy Statement
   - Procedures
   - Training Requirements
   - Monitoring & Compliance
   - Related Documents
   - References & Legislation
   - Version History

4. **Footer**: Page X of Y, Policy title, Version number

This follows the existing pattern from `src/utils/generateMeetingNotesDocx.ts` using the `docx` library.

---

## File Structure

```text
src/
├── pages/
│   ├── PolicyService.tsx              (Landing page)
│   ├── PolicyServiceCreate.tsx        (Create wizard)
│   ├── PolicyServiceUpdate.tsx        (Update wizard)
│   └── PolicyServiceChecklist.tsx     (Checklist view)
│
├── components/
│   └── policy/
│       ├── PolicyTypeSelector.tsx
│       ├── PracticeDetailsForm.tsx
│       ├── PolicyPreviewPanel.tsx
│       ├── GapAnalysisResults.tsx
│       ├── PolicyCategoryBadge.tsx
│       └── PolicyDownloadButton.tsx
│
├── hooks/
│   ├── usePolicyGeneration.ts
│   ├── usePolicyAnalysis.ts
│   └── usePolicyReferenceLibrary.ts
│
└── utils/
    └── generatePolicyDocx.ts

supabase/
└── functions/
    ├── generate-policy/
    │   └── index.ts
    ├── analyse-policy-gaps/
    │   └── index.ts
    └── extract-policy-text/
        └── index.ts
```

---

## Technical Considerations

### AI Prompt Architecture

Following the specification's prompt structure (Section 4):

**System Prompt**: Expert NHS policy writer with deep knowledge of CQC regulations, NHS England guidance, and healthcare legislation.

**User Prompt Template**:
```text
Generate a [POLICY TYPE] policy for:

PRACTICE DETAILS:
- Practice Name: [NAME]
- Address: [FULL ADDRESS]
- Practice Manager: [NAME]
- Lead GP: [NAME]
- [ROLE-SPECIFIC LEADS]
- Services: [LIST]
- List Size: [NUMBER] patients

REGULATORY CONTEXT:
- CQC KLOE: [SAFE/EFFECTIVE/CARING/RESPONSIVE/WELL-LED]
- Primary Guidance: [LIST FROM POLICY REFERENCE]
- Generation Date: [TODAY'S DATE]

FORMAT RESPONSE AS:
===METADATA===
Title: [Policy Title]
Version: 1.0
Effective Date: [Today]
Review Date: [Today + 12 months]
References: [List of guidance documents used]

===POLICY_CONTENT===
[Full policy document following template structure]
```

### File Upload Handling

- Accept: `.docx`, `.doc`, `.pdf`
- Max size: 10MB
- Use existing `WordProcessor.ts` and `PDFProcessor.ts` utilities for text extraction
- Convert `.doc` to `.docx` if needed before processing

### Security & Access Control

- RLS policies on all new tables restricting access to user's practice
- Policy generation logged for audit trail
- No storage of uploaded documents (process and discard)

---

## Out of Scope (Future Phases)

As per specification Section 1.3, these features are NOT included in MVP:
- Review date tracking and automated reminders
- Version history and document storage
- Approval workflows and digital signatures
- Staff acknowledgement tracking
- Integration with external document management systems

---

## Implementation Order

1. **Database migrations** - Create new tables and extend gp_practices
2. **Seed policy reference library** - Insert 60+ policies from specification
3. **Edge functions** - generate-policy, analyse-policy-gaps, extract-policy-text
4. **Service integration** - Add to visibility/activation hooks and Header menu
5. **Landing page** - Three action cards with routing
6. **Create Policy wizard** - Steps 1-3 with AI generation
7. **Policy Checklist** - Categorised list with create buttons
8. **Update Policy wizard** - Upload, analyse, regenerate flow
9. **Word export** - Professional NHS-styled .docx output
10. **Testing & refinement** - End-to-end testing with real policies

---

## Estimated Effort

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Database schema | Medium |
| 2 | Edge functions (3) | High |
| 3 | Frontend components (8+) | High |
| 4 | Service integration | Low |
| 5 | Word export utility | Medium |
| 6 | Testing & polish | Medium |

Total: **Significant feature** requiring multiple implementation sessions

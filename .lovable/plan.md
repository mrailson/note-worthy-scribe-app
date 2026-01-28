

# Plan: Add Notewell Policies Usage Report to AI4GP Services Overview

## Overview
Add a new "Notewell Policies" tab to the AI4GP Services Overview panel on the System Admin dashboard (`/admin`). This will display usage statistics showing who is creating practice policies and when, following the same patterns as the existing Genie Chats, Image Studio, and Presentation reports.

## Current State
- **AI4GPServicesOverview.tsx** has 3 tabs: Genie Chats, Image Studio, and Presentations
- Each report component follows the same pattern:
  - Fetches data via Supabase RPC function
  - Shows overview cards: Today, Last 7 Days, Last 30 Days, All Time
  - Displays a breakdown by service/category
  - Shows a sortable per-user table with metrics
- **policy_completions** table contains: `user_id`, `policy_title`, `created_at`, `status`, `policy_reference_id`
- **policy_reference_library** has 6 categories: Clinical, HR, Health & Safety, Information Governance, Business Continuity, Patient Services
- Currently 1 policy exists (Cold Chain Management by Malcolm Railson)

## Implementation Steps

### Step 1: Create Database RPC Function
Create a new SQL migration with `get_policy_usage_report()` function that:
- Aggregates policy completions per user
- Joins with `profiles` to get user name/email
- Joins with `policy_reference_library` to get category information
- Calculates time-based metrics (today, 7d, 30d, all time)
- Returns counts by each of the 6 CQC categories

### Step 2: Create PolicyUsageReport Component
Create `src/components/admin/PolicyUsageReport.tsx` matching the existing report patterns:
- **Overview Cards**: Today / 7 Days / 30 Days / All Time policy counts
- **Category Breakdown Card**: 6 boxes showing counts per CQC category with colour-coded badges
- **Per-User Table**: Sortable columns for User, per-category counts, Total, Last Created

### Step 3: Update AI4GPServicesOverview
Modify `AI4GPServicesOverview.tsx` to:
- Import the new `PolicyUsageReport` component
- Add a 4th tab "Notewell Policies" with `FileText` icon
- Change TabsList grid from 3 to 4 columns

---

## Technical Details

### Database RPC Function
```sql
CREATE OR REPLACE FUNCTION public.get_policy_usage_report()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  clinical_count bigint,
  hr_count bigint,
  health_safety_count bigint,
  info_governance_count bigint,
  business_continuity_count bigint,
  patient_services_count bigint,
  total_policies bigint,
  last_24h bigint,
  last_7d bigint,
  last_30d bigint,
  last_created timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    pc.user_id,
    COALESCE(p.email, 'Unknown')::text as email,
    p.full_name::text,
    COUNT(*) FILTER (WHERE prl.category = 'Clinical') as clinical_count,
    COUNT(*) FILTER (WHERE prl.category = 'HR') as hr_count,
    COUNT(*) FILTER (WHERE prl.category = 'Health & Safety') as health_safety_count,
    COUNT(*) FILTER (WHERE prl.category = 'Information Governance') as info_governance_count,
    COUNT(*) FILTER (WHERE prl.category = 'Business Continuity') as business_continuity_count,
    COUNT(*) FILTER (WHERE prl.category = 'Patient Services') as patient_services_count,
    COUNT(*) as total_policies,
    COUNT(*) FILTER (WHERE pc.created_at >= CURRENT_DATE) as last_24h,
    COUNT(*) FILTER (WHERE pc.created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7d,
    COUNT(*) FILTER (WHERE pc.created_at >= CURRENT_DATE - INTERVAL '30 days') as last_30d,
    MAX(pc.created_at) as last_created
  FROM policy_completions pc
  LEFT JOIN profiles p ON p.user_id = pc.user_id
  LEFT JOIN policy_reference_library prl ON prl.id = pc.policy_reference_id
  WHERE pc.status = 'completed'
  GROUP BY pc.user_id, p.email, p.full_name
  ORDER BY total_policies DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_policy_usage_report() TO authenticated;
```

### Component Structure
```text
+--------------------------------------------------+
| Overview Cards (4-column grid)                   |
| [Today] [7 Days] [30 Days] [All Time]            |
+--------------------------------------------------+
| Category Breakdown Card (6-column grid)          |
| [Clinical] [HR] [H&S] [IG] [BC] [Patient Svcs]   |
+--------------------------------------------------+
| Usage by User Table                              |
| User | Clinical | HR | H&S | IG | BC | PS | Total | Last Created |
+--------------------------------------------------+
```

### Category Colour Scheme
| Category | Colour |
|----------|--------|
| Clinical | Blue (`text-blue-600`) |
| HR | Purple (`text-purple-600`) |
| Health & Safety | Amber (`text-amber-600`) |
| Information Governance | Green (`text-green-600`) |
| Business Continuity | Red (`text-red-600`) |
| Patient Services | Teal (`text-teal-600`) |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/[timestamp]_add_policy_usage_report.sql` | Create - RPC function |
| `src/components/admin/PolicyUsageReport.tsx` | Create - New report component |
| `src/components/admin/AI4GPServicesOverview.tsx` | Modify - Add 4th tab |

## Expected Outcome
System administrators will see a new "Notewell Policies" tab in the AI4GP Services Overview on `/admin` showing:
- Summary statistics of policy generation activity over time
- Breakdown by the 6 CQC policy categories
- Per-user table showing which users are creating policies and when
- Same sortable, consistent styling as other usage reports


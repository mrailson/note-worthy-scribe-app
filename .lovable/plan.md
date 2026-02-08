

# Admin Audit Dashboard — Edge Functions & Pages Overview

## Summary

Add a new **"Platform Audit"** tab to the System Admin dashboard with two sub-tabs:

1. **Edge Functions** — Lists every deployed function with last-used dates, log activity, and purpose descriptions
2. **Pages & Routes** — Lists every registered route with its component, whether it has a menu link, and a description of what it does

This gives you a single view to identify dead/unused functions and pages for safe cleanup.

---

## What You Will See

### Tab 1: Edge Functions

A searchable, sortable table showing:

| Column | Description |
|--------|-------------|
| Function Name | The edge function directory name |
| Status | Active / Archived badge |
| Last 5 Log Dates | Fetched from Supabase analytics on demand |
| Referenced In Client | Whether `src/` code calls this function |
| Referenced In Other Functions | Whether another edge function calls it |
| Purpose | Auto-generated short description based on the function name |
| Config Entry | Whether it has a `config.toml` block |

- A **"Check Logs"** button fetches the last 5 invocation timestamps from Supabase edge function logs for each function
- Functions with zero references and zero recent logs are highlighted in amber as cleanup candidates
- Archived functions (from `functions__archive/`) are shown in a separate collapsed section

### Tab 2: Pages & Routes

A searchable table showing every route defined in `App.tsx`:

| Column | Description |
|--------|-------------|
| Route Path | e.g. `/turkey2025`, `/feedback` |
| Component | e.g. `Turkey2025`, `PracticeManagerFeedback` |
| Has Menu Link | Yes/No — whether the Header.tsx menu navigates to this route |
| Protection | e.g. "Public", "ProtectedRoute", "requiredModule: enhanced_access" |
| Description | Short auto-generated description of the page purpose |
| Category | Core Service / Admin / CSO Governance / Public / Utility / Unknown |

- Pages with **no menu link** are highlighted as potential cleanup candidates
- A summary card at the top shows: total pages, pages with menu links, orphaned pages, protected vs public

---

## Technical Approach

### New Files

1. **`src/components/admin/EdgeFunctionAudit.tsx`**
   - Hardcoded registry of all ~240 active functions and ~19 archived functions with:
     - `name`, `purpose` (short description), `referencedInClient` (boolean), `referencedInOtherFunctions` (boolean), `hasConfigEntry` (boolean)
   - References are pre-computed from the codebase search results (static data — no runtime file scanning needed)
   - "Check Logs" button calls `supabase.functions.invoke('system-monitoring')` or uses the Supabase analytics API to fetch recent log timestamps
   - Since fetching logs for 240 functions at once would be slow, logs are fetched on-demand per function or in small batches
   - Search/filter bar to find functions by name
   - Colour-coded rows: green (referenced + recent logs), amber (no references), red (no references + no logs)

2. **`src/components/admin/PageRouteAudit.tsx`**
   - Hardcoded registry of all ~120 routes from `App.tsx` with:
     - `path`, `component`, `hasMenuLink` (boolean — cross-referenced against Header.tsx navigation), `protection` (string), `description`, `category`
   - Menu link data is pre-computed by checking which routes appear in Header.tsx `navigate()` calls
   - Summary cards at top with counts
   - Search/filter by category, menu link status, protection type

### Modified Files

3. **`src/pages/SystemAdmin.tsx`**
   - Add a new tab trigger "Platform Audit" with a `Database` icon to the existing TabsList (changing grid from 7 to 8 columns on large screens)
   - Add a new `TabsContent` that renders sub-tabs for "Edge Functions" and "Pages & Routes"
   - Import the two new components

### Data Strategy

- **Edge function list**: Hardcoded from the current `supabase/functions/` directory listing (240+ entries) plus archived entries. This avoids needing a runtime filesystem scan.
- **Page/route list**: Hardcoded from the current `App.tsx` route definitions (~120 entries). Each entry includes whether Header.tsx has a `navigate()` call to that path.
- **Log data**: Fetched on-demand via an edge function call or direct Supabase analytics query. The component will call the existing `system-monitoring` function or a lightweight new endpoint.
- **No database tables needed** — this is purely a read-only diagnostic view using static metadata + live log queries.

### Log Fetching Approach

Rather than fetching logs for all 240 functions at page load (which would be very slow), the UI will:
1. Show the static metadata immediately (references, purpose, config status)
2. Provide a "Scan Logs" button that fetches the last 5 log entries for a selected function
3. Optionally, a "Batch Scan" button that checks logs for all functions marked as "no references" (the most likely cleanup candidates) — limited to ~20 at a time

---

## Route and Menu Link Mapping

Based on the codebase analysis, here is the pre-computed mapping of which routes have menu links. This data will be embedded in the component:

**Routes WITH menu links** (from Header.tsx):
`/`, `/ai4gp`, `/scribe`, `/complaints`, `/enhanced-access`, `/cqc-compliance`, `/surveys`, `/shared-drive`, `/NRESDashboard`, `/nres`, `/nres/complex-care`, `/nres/comms-strategy`, `/gp-genie`, `/gp-translation`, `/mobile-translate`, `/practice-admin/fridges`, `/bp-calculator`, `/mock-cqc-inspection`, `/policy-service`, `/settings`, `/cso-report`, `/practice-admin`, `/admin`, `/notebook-studio`, `/lg-capture`, `/compliance/security`

**Routes WITHOUT menu links** (orphaned — cleanup candidates):
`/quick-record`, `/executive-overview`, `/demos`, `/training`, `/ai-showcase`, `/nres-presentation`, `/meetings`, `/meeting-history`, `/meeting-summary`, `/consultation-summary`, `/admin/demo-video`, `/admin/chunk-repair`, `/attendees`, `/complaints-guide`, `/federation-presentation`, `/load-demo-team`, `/staff-feedback`, `/patient-language`, `/new-recorder`, `/ai4pm`, `/compliance/documentation`, `/data-flow-architecture`, `/dpia`, `/dtac`, `/privacy-policy`, `/hazard-log`, `/safety-case`, `/dcb0129`, `/cso-training-*` (6 routes), `/usingai_nhs`, `/security-posture`, `/incident-response`, `/feedback`, `/feedback/results`, `/network-diagnostics`, `/admin/consolidate`, `/turkey2025`, `/voice-test`, `/security-report`, `/compliance/security-audit-2025-11-19`, `/nhs-quest`, `/lg-capture/*` (sub-routes), `/ai4gp-prompts`, `/reception-translate`, `/doc-capture/:sessionToken`, `/ai-capture/:sessionToken`, `/complaint-capture/:shortCode`, `/inspection-capture/:shortCode`, `/public/bp-calculator`

---

## No Breaking Changes

- No existing functionality is modified
- No database changes required
- No new edge functions needed (uses existing log access)
- The new tab is only visible to system admins (same protection as the rest of the admin page)


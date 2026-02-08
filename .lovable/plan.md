

# Enhanced Edge Function Audit View — Governance Upgrade (Refined)

## Overview

Transform the existing Edge Function Audit from a simple reference/log checker into a comprehensive governance dashboard. Every edge function will display computed metadata answering: *"Why does this function exist, how risky is it, and what would happen if we archived it?"*

**No edge functions will be deleted, modified, or archived.** This is purely an observability and advisory upgrade.

### Implementation Constraints (Do Not Deviate)

- Refactor only: no behavioural change to audit scanning or log fetching
- `lastInvocationBucket` must update only after logs are fetched; default is "Never / Unknown"
- `dataSensitivity` defaults to PHI for any "capture" flows unless explicitly overridden
- No edge functions are deleted, disabled, or archived
- No deployment configuration changes

---

## File Structure

The current `EdgeFunctionAudit.tsx` is 807 lines. The new governance fields, inference logic, and expanded-row UI will be split into focused modules:

| File | Purpose |
|------|---------|
| `src/components/admin/audit/EdgeFunctionAuditTypes.ts` | All TypeScript interfaces and type unions |
| `src/components/admin/audit/EdgeFunctionAuditData.ts` | ACTIVE_FUNCTIONS and ARCHIVED_FUNCTIONS arrays (moved from main file) with manual override fields |
| `src/components/admin/audit/EdgeFunctionAuditUtils.ts` | All inference and computation functions |
| `src/components/admin/audit/EdgeFunctionExpandedRow.tsx` | Expandable detail panel per function row |
| `src/components/admin/EdgeFunctionAudit.tsx` | Main component (refactored to import from the above) |

---

## Data Model

### Extended `EdgeFunction` Interface

```text
EdgeFunction {
  // Existing fields (unchanged)
  name: string
  purpose: string
  referencedInClient: boolean
  referencedInOtherFunctions: boolean
  hasConfigEntry: boolean
  calledFrom: string
  status: 'active' | 'archived'
  lastLogDates?: string[]
  logStatus?: 'idle' | 'loading' | 'loaded' | 'error'

  // New computed fields (inferred client-side)
  invocationPathType:
    | "UI-triggered"
    | "Edge-to-Edge"
    | "Webhook (external)"
    | "Cron / background"
    | "One-off seed / migration"
    | "Unknown"

  lastInvocationBucket:
    | "<7 days"
    | "7-30 days"
    | "31-90 days"
    | ">90 days"
    | "Never / Unknown"

  dataSensitivity:
    | "PHI"
    | "Operational"
    | "Public"
    | "Demo / Test"
    | "Unknown"

  replacementExists: boolean
  replacementReference: string | null

  lifecycleStatus:
    | "ACTIVE"
    | "DORMANT (retained)"
    | "DEPRECATED"
    | "DEPRECATED (still in use)"
    | "ARCHIVED"

  deletionMode:
    | "Retain"
    | "Archive (disable deploy)"
    | "Remove after confirmation"

  archiveConfidenceScore: number   // 0-100
  archiveRationale: string
}
```

### Computed vs Dynamic Fields

Computed fields are inferred client-side from registry metadata. Some fields (e.g. `lastInvocationBucket`) update dynamically when logs are fetched.

- `enrichFunction(baseFn)` sets all defaults including `lastInvocationBucket: "Never / Unknown"`
- When logs arrive via "Check Logs", only `lastLogDates`, `lastInvocationBucket` (re-computed from those dates), and `archiveConfidenceScore` / `archiveRationale` (which depend on the bucket) are updated

---

## Inference Rules (Detailed)

### Invocation Path Type

Applied in this order (first match wins):

1. If `calledFrom` contains `/` (a route path) --> **UI-triggered**
2. Else if `calledFrom` matches `AuthContext|Settings|Admin|SystemAdmin|PracticeAdmin` --> **UI-triggered**
3. Else if `calledFrom` matches `webhook|inbound|resend|email|external` (case-insensitive) --> **Webhook (external)**
4. Else if `name` matches `auto-|cron|cleanup|purge|monitor` --> **Cron / background**
5. Else if `name` matches `import-|seed|migration` AND `referencedInClient` is false --> **One-off seed / migration**
6. Else if `referencedInOtherFunctions` is true AND `referencedInClient` is false --> **Edge-to-Edge**
7. Otherwise --> **Unknown**

### Data Sensitivity

Applied conservatively (first match wins):

1. If name/purpose matches: `complaint|consultation|transcript|patient|clinical|lg-|referral|medical|scribe|meeting|capture|survey|evidence|inspection` --> **PHI**
2. If name/purpose matches: `admin|monitoring|cleanup|purge|security|rate-limit|log-|system-|api-test|challenge` --> **Operational**
3. If name/purpose matches: `demo|showcase|test|example|staff-demo` --> **Demo / Test**
4. If name/purpose matches: `news|fetch-gp-news|nhs-gp-news|bp-calculator|get-client-info` --> **Public**
5. Otherwise --> **Unknown**

Key correction from feedback: "capture" routes (complaint-capture, inspection-capture, doc-capture, ai-capture) are **PHI** even though they use public-token access. "Public link" does not mean "public data".

### Manual Overrides

The data registry supports two fields that can be manually set per-function to override inferred values:

- `replacementExists` / `replacementReference` -- set to `true` and the replacement function name for known superseded functions
- `dataSensitivityOverride` -- optional field that, when set, overrides the inferred sensitivity (e.g. `parse-bp-readings` could be overridden to "Public" since it processes anonymised calculator input, not patient records)

### Lifecycle Status

Applied in this priority order:

1. If `status === 'archived'` --> **ARCHIVED**
2. If `replacementExists === true` AND function has client or edge-to-edge references --> **DEPRECATED (still in use)**
3. If `replacementExists === true` AND no references --> **DEPRECATED**
4. If has client or edge-to-edge references --> **ACTIVE**
5. If no references but `invocationPathType` is Webhook, Cron, or Unknown --> **DORMANT (retained)**
6. Fallback --> **ACTIVE**

The fifth lifecycle status ("DEPRECATED (still in use)") addresses the feedback about functions that are replaced but still actively referenced during migration. The rationale will note "still referenced" to flag the dependency.

### Deletion Mode

- Default --> **Retain**
- If DEPRECATED or DEPRECATED (still in use) --> **Archive (disable deploy)**
- If One-off seed/migration with no references --> **Archive (disable deploy)**
- If Webhook (external) with no references --> **Remove after confirmation**

### Archive Confidence Score (0-100)

Start at 50, then apply adjustments:

| Condition | Adjustment |
|-----------|-----------|
| PHI sensitivity | -40 |
| Webhook or Cron path type | -30 |
| Unknown invocation type | -20 |
| `lastInvocationBucket` is "Never / Unknown" AND path type is Webhook/Cron/Unknown | -25 |
| One-off seed / migration | +30 |
| Replacement exists | +30 |
| No references (neither client nor cross) | +20 |

Clamped to 0-100.

The additional -25 penalty (from feedback) prevents false-high confidence for functions with unknown activity patterns -- unknown activity should reduce confidence, not be ignored.

### Archive Rationale

Auto-generated 1-2 sentence explanation combining signals. Examples:

- "This function has no client or edge references and appears to be a one-off seed script. No replacement is required. Suitable for archival."
- "This function processes PHI (complaint data) and is actively UI-triggered. Not suitable for archival."
- "This function is superseded by `gpt5-fast-clinical` but still has active client references. Migration should be completed before archiving."
- "This function has no references and no recent invocation data. However, it is webhook-triggered and may receive external traffic. Manual verification required before archiving."

### Last Invocation Bucket

- Default: **"Never / Unknown"** (until logs are fetched)
- After "Check Logs" returns timestamps, compute the bucket from the most recent date:
  - Within 7 days --> **"<7 days"**
  - Within 30 days --> **"7-30 days"**
  - Within 90 days --> **"31-90 days"**
  - Older --> **">90 days"**
  - No logs returned --> remains **"Never / Unknown"**
- This also triggers a recalculation of `archiveConfidenceScore` and `archiveRationale` since they depend on the bucket

---

## UI Changes

### 1. Summary Cards Row

Add two new summary cards to the existing row of 5 (total becomes 7):

- **DEPRECATED** count (amber/orange badge)
- **DORMANT** count (grey badge)

Grid changes from `grid-cols-2 sm:grid-cols-5` to `grid-cols-2 sm:grid-cols-4 lg:grid-cols-7`.

### 2. Advanced Filters Section

A collapsible "Advanced Filters" panel below the existing search + filter row. Contains:

**Lifecycle Status** (Select dropdown):
All | ACTIVE | DORMANT (retained) | DEPRECATED | DEPRECATED (still in use) | ARCHIVED

**Invocation Path Type** (Select dropdown):
All | UI-triggered | Edge-to-Edge | Webhook (external) | Cron / background | One-off seed / migration | Unknown

**Data Sensitivity** (Select dropdown):
All | PHI | Operational | Public | Demo / Test | Unknown

**Archive Confidence Threshold** (Slider):
Range 0-100, filters to show only functions with score >= threshold. Label shows "Confidence >= X%".

The existing filter dropdown (Referenced / Unreferenced etc.) remains as-is.

### 3. Table Column Updates

The main table columns become:

| Function Name | Purpose | Called From | Lifecycle | Path Type | Sensitivity | Confidence | Client | Cross-Ref | Actions |

Column details:
- **Lifecycle**: Colour-coded badge -- green (ACTIVE), grey (DORMANT), amber (DEPRECATED), amber with border (DEPRECATED still in use), slate (ARCHIVED)
- **Path Type**: Small badge -- blue (UI-triggered), purple (Edge-to-Edge), orange (Webhook), teal (Cron), yellow (Seed), grey (Unknown)
- **Sensitivity**: Small badge -- red (PHI), blue (Operational), green (Public), slate (Demo/Test), grey (Unknown)
- **Confidence**: Number displayed as "85%" with colour coding -- green >=70, amber 30-69, red <30

The **Last Log Dates** column is **removed from the main table** and moved into the expanded row detail panel (UX improvement from feedback -- reduces clutter and prevents over-weighting raw timestamps).

The **"Check Logs"** button moves from the table Actions column into the expanded row.

### 4. Expandable Row Detail Panel

Clicking a row (or a chevron icon in the Actions column) expands an inline detail panel below that row. The panel shows:

- **Archive Rationale** -- the generated explanation text
- **Replacement Reference** -- if a replacement exists, the replacement function name with a link/badge
- **Deletion Mode** -- "Retain" / "Archive (disable deploy)" / "Remove after confirmation" with appropriate colour
- **Last Invocation Bucket** -- the time bucket badge
- **Check Logs** button -- triggers log fetch; after fetch, displays full log dates and updates the bucket badge
- **Full log date list** -- shown after logs are fetched

Controlled via `expandedRow: string | null` state (only one row expanded at a time).

### 5. Legend Update

The existing legend expands to include colour meanings for:
- Lifecycle status badges (ACTIVE, DORMANT, DEPRECATED, DEPRECATED still in use, ARCHIVED)
- Path type badges
- Sensitivity badges
- Confidence score colours

### 6. Word Report Update

The downloadable Word report gains:

**New "Governance Summary" section** at the top:
- Counts by lifecycle status (ACTIVE, DORMANT, DEPRECATED, ARCHIVED)
- Counts by data sensitivity (PHI, Operational, Public, Demo/Test, Unknown)
- Count of functions with archive confidence >= 70

**New columns in the function table**:
- Lifecycle Status
- Invocation Path Type
- Data Sensitivity
- Archive Confidence (as percentage)
- Archive Rationale

---

## Implementation Steps

### Step 1: Create `src/components/admin/audit/EdgeFunctionAuditTypes.ts`

- `InvocationPathType` union type
- `LastInvocationBucket` union type
- `DataSensitivity` union type
- `LifecycleStatus` union type (5 values including "DEPRECATED (still in use)")
- `DeletionMode` union type
- Extended `EdgeFunction` interface with all new fields
- `BaseEdgeFunction` type for the registry entries (before enrichment)
- `AuditFilterState` type for all filter controls

### Step 2: Create `src/components/admin/audit/EdgeFunctionAuditUtils.ts`

- `inferInvocationPathType(fn)` -- ordered pattern matching as described above
- `inferDataSensitivity(fn)` -- keyword matching with PHI-first bias; respects `dataSensitivityOverride`
- `inferLifecycleStatus(fn)` -- priority-ordered rules with DEPRECATED (still in use) support
- `inferDeletionMode(fn)` -- derived from lifecycle and path type
- `calculateArchiveConfidence(fn)` -- score formula including the -25 unknown-activity penalty
- `generateArchiveRationale(fn)` -- template-based sentence builder
- `computeLastInvocationBucket(logDates)` -- buckets from most recent log timestamp
- `enrichFunction(baseFn)` -- applies all inference functions, sets defaults
- `recomputeDynamicFields(fn)` -- called after log fetch to update bucket, confidence, and rationale only

### Step 3: Create `src/components/admin/audit/EdgeFunctionAuditData.ts`

- Move `ACTIVE_FUNCTIONS` and `ARCHIVED_FUNCTIONS` arrays from main file
- Add optional `replacementExists`, `replacementReference`, and `dataSensitivityOverride` fields to relevant entries
- Known replacements to set:
  - `gpt5-clinical-reviewer` (archived) --> replaced by `gpt5-fast-clinical`
  - `meeting-completion-handler` (archived) --> replaced by `meeting-completion-processor`
  - `openai-realtime-token` (archived) --> replaced by `openai-realtime-session`
  - `generate-image` (archived) --> replaced by `advanced-image-generation`
  - `smart-web-search` (archived) --> replaced by `smart-source-router`
- Known sensitivity overrides:
  - `parse-bp-readings` --> "Public" (anonymised calculator input)
  - `get-client-info` --> "Public" (network diagnostics, no patient data)
  - `fetch-gp-news`, `nhs-gp-news` --> "Public"
- Export pre-enriched arrays using `enrichFunction()`

### Step 4: Create `src/components/admin/audit/EdgeFunctionExpandedRow.tsx`

- Receives a single enriched `EdgeFunction`
- Renders an indented card within the table row showing:
  - Archive rationale (text block)
  - Replacement reference (if exists, as a badge)
  - Deletion mode (colour-coded badge)
  - Last invocation bucket (badge)
  - "Check Logs" button
  - Full log date list (after fetch)
- Styled consistently with the existing card/table design

### Step 5: Refactor `src/components/admin/EdgeFunctionAudit.tsx`

- Import types, data, utils, and expanded row from new modules
- Remove inline ACTIVE_FUNCTIONS and ARCHIVED_FUNCTIONS arrays (~275 lines moved out)
- Add new filter state: `lifecycleFilter`, `pathTypeFilter`, `sensitivityFilter`, `confidenceThreshold`
- Add `expandedRow` state
- Update `activeFunctions` memo to apply all new filters
- Update `checkLogs` to call `recomputeDynamicFields` after log fetch (updating bucket, confidence, rationale)
- Update table to render new columns with badges, remove log dates column
- Add row click / chevron to toggle expanded panel
- Update summary cards (add DEPRECATED and DORMANT counts)
- Add collapsible Advanced Filters section
- Update Word report generation with governance summary and new columns
- Update legend with new badge colour definitions

---

## What Does NOT Change

- No edge function code is modified
- No deployment configuration changes
- No database schema changes
- The existing log fetching mechanism (via `system-monitoring` edge function) is unchanged
- Batch scan continues to work identically
- Archived functions section continues to display (now also enriched with governance metadata)


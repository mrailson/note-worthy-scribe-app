

# Phase 1: ENN Dashboard — Core Build

## Overview
Create a standalone East Northants Neighbourhood (ENN) dashboard at `/enn`, replicating the NRES dashboard layout and features but populated with ENN-specific practice/hub data from Supabase. All 10 ENN practices already exist in `gp_practices` (neighbourhood_id `e1824813-4d90-4911-9104-e6ac0ba9be15`).

## Database Changes (Migration)

### 1. New tables

**`enn_hubs`** — The 3 ENN hub providers
- `id` uuid PK
- `practice_id` uuid → gp_practices.id (the hub provider practice)
- `hub_name` text
- `hub_list_size` integer
- `annual_income` numeric
- `weekly_appts_required` integer
- `created_at` timestamptz

**`enn_hub_practice_mappings`** — Which practices are served by which hub
- `id` uuid PK
- `hub_id` uuid → enn_hubs.id
- `practice_id` uuid → gp_practices.id
- `created_at` timestamptz

**`enn_practice_data`** — ENN-specific practice data (list size, appointments, winter data)
- `id` uuid PK
- `practice_id` uuid → gp_practices.id
- `ods_code` text
- `list_size` integer
- `address` text
- `annual_appts_required` integer
- `weekly_appts_required` integer
- `participating_winter` boolean default true
- `winter_appts_required` integer
- `non_winter_appts_required` integer
- `weekly_non_winter_appts` integer
- `created_at` timestamptz

### 2. Update `gp_practices` — Set `list_size` and `address` for the 10 ENN practices (via insert tool / UPDATE)

### 3. Seed data — Insert all hub, mapping, and practice data from the prompt into the new tables

### 4. Add `'enn'` to the `ServiceType` — Update `useServiceActivation.ts` to recognise `enn` service access

## Frontend Changes

### 1. `src/data/ennPractices.ts`
ENN equivalent of `nresPractices.ts` — 10 practice keys, display names, ODS codes.

### 2. `src/data/ennMockData.ts`
ENN-specific mock consultation data for the results dashboard tab (same structure as `nresMockData.ts` but with ENN practice names, ENN hub names, and sample clinicians).

### 3. `src/components/enn/` — Component directory
Copy and adapt the following NRES components, replacing all NRES references with ENN:
- `ENNDashboardHeader.tsx` — Practice selector with 10 ENN practices + "All Practices"
- `ENNMetricCard.tsx` — Reuse `MetricCard` directly (no copy needed)
- `ENNPerformanceChart.tsx` — Wrapper using ENN practice performance data
- `ENNPracticeOverview.tsx` — **New** — Practice cards showing list size, hub assignment, appointment data, utilisation metrics
- `ENNHubSummary.tsx` — **New** — Hub-level cards with income, list size, weekly appointments
- `ENNWinterAccessPanel.tsx` — **New** — Winter vs non-winter appointment split display

### 4. `src/pages/ENNDashboard.tsx`
Main page with tabs:
- **Dashboard** — Key metrics, priority actions, consultations table, performance chart, escalations log (same layout as NRES)
- **Practice Overview** — Practice cards with list size, hub, appointment data
- **Hub Reporting** — Hub-level summaries with income and utilisation
- **Winter Access** — Winter participation and appointment tracking

### 5. `src/hooks/useENNData.ts`
Hook to fetch ENN practices, hubs, and mappings from Supabase.

### 6. Routing — `src/App.tsx`
Add `/enn` route with `<ProtectedRoute requiredService="enn">`.

### 7. Service activation — `src/hooks/useServiceActivation.ts`
Add `'enn'` to the `ServiceType` union.

## Key Details

- **Neighbourhood identity**: Title shows "ENN Results Dashboard", subtitle "East Northants Neighbourhood — 3Sixty Care Partnership"
- **Transformation Manager**: Rebecca Gane contact details shown in dashboard header/info tooltip
- **Budget display**: £2,376,045.53 total annual budget shown in executive metrics
- **10 practices, 3 hubs**: All data from the prompt seeded into Supabase
- **No shared state with NRES**: Completely separate tables, routes, and data
- **Existing components reused where possible**: MetricCard, InfoTooltip, CollapsibleCard, StatusBadge

## What's NOT in Phase 1 (future phases)
- Claims & Oversight (Hours Tracker) for ENN
- Document Vault for ENN
- SDA Programme dashboard for ENN
- Comms Strategy for ENN
- Complex Care for ENN
- Presentation mode for ENN




# Rebuild ENN Dashboard as a Copy of the NRES SDA Programme Dashboard

## Problem
The current ENN dashboard (`/enn`) was built as a results/consultations tracker. You wanted it to mirror the **NRES SDA Programme dashboard** (`/NRESDashboard`) — the one with the hero header, Executive Summary, Estates & Capacity, IT & Reporting, Workforce, Claims & Oversight, and Document Vault tabs.

## Approach
Rebuild `ENNDashboard.tsx` to replicate the `SDADashboard.tsx` structure and layout, but with ENN-specific branding and data:

- **Hero header**: "EAST NORTHANTS NEIGHBOURHOOD" / "Neighbourhood SDA Programme" with Rebecca Gane contact, go-live date, feedback button
- **Same 6 tabs**: Executive Summary, Estates & Capacity, IT & Reporting, Workforce, Claims & Oversight, Document Vault
- **Same styling**: Gradient hero, floating tab bar, NHS blue theme

## What Changes

### 1. Rewrite `src/pages/ENNDashboard.tsx`
Replace the current results-dashboard layout with the SDA Programme layout:
- Hero header with ENN branding (East Northants Neighbourhood, 3Sixty Care Partnership, Rebecca Gane)
- 6 tabs matching SDADashboard exactly
- Reuse the same SDA tab components initially (SDAExecutiveSummary, SDAEstatesCapacity, etc.) — these can be swapped for ENN-specific versions later
- Wrap in NRESPeopleProvider (same as SDA dashboard)

### 2. Update ENN-specific data in Executive Summary
The shared SDAExecutiveSummary component currently shows NRES data (7 practices, 89,584 patients, £2.36m). For Phase 1, we reuse these components as-is to get the structure right. In a follow-up, we create ENN-specific versions with:
- 10 practices, 90,241 patients, £2,376,045.53 budget
- ENN practice population chart
- ENN-specific action log and programme plan

### 3. Keep existing ENN components
The Practice Overview, Hub Reporting, and Winter Access components already built remain available — they can be integrated as sub-sections or additional tabs later.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/ENNDashboard.tsx` | Rewrite to match SDADashboard structure with ENN branding |

## ENN Dashboard Header Content
- Subtitle: "EAST NORTHANTS NEIGHBOURHOOD"
- Title: "Neighbourhood SDA Programme"
- Go-Live: "1st April 2026"
- Feedback button with current section context
- Transformation Manager: Rebecca Gane

## What's Deferred
- ENN-specific Executive Summary component (with ENN practice data, population chart, budget)
- ENN-specific Estates, IT, Workforce components
- ENN-specific Claims & Document Vault

These will be built in follow-up phases, replacing the shared NRES components with ENN-specific ones.


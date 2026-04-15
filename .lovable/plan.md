

# Restructure NRES Dashboard: Claims-Only Tab + IT & Reporting

## Summary
Move the "Finance, Governance & Insurance" sub-tab out of Claims & Oversight into a new "IT & Reporting" top-level tab on the NRES Dashboard. Claims & Oversight becomes a clean, claims-only page.

## Current structure
```text
NRESDashboard tabs:
├─ Dashboard
├─ Claims & Oversight  →  NRESHoursTracker
│   ├─ SDA Resource & Buy-Back Claims  (BuyBackClaimsTab)
│   └─ Finance, Governance & Insurance
│       ├─ Finance & Governance
│       ├─ Pre Go-Live Time & Expenses
│       ├─ Risks & Mitigation
│       ├─ Evidence Library
│       └─ Workforce
└─ Document Vault
```

## Proposed structure
```text
NRESDashboard tabs:
├─ Dashboard
├─ IT & Reporting
│   ├─ Digital Integration   (SDADigitalIntegration — same as SDADashboard)
│   ├─ Finance & Governance
│   ├─ Pre Go-Live Time & Expenses
│   ├─ Risks & Mitigation
│   ├─ Evidence Library
│   └─ Workforce
├─ Claims & Oversight  →  NRESHoursTracker (claims only)
└─ Document Vault
```

## Changes

### File 1: `src/pages/NRESDashboard.tsx`
- Add `Monitor` icon import and `SDADigitalIntegration` import
- Add a new top-level tab: `{ value: "digital", label: "IT & Reporting", icon: Monitor }`
- Reorder tabs: Dashboard → IT & Reporting → Claims & Oversight → Document Vault
- Add `<TabsContent value="digital">` rendering a new `NRESDigitalAndFinance` component (or inline the sub-tabs)
- The digital tab will contain the `SDADigitalIntegration` component plus all the Finance/Governance sub-tabs currently in NRESHoursTracker

### File 2: `src/components/nres/hours-tracker/NRESHoursTracker.tsx`
- Remove the `TabsList` with "SDA Resource & Buy-Back Claims" and "Finance, Governance & Insurance" toggle
- Remove all Finance-related imports (`SDAFinanceGovernance`, `SDARisksMitigation`, `SDAEvidenceLibrary`, `SDAWorkforceInnovation`, time/expense components)
- Remove the `financeSubTab` state and all the Finance tab content (lines 188-330)
- The component now renders only the Buy-Back claims content directly (guide button, settings button, `BuyBackClaimsTab`, and the access settings modal)
- Remove unused hooks/state (`useNRESUserSettings`, `useNRESHoursTracker`, `useNRESExpenses`, `useNRESClaimants`, expenses/claimants states)

### File 3 (new): `src/components/nres/NRESDigitalAndFinance.tsx`
- New component containing the `SDADigitalIntegration` plus Finance sub-tabs
- Sub-tabs: Digital Integration | Finance & Governance | Pre Go-Live Time & Expenses | Risks & Mitigation | Evidence Library | Workforce
- Moves all the Finance/Governance logic from NRESHoursTracker (time tracking, expenses, claimants, admin reports) into this component
- Receives `neighbourhoodName`, `hideEvidenceLibrary`, `interactiveInsurance` and other relevant props

### No changes to
- SDADashboard or ENNDashboard
- BuyBackClaimsTab or any claims components
- Any hooks or data files


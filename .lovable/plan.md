

## Goal

Fix two issues with how GP Locum is presented in the **Claims Scheme Guide** modal so it correctly states that 1 session = **4 hours 10 minutes (half-day)** at **£375/session**, and stop GP Locum from being rendered inside the salaried-roles rate table where its annual figures are nonsensical.

## Issues today

Looking at the Rates & Caps tab in the screenshot:

1. **GP Locum is appearing in the main "Maximum Reclaimable Rates" table** with values like £975 annual / £1.73/hr / £485/mo — this table is computed from `rateSettings.roles_config` assuming an annual salary × on-costs model, which doesn't apply to fixed-rate locums. It should be excluded from this table because locum already has its own dedicated **GP Locum Rates** table further down.
2. **"1 session"** is described inconsistently — sometimes "a half-day", sometimes just "session" — without ever quantifying it. The user has confirmed: **1 session = 4 hours 10 minutes (a half-day)**, billed at **£375/session** flat (cap).

## Changes (single file: `src/components/nres/hours-tracker/ClaimsUserGuide.tsx`)

### 1. Exclude GP Locum from the salaried Maximum Reclaimable Rates table
In the `.map(role => …)` over `rateSettings.roles_config` (around line 344), add a filter so any role whose `key` / `label` matches GP Locum is skipped — it's surfaced separately in the dedicated GP Locum Rates panel below.

```ts
rateSettings.roles_config
  .filter(r => r.key !== 'gp_locum' && r.label.toLowerCase() !== 'gp locum')
  .map(role => { … })
```

### 2. Quantify the session definition everywhere
Update the four spots that reference GP Locum sessions or sessions in general:

- **Overview callout** (~line 92): change to *"…£750/day or £375/session (1 session = 4 hrs 10 mins / half-day)…"*
- **How to Claim → GP Locum workflow** (~line 203): *"…£750/day or £375/session (4 hrs 10 mins)…"*
- **Rates & Caps → GP Locum Rates table Session row** (~line 422): change the Allocation cell from `Session` to `Session (4 hrs 10 mins / half-day)`.
- **Allocation Types list** (~line 389): change *"1 session = a half-day"* to *"1 session = a half-day (4 hrs 10 mins)"* for consistency across all GP roles.
- **Claim Rules note** (~line 549): clarify *"£375/session (half-day, 4 hrs 10 mins)"*.

### 3. FAQ tweak
Update the existing FAQ answer (~line 630) *"How do GP Locum claims differ from Buy-Back?"* to mention *"1 session = a half-day (4 hrs 10 mins) at £375 (cap)"*.

## Out of scope

- No changes to claim calculation logic, dashboards, invoice PDF, or database — `£375/session` is already correctly applied in `BuyBackClaimsTab.tsx`, `EditStaffDialog.tsx`, and `invoicePdfGenerator.ts`.
- No changes to the underlying `rateSettings.roles_config` (the GP Locum entry stays in settings — we just stop rendering it in the salaried table).
- No changes to the 7-tab structure.


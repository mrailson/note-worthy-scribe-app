I’ll add a claim-specific evidence help tooltip in the draft section.

1. Add an info icon beside the blue “Evidence” heading
- Place a small info icon immediately next to the “Evidence” label in the draft claim evidence header.
- The icon will be keyboard/focus accessible as well as hover accessible.

2. Show claim-type-specific supporting evidence requirements
- Use the existing evidence configuration from `nres_claim_evidence_config` via `useNRESEvidenceConfig()`.
- For the current claim type (`buyback`, `gp_locum`, `new_sda`, `management`, or mixed), show the relevant configured evidence rows.
- Mark mandatory items as “Required”.
- Include optional “Other Supporting Evidence” guidance where configured.

3. Make the hover text clear for practice users
- Tooltip heading will name the claim type, e.g. “Buy-Back evidence required”, “GP Locum evidence required”, or “New SDA evidence required”.
- Tooltip body will list the supporting documents required for that specific claim type, using each evidence item’s label and description.
- If configuration is still loading or unavailable, show a short fallback message instead of a blank tooltip.

Technical details
- Update `src/components/nres/hours-tracker/ClaimEvidencePanel.tsx`.
- Import the existing shadcn tooltip components and `Info` icon.
- Build a small helper inside the component to derive a friendly claim-type label and tooltip list from `visibleConfig` / `applicableConfig`.
- Keep existing upload, paste, validation and multi-file behaviour unchanged.
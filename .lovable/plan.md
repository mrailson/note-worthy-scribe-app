Plan only — no code changes made.

## Current findings

### 1) Export/download code paths today

On `/nres/population-risk`, the relevant export paths are:

1. `src/pages/NRESPopulationRisk.tsx`
   - Function: `exportCohortCsv(cohortId)`
   - Triggered by: `CohortsSection` button labelled `Export cohort (CSV)`
   - Output filename: `nres-cohort-${cohortId}.csv`
   - Builder: inline CSV string construction using `headers.join(",")` and `data.map(...).join(",")`
   - Current behaviour: always pseudonymised; includes `FK_Patient_Link_ID`, never NHS number/name.

2. `src/components/nres/PatientDrillDrawer.tsx`
   - Function: `exportCsvAnonymised()`
   - Triggered by: drawer button labelled `Export – anonymised`
   - Output filename: `narp-${slug}-anonymised.csv`
   - Builder: inline CSV string construction using `csvRows` array.
   - Current behaviour: always pseudonymised; includes `FK_Patient_Link_ID`, never NHS number/name.

3. `src/components/nres/PatientDrillDrawer.tsx`
   - Function: `exportCsvIdentifiable()`
   - Triggered by: drawer button labelled `Export – with identifiers`
   - Calls: `IdentifiableExportModal`
   - Then: `src/components/nres/IdentifiableExportModal.tsx` calls Supabase edge function `narp-export-identifiable`
   - Output filename: returned by edge function, fallback `narp-identifiable.csv`
   - Current behaviour: separate audited identifiable export path, gated by `canExportPII`, not the same as the visual `Show identifiable details` toggle.

4. `src/components/nres/WorklistsTab.tsx`
   - I found patient/worklist display paths, but no current CSV/XLSX export function in this file.
   - Worklists currently show stored `fk_patient_link_id` only; no download button exists in the inspected code.
   - If “any patient list/worklist” refers to drawer patient lists, that path is `PatientDrillDrawer.exportCsvAnonymised()`.

No XLSX export builder appears to be used for these population-risk patient lists today. `xlsx` is imported in `NRESPopulationRisk.tsx` for upload parsing only.

### 2) Where the toggle state currently lives

There are two independent local React states:

1. `src/pages/NRESPopulationRisk.tsx`
   - `TopRiskSection`
   - `const [identifiersVisible, setIdentifiersVisible] = useState(false);`
   - Controls Top 25 inline `NHS Number` and `Name` columns.

2. `src/components/nres/PatientDrillDrawer.tsx`
   - `const [identifiersVisible, setIdentifiersVisible] = useState(false);`
   - Controls drawer inline `NHS no.` and `Name` columns.

Both reset to OFF on component remount/page reload. They are not shared, and exports do not currently read this state.

### 3) Safest persistence location

Use `localStorage`, keyed by authenticated user id, with defensive RBAC enforcement at read/use time.

Recommended key shape:

```text
nres:population-risk:show-identifiers:${user.id}
```

Why localStorage is the smallest/safest patch here:
- It is per-browser/per-user and suits a UI preference.
- It avoids storing a sensitive preference in the database.
- It avoids schema/RLS changes.
- It avoids URL leakage; query params are inappropriate because they could be shared/bookmarked and accidentally request identifier display.
- It must not be trusted for access. The effective value must always be `canViewPII && persistedPreference`.

Rejected alternatives:
- `user_settings` table: more durable across devices, but requires schema/RLS/API changes and is too large for this request.
- Query param: not appropriate for an identifier-display preference and could leak into history/shared URLs.

## Proposed smallest patch

### File 1: `src/pages/NRESPopulationRisk.tsx`

Exact changes:

1. Import the authenticated user:
   - Add `useAuth` import from `@/contexts/AuthContext`.
   - Inside `NRESPopulationRiskInner`, read `const { user } = useAuth();`.

2. Add a shared persisted toggle state at page level, not inside `TopRiskSection`:
   - Add state such as `const [showIdentifiersPreference, setShowIdentifiersPreference] = useState(false);`.
   - Add a localStorage key derived from `user?.id`.
   - On user id change, load the saved value from localStorage.
   - On toggle change, write via existing `safeSetItem` from `src/utils/localStorageManager.ts` if available/imported; otherwise use guarded `localStorage.setItem`.
   - If `canViewPII` becomes false, force the effective display OFF without necessarily deleting the saved preference.

3. Pass the persisted state and setter into `TopRiskSection`:
   - Replace `TopRiskSection`’s internal `useState(false)` with props:
     - `identifiersVisible`
     - `onIdentifiersVisibleChange`
   - Keep effective display as `const showIdentifiers = canViewPII && identifiersVisible;`.

4. Wire Top 25 export/download:
   - Add a CSV export button to `TopRiskSection` if there is not one already.
   - Add a local inline CSV builder for Top 25 sorted rows.
   - When `canViewPII && identifiersVisible` is true, export columns:
     - `NHS_Number`
     - `Name`
     - then the existing clinical/risk columns
   - When false, export only:
     - `FK_Patient_Link_ID`
     - existing clinical/risk columns
   - Never include identifiers unless `canViewPII && identifiersVisible` is true.
   - Use the already-loaded `identifierDetails` first, then row-level fallback (`p.nhsNumber`, `p.forenames`, `p.surname`) only under the same RBAC+toggle condition.

5. Wire cohort CSV export:
   - Update `exportCohortCsv(cohortId)` to use the same effective condition:
     - `const includeIdentifiers = canViewPII && showIdentifiersPreference;`
   - If true, headers become `NHS_Number, Name, Age, ...` or `FK_Patient_Link_ID, NHS_Number, Name, Age, ...` depending preferred output. Based on the request “instead of just REF”, I would include `NHS_Number` and `Name` and omit `FK_Patient_Link_ID` only for ON exports.
   - If false, keep current pseudonymised headers exactly as today.
   - Important: this path only has identifiers already present in uploaded/demo rows. For real encrypted NARP refs with no row-level identifiers, it would need the same RPC lookup before export. Smallest safe implementation: build a helper that resolves identifiers for a set of refs using the existing demo map + `get_narp_identifiable_by_refs` only when `includeIdentifiers` is true.

6. Pass the same persisted state into the drawer:
   - In the `PatientDrillDrawer` invocation, add props:
     - `identifiersVisible={showIdentifiersPreference}`
     - `onIdentifiersVisibleChange={setShowIdentifiersPreference}`

### File 2: `src/components/nres/PatientDrillDrawer.tsx`

Exact changes:

1. Add optional controlled toggle props:

```ts
identifiersVisible?: boolean;
onIdentifiersVisibleChange?: (visible: boolean) => void;
```

2. Replace local-only state with controlled/uncontrolled compatibility:
   - Keep an internal fallback state for safety.
   - Effective value:

```ts
const effectiveIdentifiersVisible = identifiersVisibleProp ?? internalIdentifiersVisible;
```

   - Setter updates either parent callback or internal fallback.

3. Update all drawer references from `identifiersVisible` to `effectiveIdentifiersVisible`:
   - `showInlinePII`
   - identifier loading effect
   - switch `checked`
   - switch `onCheckedChange`

4. Change `exportCsvAnonymised()` into a toggle-aware export while keeping the same button position:
   - Rename internally to something like `exportCsvCurrentView()` or keep function name to minimise UI churn.
   - Effective export rule:

```ts
const includeIdentifiers = canViewPII && effectiveIdentifiersVisible;
```

   - If `includeIdentifiers` is false, keep today’s headers and filename behaviour (`narp-${slug}-anonymised.csv`).
   - If `includeIdentifiers` is true:
     - Ensure identifiers are available for all `sortedRows` being exported, not just `visibleRows`. The current effect only loads `visibleRows` because of virtual/render limiting.
     - Use a shared helper inside the component to load missing identifiers for `sortedRows` via demo map + existing RPC.
     - Headers should include `NHS_Number` and `Name` instead of `FK_Patient_Link_ID` for ON exports.
     - Filename should avoid saying anonymised, e.g. `narp-${slug}-identifiable.csv`.
   - If identifier lookup fails, show the existing toast and do not produce a partial identifiable export.

5. Keep the separate `Export – with identifiers` audited edge-function path unchanged.
   - This request is about making the current patient-list export follow the visual toggle.
   - Do not touch edge functions.
   - Do not change `IdentifiableExportModal.tsx` unless you want to rename labels, which is not required.

### File 3: optional small helper file, only if needed

To avoid duplicating CSV escaping and identifier resolution between Top 25/cohort/drawer exports, the cleanest small helper would be:

`src/utils/narpIdentifiableExport.ts`

Potential contents:
- `csvEscape(value)`
- `formatPatientName(detailsOrRow)`
- `buildPatientListCsv(rows, { includeIdentifiers, details })`

However, to keep the patch smallest, I would probably avoid a new file and keep helpers local unless duplication becomes messy.

## Security/RBAC rules preserved

- Toggle UI remains shown only when `canViewPII` is true.
- Persistence stores only a boolean preference, not identifiers.
- Export inclusion condition is always `canViewPII && persistedToggleValue`.
- If localStorage is manually changed to `true` by a user without permission, identifiers still will not render or export.
- Real NARP references still use the existing `get_narp_identifiable_by_refs` RPC for identifier resolution.
- Demo refs continue to use the synthetic `DEMO_IDENTIFIABLE_DETAILS` path.
- No edge functions touched.
- No typecheck “fixes”.

## Files I would touch

1. `src/pages/NRESPopulationRisk.tsx`
   - Lift/persist toggle state per user.
   - Pass controlled toggle state into Top 25 and drawer.
   - Make `exportCohortCsv` toggle-aware.
   - Add Top 25 CSV export if required.

2. `src/components/nres/PatientDrillDrawer.tsx`
   - Accept controlled toggle state props.
   - Use shared persisted toggle state.
   - Make drawer CSV export include identifiers only when `canViewPII && toggleOn`.
   - Load identifiers for all exported rows before producing identifiable CSV.

No database migrations, no edge-function edits, no typecheck warning work.
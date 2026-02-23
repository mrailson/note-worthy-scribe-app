

## Edit Risk Register Entries

### Overview
Add inline and modal-based editing to the Project Risks Register, allowing users to modify the current risk score (Likelihood 1-5 x Consequence 1-5 = 1-25), mitigation text, key concerns, owner, last reviewed date, and assurance indicators (add, edit, delete).

### What Changes

**1. State Management for Editable Risks**
- Convert `projectRisks` from a static imported array to local React state in `SDARisksMitigation.tsx` using `useState`, seeded from the imported data.
- Track which risk is currently being edited via `editingRiskId` state.

**2. Edit Modal/Dialog for Each Risk**
- Add an "Edit" button (pencil icon) to each risk row in the table.
- Clicking opens a Dialog/modal pre-populated with that risk's current values:
  - **Current Score**: Two dropdown selects side-by-side — Likelihood (1-5) and Consequence (1-5) — with a live-calculated total displayed (e.g. "4 x 5 = 20") and the resulting rating badge.
  - **Mitigation**: Textarea field.
  - **Key Concerns**: Textarea field.
  - **Owner**: Text input field.
  - **Last Reviewed**: Date picker input (defaults to today's date in `MMM-YY` format).
  - **Assurance Indicators**: A list of current indicators, each with:
    - Editable text input
    - Completed checkbox toggle
    - Delete button (trash icon)
    - "Add Indicator" button at the bottom to append new entries.
- Save and Cancel buttons at the modal footer.

**3. Heatmap & Summary Auto-Update**
- Since the risks array is now state, the Risk Position Heatmap and summary badges (High/Significant/Escalation counts) will automatically recalculate when a risk is saved.

**4. Score Change Tracking**
- Original scores remain immutable — only `currentLikelihood`, `currentConsequence`, and `currentScore` are editable, preserving the trend indicators.

### Technical Details

**Files to modify:**
- `src/components/sda/SDARisksMitigation.tsx` — Add `useState` for risks array and editing state; add edit button column; import and render the new edit dialog.
- `src/components/sda/risk-register/projectRisksData.ts` — No changes needed (data stays as the initial seed).

**New file:**
- `src/components/sda/risk-register/RiskEditDialog.tsx` — The edit modal component containing all form fields, score calculator, and assurance indicator management.

**Key implementation details:**
- Uses existing `Dialog` component from `@/components/ui/dialog`.
- Uses existing `Select`, `Input`, `Textarea`, `Checkbox`, `Button` components.
- Score auto-calculates as `likelihood x consequence` when either dropdown changes.
- Rating badge updates live using the existing `getRatingFromScore` and `getRatingBadgeStyles` utilities.
- Assurance indicators managed via local array state within the dialog, with add/edit/delete operations.
- Last reviewed date uses a standard date input, formatted to `MMM-YY` on save.
- All changes are in-memory only (no database persistence) — consistent with the current static data approach.


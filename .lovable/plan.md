

## Plan: Enhance Policy Service Landing Page

### Changes to `src/pages/PolicyService.tsx`

**1. Remove Policy Checklist card**
Remove the "Policy Checklist" entry from the `actionCards` array (lines 30-37).

**2. Restyle Practice Profile Defaults card**
Render it separately from the main grid as a subtle banner/setup prompt — e.g. a bordered card with a dashed border style, muted background, and a "one-time setup" badge. Position it above or below the main action cards grid.

**3. Add completed policy count badge to My Policies card**
- Import and use `usePolicyCompletions` hook to get `completions.length`
- Show a badge like "12 policies" on the My Policies card (only for completed status, not in-progress)
- Keep existing in-progress badge from `activeJobCount` alongside

**4. Add collapsed "How This Works" section**
Add a `Collapsible` section below the action cards (before the stats section) with a step-by-step guide:
1. **Set up your profile** — Configure practice details and key personnel
2. **Choose a policy** — Browse 90+ templates across 6 categories  
3. **Generate** — AI creates a CQC-compliant policy tailored to your practice (5-10 mins)
4. **Review & download** — View, edit, and export as Word document

Use numbered steps with icons, clean layout, collapsed by default with a "How does this work?" trigger.

### Summary of structural changes
- Remove 1 card (Checklist)
- Extract 1 card (Profile Defaults) into a separate styled banner
- Add badge count from `usePolicyCompletions` to My Policies
- Add collapsible instructions section


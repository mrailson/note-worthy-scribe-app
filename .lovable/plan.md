

## Targeted Prompt Injections for Haiku CQC Compliance

Two surgical edits to the edge function prompts — no structural changes, no new steps, zero latency impact.

### Change 1: PART2A_SYSTEM_ADDITION (line 223-234)

Append a mandatory content block after the existing `CRITICAL` instruction, before the `Do NOT` lines. This block enumerates the four items Haiku keeps missing in Section 5:

- **SNOMED CT codes** subsection with specific code categories for SystmOne
- **Home visits** subsection covering housebound patient screening
- **Trans/non-binary patients** named subsection with manual recall and sensitivity guidance
- **Failsafe** — explicit use of the word "failsafe" in the three-contact escalation heading

### Change 2: PART3A_SYSTEM_ADDITION (line 248-256)

Append a mandatory equality monitoring requirement to Section 8. Specifies:

- Monitoring uptake by protected characteristic (age, disability, ethnicity minimum)
- How findings are reviewed and actioned
- Minimum annual reporting frequency
- Distinction from the Equality Impact Assessment in the document header

### File: `supabase/functions/generate-policy/index.ts`

Both changes are additive text within existing prompt constants — no logic, routing, or token budget changes needed. Redeploy the edge function after editing.


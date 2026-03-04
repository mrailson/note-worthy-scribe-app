

## Plan: Replace Policy Generator System Prompts

Two targeted edits to replace the system prompts in both edge functions with the user-provided text.

### Change 1: `supabase/functions/generate-policy/index.ts`
- Replace the `systemPrompt` constant (lines 13–111) with the new prompt text provided
- Key additions vs current: `⚠️[VERIFY CURRENCY]` inline flags, `GUIDANCE CURRENCY RULE` section, `GUIDANCE CURRENCY NOTICE` box in Section 10
- Removal: "Reference current (2024/2025) guidance and legislation only" replaced with the verify-currency approach
- Structure otherwise identical — header template, sections 1–11, version history all preserved

### Change 2: `supabase/functions/enhance-policy/index.ts`
- Replace the `POLICY_ENHANCEMENT_SYSTEM_PROMPT` constant (lines 9–462) with the new prompt text
- Key additions vs current: `KNOWN GUIDANCE CHANGES` section at top (cervical screening intervals, flexible working day-one right, Working Together 2023, ReSPECT/Tracey, DSPT 2024/25)
- Updated user message template (line 507–512) to match the new format: `Please review and enhance the following {policyType} policy for {practiceName} (ODS: {odsCode})...`
- Output format now includes item 3 (apply known guidance changes), item 8 (GUIDANCE CURRENCY NOTICE box)
- All 90 policy-specific requirements restructured with more detail (e.g., cervical screening now includes HPV history caveat, NHS App channel)

### Deployment
Both edge functions will need redeploying after the edits.

### No database or frontend changes required.


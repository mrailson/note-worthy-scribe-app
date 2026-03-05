

## Plan: Embed Full 16-Point Mandatory Guidance Overrides into Policy Generation Pipeline

### Current State
The `generate-policy/index.ts` edge function currently includes only 5 of the 16 overrides in its prompts (cervical screening, flexible working, safeguarding children 2023, DNACPR/ReSPECT, DSPT 2024/25). The remaining 11 are missing entirely.

### Changes Required

**File: `supabase/functions/generate-policy/index.ts`**

1. **Expand `ENHANCEMENT_SYSTEM_PROMPT` guidance section** (lines 23–46) — replace the current 5-item block with the full 16-point override list covering:
   - Clinical: chaperone (GMC 2024 + NHS England Dec 2025), safeguarding adults (Care Act 2023), sepsis (NG51 2024), IPC (UKHSA 2023), antimicrobial stewardship (2024), DNACPR/ReSPECT
   - HR: carer's leave (Apr 2024), neonatal care leave (Apr 2025), sexual harassment prevention duty (Oct 2024), menopause workplace adjustments (EHRC 2024)
   - IG: SAR guidance (ICO 2023)
   - GP Contract 2026/27

2. **Expand `BASE_SYSTEM_PROMPT`** (lines 88–107) — add the same 16-point block so that the initial generation steps (parts 1–3) also produce correct content from the outset, reducing reliance on the enhance step to fix errors.

3. **Add post-processing regex replacements in `sanitisePolicyOutput`** (line 367) — deterministic find-and-replace for the most common AI mistakes that prompting alone cannot guarantee:
   - Replace "Working Together 2018" → "Working Together 2023"
   - Replace "DSPT 2022/23" or "DSPT 2023/24" → "DSPT 2024/25"
   - Replace "NG51 (2016)" → "NG51 (2024)"
   - Replace cervical screening "3 years"/"three years" in HPV-negative context → "5 years"/"five years" (preserving the pre-2019 exception)
   - Replace "26-week qualifying period" for flexible working → "day-one right"
   - Replace "PHE" IPC references → "UKHSA"

This two-layer approach (prompt instructions + deterministic post-processing) ensures compliance even when the model ignores prompt instructions.

### No other files affected
All changes are confined to the single edge function file. The function will be redeployed automatically.


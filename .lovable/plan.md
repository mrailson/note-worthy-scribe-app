

## Remove "Signature placement" Radio Choice

The "Append signature page" vs "Stamp signature block" radio group on the setup page will be removed. The system will always default to `stamp` mode, which feeds into the Block/Separated position picker.

### Changes — `CreateApprovalFlow.tsx`

1. **Remove the radio group UI** (lines ~497–525) — delete the entire "Signature placement" section with the append/stamp radio buttons
2. **Hardcode `signatureMethod` to `'stamp'`** — remove the `useState` setter, keep it as a constant
3. **Remove append-related logic** — the placement object construction already handles stamp; just remove the `append` branch
4. **Simplify flow logic** — the step progression currently conditionally skips `stamp_position` for append mode; simplify to always include it
5. **Clean up progress bar** — remove the conditional that shows different steps based on `signatureMethod`; always show `['upload', 'signatories', 'stamp_position', 'review']`
6. **Clean up imports** — remove `FileSignature` icon if no longer used, and `RadioGroup`/`RadioGroupItem` if not used elsewhere on the page


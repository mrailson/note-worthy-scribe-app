I’ll update the NRES SDA claim form in two small areas.

1. Make the Practice Note box visually clear
- Change the Practice Note textarea background from off-white/grey to pure white.
- Strengthen the border slightly so it reads clearly as an editable text box.
- Keep the existing placeholder, character limit and submission behaviour unchanged.

2. Allow multiple files for “Other Supporting Evidence”
- Update the claim-level “Other Supporting Evidence” slot so it can accept multiple files rather than only one.
- Allow multiple file selection from the Upload button.
- Allow multiple pasted files/screenshots via the existing Ctrl+V paste facility.
- Upload each selected/pasted file under the same `other_supporting` evidence type.
- Continue to show uploaded files and allow deletion/download of each file.

3. Preserve mandatory evidence behaviour
- Keep mandatory evidence slots as single-file where they are currently designed that way.
- Only change the flexible “Other Supporting Evidence” upload behaviour, so required evidence validation is not disrupted.

Technical details
- `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`: adjust the inline textarea style for the Practice Note area.
- `src/components/nres/hours-tracker/ClaimEvidencePanel.tsx`: change the claim-level `other_supporting` rendering to use the multi-file `SmartUploadZone`, matching the existing staff-line multi-file upload pattern.
- `src/hooks/useNRESClaimEvidence.ts`: if needed, expose grouped/all evidence files by evidence type so multiple `other_supporting` files can be displayed instead of the current single-file map overwriting earlier files of the same type.

Expected result
- The Practice Note area will look like a clear white text input.
- Users can attach several “Other Supporting Evidence” files in one go, including via Ctrl+V paste.
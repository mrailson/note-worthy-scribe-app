
# Plan: Update Complaint Email Domain, Email Template, and Response Page Mic Input

## Summary
Three changes are required:
1. Replace all `notewell.dialai.co.uk` domain references with `gnotewell.co.uk`
2. Update the complaint notification email subject and content to match the revised format
3. Replace the mic engine dropdown and AudioWorklet/Legacy mic components on the Complaint Response page with the simple Web Speech API mic used in Ask AI

---

## Change 1: Domain Update (`notewell.dialai.co.uk` to `gnotewell.co.uk`)

Three edge functions reference the old domain:

- **`supabase/functions/send-complaint-notifications/index.ts`** (line 141): `baseUrl` used for complaint response links
- **`supabase/functions/send-magic-link/index.ts`** (lines 83-84): `Origin` and `Referer` headers
- **`supabase/functions/send-email-via-emailjs/index.ts`** (line 126): `login_url` in email data

All instances of `https://notewell.dialai.co.uk` will be replaced with `https://gnotewell.co.uk`.

---

## Change 2: Email Template Update

**File:** `supabase/functions/send-complaint-notifications/index.ts`

Update the email subject line (line 256) from:
```
Complaint Input Request - {reference}
```
to:
```
Complaint Input Request - {reference} ({practice_name})
```

Update the email HTML body to match the revised wording. Key changes:
- Opening paragraph: "You are requested to provide input as part of a formal complaint investigation and learning review..." (replacing "You have been requested to provide input for the following complaint investigation")
- Add reassurance line: "Your contribution will help us understand the events from different perspectives and support service improvement. This request is not a disciplinary process."
- Update the "Important Information" section bullets to match the revised wording (e.g., "Your response will form part of the complaint investigation and outcome" instead of "used as part of the investigation process", and add "in line with NHS complaints guidance")
- Update closing: "Kind regards" instead of "Best regards", and "Complaint Management System" instead of "Complaints Team"

---

## Change 3: Replace Mic Input on Complaint Response Page

**File:** `src/pages/ComplaintResponse.tsx`

Currently the page has:
- A dropdown to select between "New mic (AudioWorklet)" and "Legacy mic"
- Two mic components: `ComplaintMicRecorderV2` (AudioWorklet) and `ComplaintMicRecorder` (Legacy AssemblyAI)
- Both use external transcription services (AssemblyAI)

This will be replaced with a single `SimpleBrowserMic` component (the same one used in Ask AI), which uses the browser's built-in Web Speech API -- no external service needed and works well for simple voice input.

### Technical Details
- Remove the `micEngine` state and the `<select>` dropdown
- Remove imports for `ComplaintMicRecorder` and `ComplaintMicRecorderV2`
- Add import for `SimpleBrowserMic` from `@/components/ai4gp/SimpleBrowserMic`
- The `SimpleBrowserMic` sends the full accumulated transcript on each update (not deltas), so the `onTranscriptUpdate` handler will be simplified to set the response directly rather than appending
- The mic button styling in `SimpleBrowserMic` is currently 96x96px (designed for Ask AI modal) -- this is fine for the complaint response page as it gives a clear, prominent voice input target
- Remove the "Mic" label and engine selector UI, leaving just the mic button and the "Load Demo" button

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/send-complaint-notifications/index.ts` | Domain update + email template revision |
| `supabase/functions/send-magic-link/index.ts` | Domain update |
| `supabase/functions/send-email-via-emailjs/index.ts` | Domain update |
| `src/pages/ComplaintResponse.tsx` | Replace mic dropdown with SimpleBrowserMic |

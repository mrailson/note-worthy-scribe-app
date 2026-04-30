# Fix: SDA Verification "Preview invoice" shows "This content is blocked"

## Root cause

The Invoice preview dialog (`InvoicePreviewDialog` in `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`, line 86) renders the generated PDF inside an `<iframe>` whose `src` is a `blob:` URL created by `URL.createObjectURL(pdfDoc.output('blob'))`.

The app's client-side Content Security Policy in `src/components/SecurityWrapper.tsx` (line 23) currently sets:

```
frame-src 'self' https://dphcnbricafkbtizkoal.supabase.co https://*.elevenlabs.io
```

This does **not** include `blob:`, so Chrome blocks the iframe and shows the standard "This content is blocked. Contact the site owner to fix the issue." page — exactly what the screenshot shows on `gpnotewell.co.uk`. (It works fine in the Lovable preview because preview iframes inherit a more permissive policy.)

The same CSP already correctly allows `blob:` for `script-src`, `img-src`, `media-src`, and `worker-src` — `frame-src` was simply missed.

## Change

In `src/components/SecurityWrapper.tsx`, update the `frame-src` directive only:

- Add `blob:` so the generated PDF blob URL can be embedded.
- (Defensive) also add `data:` for parity with the other directives, since some PDF preview flows fall back to data URLs.

New value:

```
frame-src 'self' blob: data: https://dphcnbricafkbtizkoal.supabase.co https://*.elevenlabs.io
```

No other directive, no other file, and no application logic is touched. The existing Supabase and ElevenLabs frame allowances are preserved, so storage previews and the voice agent widget are unaffected.

## Why this is safe

- `blob:` URLs are same-origin and created only by our own code (jsPDF in `generateInvoicePdf`); they cannot be forged from a remote attacker.
- `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'` remain unchanged.
- The `X-Frame-Options: DENY` header (set later in the same component) only restricts who can frame **us**, not what we can frame, so it does not conflict.

## Verification after deploy

1. Open SDA → SDA Claims → Managerial Lead Verification queue → click "Preview invoice" on a verified claim. The PDF should render inline in the dialog instead of showing "This content is blocked".
2. Confirm no new CSP violations appear in the browser console for unrelated frames (Supabase storage previews, ElevenLabs widget).

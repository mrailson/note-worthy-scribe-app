
## Root cause

The `render-practice-letterhead` edge function fails to boot. Logs show:

```
event loop error: Error: unsupported arch/platform: Not supported
  at .../imagescript/1.3.0/codecs/node/index.js
```

`imagescript@1.3.0` pulled via `npm:` tries to load a **native Node addon** (the same class of failure that killed the previous `@napi-rs/canvas` attempt). Because the import is at the top of the file, the entire function refuses to start — so PDF, DOCX **and** image uploads all return *"Failed to send a request to the Edge Function"*.

There is also a **latent second bug**: the PDF path uses `pdfjs.SVGGraphics`, which was **removed in pdfjs-dist v4**. Once imagescript is fixed, PDF uploads would still throw *"PDF rendering not supported in this runtime build."*

## Fix plan (edge function only — zero changes to complaints UI, DB schema, RLS, storage layout, or letter-generation call sites)

### 1. Replace `imagescript` with a pure-WASM image decoder

Swap `npm:imagescript@1.3.0` → `npm:@cf-wasm/photon@0.1.x` (pure WASM, runs on Deno edge) **or** `jsr:@img/png` + `jsr:@img/jpeg` (Deno-native, no native binaries).

Preferred: `@cf-wasm/photon` — single dep, supports decode/encode PNG/JPEG, flatten transparency, and width check.

### 2. Replace pdfjs SVG path with a WASM-only PDF rasteriser

`pdfjs-dist@4` removed `SVGGraphics`. Swap to `npm:@hyzyla/pdfium@2.x` (pdfium compiled to WASM) which renders PDF pages directly to PNG bytes. No SVG intermediate, no resvg needed for the PDF path.

### 3. Keep DOCX path, but render via the same image library

`mammoth` extraction stays. Replace the SVG-then-resvg layout with a small text-on-white PNG built via the new image lib (or keep `@resvg/resvg-wasm` only for the DOCX SVG → PNG step, since resvg-wasm is pure WASM and works fine — it's only `imagescript` that's broken).

### 4. Defensive boot

Wrap heavyweight imports in dynamic `await import()` inside the request handler so a broken dep returns a clean 500 with a useful message instead of preventing the function from booting (which produces the unhelpful *"Failed to send a request to the Edge Function"*).

### 5. Redeploy `render-practice-letterhead` only

No other functions touched. No DB migration. No frontend change.

## What stays untouched (safety guarantees)

- `practice_letterheads` table, RLS, `can_manage_practice_letterhead` RPC — unchanged.
- `practice-letterheads` storage bucket + paths (`{practice_id}/originals/...`, `{practice_id}/rendered/...`) — unchanged.
- `LetterheadSettings.tsx` UI, dropzone, preview, layout controls — unchanged.
- `practiceLetterhead.ts` resolver and all five letter-generation call sites (Complaints acknowledgement/outcome, DOCX + email) — unchanged. They already gracefully fall back to the Notewell default when no active letterhead exists, so the existing complaints flow continues to work end-to-end while the upload path is being repaired.

## Verification after fix

1. Deploy → check `supabase--edge_function_logs` shows `booted` with no event-loop error.
2. Upload a PNG ≥ 2480px → expect 200 + row in `practice_letterheads`.
3. Upload a single-page PDF → expect 200.
4. Upload a DOCX → expect 200.
5. Generate one acknowledgement DOCX from Complaints → confirm the rendered PNG appears in the letter header at the configured height/alignment.
6. Delete the letterhead → confirm complaints letters revert cleanly to the Notewell default banner (regression check).

## Risks & mitigations

- **pdfium WASM cold-start (~2–3 s)**: acceptable for an admin upload action; cached after first invoke.
- **Photon API differences vs imagescript**: contained to `renderImageToPng()` — single function, easy to unit-test via curl.
- **No schema or contract change**: rollback = redeploy previous function version.

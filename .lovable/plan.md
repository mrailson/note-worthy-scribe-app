
Goal: remove the CSP conflicts that can block Safari iPhone script execution, and keep a universal fallback instead of a blank screen.

What I found in the current code:
- `index.html` already has no static CSP meta tag. That part is effectively done.
- `src/components/SecurityWrapper.tsx` still defines CSP twice:
  - once in `useEffect`
  - once again via `<Helmet><meta httpEquiv="Content-Security-Policy" ... /></Helmet>`
- The active `useEffect` CSP already does not use `script-src-elem` or `style-src-elem`.
- `src/components/ChunkLoadErrorBoundary.tsx` already catches all errors in `getDerivedStateFromError`, but it still has chunk-specific comments/logging and an automatic reload path.

Implementation plan:
1. Keep `index.html` unchanged except to verify there is still no CSP meta tag added back
- No runtime CSP should exist there.
- This avoids parse-time CSP blocking the app before React starts.

2. Make `SecurityWrapper.tsx` the only CSP source
- Remove the `<meta httpEquiv="Content-Security-Policy" ... />` from the `<Helmet>` block.
- Keep the `useEffect` CSP injection as the single runtime source of truth.
- Add `worker-src 'self' blob:` to the `cspHeader` string.
- Leave `script-src-elem` and `style-src-elem` absent everywhere.
- Keep the non-CSP Helmet meta tags (`Permissions-Policy`, etc.) unless they are also duplicated elsewhere.

3. Clean up `ChunkLoadErrorBoundary.tsx` so it behaves like a true global fallback
- Keep `getDerivedStateFromError` catching all errors.
- Remove the chunk-specific assumption in comments/logging text.
- Remove the automatic reload/sessionStorage loop so errors surface as the fallback UI instead of bouncing silently.
- Keep a simple fallback with reload action: “Something went wrong” / “Tap to reload”.

4. Limit scope strictly to the requested files
- `src/components/SecurityWrapper.tsx`
- `src/components/ChunkLoadErrorBoundary.tsx`
- No changes to recorder, wake lock, Whisper cleaner, or other mobile logic.

Expected result:
- Safari iPhone no longer gets multiple intersecting CSPs.
- Script execution is no longer blocked by duplicate/competing policies.
- If any separate runtime error still exists, users see a fallback instead of a blank white screen, making the next issue debuggable.

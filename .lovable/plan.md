

## Problem
When Gamma generates a PPTX, two URLs are returned:
- `downloadUrl` — direct PPTX file link on Gamma's CDN (temporary, may expire)
- `gammaUrl` — link to the presentation on Gamma's platform (could expose other Gamma content)

Currently, the `gammaUrl` is exposed as a "View / Edit" button in the complaints briefing suite, and download URLs are ephemeral Gamma CDN links that may expire. Nothing is persisted to your own storage.

## Plan

### 1. Proxy-download and store the PPTX in Supabase Storage (edge function)
Modify `generate-powerpoint-gamma/index.ts` so that when a generation completes (poll returns `completed`), the edge function:
- Fetches the PPTX binary from Gamma's `downloadUrl`
- Uploads it to the existing `ai4pm-assets` Supabase Storage bucket under `{user_id}/presentations/{timestamp}-{title}.pptx`
- Returns the **Supabase Storage public URL** as `downloadUrl` instead of the Gamma CDN URL
- **Does not return `gammaUrl`** at all — strip it from the response

This ensures the user always gets a persistent, private download link.

### 2. Remove all `gammaUrl` exposure from the UI
- **`ExecutiveBriefingSuite.tsx`**: Remove the "View / Edit" button that links to `gammaUrl`
- **`useComplaintPowerPoint.ts`**: Stop saving `powerpoint_gamma_url` to the database; remove `gammaUrl` from persisted data
- **`usePresentationStudio.ts`**: Remove `gammaUrl` from the `GeneratedPresentation` result object
- **`useGammaPowerPoint.ts`**: Remove `gammaUrl` from return values
- **`useMeetingPowerPoint.ts`**: Remove `gammaUrl` from return values
- **Type definitions** (`presentationStudio.ts`, `ai4gp.ts`): Remove `gammaUrl` field from interfaces

### 3. Ensure download links use stored Supabase URLs
- In `useGammaPowerPoint.ts`, after polling completes, the `downloadUrl` will already point to Supabase Storage (from the updated edge function), so the existing `downloadFromUrl` logic works unchanged
- In `usePresentationStudio.ts`, same — the stored URL replaces the Gamma CDN URL
- The existing `uploadToStorage` helper in `useGammaPowerPoint.ts` can be reused if the edge function approach isn't feasible (client-side fallback: fetch PPTX from Gamma URL, re-upload to storage)

### 4. Security: user-scoped storage paths
The upload path `{user_id}/presentations/...` combined with Supabase Storage RLS ensures users can only access their own files. No changes needed to RLS if the bucket already has user-scoped policies.

### Files to modify
- `supabase/functions/generate-powerpoint-gamma/index.ts` — fetch + store PPTX, strip `gammaUrl`
- `src/components/complaints/ExecutiveBriefingSuite.tsx` — remove "View / Edit" Gamma link
- `src/hooks/useComplaintPowerPoint.ts` — remove `gammaUrl` persistence
- `src/hooks/useGammaPowerPoint.ts` — remove `gammaUrl` from results
- `src/hooks/useMeetingPowerPoint.ts` — remove `gammaUrl` from results  
- `src/hooks/usePresentationStudio.ts` — remove `gammaUrl` from results
- `src/types/presentationStudio.ts` — remove `gammaUrl` from `GeneratedPresentation`
- `src/types/ai4gp.ts` — remove `gammaUrl` from `GeneratedPresentation`


## NRES PPG Patient Survey — Implementation Plan

Build a public, anonymous patient feedback survey at `/nres/ppgsurvey`, converting the uploaded HTML 1:1 into a React component with Supabase backend, anonymous submission edge function, email notifications, and a minimal admin view.

### 1. Database (migration)

New table `public.nres_ppg_responses`:
- `id`, `submitted_at`, `practice_id` (CHECK in 8-value list), `practice_label`, `rating` (CHECK better/same/worse), `followup_reason`, `followup_label`, `comment` (≤400 chars), `user_agent`, `submission_token`
- Table-level CHECK: `rating <> 'worse' OR followup_reason IS NOT NULL`
- RLS enabled
  - INSERT policy for `anon` role
  - SELECT policy for `authenticated` users with admin role (via existing `has_role` pattern — verify which role enum exists)

New table `public.email_failures`:
- `id`, `created_at`, `response_id`, `error_message`, `payload jsonb`
- RLS: admin-only SELECT, service role INSERT

New table `public.nres_ppg_rate_limit` (or use in-memory):
- `submission_token`, `created_at` — to count per-token submissions in last hour
- Plus a global hourly counter approach

Index on `submitted_at DESC` and `practice_id`.

### 2. Edge function `submit-ppg-response` (verify_jwt = false)

- CORS preflight
- Honeypot check → silent 200
- Zod validation of body
- Compute `submission_token = SHA-256(client_ip + daily_salt + user_agent)` where daily_salt = secret `PPG_DAILY_SALT_BASE` + UTC date string. IP read from `x-forwarded-for`, never stored.
- Rate limit: count rows in last hour for token (>5 → 429); count global rows (>200 → 429)
- Insert row with service role
- Send email via Resend (use existing `RESEND_API_KEY` if present, otherwise prompt to add)
- On email failure → insert into `email_failures`, still return 200
- Return `{ success: true }`

### 3. Email

Sent via Resend from `NRES Patient Feedback <noreply@gpnotewell.co.uk>` to `malcolm.railson@nhs.net`. HTML + plain text per spec. Subject template per spec.

### 4. React route

- New page `src/pages/NRESPpgSurvey.tsx` — full 1:1 port of uploaded HTML using inline `<style>` block and the same DOM/JS state, wrapped in React with `useState` for screen flow. Keep all classes, colors, animations, accessibility attributes exactly as built.
- Inject `<meta name="robots" content="noindex,nofollow">` and the page title via `document.title` / a `<Helmet>`-style effect (project does not use Helmet — use `useEffect` to set `document.title` and append meta tag).
- Hidden honeypot input `website`.
- Submit POSTs to edge function via `supabase.functions.invoke`.
- Loading + error states per spec.
- Add route `/nres/ppgsurvey` in `src/App.tsx` OUTSIDE any auth-guarded layout, plain `<NRESPpgSurvey />` (no sidebar/header chrome).

### 5. Admin view

- New page `src/pages/AdminNRESResponses.tsx` at `/admin/nres-responses`, behind existing admin guard.
- Fetches rows via Supabase client (RLS allows admins).
- Filter chips by practice & rating, count tile, CSV download (client-side blob), comment truncation with toggle.

### 6. Test data

After deploy, insert two test rows directly via SQL/edge function call and trigger two `[TEST]`-prefixed emails to `malcolm.railson@nhs.net`.

### Open questions / assumptions

1. **Admin role check** — Project uses a `has_role` pattern. I'll reuse the existing admin role detection (will inspect `useEnhancedAuth` / role hooks before writing the admin page).
2. **Resend** — I'll check `secrets--fetch_secrets` for `RESEND_API_KEY`. If missing, I'll request it via `add_secret`.
3. **Sender domain** — `noreply@gpnotewell.co.uk` requires `gpnotewell.co.uk` to be a verified Resend sender domain. I'll proceed using it as specified; if Resend rejects, the email will land in `email_failures` (submission still succeeds).
4. **Daily salt** — I'll add a secret `PPG_DAILY_SALT_BASE` (random string) and combine with UTC date. If you'd rather I generate and store it inline, let me know.
5. **Rate-limit storage** — using a small `nres_ppg_rate_limit` table keyed by `submission_token` so counts survive cold starts.

### Technical notes

- Edge function uses `npm:` specifiers, `Deno.serve()`, inline CORS headers, service role for inserts.
- 1:1 HTML preservation: the converted component will render the original `<style>` block scoped to a wrapper div with a unique class to avoid colliding with Tailwind/global styles. No Tailwind rewrite — preserves visuals exactly.
- No localStorage / cookies / analytics.

Shall I proceed?

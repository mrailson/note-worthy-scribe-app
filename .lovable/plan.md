
# Send Security Report via Email

## Overview

Add a "Send Security Report" button to the Security Report page that compiles recent login rate limit events and security events into a professionally formatted HTML email and sends it to your address (malcolm.railson@nhs.net) via the existing Resend infrastructure.

---

## Changes

### 1. New edge function: `send-security-report`

**File:** `supabase/functions/send-security-report/index.ts`

Create a new authenticated edge function that:

- Accepts `{ recipient_email: string, days?: number }` (defaults to last 30 days)
- Queries `login_rate_limits` for all entries within the period, ordered by most recent first
- Queries `security_events` for all entries within the period
- Builds a professional HTML email report containing:
  - **Summary header** with total counts (login attempts, blocked attempts, unique IPs, unique emails)
  - **Rate Limit Events table** showing date/time (UK format), IP address, email attempted, browser/OS (parsed from user agent), and blocked status
  - **Security Events table** (if any) showing event type, severity, user email, IP, and timestamp
  - Geolocation is not fetched (too slow for bulk; can be added later)
- Sends via Resend using the existing `noreply@bluepcn.co.uk` verified domain
- Subject line: "Notewell Security Report -- DD Month YYYY"
- Requires authentication (only logged-in users can trigger)

The function follows the same patterns as `notify-login-rate-limit` for HTML styling and `send-email-resend` for Resend usage.

### 2. Add "Email Report" button to Security Report page

**File:** `src/pages/SecurityReport.tsx`

- Add a `Mail` icon button next to the existing "Re-scan" button in the header area (line 184-197)
- On click, calls `supabase.functions.invoke('send-security-report', { body: { recipient_email: 'malcolm.railson@nhs.net' } })`
- Shows a loading spinner while sending, then a success/error toast
- Button label: "Email Report"

### 3. Register in config.toml

**File:** `supabase/config.toml`

Add entry for the new function with `verify_jwt = false` (auth validated in code).

---

## Files Modified

| File | Summary |
|------|---------|
| `supabase/functions/send-security-report/index.ts` | New edge function: queries rate limit and security event data, builds HTML report, sends via Resend |
| `src/pages/SecurityReport.tsx` | Add "Email Report" button next to Re-scan button |
| `supabase/config.toml` | Register new edge function |

## What Does NOT Change

- Database schema (read-only queries against existing tables)
- Existing email functions
- Security scan logic
- Rate limiting behaviour

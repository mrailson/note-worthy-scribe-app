

## Magic Link Rate Limiting with Admin Notification

### Overview
This plan implements a server-side rate limiting mechanism for the magic link feature that:
- Tracks requests by IP address over a 5-minute window
- Blocks requests after 2 attempts from the same IP within 5 minutes
- Enforces a 5-minute cooldown when the limit is exceeded
- Sends an email notification to the system admin with full request details

---

### Technical Architecture

```text
┌─────────────────────┐
│  MagicLinkRequest   │
│    (Frontend)       │
│                     │
│ - Sends email only  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│         generate-magic-link                 │
│           (Edge Function)                   │
│                                             │
│ 1. Extract IP, User-Agent, email from req   │
│ 2. Query magic_link_rate_limits table       │
│ 3. Check if IP has >2 requests in 5 mins    │
│    ├─ YES: Return 429 + trigger alert       │
│    └─ NO: Log request, proceed with link    │
│ 4. Generate and send magic link             │
└──────────┬──────────────────────────────────┘
           │
           ▼ (if rate limited)
┌─────────────────────────────────────────────┐
│      notify-admin-rate-limit                │
│         (Edge Function)                     │
│                                             │
│ - Fetch IP geolocation (ip-api.com)         │
│ - Parse browser from User-Agent             │
│ - Send email to malcolm.railson@nhs.net     │
│   with: IP, email, browser, date/time,      │
│   location (if available)                   │
└─────────────────────────────────────────────┘
```

---

### Implementation Steps

#### Step 1: Create Database Table for Rate Limiting

Create a new table `magic_link_rate_limits` to persist rate limit tracking across edge function cold starts:

```sql
CREATE TABLE public.magic_link_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email_requested TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE
);

-- Index for fast lookups by IP and time window
CREATE INDEX idx_magic_link_rate_ip_time 
  ON public.magic_link_rate_limits(ip_address, created_at DESC);

-- Auto-cleanup old records (older than 1 hour)
-- This keeps the table small
```

Enable RLS and create policies for service role access only.

---

#### Step 2: Create Admin Notification Edge Function

Create a new edge function `notify-admin-rate-limit` that:

1. Accepts: IP address, email attempted, user agent, timestamp
2. Fetches geolocation from ip-api.com (free tier, no API key required)
3. Parses browser type from User-Agent string
4. Sends formatted email to system admin (malcolm.railson@nhs.net) via Resend

**Email content will include:**
- Alert title: "Magic Link Rate Limit Exceeded"
- IP Address
- Email address entered
- Browser type (parsed from User-Agent)
- Date and time (UK format: DD/MM/YYYY HH:mm)
- Location (city, country) if available from geolocation
- Request count in window

---

#### Step 3: Update generate-magic-link Edge Function

Modify the existing function to:

1. **Extract client information:**
   - IP from `x-forwarded-for` or `cf-connecting-ip` headers
   - User-Agent from headers
   - Email from request body

2. **Check rate limit:**
   - Query `magic_link_rate_limits` for records from this IP in past 5 minutes
   - If count >= 2, block request and trigger notification

3. **Log all requests:**
   - Insert record into `magic_link_rate_limits` table

4. **Handle blocked requests:**
   - Return 429 status with clear message
   - Calculate remaining cooldown time
   - Call `notify-admin-rate-limit` function

---

#### Step 4: Update Frontend to Handle Rate Limiting

Update `MagicLinkRequest.tsx` to:

1. Handle 429 response gracefully
2. Show user-friendly message with countdown
3. Disable the submit button during cooldown
4. Display remaining wait time

---

### Files to be Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/notify-admin-rate-limit/index.ts` | Create | New edge function for admin alerts |
| `supabase/functions/generate-magic-link/index.ts` | Modify | Add rate limit checking and logging |
| `src/components/MagicLinkRequest.tsx` | Modify | Handle 429 responses with countdown |
| Database migration | Create | Add `magic_link_rate_limits` table |

---

### Security Considerations

1. **Database-backed rate limiting**: Unlike in-memory rate limiting (which resets on cold starts), this persists across function invocations
2. **IP-based tracking**: Uses the most reliable IP extraction from Cloudflare/proxy headers
3. **No sensitive data in logs**: Email addresses are logged but passwords/tokens are never stored
4. **Automatic cleanup**: Old records are periodically purged to prevent table bloat
5. **Security event logging**: Rate limit violations are also logged to the existing `security_events` table

---

### Admin Notification Email Format

```text
Subject: ⚠️ Magic Link Rate Limit Alert - Notewell AI

RATE LIMIT EXCEEDED
━━━━━━━━━━━━━━━━━━━

An IP address has exceeded the magic link request limit.

Details:
• IP Address: 123.45.67.89
• Email Requested: suspicious.user@nhs.net
• Browser: Chrome 120 on Windows 10
• Date/Time: 01/02/2026 14:35
• Location: London, United Kingdom
• Requests in 5 min window: 3

This may indicate:
- A user having difficulty logging in
- An automated attack attempt
- Shared IP (e.g., NHS network)

The IP is now blocked from magic link requests for 5 minutes.
```

---

### Rate Limiting Logic

```text
Request arrives
      │
      ▼
Get IP from headers
      │
      ▼
Query DB: COUNT(*) WHERE ip = ? AND created_at > NOW() - 5 mins
      │
      ├─── count < 2 ───► Log request, proceed with magic link
      │
      └─── count >= 2 ──► Block request
                              │
                              ├─► Return 429 with wait time
                              │
                              ├─► Log to security_events
                              │
                              └─► Send admin notification
```

---

### Testing Approach

After implementation:
1. Request a magic link once - should succeed
2. Request again immediately - should succeed (2nd request)
3. Request a third time - should be blocked with 429 and countdown shown
4. Verify admin email is received with correct details
5. Wait 5 minutes, try again - should succeed


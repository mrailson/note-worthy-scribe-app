

## Prevent Magic Link Creating Users (with Generic Response)

### Problem
The `generate-magic-link` edge function automatically creates new users when a magic link is requested for an unregistered email. This is default Supabase behaviour with `auth.admin.generateLink()`.

### Solution
Add a user existence check before generating the link. Crucially, return the **same success message** whether the user exists or not - this prevents attackers from discovering which emails are registered.

---

### Security Approach

| Scenario | Backend Action | User Sees |
|----------|---------------|-----------|
| User exists | Generate link, send email | "If your email is registered, you'll receive a login link shortly." |
| User doesn't exist | Log attempt, do nothing | "If your email is registered, you'll receive a login link shortly." |

The identical response prevents email enumeration attacks.

---

### Implementation Steps

#### 1. Create Database Function
Add a helper function to check if a user exists by email (queries `auth.users` safely).

```sql
CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(email_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = lower(email_param)
  );
$$;

REVOKE ALL ON FUNCTION public.check_user_exists_by_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email TO service_role;
```

#### 2. Update Edge Function
Modify `supabase/functions/generate-magic-link/index.ts`:

**After rate limit check, before `generateLink`:**
```typescript
// Check if user exists BEFORE generating magic link
const { data: userExists, error: checkError } = await supabaseAdmin.rpc(
  'check_user_exists_by_email', 
  { email_param: email }
);

if (checkError) {
  console.error("Error checking user existence:", checkError);
}

// If user doesn't exist, log the attempt but return same success message
if (!userExists) {
  console.log("Magic link requested for non-existent user:", email);
  
  // Log to security events for monitoring
  await supabaseAdmin.from("magic_link_rate_limits").insert({
    ip_address: clientIP,
    email_requested: email,
    user_agent: userAgent,
    blocked: true  // Mark as blocked (no link generated)
  });

  // Return SAME message as success - prevents enumeration
  return new Response(
    JSON.stringify({
      success: true,
      message: "If your email is registered, you'll receive a login link shortly.",
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

// User exists - proceed with actual link generation...
```

#### 3. Update Frontend Success Message
Modify `src/components/MagicLinkRequest.tsx` to display the generic message:

Change the success toast/message from specific wording to:
> "If your email is registered, you'll receive a login link shortly."

---

### Files to Modify

| File | Change |
|------|--------|
| Database migration | Create `check_user_exists_by_email` function |
| `supabase/functions/generate-magic-link/index.ts` | Add existence check with generic response |
| `src/components/MagicLinkRequest.tsx` | Update success message wording |

---

### Security Audit Trail

Even though we show a generic message, we still log attempts for non-existent users to the `magic_link_rate_limits` table with `blocked: true`. This allows you to:
- Monitor potential enumeration attempts
- See patterns of suspicious activity
- Track which fake emails are being tested

---

### Cleanup Recommendation

After implementation, delete the accidentally created test users via Supabase Dashboard:
- `test@nhs.net`
- `newtest@nhs.net`

Or I can create a one-time edge function to remove them.


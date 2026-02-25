

# Buy-Back Claims Access Control Settings

## Overview

Add a settings cog button alongside the status filter buttons in the Claims History section. Clicking it opens a modal where admins can assign system users to practices with specific access roles: **Submit** (can create/submit claims for a practice), **View** (read-only access to a practice's claims and staff), and **Approver** (can approve/reject claims). Users will only see claims and staff data for practices they are assigned to.

---

## What Changes

### 1. New Database Table: `nres_buyback_access`

Stores per-user, per-practice access assignments:

```text
id              UUID (PK, auto)
user_id         UUID (references auth.users, not null)
practice_key    TEXT (not null) — e.g. 'parks', 'brackley'
access_role     TEXT (not null) — 'submit', 'view', or 'approver'
granted_by      TEXT (nullable) — email of admin who granted
granted_at      TIMESTAMPTZ (default now())
UNIQUE(user_id, practice_key, access_role)
```

RLS: Only NRES admins (checked via `NRES_ADMIN_EMAILS` or a security-definer function) can INSERT/UPDATE/DELETE. Authenticated users can SELECT their own rows.

### 2. New Hook: `useNRESBuyBackAccess`

- **Fetches** all access assignments (for admins) or own assignments (for regular users)
- **Provides** helper functions: `grantAccess(userId, practiceKey, role)`, `revokeAccess(id)`, `getUserPractices(userId)`, `getUserRole(userId, practiceKey)`
- **Exposes** a derived list of which practices the current user can submit to, view, or approve

### 3. Settings Modal Component: `BuyBackAccessSettingsModal`

Opened via a cog icon button placed inline with the status filter buttons in Claims History.

**Layout:**
- Left side: list of system users (from `useNRESUserAccess` — already exists, fetches all NRES-activated users with name, email, practice)
- Searchable/filterable user list
- When a user is selected, the right side shows a grid of the 7 practices with checkboxes for each role (Submit / View / Approver)
- Save changes per user

**Only visible to admins** (checked via `NRES_ADMIN_EMAILS`).

### 4. Update Data Fetching in Hooks

**`useNRESBuyBackStaff.ts`:**
- Instead of fetching all staff when admin, fetch staff only for practices the user has access to (any role)
- Use the access assignments to build a `practice_key IN (...)` filter

**`useNRESBuyBackClaims.ts`:**
- Same approach — filter claims by the user's assigned practices
- Admin override remains for users with 'approver' role on a practice

**`buybackStaffMasking.ts`:**
- Update `isBuybackApprover` to also check the new access table for 'approver' role (or keep the hardcoded list as a fallback during transition)

### 5. UI Filtering in BuyBackClaimsTab

- The practice dropdown (for creating claims) only shows practices the user has 'submit' access to
- The claims list only shows claims for practices the user is assigned to
- The staff list only shows staff for assigned practices
- Approve/reject buttons only appear for users with 'approver' role on that claim's practice

---

## Technical Details

### Database Migration

```sql
CREATE TABLE public.nres_buyback_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_key TEXT NOT NULL,
  access_role TEXT NOT NULL CHECK (access_role IN ('submit', 'view', 'approver')),
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, practice_key, access_role)
);

ALTER TABLE public.nres_buyback_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own access
CREATE POLICY "Users can read own access"
  ON public.nres_buyback_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage all access (using security definer function)
CREATE POLICY "Admins can manage access"
  ON public.nres_buyback_access FOR ALL
  TO authenticated
  USING (public.is_nres_admin(auth.uid()))
  WITH CHECK (public.is_nres_admin(auth.uid()));
```

A `is_nres_admin` security-definer function will check if the user's email is in the admin list (queried from `auth.users`).

### Files to Create

1. `src/hooks/useNRESBuyBackAccess.ts` — fetch/manage access assignments
2. `src/components/nres/hours-tracker/BuyBackAccessSettingsModal.tsx` — settings modal UI

### Files to Modify

1. **Database migration** — new table, RLS, security-definer function
2. `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — add cog button, integrate access filtering
3. `src/hooks/useNRESBuyBackStaff.ts` — filter by assigned practices
4. `src/hooks/useNRESBuyBackClaims.ts` — filter by assigned practices
5. `src/utils/buybackStaffMasking.ts` — extend approver check to use access table




## Plan: Fix staff_responses Broken SELECT Policy

### The Problem
The `staff_responses` SELECT policy checks only that the referenced complaint exists — not that the current user has access to it. Any authenticated user can read all staff names, emails, roles, and response text.

### The Fix — Single Migration

Drop the broken SELECT policy and replace it with one that mirrors the complaints table's own access logic (practice-based + system admin + PCN manager):

```sql
DROP POLICY IF EXISTS "Users can view staff responses for complaints they have access to" 
  ON public.staff_responses;

CREATE POLICY "Users can view staff responses for complaints they have access to"
  ON public.staff_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = staff_responses.complaint_id
      AND (
        is_system_admin(auth.uid())
        OR c.practice_id = get_practice_manager_practice_id(auth.uid())
        OR c.practice_id = ANY(get_pcn_manager_practice_ids(auth.uid()))
        OR c.created_by = auth.uid()
      )
    )
  );
```

### Why This Is Safe
- The `StaffFeedback.tsx` page only **inserts** into `staff_responses` (covered by separate INSERT policy) — it never SELECTs from the table
- Authenticated complaint views already filter by the same practice/admin/PCN logic on the `complaints` table, so the join condition will match for any user who can already see the complaint
- System admins, practice managers, PCN managers, and complaint creators retain full read access to related staff responses
- No client-side code changes needed

### What Does NOT Change
- INSERT, UPDATE policies on `staff_responses` — untouched
- The `complaints` table policies — untouched
- `StaffFeedback.tsx` — untouched
- All other tables and edge functions


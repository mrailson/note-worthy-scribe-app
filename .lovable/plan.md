

## Root Cause

The problem is **not in the component code** — it's in the **RLS (Row Level Security) policy** on the `practice_details` table.

The SELECT policy allows users to read other users' records only when:
```sql
lower(gp.name) = lower(practice_details.practice_name)
```

But there's a name mismatch:
- `gp_practices.name` = **"The Saxon Spires Practice"**
- Sarah Berry's `practice_details.practice_name` = **"Saxon Spires Practice"** (no "The")

So when Julia Railson queries for shared records, RLS silently blocks the result because the exact string comparison fails. The component code's `ilike` query runs fine, but the database returns zero rows due to the policy.

## Fix — Two Changes

### 1. Update the RLS SELECT policy to use flexible name matching

Replace the exact `lower()` comparison with one that strips common prefixes like "The ":

```sql
DROP POLICY "Org members can view practice details" ON public.practice_details;

CREATE POLICY "Org members can view practice details"
ON public.practice_details FOR SELECT TO authenticated
USING (
  is_system_admin()
  OR (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN gp_practices gp ON gp.id = ur.practice_id
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id IS NOT NULL
      AND lower(regexp_replace(gp.name, '^[Tt]he\s+', '')) 
        = lower(regexp_replace(practice_details.practice_name, '^[Tt]he\s+', ''))
  ))
);
```

### 2. Also fix the UPDATE policy (same issue)

The UPDATE policy has the identical exact-match problem. Apply the same `regexp_replace` fix.

### No component code changes needed

The existing fallback/merge logic in `PolicyProfileDefaults.tsx` is already correct — it searches with `ilike` and strips "The " prefixes. The only reason it fails is that the database never returns rows due to the RLS block.


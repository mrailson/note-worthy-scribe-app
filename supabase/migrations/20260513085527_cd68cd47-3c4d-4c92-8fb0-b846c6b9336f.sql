
ALTER TABLE public.nres_time_entries ADD COLUMN IF NOT EXISTS logged_by uuid;
ALTER TABLE public.nres_time_entries DISABLE TRIGGER nres_time_entry_audit_trg;
UPDATE public.nres_time_entries SET logged_by = user_id WHERE logged_by IS NULL;
ALTER TABLE public.nres_time_entries ENABLE TRIGGER nres_time_entry_audit_trg;

CREATE INDEX IF NOT EXISTS idx_nres_time_entries_user_cat_date
  ON public.nres_time_entries (user_id, category, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_nres_time_entries_logged_by_date
  ON public.nres_time_entries (logged_by, entry_date DESC);

ALTER TABLE public.nres_user_profile ADD COLUMN IF NOT EXISTS last_logged_for uuid;

CREATE OR REPLACE FUNCTION public.nres_users_share_practice(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nres_buyback_staff sa
    JOIN public.nres_buyback_staff sb ON sb.practice_id = sa.practice_id
    WHERE sa.user_id = _a AND sb.user_id = _b
  );
$$;

CREATE OR REPLACE FUNCTION public.get_nres_practice_colleagues()
RETURNS TABLE (user_id uuid, display_name text, staff_role text, practice_id uuid, practice_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_practices AS (
    SELECT DISTINCT s.practice_id FROM public.nres_buyback_staff s WHERE s.user_id = auth.uid()
  ),
  colleagues AS (
    SELECT DISTINCT ON (s.user_id)
      s.user_id,
      COALESCE(s.staff_name, '') AS display_name,
      s.staff_role,
      s.practice_id
    FROM public.nres_buyback_staff s
    JOIN my_practices m ON m.practice_id = s.practice_id
    WHERE s.user_id IS NOT NULL
      AND s.user_id <> auth.uid()
      AND COALESCE(s.is_active, true) = true
    ORDER BY s.user_id, s.updated_at DESC NULLS LAST
  )
  SELECT c.user_id, NULLIF(c.display_name, '') AS display_name, c.staff_role, c.practice_id,
         COALESCE(gp.name, pd.practice_name) AS practice_name
  FROM colleagues c
  LEFT JOIN public.gp_practices gp ON gp.id = c.practice_id
  LEFT JOIN LATERAL (
    SELECT practice_name FROM public.practice_details
    WHERE practice_details.user_id = c.user_id
    ORDER BY is_default DESC NULLS LAST, updated_at DESC NULLS LAST LIMIT 1
  ) pd ON true
  ORDER BY display_name NULLS LAST;
$$;

DROP POLICY IF EXISTS "select own or verifier all" ON public.nres_time_entries;
DROP POLICY IF EXISTS "insert own or verifier on behalf" ON public.nres_time_entries;
DROP POLICY IF EXISTS "update own or verifier" ON public.nres_time_entries;
DROP POLICY IF EXISTS "delete own or verifier" ON public.nres_time_entries;

CREATE POLICY "select own logged_by or verifier" ON public.nres_time_entries FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = logged_by OR is_nres_verifier(auth.uid()));
CREATE POLICY "insert own logged_by or verifier" ON public.nres_time_entries FOR INSERT
  WITH CHECK (
    auth.uid() = logged_by AND (
      auth.uid() = user_id
      OR public.nres_users_share_practice(auth.uid(), user_id)
      OR is_nres_verifier(auth.uid())
    )
  );
CREATE POLICY "update own logged_by or verifier" ON public.nres_time_entries FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = logged_by OR is_nres_verifier(auth.uid()));
CREATE POLICY "delete own logged_by or verifier" ON public.nres_time_entries FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = logged_by OR is_nres_verifier(auth.uid()));

DROP POLICY IF EXISTS "users select own activities" ON public.nres_user_activities;
CREATE POLICY "users select own or practice activities" ON public.nres_user_activities FOR SELECT
  USING (auth.uid() = user_id OR public.nres_users_share_practice(auth.uid(), user_id));

GRANT EXECUTE ON FUNCTION public.get_nres_practice_colleagues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nres_users_share_practice(uuid, uuid) TO authenticated;

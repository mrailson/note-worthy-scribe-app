-- ============================================================
-- Phase 1: Practice Letterheads — table, storage, RLS, trigger
-- ============================================================

-- 1. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice-letterheads', 'practice-letterheads', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.practice_letterheads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  original_filename text NOT NULL,
  original_mime_type text,
  storage_path text NOT NULL,
  rendered_png_path text NOT NULL,
  rendered_width_px integer,
  rendered_height_px integer,
  height_cm numeric(4,2) NOT NULL DEFAULT 6.00 CHECK (height_cm >= 3 AND height_cm <= 9),
  top_margin_cm numeric(4,2) NOT NULL DEFAULT 1.00 CHECK (top_margin_cm >= 0.5 AND top_margin_cm <= 3),
  alignment text NOT NULL DEFAULT 'source' CHECK (alignment IN ('left','centre','right','source')),
  include_all_pages boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL,
  uploaded_by_email text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_letterheads_practice_active
  ON public.practice_letterheads (practice_id, active);
CREATE INDEX IF NOT EXISTS idx_practice_letterheads_practice_uploaded_at
  ON public.practice_letterheads (practice_id, uploaded_at DESC);

-- 3. updated_at trigger (reuse existing helper if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_practice_letterheads_updated_at ON public.practice_letterheads;
CREATE TRIGGER trg_practice_letterheads_updated_at
  BEFORE UPDATE ON public.practice_letterheads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Auto-deactivate previous active letterhead on new active insert
CREATE OR REPLACE FUNCTION public.deactivate_previous_practice_letterheads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active = true THEN
    UPDATE public.practice_letterheads
       SET active = false, updated_at = now()
     WHERE practice_id = NEW.practice_id
       AND id <> NEW.id
       AND active = true;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_practice_letterheads_deactivate_others ON public.practice_letterheads;
CREATE TRIGGER trg_practice_letterheads_deactivate_others
  AFTER INSERT OR UPDATE OF active ON public.practice_letterheads
  FOR EACH ROW WHEN (NEW.active = true)
  EXECUTE FUNCTION public.deactivate_previous_practice_letterheads();

-- 5. Permission helper: can the current user manage letterhead for this practice?
CREATE OR REPLACE FUNCTION public.can_manage_practice_letterhead(_practice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(auth.uid(), 'system_admin'::app_role)
    OR (
      (
        public.has_role(auth.uid(), 'practice_manager'::app_role)
        OR public.has_role(auth.uid(), 'complaints_manager'::app_role)
      )
      AND _practice_id = ANY (COALESCE(public.get_user_practice_ids(auth.uid()), ARRAY[]::uuid[]))
    );
$$;

-- 6. Permission helper: can the current user view this practice's letterhead?
CREATE OR REPLACE FUNCTION public.can_view_practice_letterhead(_practice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(auth.uid(), 'system_admin'::app_role)
    OR _practice_id = ANY (COALESCE(public.get_user_practice_ids(auth.uid()), ARRAY[]::uuid[]));
$$;

-- 7. RLS
ALTER TABLE public.practice_letterheads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "letterheads_select" ON public.practice_letterheads;
CREATE POLICY "letterheads_select" ON public.practice_letterheads
  FOR SELECT TO authenticated
  USING (public.can_view_practice_letterhead(practice_id));

DROP POLICY IF EXISTS "letterheads_insert" ON public.practice_letterheads;
CREATE POLICY "letterheads_insert" ON public.practice_letterheads
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_practice_letterhead(practice_id) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "letterheads_update" ON public.practice_letterheads;
CREATE POLICY "letterheads_update" ON public.practice_letterheads
  FOR UPDATE TO authenticated
  USING (public.can_manage_practice_letterhead(practice_id))
  WITH CHECK (public.can_manage_practice_letterhead(practice_id));

DROP POLICY IF EXISTS "letterheads_delete" ON public.practice_letterheads;
CREATE POLICY "letterheads_delete" ON public.practice_letterheads
  FOR DELETE TO authenticated
  USING (public.can_manage_practice_letterhead(practice_id));

-- 8. Storage policies — path convention: {practice_id}/{filename}
DROP POLICY IF EXISTS "letterheads_storage_select" ON storage.objects;
CREATE POLICY "letterheads_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'practice-letterheads'
    AND public.can_view_practice_letterhead(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "letterheads_storage_insert" ON storage.objects;
CREATE POLICY "letterheads_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'practice-letterheads'
    AND public.can_manage_practice_letterhead(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "letterheads_storage_update" ON storage.objects;
CREATE POLICY "letterheads_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'practice-letterheads'
    AND public.can_manage_practice_letterhead(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "letterheads_storage_delete" ON storage.objects;
CREATE POLICY "letterheads_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'practice-letterheads'
    AND public.can_manage_practice_letterhead(((storage.foldername(name))[1])::uuid)
  );
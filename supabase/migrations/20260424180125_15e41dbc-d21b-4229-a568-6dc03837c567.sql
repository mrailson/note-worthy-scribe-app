-- =========================================================
-- Phase C: NRES Worklist Object
-- =========================================================

-- Helper: is this user a member of the given practice?
CREATE OR REPLACE FUNCTION public.is_practice_member(_practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.practice_id = _practice_id
  );
$$;

-- 1. Worklists (header)
CREATE TABLE public.narp_worklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid NOT NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid,
  source_export_id uuid REFERENCES public.narp_exports(id) ON DELETE SET NULL,
  cohort_label text
);

CREATE INDEX idx_narp_worklists_practice ON public.narp_worklists(practice_id, status);
CREATE INDEX idx_narp_worklists_created_by ON public.narp_worklists(created_by);

ALTER TABLE public.narp_worklists ENABLE ROW LEVEL SECURITY;

-- 2. Worklist items (patient lines)
CREATE TABLE public.narp_worklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worklist_id uuid NOT NULL REFERENCES public.narp_worklists(id) ON DELETE CASCADE,
  fk_patient_link_id text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid NOT NULL,
  added_risk_tier text,
  added_poa numeric,
  added_polos numeric,
  added_drug_count integer,
  added_frailty_category text,
  added_export_id uuid REFERENCES public.narp_exports(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'excluded')),
  reviewed_by uuid,
  reviewed_by_email text,
  reviewed_at timestamptz,
  reviewed_via_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  notes text,
  change_flag text NOT NULL DEFAULT 'unchanged' CHECK (change_flag IN ('unchanged', 'improved', 'escalated', 'left_practice')),
  change_flag_updated_at timestamptz,
  latest_risk_tier text,
  latest_poa numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worklist_id, fk_patient_link_id)
);

CREATE INDEX idx_narp_worklist_items_worklist ON public.narp_worklist_items(worklist_id);
CREATE INDEX idx_narp_worklist_items_patient ON public.narp_worklist_items(fk_patient_link_id);
CREATE INDEX idx_narp_worklist_items_review ON public.narp_worklist_items(worklist_id, review_status);

ALTER TABLE public.narp_worklist_items ENABLE ROW LEVEL SECURITY;

-- 3. Meeting links
CREATE TABLE public.narp_worklist_meeting_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worklist_id uuid NOT NULL REFERENCES public.narp_worklists(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid NOT NULL,
  unlinked_at timestamptz,
  UNIQUE (worklist_id, meeting_id)
);

CREATE INDEX idx_narp_worklist_meeting_links_worklist ON public.narp_worklist_meeting_links(worklist_id);
CREATE INDEX idx_narp_worklist_meeting_links_meeting ON public.narp_worklist_meeting_links(meeting_id);

ALTER TABLE public.narp_worklist_meeting_links ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
CREATE TRIGGER trg_narp_worklists_updated
  BEFORE UPDATE ON public.narp_worklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_narp_worklist_items_updated
  BEFORE UPDATE ON public.narp_worklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS policies
-- =========================================================

CREATE POLICY "narp_worklists_select"
  ON public.narp_worklists FOR SELECT TO authenticated
  USING (public.is_practice_member(practice_id));

CREATE POLICY "narp_worklists_insert"
  ON public.narp_worklists FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_practice_member(practice_id));

CREATE POLICY "narp_worklists_update"
  ON public.narp_worklists FOR UPDATE TO authenticated
  USING (public.is_practice_member(practice_id));

CREATE POLICY "narp_worklists_delete"
  ON public.narp_worklists FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.is_practice_member(practice_id));

CREATE POLICY "narp_worklist_items_select"
  ON public.narp_worklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_items.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_worklist_items_insert"
  ON public.narp_worklist_items FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_items.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_worklist_items_update"
  ON public.narp_worklist_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_items.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_worklist_items_delete"
  ON public.narp_worklist_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_items.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_wml_select"
  ON public.narp_worklist_meeting_links FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_meeting_links.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_wml_insert"
  ON public.narp_worklist_meeting_links FOR INSERT TO authenticated
  WITH CHECK (
    linked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_meeting_links.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_wml_update"
  ON public.narp_worklist_meeting_links FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_meeting_links.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

CREATE POLICY "narp_wml_delete"
  ON public.narp_worklist_meeting_links FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.narp_worklists w
      WHERE w.id = narp_worklist_meeting_links.worklist_id
        AND public.is_practice_member(w.practice_id)
    )
  );

-- =========================================================
-- Trigger: re-flag open worklist items when a new NARP export is processed
-- =========================================================
CREATE OR REPLACE FUNCTION public.flag_worklist_changes_on_new_export()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_risk_rank CONSTANT jsonb := '{"low":1,"moderate":2,"high":3,"very_high":4,"very high":4}'::jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM 'processed' THEN
    RETURN NEW;
  END IF;

  UPDATE public.narp_worklist_items wi
  SET
    latest_risk_tier = s.risk_tier,
    latest_poa = s.poa,
    change_flag = CASE
      WHEN s.risk_tier IS NULL THEN 'left_practice'
      WHEN COALESCE((v_risk_rank ->> lower(s.risk_tier))::int, 0)
         > COALESCE((v_risk_rank ->> lower(wi.added_risk_tier))::int, 0) THEN 'escalated'
      WHEN COALESCE((v_risk_rank ->> lower(s.risk_tier))::int, 0)
         < COALESCE((v_risk_rank ->> lower(wi.added_risk_tier))::int, 0) THEN 'improved'
      ELSE 'unchanged'
    END,
    change_flag_updated_at = now()
  FROM public.narp_worklists w
  LEFT JOIN public.narp_patient_snapshots s
    ON s.export_id = NEW.id
   AND s.fk_patient_link_id = wi.fk_patient_link_id
  WHERE wi.worklist_id = w.id
    AND w.practice_id = NEW.practice_id
    AND w.status = 'open';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_flag_worklist_on_export
  AFTER INSERT OR UPDATE OF status ON public.narp_exports
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_worklist_changes_on_new_export();

CREATE TABLE public.complaint_letter_lab_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  letter_type text NOT NULL CHECK (letter_type IN ('acknowledgement','outcome')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','sent','archived')),
  tone text NOT NULL DEFAULT 'formal' CHECK (tone IN ('formal','empathetic','firm')),
  length text NOT NULL DEFAULT 'standard' CHECK (length IN ('concise','standard','detailed')),
  signatory_ids uuid[] NOT NULL DEFAULT '{}',
  letter_date date NOT NULL DEFAULT current_date,
  response_due_date date,
  reference_number text,
  body_markdown text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cll_drafts_complaint ON public.complaint_letter_lab_drafts(complaint_id);

ALTER TABLE public.complaint_letter_lab_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lab drafts for accessible complaints"
ON public.complaint_letter_lab_drafts FOR SELECT
USING (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

CREATE POLICY "Users can create lab drafts for accessible complaints"
ON public.complaint_letter_lab_drafts FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

CREATE POLICY "Users can update lab drafts for accessible complaints"
ON public.complaint_letter_lab_drafts FOR UPDATE
USING (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
)
WITH CHECK (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

CREATE POLICY "Users can delete lab drafts for accessible complaints"
ON public.complaint_letter_lab_drafts FOR DELETE
USING (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM complaints c
    WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

CREATE TRIGGER trg_cll_drafts_updated_at
BEFORE UPDATE ON public.complaint_letter_lab_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.complaint_letter_lab_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.complaint_letter_lab_drafts(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  tone text,
  length text,
  reading_age numeric,
  flesch_kincaid_grade numeric,
  compliance_score int,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  change_note text
);

CREATE INDEX idx_cll_versions_draft ON public.complaint_letter_lab_versions(draft_id);

ALTER TABLE public.complaint_letter_lab_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lab versions for accessible complaints"
ON public.complaint_letter_lab_versions FOR SELECT
USING (
  draft_id IN (
    SELECT d.id FROM public.complaint_letter_lab_drafts d
    WHERE is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR d.complaint_id IN (
        SELECT c.id FROM complaints c
        WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
  )
);

CREATE POLICY "Users can create lab versions for accessible complaints"
ON public.complaint_letter_lab_versions FOR INSERT
WITH CHECK (
  draft_id IN (
    SELECT d.id FROM public.complaint_letter_lab_drafts d
    WHERE is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR d.complaint_id IN (
        SELECT c.id FROM complaints c
        WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
  )
);

CREATE POLICY "Users can update lab versions for accessible complaints"
ON public.complaint_letter_lab_versions FOR UPDATE
USING (
  draft_id IN (
    SELECT d.id FROM public.complaint_letter_lab_drafts d
    WHERE is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR d.complaint_id IN (
        SELECT c.id FROM complaints c
        WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
  )
);

CREATE POLICY "Users can delete lab versions for accessible complaints"
ON public.complaint_letter_lab_versions FOR DELETE
USING (
  draft_id IN (
    SELECT d.id FROM public.complaint_letter_lab_drafts d
    WHERE is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR d.complaint_id IN (
        SELECT c.id FROM complaints c
        WHERE c.created_by = auth.uid() OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
  )
);

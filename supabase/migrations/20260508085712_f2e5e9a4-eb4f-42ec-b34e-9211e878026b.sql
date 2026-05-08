
CREATE TYPE public.mandatory_read_status AS ENUM ('outstanding', 'acknowledged', 'overdue', 'paused');
CREATE TYPE public.mandatory_read_source_type AS ENUM ('vault_policy', 'upload', 'pasted_text');

CREATE TABLE public.mandatory_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  source_type public.mandatory_read_source_type NOT NULL DEFAULT 'pasted_text',
  source_ref TEXT,
  body_html TEXT,
  body_storage_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  version_hash TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reread_interval_months INTEGER,
  due_days INTEGER NOT NULL DEFAULT 14,
  reminder_schedule JSONB NOT NULL DEFAULT '{"days":[3,7,14],"weekly_after":true,"escalate_manager_at":14}'::jsonb,
  paused BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mandatory_reads_practice ON public.mandatory_reads(practice_id);
CREATE INDEX idx_mandatory_reads_active ON public.mandatory_reads(archived, paused);

CREATE TABLE public.mandatory_read_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandatory_read_id UUID NOT NULL REFERENCES public.mandatory_reads(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_snapshot TEXT,
  practice_id UUID,
  due_at TIMESTAMPTZ NOT NULL,
  status public.mandatory_read_status NOT NULL DEFAULT 'outstanding',
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  magic_token_hash TEXT,
  magic_token_expires_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mandatory_read_id, email)
);

CREATE INDEX idx_mr_assignments_user ON public.mandatory_read_assignments(user_id);
CREATE INDEX idx_mr_assignments_email ON public.mandatory_read_assignments(email);
CREATE INDEX idx_mr_assignments_status ON public.mandatory_read_assignments(status);
CREATE INDEX idx_mr_assignments_next_reminder ON public.mandatory_read_assignments(next_reminder_at) WHERE status = 'outstanding' AND paused = false;
CREATE INDEX idx_mr_assignments_token ON public.mandatory_read_assignments(magic_token_hash) WHERE magic_token_hash IS NOT NULL;

CREATE TABLE public.mandatory_read_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.mandatory_read_assignments(id) ON DELETE CASCADE,
  mandatory_read_id UUID NOT NULL REFERENCES public.mandatory_reads(id) ON DELETE CASCADE,
  version_hash TEXT NOT NULL,
  version_at_ack INTEGER NOT NULL,
  typed_name TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  user_id UUID,
  email TEXT NOT NULL
);

CREATE INDEX idx_mr_ack_assignment ON public.mandatory_read_acknowledgements(assignment_id);
CREATE INDEX idx_mr_ack_policy ON public.mandatory_read_acknowledgements(mandatory_read_id);

CREATE TABLE public.mandatory_read_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.mandatory_read_assignments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id TEXT,
  error TEXT
);

CREATE INDEX idx_mr_reminder_log_assignment ON public.mandatory_read_reminder_log(assignment_id);

ALTER TABLE public.mandatory_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_read_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_read_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_read_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all mandatory reads"
  ON public.mandatory_reads FOR ALL
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Practice managers manage mandatory reads"
  ON public.mandatory_reads FOR ALL
  USING (public.has_role(auth.uid(), 'practice_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'practice_manager'));

CREATE POLICY "Assignees can view their assigned policies"
  ON public.mandatory_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mandatory_read_assignments a
      WHERE a.mandatory_read_id = mandatory_reads.id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all assignments"
  ON public.mandatory_read_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "Practice managers manage assignments"
  ON public.mandatory_read_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'practice_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'practice_manager'));

CREATE POLICY "Users can view their own assignments"
  ON public.mandatory_read_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own assignment status"
  ON public.mandatory_read_assignments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authed can insert acknowledgement"
  ON public.mandatory_read_acknowledgements FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view their acknowledgements"
  ON public.mandatory_read_acknowledgements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers admins view acknowledgements"
  ON public.mandatory_read_acknowledgements FOR SELECT
  USING (
    public.has_role(auth.uid(), 'system_admin')
    OR public.has_role(auth.uid(), 'practice_manager')
  );

CREATE POLICY "Managers admins view reminder log"
  ON public.mandatory_read_reminder_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'system_admin')
    OR public.has_role(auth.uid(), 'practice_manager')
  );

CREATE TRIGGER trg_mandatory_reads_updated_at
  BEFORE UPDATE ON public.mandatory_reads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_mr_assignments_updated_at
  BEFORE UPDATE ON public.mandatory_read_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.mark_mandatory_read_overdue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.mandatory_read_assignments
     SET status = 'overdue'
   WHERE status = 'outstanding'
     AND paused = false
     AND due_at < now();
$$;

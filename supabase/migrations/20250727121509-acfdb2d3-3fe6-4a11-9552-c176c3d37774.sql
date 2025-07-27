-- Create investigation findings table
CREATE TABLE public.complaint_investigation_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  investigation_summary TEXT NOT NULL,
  evidence_notes TEXT,
  findings_text TEXT NOT NULL,
  investigation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  investigated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_investigation_findings ENABLE ROW LEVEL SECURITY;

-- Create policies for investigation findings
CREATE POLICY "Users can view investigation findings for their practice complaints"
ON public.complaint_investigation_findings
FOR SELECT
USING (complaint_id IN (
  SELECT c.id
  FROM complaints c
  WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
));

CREATE POLICY "Complaints managers can manage investigation findings"
ON public.complaint_investigation_findings
FOR ALL
USING (
  is_system_admin() OR 
  has_role(auth.uid(), 'complaints_manager'::app_role) OR
  complaint_id IN (
    SELECT c.id
    FROM complaints c
    WHERE (c.practice_id IN (
      SELECT ur.practice_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid())
  )
);

-- Create investigation evidence files table
CREATE TABLE public.complaint_investigation_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  evidence_type TEXT NOT NULL, -- 'email', 'pdf', 'image', 'audio', 'other'
  description TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_investigation_evidence ENABLE ROW LEVEL SECURITY;

-- Create policies for investigation evidence
CREATE POLICY "Users can view investigation evidence for their practice complaints"
ON public.complaint_investigation_evidence
FOR SELECT
USING (complaint_id IN (
  SELECT c.id
  FROM complaints c
  WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
));

CREATE POLICY "Authenticated users can upload investigation evidence"
ON public.complaint_investigation_evidence
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

-- Create investigation audio transcripts table
CREATE TABLE public.complaint_investigation_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  audio_file_id UUID REFERENCES complaint_investigation_evidence(id),
  transcript_text TEXT NOT NULL,
  transcription_confidence REAL,
  transcribed_by UUID NOT NULL,
  transcribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_investigation_transcripts ENABLE ROW LEVEL SECURITY;

-- Create policies for investigation transcripts
CREATE POLICY "Users can view investigation transcripts for their practice complaints"
ON public.complaint_investigation_transcripts
FOR SELECT
USING (complaint_id IN (
  SELECT c.id
  FROM complaints c
  WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
));

CREATE POLICY "Authenticated users can create investigation transcripts"
ON public.complaint_investigation_transcripts
FOR INSERT
WITH CHECK (auth.uid() = transcribed_by);

-- Create investigation decisions table
CREATE TABLE public.complaint_investigation_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('uphold', 'reject', 'partially_uphold')),
  decision_reasoning TEXT NOT NULL,
  corrective_actions TEXT,
  lessons_learned TEXT,
  decided_by UUID NOT NULL,
  decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_investigation_decisions ENABLE ROW LEVEL SECURITY;

-- Create policies for investigation decisions
CREATE POLICY "Users can view investigation decisions for their practice complaints"
ON public.complaint_investigation_decisions
FOR SELECT
USING (complaint_id IN (
  SELECT c.id
  FROM complaints c
  WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid())) OR c.created_by = auth.uid())
));

CREATE POLICY "Complaints managers can manage investigation decisions"
ON public.complaint_investigation_decisions
FOR ALL
USING (
  is_system_admin() OR 
  has_role(auth.uid(), 'complaints_manager'::app_role) OR
  complaint_id IN (
    SELECT c.id
    FROM complaints c
    WHERE (c.practice_id IN (
      SELECT ur.practice_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid())
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_complaint_investigation_findings_updated_at
BEFORE UPDATE ON public.complaint_investigation_findings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_complaint_investigation_decisions_updated_at
BEFORE UPDATE ON public.complaint_investigation_decisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
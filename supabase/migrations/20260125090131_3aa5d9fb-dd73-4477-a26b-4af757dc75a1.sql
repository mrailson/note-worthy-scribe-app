-- Create surveys table
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('patient_experience', 'staff', 'custom', 'event_training')),
  is_anonymous BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  public_token UUID DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create survey_questions table
CREATE TABLE public.survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('rating', 'text', 'multiple_choice', 'yes_no', 'scale')),
  options JSONB,
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create survey_responses table
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  respondent_email TEXT,
  respondent_name TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  ip_hash TEXT
);

-- Create survey_answers table
CREATE TABLE public.survey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.survey_responses(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.survey_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT,
  answer_rating INTEGER,
  answer_options JSONB
);

-- Create survey_email_preferences table
CREATE TABLE public.survey_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  practice_id UUID REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  receive_weekly_digest BOOLEAN DEFAULT true,
  digest_day TEXT DEFAULT 'monday' CHECK (digest_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, practice_id)
);

-- Enable RLS on all tables
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_email_preferences ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_surveys_practice_id ON public.surveys(practice_id);
CREATE INDEX idx_surveys_public_token ON public.surveys(public_token);
CREATE INDEX idx_surveys_status ON public.surveys(status);
CREATE INDEX idx_survey_questions_survey_id ON public.survey_questions(survey_id);
CREATE INDEX idx_survey_responses_survey_id ON public.survey_responses(survey_id);
CREATE INDEX idx_survey_responses_submitted_at ON public.survey_responses(submitted_at);
CREATE INDEX idx_survey_answers_response_id ON public.survey_answers(response_id);
CREATE INDEX idx_survey_answers_question_id ON public.survey_answers(question_id);

-- Security definer function to check if user can manage surveys for a practice
CREATE OR REPLACE FUNCTION public.can_manage_surveys(_user_id UUID, _practice_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND practice_id = _practice_id
      AND role IN ('practice_manager', 'system_admin', 'pcn_manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  )
$$;

-- Security definer function to get survey by public token
CREATE OR REPLACE FUNCTION public.get_survey_by_token(_token UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.surveys
  WHERE public_token = _token
    AND status = 'active'
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
$$;

-- RLS Policies for surveys table
CREATE POLICY "Users can view surveys for their practice"
ON public.surveys FOR SELECT
TO authenticated
USING (public.can_manage_surveys(auth.uid(), practice_id));

CREATE POLICY "Users can create surveys for their practice"
ON public.surveys FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_surveys(auth.uid(), practice_id));

CREATE POLICY "Users can update surveys for their practice"
ON public.surveys FOR UPDATE
TO authenticated
USING (public.can_manage_surveys(auth.uid(), practice_id));

CREATE POLICY "Users can delete surveys for their practice"
ON public.surveys FOR DELETE
TO authenticated
USING (public.can_manage_surveys(auth.uid(), practice_id));

CREATE POLICY "Public can view active surveys by token"
ON public.surveys FOR SELECT
TO anon
USING (
  status = 'active'
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

-- RLS Policies for survey_questions table
CREATE POLICY "Users can manage questions for their surveys"
ON public.survey_questions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
      AND public.can_manage_surveys(auth.uid(), s.practice_id)
  )
);

CREATE POLICY "Public can view questions for active surveys"
ON public.survey_questions FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
      AND s.status = 'active'
      AND (s.start_date IS NULL OR s.start_date <= now())
      AND (s.end_date IS NULL OR s.end_date >= now())
  )
);

-- RLS Policies for survey_responses table
CREATE POLICY "Users can view responses for their surveys"
ON public.survey_responses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
      AND public.can_manage_surveys(auth.uid(), s.practice_id)
  )
);

CREATE POLICY "Anyone can submit responses to active surveys"
ON public.survey_responses FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
      AND s.status = 'active'
      AND (s.start_date IS NULL OR s.start_date <= now())
      AND (s.end_date IS NULL OR s.end_date >= now())
  )
);

-- RLS Policies for survey_answers table
CREATE POLICY "Users can view answers for their survey responses"
ON public.survey_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_responses sr
    JOIN public.surveys s ON s.id = sr.survey_id
    WHERE sr.id = response_id
      AND public.can_manage_surveys(auth.uid(), s.practice_id)
  )
);

CREATE POLICY "Anyone can submit answers with responses"
ON public.survey_answers FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.survey_responses sr
    JOIN public.surveys s ON s.id = sr.survey_id
    WHERE sr.id = response_id
      AND s.status = 'active'
  )
);

-- RLS Policies for survey_email_preferences table
CREATE POLICY "Users can manage their own email preferences"
ON public.survey_email_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create updated_at trigger for surveys
CREATE TRIGGER update_surveys_updated_at
BEFORE UPDATE ON public.surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- 1. neighbourhood_meetings table
CREATE TABLE public.neighbourhood_meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  neighbourhood text NOT NULL DEFAULT 'NRES',
  practice_key text NOT NULL,
  meeting_type text NOT NULL,
  title text,
  meeting_date date NOT NULL,
  start_time time,
  duration_hours numeric NOT NULL DEFAULT 1,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.neighbourhood_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meetings"
  ON public.neighbourhood_meetings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create meetings"
  ON public.neighbourhood_meetings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners or admins can update meetings"
  ON public.neighbourhood_meetings FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR is_nres_admin());

CREATE POLICY "Owners or admins can delete meetings"
  ON public.neighbourhood_meetings FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_nres_admin());

-- 2. meeting_attendance table
CREATE TABLE public.meeting_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.neighbourhood_meetings(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.nres_buyback_staff(id) ON DELETE CASCADE,
  attended boolean NOT NULL DEFAULT false,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance"
  ON public.meeting_attendance FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage attendance"
  ON public.meeting_attendance FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
  ON public.meeting_attendance FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Owners or admins can delete attendance"
  ON public.meeting_attendance FOR DELETE TO authenticated
  USING (is_nres_admin() OR recorded_by = auth.uid());

-- Unique constraint to prevent duplicate attendance records
ALTER TABLE public.meeting_attendance 
  ADD CONSTRAINT unique_meeting_staff UNIQUE (meeting_id, staff_id);

-- 3. Add meeting rate columns to nres_buyback_rate_settings
ALTER TABLE public.nres_buyback_rate_settings
  ADD COLUMN meeting_gp_rate numeric NOT NULL DEFAULT 85,
  ADD COLUMN meeting_pm_rate numeric NOT NULL DEFAULT 45;
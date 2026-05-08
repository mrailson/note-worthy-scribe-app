
CREATE TABLE public.agewell_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipients text[] NOT NULL DEFAULT ARRAY['malcolm.railson@nhs.net']::text[],
  mode text NOT NULL DEFAULT 'all' CHECK (mode IN ('all','completed_only')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.agewell_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view agewell notification settings"
  ON public.agewell_notification_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "System admins can insert agewell notification settings"
  ON public.agewell_notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "System admins can update agewell notification settings"
  ON public.agewell_notification_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

INSERT INTO public.agewell_notification_settings (recipients, mode)
VALUES (ARRAY['malcolm.railson@nhs.net']::text[], 'all');

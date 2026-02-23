
-- Create the nres_estates_config table for admin-editable room matrix and F2F split
CREATE TABLE public.nres_estates_config (
  id text PRIMARY KEY DEFAULT 'default',
  room_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  f2f_split_pct integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.nres_estates_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read estates config"
  ON public.nres_estates_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only system admins can insert
CREATE POLICY "System admins can insert estates config"
  ON public.nres_estates_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

-- Only system admins can update
CREATE POLICY "System admins can update estates config"
  ON public.nres_estates_config
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Seed with current hardcoded values
INSERT INTO public.nres_estates_config (id, room_data, f2f_split_pct)
VALUES (
  'default',
  '[
    {"session":"Monday AM","theParks":1,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":1},
    {"session":"Monday PM","theParks":3,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":3},
    {"session":"Tuesday AM","theParks":5,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":1,"towcester":0},
    {"session":"Tuesday PM","theParks":6,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":1,"towcester":2},
    {"session":"Wednesday AM","theParks":0,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":1},
    {"session":"Wednesday PM","theParks":0,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":4},
    {"session":"Thursday AM","theParks":4,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":0},
    {"session":"Thursday PM","theParks":4,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":1,"towcester":0},
    {"session":"Friday AM","theParks":3,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":2},
    {"session":"Friday PM","theParks":3,"springfield":1,"brackley":2,"brook":1,"bugbrooke":1,"denton":0,"towcester":4}
  ]'::jsonb,
  50
);

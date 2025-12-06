-- Drop existing policies that use 'public' role
DROP POLICY IF EXISTS "Users can delete own lg_patients" ON public.lg_patients;
DROP POLICY IF EXISTS "Users can insert own lg_patients" ON public.lg_patients;
DROP POLICY IF EXISTS "Users can update own lg_patients" ON public.lg_patients;
DROP POLICY IF EXISTS "Users can view own lg_patients" ON public.lg_patients;

-- Recreate policies with 'authenticated' role for defence in depth
CREATE POLICY "Users can view own lg_patients"
ON public.lg_patients
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lg_patients"
ON public.lg_patients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lg_patients"
ON public.lg_patients
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lg_patients"
ON public.lg_patients
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add system admin access for support purposes
CREATE POLICY "System admins can manage all lg_patients"
ON public.lg_patients
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));
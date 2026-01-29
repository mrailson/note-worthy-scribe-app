-- Drop existing overly permissive policies on gp_appointments
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.gp_appointments;
DROP POLICY IF EXISTS "Users can create their own appointments" ON public.gp_appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.gp_appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.gp_appointments;

-- Create role-based access policies that verify clinical relationships

-- SELECT: Users can view appointments if:
-- 1. They created the appointment (user_id matches)
-- 2. They are a clinical staff member at the same practice
-- 3. They are a system admin
CREATE POLICY "Users can view appointments with clinical access"
ON public.gp_appointments
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_system_admin(auth.uid())
  OR (
    -- Same practice access for clinical staff
    public.get_user_practice_id(auth.uid()) IS NOT NULL
    AND public.get_user_practice_id(auth.uid()) = public.get_user_practice_id(user_id)
  )
);

-- INSERT: Users can only create their own appointments
CREATE POLICY "Users can create their own appointments"
ON public.gp_appointments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update appointments if:
-- 1. They created the appointment
-- 2. They are clinical staff at the same practice  
-- 3. They are a system admin
CREATE POLICY "Users can update appointments with clinical access"
ON public.gp_appointments
FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.is_system_admin(auth.uid())
  OR (
    public.get_user_practice_id(auth.uid()) IS NOT NULL
    AND public.get_user_practice_id(auth.uid()) = public.get_user_practice_id(user_id)
  )
);

-- DELETE: Only the creator or system admin can delete appointments
CREATE POLICY "Users can delete their own appointments or admins"
ON public.gp_appointments
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_system_admin(auth.uid())
);
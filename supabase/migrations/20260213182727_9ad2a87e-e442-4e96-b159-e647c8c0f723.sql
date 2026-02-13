
-- Drop the anon SELECT policy that exposes all practice_details columns publicly.
-- The get_public_survey RPC (SECURITY DEFINER) now handles branding lookup server-side,
-- so anonymous users no longer need direct access to this table.
DROP POLICY IF EXISTS "Anyone can view practice branding for active surveys" ON public.practice_details;

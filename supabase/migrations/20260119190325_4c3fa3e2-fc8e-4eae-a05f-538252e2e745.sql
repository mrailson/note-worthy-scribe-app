-- Fix overly permissive RLS policies on NRES board tables
-- These policies currently allow ANY authenticated user to UPDATE/DELETE ANY row
-- We need to restrict them to only allow users to modify their own data

-- =====================================================
-- Fix nres_board_action_documents DELETE policy
-- =====================================================
DROP POLICY IF EXISTS "Users can delete action documents" ON public.nres_board_action_documents;

CREATE POLICY "Users can delete own action documents" 
ON public.nres_board_action_documents 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- Fix nres_board_actions UPDATE and DELETE policies
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can update board actions" ON public.nres_board_actions;
DROP POLICY IF EXISTS "Authenticated users can delete board actions" ON public.nres_board_actions;

CREATE POLICY "Users can update own board actions" 
ON public.nres_board_actions 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own board actions" 
ON public.nres_board_actions 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- Fix nres_board_members UPDATE and DELETE policies
-- =====================================================
DROP POLICY IF EXISTS "Users can update board members" ON public.nres_board_members;
DROP POLICY IF EXISTS "Users can delete board members" ON public.nres_board_members;

CREATE POLICY "Users can update own board members" 
ON public.nres_board_members 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own board members" 
ON public.nres_board_members 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);
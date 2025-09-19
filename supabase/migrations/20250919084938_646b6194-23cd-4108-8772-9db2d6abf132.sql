-- Fix RLS policies for manual translation sessions
DROP POLICY IF EXISTS "Users can create their own manual translation sessions" ON public.manual_translation_sessions;
DROP POLICY IF EXISTS "Users can view their own manual translation sessions" ON public.manual_translation_sessions;
DROP POLICY IF EXISTS "Users can update their own manual translation sessions" ON public.manual_translation_sessions;
DROP POLICY IF EXISTS "Users can delete their own manual translation sessions" ON public.manual_translation_sessions;

-- Recreate proper RLS policies with both USING and WITH CHECK clauses
CREATE POLICY "Users can create their own manual translation sessions" 
ON public.manual_translation_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own manual translation sessions" 
ON public.manual_translation_sessions 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual translation sessions" 
ON public.manual_translation_sessions 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual translation sessions" 
ON public.manual_translation_sessions 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Also fix RLS policies for manual translation entries table
DROP POLICY IF EXISTS "Users can create their own manual translation entries" ON public.manual_translation_entries;
DROP POLICY IF EXISTS "Users can view their own manual translation entries" ON public.manual_translation_entries;
DROP POLICY IF EXISTS "Users can update their own manual translation entries" ON public.manual_translation_entries;
DROP POLICY IF EXISTS "Users can delete their own manual translation entries" ON public.manual_translation_entries;

-- Check if user owns the session for entries
CREATE POLICY "Users can create entries for their own sessions" 
ON public.manual_translation_entries 
FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manual_translation_sessions 
    WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can view entries for their own sessions" 
ON public.manual_translation_entries 
FOR SELECT 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manual_translation_sessions 
    WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update entries for their own sessions" 
ON public.manual_translation_entries 
FOR UPDATE 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manual_translation_sessions 
    WHERE id = session_id AND user_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manual_translation_sessions 
    WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can delete entries for their own sessions" 
ON public.manual_translation_entries 
FOR DELETE 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manual_translation_sessions 
    WHERE id = session_id AND user_id = auth.uid()
));
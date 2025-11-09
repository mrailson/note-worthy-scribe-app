-- 1) Remove default on sent_at so records aren’t auto-marked as sent
ALTER TABLE public.complaint_acknowledgements
  ALTER COLUMN sent_at DROP DEFAULT;

-- 2) Relax INSERT policy to allow creating acknowledgements without forcing sent_by = auth.uid()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complaint_acknowledgements'
      AND policyname = 'Authenticated users can create acknowledgements'
  ) THEN
    DROP POLICY "Authenticated users can create acknowledgements" ON public.complaint_acknowledgements;
  END IF;
END $$;

CREATE POLICY "Users can create acknowledgements for accessible complaints"
ON public.complaint_acknowledgements
FOR INSERT TO authenticated
WITH CHECK (
  is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'practice_manager'::app_role)
  OR has_role(auth.uid(), 'complaints_manager'::app_role)
  OR complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.created_by = auth.uid()
       OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

-- 3) Allow authorised users to UPDATE acknowledgements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complaint_acknowledgements'
      AND policyname = 'Users can update acknowledgements for accessible complaints'
  ) THEN
    CREATE POLICY "Users can update acknowledgements for accessible complaints"
    ON public.complaint_acknowledgements
    FOR UPDATE TO authenticated
    USING (
      is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR complaint_id IN (
        SELECT c.id FROM public.complaints c
        WHERE c.created_by = auth.uid()
           OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
    )
    WITH CHECK (
      is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR complaint_id IN (
        SELECT c.id FROM public.complaints c
        WHERE c.created_by = auth.uid()
           OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
    );
  END IF;
END $$;

-- 4) Allow authorised users to UPDATE outcomes (for sent toggling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complaint_outcomes'
      AND policyname = 'Users can update outcomes for accessible complaints'
  ) THEN
    CREATE POLICY "Users can update outcomes for accessible complaints"
    ON public.complaint_outcomes
    FOR UPDATE TO authenticated
    USING (
      is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR complaint_id IN (
        SELECT c.id FROM public.complaints c
        WHERE c.created_by = auth.uid()
           OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
    )
    WITH CHECK (
      is_system_admin(auth.uid())
      OR has_role(auth.uid(), 'practice_manager'::app_role)
      OR has_role(auth.uid(), 'complaints_manager'::app_role)
      OR complaint_id IN (
        SELECT c.id FROM public.complaints c
        WHERE c.created_by = auth.uid()
           OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
      )
    );
  END IF;
END $$;
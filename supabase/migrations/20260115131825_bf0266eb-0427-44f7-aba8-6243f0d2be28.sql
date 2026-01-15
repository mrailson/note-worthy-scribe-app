-- Grant Amanda Taylor access to view all NRES hours entries + settings for Admin Claims Report

DROP POLICY IF EXISTS "Admin users can view all hours entries" ON public.nres_hours_entries;
CREATE POLICY "Admin users can view all hours entries"
ON public.nres_hours_entries
FOR SELECT
TO public
USING (
  (auth.uid() = user_id)
  OR is_system_admin(auth.uid())
  OR (auth.uid() = ANY (
    ARRAY[
      '31a9cb05-1a66-4c81-811b-8861874c7f5b'::uuid, -- Mark Gray
      '7ed97e1c-4f3c-435d-b753-17424c5aab00'::uuid, -- Maureen Green
      'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid  -- Amanda Taylor
    ]
  ))
);

DROP POLICY IF EXISTS "Admin users can view all user settings" ON public.nres_user_settings;
CREATE POLICY "Admin users can view all user settings"
ON public.nres_user_settings
FOR SELECT
TO public
USING (
  (auth.uid() = user_id)
  OR is_system_admin(auth.uid())
  OR (auth.uid() = ANY (
    ARRAY[
      '31a9cb05-1a66-4c81-811b-8861874c7f5b'::uuid, -- Mark Gray
      '7ed97e1c-4f3c-435d-b753-17424c5aab00'::uuid, -- Maureen Green
      'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid  -- Amanda Taylor
    ]
  ))
);
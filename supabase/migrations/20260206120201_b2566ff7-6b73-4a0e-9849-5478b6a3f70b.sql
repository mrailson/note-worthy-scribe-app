-- Allow admins to delete any hours entry (matching the existing admin SELECT policy pattern)
CREATE POLICY "Admin users can delete hours entries"
ON public.nres_hours_entries
FOR DELETE
USING (
  is_system_admin(auth.uid()) 
  OR is_nres_claims_admin()
  OR (auth.uid() = ANY (ARRAY[
    '31a9cb05-1a66-4c81-811b-8861874c7f5b'::uuid, 
    '7ed97e1c-4f3c-435d-b753-17424c5aab00'::uuid, 
    'dbefd7c1-47f5-41de-a58e-ab739558af16'::uuid
  ]))
);
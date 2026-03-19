
-- Allow authenticated users to insert into domain_dictionary
CREATE POLICY "Authenticated users can insert dictionary entries"
  ON public.domain_dictionary FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update dictionary entries  
CREATE POLICY "Authenticated users can update dictionary entries"
  ON public.domain_dictionary FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete dictionary entries
CREATE POLICY "Authenticated users can delete dictionary entries"
  ON public.domain_dictionary FOR DELETE
  TO authenticated
  USING (true);

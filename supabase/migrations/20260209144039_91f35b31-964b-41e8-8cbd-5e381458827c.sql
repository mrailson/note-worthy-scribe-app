-- Add DELETE policy for inbound_emails so authenticated users can actually delete emails
CREATE POLICY "Authenticated users can delete inbound emails"
ON public.inbound_emails
FOR DELETE
USING (true);

-- Also add UPDATE policy if missing (needed for reprocessing)
CREATE POLICY "Authenticated users can update inbound emails"
ON public.inbound_emails
FOR UPDATE
USING (true)
WITH CHECK (true);
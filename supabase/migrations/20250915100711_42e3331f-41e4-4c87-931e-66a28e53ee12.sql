-- CRITICAL FIX: Remove dangerous public access policy and implement secure meeting queue access

-- Remove the extremely dangerous policy that allows public access to everything
DROP POLICY IF EXISTS "System can manage notes queue" ON public.meeting_notes_queue;

-- Keep the existing secure policies but enhance them
-- Users can only queue notes for meetings they own - this policy is good, keep it

-- Users can only view queue status for their own meetings - this policy is good, keep it

-- Add a new secure policy for system processes to manage the queue
-- This replaces the dangerous "System can manage notes queue" policy
CREATE POLICY "Authenticated system can process meeting queue" ON public.meeting_notes_queue
FOR ALL TO authenticated
USING (
  -- System admins can manage all queue entries
  is_system_admin(auth.uid()) OR
  -- Users can manage queue entries for their own meetings
  (meeting_id IN (SELECT id FROM meetings WHERE user_id = auth.uid())) OR
  -- Service role can process queue entries (for edge functions)
  (auth.role() = 'service_role')
)
WITH CHECK (
  -- System admins can create/update all queue entries
  is_system_admin(auth.uid()) OR
  -- Users can create/update queue entries for their own meetings
  (meeting_id IN (SELECT id FROM meetings WHERE user_id = auth.uid())) OR
  -- Service role can create/update queue entries (for edge functions)
  (auth.role() = 'service_role')
);

-- Add a policy specifically for edge functions to update queue status during processing
CREATE POLICY "Service role can update queue processing status" ON public.meeting_notes_queue
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);

-- Ensure only authenticated users can delete queue entries and only their own
CREATE POLICY "Users can delete their own meeting queue entries" ON public.meeting_notes_queue
FOR DELETE TO authenticated
USING (
  -- System admins can delete any queue entry
  is_system_admin(auth.uid()) OR
  -- Users can delete queue entries for their own meetings
  (meeting_id IN (SELECT id FROM meetings WHERE user_id = auth.uid())) OR
  -- Service role can delete processed entries (for cleanup)
  (auth.role() = 'service_role')
);
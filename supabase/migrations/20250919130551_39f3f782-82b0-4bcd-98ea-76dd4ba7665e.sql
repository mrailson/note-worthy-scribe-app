-- Add missing is_active column to manual_translation_sessions table
ALTER TABLE public.manual_translation_sessions 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Add RLS policy for is_active column access
CREATE POLICY "Users can manage their own active translation sessions" 
ON public.manual_translation_sessions 
FOR ALL 
USING (auth.uid() = user_id);

-- Create index for better performance on active sessions
CREATE INDEX idx_manual_translation_sessions_active 
ON public.manual_translation_sessions(user_id, is_active) 
WHERE is_active = true;
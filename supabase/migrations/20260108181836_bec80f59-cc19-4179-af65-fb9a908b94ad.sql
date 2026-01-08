-- Add policies for practice managers to manage NRES access for their practice users

CREATE POLICY "Practice managers can insert service activations for their practice" 
ON user_service_activations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles manager_role
    JOIN user_roles target_role ON target_role.user_id = user_service_activations.user_id
    WHERE manager_role.user_id = auth.uid() 
    AND manager_role.role = 'practice_manager'::app_role
    AND manager_role.practice_id IS NOT NULL
    AND target_role.practice_id = manager_role.practice_id
  )
);

CREATE POLICY "Practice managers can delete service activations for their practice" 
ON user_service_activations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles manager_role
    JOIN user_roles target_role ON target_role.user_id = user_service_activations.user_id
    WHERE manager_role.user_id = auth.uid() 
    AND manager_role.role = 'practice_manager'::app_role
    AND manager_role.practice_id IS NOT NULL
    AND target_role.practice_id = manager_role.practice_id
  )
);
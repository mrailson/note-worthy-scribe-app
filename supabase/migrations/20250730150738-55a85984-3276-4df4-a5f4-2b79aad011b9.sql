-- Fix function search path
CREATE OR REPLACE FUNCTION public.has_shared_drive_permission(
  p_user_id UUID,
  p_target_id UUID,
  p_target_type file_type,
  p_action permission_action
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_permission permission_level;
  allowed_actions permission_action[];
BEGIN
  -- Check direct permission
  SELECT permission_level, actions INTO user_permission, allowed_actions
  FROM public.shared_drive_permissions
  WHERE target_id = p_target_id 
    AND target_type = p_target_type 
    AND user_id = p_user_id;
  
  -- If direct permission found, check if action is allowed
  IF user_permission IS NOT NULL THEN
    RETURN p_action = ANY(allowed_actions) OR user_permission = 'owner';
  END IF;
  
  -- If no direct permission and it's a file, check folder permission
  IF p_target_type = 'file' THEN
    SELECT permission_level, actions INTO user_permission, allowed_actions
    FROM public.shared_drive_permissions p
    JOIN public.shared_drive_files f ON f.folder_id = p.target_id
    WHERE f.id = p_target_id 
      AND p.target_type = 'folder'
      AND p.user_id = p_user_id;
      
    IF user_permission IS NOT NULL THEN
      RETURN p_action = ANY(allowed_actions) OR user_permission = 'owner';
    END IF;
  END IF;
  
  -- Check if user created the item (owner access)
  IF p_target_type = 'folder' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.shared_drive_folders 
      WHERE id = p_target_id AND created_by = p_user_id
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.shared_drive_files 
      WHERE id = p_target_id AND created_by = p_user_id
    );
  END IF;
END;
$$;

-- Create RLS policies for folders
CREATE POLICY "Users can view folders they have access to" 
ON public.shared_drive_folders 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  has_shared_drive_permission(auth.uid(), id, 'folder', 'view')
);

CREATE POLICY "Users can create folders in accessible locations" 
ON public.shared_drive_folders 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND (
    parent_id IS NULL OR 
    has_shared_drive_permission(auth.uid(), parent_id, 'folder', 'upload')
  )
);

CREATE POLICY "Users can update folders they own or have edit access" 
ON public.shared_drive_folders 
FOR UPDATE 
USING (
  created_by = auth.uid() OR 
  has_shared_drive_permission(auth.uid(), id, 'folder', 'edit')
);

CREATE POLICY "Users can delete folders they own or have delete access" 
ON public.shared_drive_folders 
FOR DELETE 
USING (
  created_by = auth.uid() OR 
  has_shared_drive_permission(auth.uid(), id, 'folder', 'delete')
);
-- Create RLS policies for files
CREATE POLICY "Users can view files they have access to" 
ON public.shared_drive_files 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  has_shared_drive_permission(auth.uid(), id, 'file', 'view')
);

CREATE POLICY "Users can upload files to accessible folders" 
ON public.shared_drive_files 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND (
    folder_id IS NULL OR 
    has_shared_drive_permission(auth.uid(), folder_id, 'folder', 'upload')
  )
);

CREATE POLICY "Users can update files they own or have edit access" 
ON public.shared_drive_files 
FOR UPDATE 
USING (
  created_by = auth.uid() OR 
  has_shared_drive_permission(auth.uid(), id, 'file', 'edit')
);

CREATE POLICY "Users can delete files they own or have delete access" 
ON public.shared_drive_files 
FOR DELETE 
USING (
  created_by = auth.uid() OR 
  has_shared_drive_permission(auth.uid(), id, 'file', 'delete')
);

-- Create RLS policies for permissions
CREATE POLICY "Users can view permissions for items they can access" 
ON public.shared_drive_permissions 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  granted_by = auth.uid() OR
  (
    target_type = 'folder' AND 
    has_shared_drive_permission(auth.uid(), target_id, 'folder', 'view')
  ) OR
  (
    target_type = 'file' AND 
    has_shared_drive_permission(auth.uid(), target_id, 'file', 'view')
  )
);

CREATE POLICY "Users can manage permissions for items they own" 
ON public.shared_drive_permissions 
FOR ALL 
USING (
  granted_by = auth.uid() OR
  (
    target_type = 'folder' AND 
    EXISTS(SELECT 1 FROM public.shared_drive_folders WHERE id = target_id AND created_by = auth.uid())
  ) OR
  (
    target_type = 'file' AND 
    EXISTS(SELECT 1 FROM public.shared_drive_files WHERE id = target_id AND created_by = auth.uid())
  )
);

-- Create RLS policies for activity log
CREATE POLICY "Users can view activity for items they have access to" 
ON public.shared_drive_activity 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  (
    target_type = 'folder' AND 
    has_shared_drive_permission(auth.uid(), target_id, 'folder', 'view')
  ) OR
  (
    target_type = 'file' AND 
    has_shared_drive_permission(auth.uid(), target_id, 'file', 'view')
  )
);

CREATE POLICY "Users can create activity logs" 
ON public.shared_drive_activity 
FOR INSERT 
WITH CHECK (user_id = auth.uid());
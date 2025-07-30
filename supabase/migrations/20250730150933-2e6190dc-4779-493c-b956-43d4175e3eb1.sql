-- Create storage policies
CREATE POLICY "Users can view files they have permission to" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'shared-drive' AND 
  EXISTS (
    SELECT 1 FROM public.shared_drive_files f
    WHERE f.file_path = name 
      AND (
        f.created_by = auth.uid() OR 
        has_shared_drive_permission(auth.uid(), f.id, 'file', 'view')
      )
  )
);

CREATE POLICY "Users can upload files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'shared-drive' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update files they have permission to" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'shared-drive' AND 
  EXISTS (
    SELECT 1 FROM public.shared_drive_files f
    WHERE f.file_path = name 
      AND (
        f.created_by = auth.uid() OR 
        has_shared_drive_permission(auth.uid(), f.id, 'file', 'edit')
      )
  )
);

CREATE POLICY "Users can delete files they have permission to" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'shared-drive' AND 
  EXISTS (
    SELECT 1 FROM public.shared_drive_files f
    WHERE f.file_path = name 
      AND (
        f.created_by = auth.uid() OR 
        has_shared_drive_permission(auth.uid(), f.id, 'file', 'delete')
      )
  )
);

-- Create indexes for performance
CREATE INDEX idx_shared_drive_folders_parent_id ON public.shared_drive_folders(parent_id);
CREATE INDEX idx_shared_drive_folders_created_by ON public.shared_drive_folders(created_by);
CREATE INDEX idx_shared_drive_folders_path ON public.shared_drive_folders(path);
CREATE INDEX idx_shared_drive_files_folder_id ON public.shared_drive_files(folder_id);
CREATE INDEX idx_shared_drive_files_created_by ON public.shared_drive_files(created_by);
CREATE INDEX idx_shared_drive_files_name ON public.shared_drive_files(name);
CREATE INDEX idx_shared_drive_files_file_type ON public.shared_drive_files(file_type);
CREATE INDEX idx_shared_drive_permissions_target ON public.shared_drive_permissions(target_id, target_type);
CREATE INDEX idx_shared_drive_permissions_user ON public.shared_drive_permissions(user_id);
CREATE INDEX idx_shared_drive_activity_target ON public.shared_drive_activity(target_id, target_type);
CREATE INDEX idx_shared_drive_activity_user ON public.shared_drive_activity(user_id);

-- Add triggers for timestamps
CREATE TRIGGER update_shared_drive_folders_updated_at
  BEFORE UPDATE ON public.shared_drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_drive_files_updated_at
  BEFORE UPDATE ON public.shared_drive_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_drive_permissions_updated_at
  BEFORE UPDATE ON public.shared_drive_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
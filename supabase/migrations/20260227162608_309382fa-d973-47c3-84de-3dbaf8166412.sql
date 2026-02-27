
-- Fix: Allow vault admins to see all permission records for nres_vault items
DROP POLICY IF EXISTS "Users can view permissions for items they can access" ON public.shared_drive_permissions;

CREATE POLICY "Users can view permissions for items they can access"
ON public.shared_drive_permissions
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (granted_by = auth.uid())
  OR (
    -- Vault admins can see all nres_vault permissions
    EXISTS (
      SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid()
    )
  )
  OR (
    (target_type = 'folder'::file_type) 
    AND has_shared_drive_permission(auth.uid(), target_id, 'folder'::file_type, 'view'::permission_action)
  )
  OR (
    (target_type = 'file'::file_type) 
    AND has_shared_drive_permission(auth.uid(), target_id, 'file'::file_type, 'view'::permission_action)
  )
);

-- Also fix the ALL policy to allow vault admins to manage permissions
DROP POLICY IF EXISTS "Users can manage permissions for items they own" ON public.shared_drive_permissions;

CREATE POLICY "Users can manage permissions for items they own"
ON public.shared_drive_permissions
FOR ALL
TO authenticated
USING (
  (granted_by = auth.uid())
  OR (
    -- Vault admins can manage all permissions
    EXISTS (
      SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid()
    )
  )
  OR (
    (target_type = 'folder'::file_type)
    AND EXISTS (
      SELECT 1 FROM public.shared_drive_folders
      WHERE id = shared_drive_permissions.target_id
        AND created_by = auth.uid()
    )
  )
  OR (
    (target_type = 'file'::file_type)
    AND EXISTS (
      SELECT 1 FROM public.shared_drive_files
      WHERE id = shared_drive_permissions.target_id
        AND created_by = auth.uid()
    )
  )
)
WITH CHECK (
  (granted_by = auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.nres_vault_admins WHERE user_id = auth.uid()
    )
  )
  OR (
    (target_type = 'folder'::file_type)
    AND EXISTS (
      SELECT 1 FROM public.shared_drive_folders
      WHERE id = shared_drive_permissions.target_id
        AND created_by = auth.uid()
    )
  )
  OR (
    (target_type = 'file'::file_type)
    AND EXISTS (
      SELECT 1 FROM public.shared_drive_files
      WHERE id = shared_drive_permissions.target_id
        AND created_by = auth.uid()
    )
  )
);


-- 1. Create ENN vault access check function
CREATE OR REPLACE FUNCTION public.has_enn_vault_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_service_activations
    WHERE user_id = p_user_id
      AND service = 'enn'
  );
$$;

-- 2. Create ENN vault permission check function
CREATE OR REPLACE FUNCTION public.check_enn_vault_permission(p_user_id uuid, p_target_id uuid, p_target_type text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permission_level permission_level;
  v_parent_id uuid;
  v_current_folder_id uuid;
  v_has_any_permissions boolean;
  v_is_admin boolean;
BEGIN
  IF NOT has_enn_vault_access(p_user_id) THEN
    RETURN 'no_access';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.nres_vault_admins WHERE user_id = p_user_id
  ) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN 'full_access';
  END IF;

  SELECT permission_level INTO v_permission_level
  FROM public.shared_drive_permissions
  WHERE target_id = p_target_id
    AND target_type = (CASE WHEN p_target_type = 'folder' THEN 'folder'::file_type ELSE 'file'::file_type END)
    AND user_id = p_user_id;

  IF v_permission_level IS NOT NULL THEN
    RETURN v_permission_level::text;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.shared_drive_permissions
    WHERE target_id = p_target_id
      AND target_type = (CASE WHEN p_target_type = 'folder' THEN 'folder'::file_type ELSE 'file'::file_type END)
  ) INTO v_has_any_permissions;

  IF v_has_any_permissions THEN
    RETURN 'no_access';
  END IF;

  IF p_target_type = 'file' THEN
    SELECT folder_id INTO v_current_folder_id
    FROM public.shared_drive_files
    WHERE id = p_target_id;
  ELSE
    SELECT parent_id INTO v_current_folder_id
    FROM public.shared_drive_folders
    WHERE id = p_target_id;
  END IF;

  WHILE v_current_folder_id IS NOT NULL LOOP
    SELECT permission_level INTO v_permission_level
    FROM public.shared_drive_permissions
    WHERE target_id = v_current_folder_id
      AND target_type = 'folder'::file_type
      AND user_id = p_user_id;

    IF v_permission_level IS NOT NULL THEN
      RETURN v_permission_level::text;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.shared_drive_permissions
      WHERE target_id = v_current_folder_id
        AND target_type = 'folder'::file_type
    ) INTO v_has_any_permissions;

    IF v_has_any_permissions THEN
      RETURN 'no_access';
    END IF;

    SELECT parent_id INTO v_current_folder_id
    FROM public.shared_drive_folders
    WHERE id = v_current_folder_id;
  END LOOP;

  RETURN 'full_access';
END;
$$;

-- 3. Create ENN vault item access check
CREATE OR REPLACE FUNCTION public.can_access_enn_vault_item(p_user_id uuid, p_target_id uuid, p_target_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_enn_vault_permission(p_user_id, p_target_id, p_target_type) != 'no_access';
$$;

-- 4. Update SELECT policy on shared_drive_folders
DROP POLICY IF EXISTS "Users can view folders they have access to" ON public.shared_drive_folders;
CREATE POLICY "Users can view folders they have access to"
ON public.shared_drive_folders
FOR SELECT
USING (
  CASE
    WHEN scope = 'nres_vault' THEN can_access_nres_vault_item(auth.uid(), id, 'folder')
    WHEN scope = 'enn_vault' THEN can_access_enn_vault_item(auth.uid(), id, 'folder')
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'folder'::file_type, 'view'::permission_action))
  END
);

-- 5. Update INSERT policy on shared_drive_folders
DROP POLICY IF EXISTS "Users can create folders in accessible locations" ON public.shared_drive_folders;
CREATE POLICY "Users can create folders in accessible locations"
ON public.shared_drive_folders
FOR INSERT
WITH CHECK (
  CASE
    WHEN scope = 'nres_vault' THEN (has_nres_vault_access(auth.uid()) AND created_by = auth.uid() AND (parent_id IS NULL OR can_access_nres_vault_item(auth.uid(), parent_id, 'folder')))
    WHEN scope = 'enn_vault' THEN (has_enn_vault_access(auth.uid()) AND created_by = auth.uid() AND (parent_id IS NULL OR can_access_enn_vault_item(auth.uid(), parent_id, 'folder')))
    ELSE (created_by = auth.uid() AND (parent_id IS NULL OR has_shared_drive_permission(auth.uid(), parent_id, 'folder'::file_type, 'upload'::permission_action)))
  END
);

-- 6. Update UPDATE policy on shared_drive_folders
DROP POLICY IF EXISTS "Users can update folders they own or have edit access" ON public.shared_drive_folders;
CREATE POLICY "Users can update folders they own or have edit access"
ON public.shared_drive_folders
FOR UPDATE
USING (
  CASE
    WHEN scope = 'nres_vault' THEN (can_access_nres_vault_item(auth.uid(), id, 'folder') AND check_nres_vault_permission(auth.uid(), id, 'folder') = ANY(ARRAY['full_access', 'owner', 'editor']))
    WHEN scope = 'enn_vault' THEN (can_access_enn_vault_item(auth.uid(), id, 'folder') AND check_enn_vault_permission(auth.uid(), id, 'folder') = ANY(ARRAY['full_access', 'owner', 'editor']))
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'folder'::file_type, 'edit'::permission_action))
  END
);

-- 7. Update DELETE policy on shared_drive_folders
DROP POLICY IF EXISTS "Users can delete folders they own or have delete access" ON public.shared_drive_folders;
CREATE POLICY "Users can delete folders they own or have delete access"
ON public.shared_drive_folders
FOR DELETE
USING (
  CASE
    WHEN scope = 'nres_vault' THEN (can_access_nres_vault_item(auth.uid(), id, 'folder') AND check_nres_vault_permission(auth.uid(), id, 'folder') = ANY(ARRAY['full_access', 'owner']))
    WHEN scope = 'enn_vault' THEN (can_access_enn_vault_item(auth.uid(), id, 'folder') AND check_enn_vault_permission(auth.uid(), id, 'folder') = ANY(ARRAY['full_access', 'owner']))
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'folder'::file_type, 'delete'::permission_action))
  END
);

-- 8. Update SELECT policy on shared_drive_files
DROP POLICY IF EXISTS "Users can view files they have access to" ON public.shared_drive_files;
CREATE POLICY "Users can view files they have access to"
ON public.shared_drive_files
FOR SELECT
USING (
  CASE
    WHEN scope = 'nres_vault' THEN can_access_nres_vault_item(auth.uid(), id, 'file')
    WHEN scope = 'enn_vault' THEN can_access_enn_vault_item(auth.uid(), id, 'file')
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'file'::file_type, 'view'::permission_action))
  END
);

-- 9. Update INSERT policy on shared_drive_files
DROP POLICY IF EXISTS "Users can upload files to accessible locations" ON public.shared_drive_files;
CREATE POLICY "Users can upload files to accessible locations"
ON public.shared_drive_files
FOR INSERT
WITH CHECK (
  CASE
    WHEN scope = 'nres_vault' THEN (has_nres_vault_access(auth.uid()) AND created_by = auth.uid() AND can_access_nres_vault_item(auth.uid(), folder_id, 'folder'))
    WHEN scope = 'enn_vault' THEN (has_enn_vault_access(auth.uid()) AND created_by = auth.uid() AND can_access_enn_vault_item(auth.uid(), folder_id, 'folder'))
    ELSE (created_by = auth.uid() AND has_shared_drive_permission(auth.uid(), folder_id, 'folder'::file_type, 'upload'::permission_action))
  END
);

-- 10. Update UPDATE policy on shared_drive_files
DROP POLICY IF EXISTS "Users can update files they own or have edit access" ON public.shared_drive_files;
CREATE POLICY "Users can update files they own or have edit access"
ON public.shared_drive_files
FOR UPDATE
USING (
  CASE
    WHEN scope = 'nres_vault' THEN (can_access_nres_vault_item(auth.uid(), id, 'file') AND check_nres_vault_permission(auth.uid(), id, 'file') = ANY(ARRAY['full_access', 'owner', 'editor']))
    WHEN scope = 'enn_vault' THEN (can_access_enn_vault_item(auth.uid(), id, 'file') AND check_enn_vault_permission(auth.uid(), id, 'file') = ANY(ARRAY['full_access', 'owner', 'editor']))
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'file'::file_type, 'edit'::permission_action))
  END
);

-- 11. Update DELETE policy on shared_drive_files
DROP POLICY IF EXISTS "Users can delete files they own or have delete access" ON public.shared_drive_files;
CREATE POLICY "Users can delete files they own or have delete access"
ON public.shared_drive_files
FOR DELETE
USING (
  CASE
    WHEN scope = 'nres_vault' THEN (can_access_nres_vault_item(auth.uid(), id, 'file') AND check_nres_vault_permission(auth.uid(), id, 'file') = ANY(ARRAY['full_access', 'owner']))
    WHEN scope = 'enn_vault' THEN (can_access_enn_vault_item(auth.uid(), id, 'file') AND check_enn_vault_permission(auth.uid(), id, 'file') = ANY(ARRAY['full_access', 'owner']))
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'file'::file_type, 'delete'::permission_action))
  END
);

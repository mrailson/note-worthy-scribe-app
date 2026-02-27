
-- Update check_nres_vault_permission: if a folder/file has ANY explicit permissions,
-- users without a permission get 'no_access' instead of 'full_access'
CREATE OR REPLACE FUNCTION public.check_nres_vault_permission(
  p_user_id uuid,
  p_target_id uuid,
  p_target_type text
)
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
  -- Must have NRES activation
  IF NOT has_nres_vault_access(p_user_id) THEN
    RETURN 'no_access';
  END IF;

  -- Vault admins always get full access
  SELECT EXISTS(
    SELECT 1 FROM public.nres_vault_admins WHERE user_id = p_user_id
  ) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN 'full_access';
  END IF;

  -- Check explicit permission on this item for this user
  SELECT permission_level INTO v_permission_level
  FROM public.shared_drive_permissions
  WHERE target_id = p_target_id
    AND target_type = (CASE WHEN p_target_type = 'folder' THEN 'folder'::file_type ELSE 'file'::file_type END)
    AND user_id = p_user_id;

  IF v_permission_level IS NOT NULL THEN
    RETURN v_permission_level::text;
  END IF;

  -- Check if this item has ANY explicit permissions (i.e. it's restricted)
  SELECT EXISTS(
    SELECT 1 FROM public.shared_drive_permissions
    WHERE target_id = p_target_id
      AND target_type = (CASE WHEN p_target_type = 'folder' THEN 'folder'::file_type ELSE 'file'::file_type END)
  ) INTO v_has_any_permissions;

  -- If permissions exist but not for this user, they can't access
  IF v_has_any_permissions THEN
    RETURN 'no_access';
  END IF;

  -- If it's a file, get its folder_id and check folder chain
  IF p_target_type = 'file' THEN
    SELECT folder_id INTO v_current_folder_id
    FROM public.shared_drive_files
    WHERE id = p_target_id;
  ELSE
    -- For folders, start checking from parent
    SELECT parent_id INTO v_current_folder_id
    FROM public.shared_drive_folders
    WHERE id = p_target_id;
  END IF;

  -- Walk up the folder tree checking for inherited permissions
  WHILE v_current_folder_id IS NOT NULL LOOP
    -- Check user's permission on this ancestor
    SELECT permission_level INTO v_permission_level
    FROM public.shared_drive_permissions
    WHERE target_id = v_current_folder_id
      AND target_type = 'folder'::file_type
      AND user_id = p_user_id;

    IF v_permission_level IS NOT NULL THEN
      RETURN v_permission_level::text;
    END IF;

    -- Check if this ancestor has any permissions (restricted)
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

  -- No explicit permission anywhere in chain = full access (NRES default)
  RETURN 'full_access';
END;
$$;

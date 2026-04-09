
CREATE OR REPLACE FUNCTION public.check_nres_vault_permission(p_user_id uuid, p_target_id uuid, p_target_type text)
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
    -- If explicitly set to no_access, block them
    IF v_permission_level::text = 'no_access' THEN
      RETURN 'no_access';
    END IF;
    RETURN v_permission_level::text;
  END IF;

  -- No explicit permission on this item for this user.
  -- Walk up the folder tree to check for inherited explicit permissions or no_access.
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
      IF v_permission_level::text = 'no_access' THEN
        RETURN 'no_access';
      END IF;
      RETURN v_permission_level::text;
    END IF;

    SELECT parent_id INTO v_current_folder_id
    FROM public.shared_drive_folders
    WHERE id = v_current_folder_id;
  END LOOP;

  -- NRES-activated user with no explicit permission anywhere in chain = default viewer access
  RETURN 'viewer';
END;
$$;

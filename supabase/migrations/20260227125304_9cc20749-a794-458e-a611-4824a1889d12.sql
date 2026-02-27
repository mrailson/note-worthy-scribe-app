
-- 1. Add scope column to folders and files tables
ALTER TABLE public.shared_drive_folders ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'general';
ALTER TABLE public.shared_drive_files ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'general';

-- 2. Create indexes for scope filtering
CREATE INDEX IF NOT EXISTS idx_shared_drive_folders_scope ON public.shared_drive_folders(scope);
CREATE INDEX IF NOT EXISTS idx_shared_drive_files_scope ON public.shared_drive_files(scope);

-- 3. Security definer function to check NRES vault access
CREATE OR REPLACE FUNCTION public.has_nres_vault_access(p_user_id uuid)
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
      AND service = 'nres'
  );
$$;

-- 4. Function to check effective vault permission (with inheritance)
-- Returns: 'full_access', 'viewer', 'editor', 'no_access'
CREATE OR REPLACE FUNCTION public.check_nres_vault_permission(
  p_user_id uuid,
  p_target_id uuid,
  p_target_type text  -- 'folder' or 'file'
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
BEGIN
  -- Must have NRES activation
  IF NOT has_nres_vault_access(p_user_id) THEN
    RETURN 'no_access';
  END IF;

  -- Check explicit permission on this item
  SELECT permission_level INTO v_permission_level
  FROM public.shared_drive_permissions
  WHERE target_id = p_target_id
    AND target_type = (CASE WHEN p_target_type = 'folder' THEN 'folder'::file_type ELSE 'file'::file_type END)
    AND user_id = p_user_id;

  IF v_permission_level IS NOT NULL THEN
    RETURN v_permission_level::text;
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
    SELECT permission_level INTO v_permission_level
    FROM public.shared_drive_permissions
    WHERE target_id = v_current_folder_id
      AND target_type = 'folder'::file_type
      AND user_id = p_user_id;

    IF v_permission_level IS NOT NULL THEN
      RETURN v_permission_level::text;
    END IF;

    SELECT parent_id INTO v_current_folder_id
    FROM public.shared_drive_folders
    WHERE id = v_current_folder_id;
  END LOOP;

  -- No explicit permission anywhere in chain = full access (NRES default)
  RETURN 'full_access';
END;
$$;

-- 5. Helper function for RLS: checks if user can access nres_vault item
CREATE OR REPLACE FUNCTION public.can_access_nres_vault_item(
  p_user_id uuid,
  p_target_id uuid,
  p_target_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_nres_vault_permission(p_user_id, p_target_id, p_target_type) != 'no_access';
$$;

-- 6. Drop and recreate RLS policies for shared_drive_folders to include vault logic
DROP POLICY IF EXISTS "Users can view folders they have access to" ON public.shared_drive_folders;
CREATE POLICY "Users can view folders they have access to"
ON public.shared_drive_folders FOR SELECT
TO authenticated
USING (
  CASE
    WHEN scope = 'nres_vault' THEN can_access_nres_vault_item(auth.uid(), id, 'folder')
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'folder'::file_type, 'view'::permission_action))
  END
);

DROP POLICY IF EXISTS "Users can create folders in accessible locations" ON public.shared_drive_folders;
CREATE POLICY "Users can create folders in accessible locations"
ON public.shared_drive_folders FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN scope = 'nres_vault' THEN
      has_nres_vault_access(auth.uid()) AND created_by = auth.uid()
      AND (parent_id IS NULL OR can_access_nres_vault_item(auth.uid(), parent_id, 'folder'))
    ELSE
      created_by = auth.uid() AND (parent_id IS NULL OR has_shared_drive_permission(auth.uid(), parent_id, 'folder'::file_type, 'upload'::permission_action))
  END
);

DROP POLICY IF EXISTS "Users can update folders they own or have edit access" ON public.shared_drive_folders;
CREATE POLICY "Users can update folders they own or have edit access"
ON public.shared_drive_folders FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN scope = 'nres_vault' THEN
      can_access_nres_vault_item(auth.uid(), id, 'folder')
      AND check_nres_vault_permission(auth.uid(), id, 'folder') IN ('full_access', 'owner', 'editor')
    ELSE
      created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'folder'::file_type, 'edit'::permission_action)
  END
);

DROP POLICY IF EXISTS "Users can delete folders they own or have delete access" ON public.shared_drive_folders;
CREATE POLICY "Users can delete folders they own or have delete access"
ON public.shared_drive_folders FOR DELETE
TO authenticated
USING (
  CASE
    WHEN scope = 'nres_vault' THEN
      can_access_nres_vault_item(auth.uid(), id, 'folder')
      AND check_nres_vault_permission(auth.uid(), id, 'folder') IN ('full_access', 'owner')
    ELSE
      created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'folder'::file_type, 'delete'::permission_action)
  END
);

-- 7. Drop and recreate RLS policies for shared_drive_files to include vault logic
DROP POLICY IF EXISTS "Users can view files they have access to" ON public.shared_drive_files;
CREATE POLICY "Users can view files they have access to"
ON public.shared_drive_files FOR SELECT
TO authenticated
USING (
  CASE
    WHEN scope = 'nres_vault' THEN can_access_nres_vault_item(auth.uid(), id, 'file')
    ELSE (created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'file'::file_type, 'view'::permission_action))
  END
);

DROP POLICY IF EXISTS "Users can upload files to accessible folders" ON public.shared_drive_files;
CREATE POLICY "Users can upload files to accessible folders"
ON public.shared_drive_files FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN scope = 'nres_vault' THEN
      has_nres_vault_access(auth.uid()) AND created_by = auth.uid()
      AND (folder_id IS NULL OR can_access_nres_vault_item(auth.uid(), folder_id, 'folder'))
    ELSE
      created_by = auth.uid() AND (folder_id IS NULL OR has_shared_drive_permission(auth.uid(), folder_id, 'folder'::file_type, 'upload'::permission_action))
  END
);

DROP POLICY IF EXISTS "Users can update files they own or have edit access" ON public.shared_drive_files;
CREATE POLICY "Users can update files they own or have edit access"
ON public.shared_drive_files FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN scope = 'nres_vault' THEN
      can_access_nres_vault_item(auth.uid(), id, 'file')
      AND check_nres_vault_permission(auth.uid(), id, 'file') IN ('full_access', 'owner', 'editor')
    ELSE
      created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'file'::file_type, 'edit'::permission_action)
  END
);

DROP POLICY IF EXISTS "Users can delete files they own or have delete access" ON public.shared_drive_files;
CREATE POLICY "Users can delete files they own or have delete access"
ON public.shared_drive_files FOR DELETE
TO authenticated
USING (
  CASE
    WHEN scope = 'nres_vault' THEN
      can_access_nres_vault_item(auth.uid(), id, 'file')
      AND check_nres_vault_permission(auth.uid(), id, 'file') IN ('full_access', 'owner')
    ELSE
      created_by = auth.uid() OR has_shared_drive_permission(auth.uid(), id, 'file'::file_type, 'delete'::permission_action)
  END
);

-- Drop the old constraint that doesn't account for scope
ALTER TABLE public.shared_drive_folders
  DROP CONSTRAINT IF EXISTS shared_drive_folders_parent_id_name_key;

-- Create a new unique constraint that includes scope
-- This allows the same folder name under the same parent in different scopes (nres_vault vs enn_vault)
ALTER TABLE public.shared_drive_folders
  ADD CONSTRAINT shared_drive_folders_scope_parent_id_name_key
  UNIQUE (scope, parent_id, name);

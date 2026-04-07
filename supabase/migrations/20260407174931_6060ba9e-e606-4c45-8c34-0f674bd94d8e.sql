-- Duplicate NRES vault folder structure into ENN vault scope
-- Uses a temporary mapping table to preserve parent-child relationships

DO $$
DECLARE
  rec RECORD;
  new_id UUID;
  parent_new_id UUID;
BEGIN
  -- Create temp table for old->new ID mapping
  CREATE TEMP TABLE _folder_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL);

  -- Process folders in topological order (roots first, then children)
  -- We use a recursive CTE to get the correct insertion order
  FOR rec IN
    WITH RECURSIVE folder_tree AS (
      SELECT id, name, parent_id, path, created_by, 0 AS depth
      FROM shared_drive_folders
      WHERE scope = 'nres_vault' AND parent_id IS NULL
      UNION ALL
      SELECT f.id, f.name, f.parent_id, f.path, f.created_by, ft.depth + 1
      FROM shared_drive_folders f
      JOIN folder_tree ft ON f.parent_id = ft.id
      WHERE f.scope = 'nres_vault'
    )
    SELECT * FROM folder_tree ORDER BY depth, name
  LOOP
    new_id := gen_random_uuid();

    -- Look up parent's new ID (NULL for root folders)
    IF rec.parent_id IS NOT NULL THEN
      SELECT fm.new_id INTO parent_new_id FROM _folder_map fm WHERE fm.old_id = rec.parent_id;
    ELSE
      parent_new_id := NULL;
    END IF;

    INSERT INTO shared_drive_folders (id, name, parent_id, created_by, path, scope)
    VALUES (
      new_id,
      rec.name,
      parent_new_id,
      rec.created_by,
      COALESCE(parent_new_id::text || '/', '') || rec.name,
      'enn_vault'
    );

    INSERT INTO _folder_map (old_id, new_id) VALUES (rec.id, new_id);
  END LOOP;

  DROP TABLE _folder_map;
END $$;

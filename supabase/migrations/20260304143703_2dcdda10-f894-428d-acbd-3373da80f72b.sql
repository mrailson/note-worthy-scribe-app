DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'practice_role'
      AND e.enumlabel = 'practice_manager'
  ) THEN
    ALTER TYPE public.practice_role ADD VALUE 'practice_manager';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'practice_role'
      AND e.enumlabel = 'deputy_practice_manager'
  ) THEN
    ALTER TYPE public.practice_role ADD VALUE 'deputy_practice_manager';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'practice_role'
      AND e.enumlabel = 'clinician'
  ) THEN
    ALTER TYPE public.practice_role ADD VALUE 'clinician';
  END IF;
END
$$;
-- First, let's check if the contractors table exists and examine its structure
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contractors'
) as table_exists;

-- If contractors table exists, let's see its columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'contractors'
ORDER BY ordinal_position;

-- Check current RLS policies on contractors table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'contractors';
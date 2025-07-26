-- Add subcategory column to complaints table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'complaints' 
        AND column_name = 'subcategory'
    ) THEN
        ALTER TABLE public.complaints 
        ADD COLUMN subcategory text;
    END IF;
END $$;
-- Create the icn_norm function to normalize drug names
CREATE OR REPLACE FUNCTION public.icn_norm(input_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- Basic normalization: lowercase, remove extra spaces, remove common suffixes
    RETURN TRIM(
        LOWER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(input_name, '\s+', ' ', 'g'), -- normalize spaces
                    '\s*(tablet|capsule|injection|cream|ointment|spray|inhaler|solution|suspension|drops)s?\s*$', '', 'gi' -- remove formulation
                ),
                '\s*(mg|mcg|microgram|g|ml|%)\s*\d*\s*$', '', 'gi' -- remove dosage
            )
        )
    );
END;
$$;
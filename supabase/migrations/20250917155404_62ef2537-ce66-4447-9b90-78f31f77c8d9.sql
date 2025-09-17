-- Update neighbourhood assignments for GP practices based on the provided data

-- First ensure we have the neighbourhoods (insert only if they don't exist)
DO $$
DECLARE
    corby_id UUID;
    east_northants_id UUID;
    kettering_id UUID;
    wellingborough_id UUID;
BEGIN
    -- Get or create Corby neighbourhood
    SELECT id INTO corby_id FROM neighbourhoods WHERE name = 'Corby' LIMIT 1;
    IF corby_id IS NULL THEN
        INSERT INTO neighbourhoods (name, description) VALUES ('Corby', 'Corby neighbourhood') RETURNING id INTO corby_id;
    END IF;

    -- Get or create East Northamptonshire neighbourhood
    SELECT id INTO east_northants_id FROM neighbourhoods WHERE name = 'East Northamptonshire' LIMIT 1;
    IF east_northants_id IS NULL THEN
        INSERT INTO neighbourhoods (name, description) VALUES ('East Northamptonshire', 'East Northamptonshire neighbourhood') RETURNING id INTO east_northants_id;
    END IF;

    -- Get or create Kettering neighbourhood
    SELECT id INTO kettering_id FROM neighbourhoods WHERE name = 'Kettering' LIMIT 1;
    IF kettering_id IS NULL THEN
        INSERT INTO neighbourhoods (name, description) VALUES ('Kettering', 'Kettering neighbourhood') RETURNING id INTO kettering_id;
    END IF;

    -- Get or create Wellingborough neighbourhood
    SELECT id INTO wellingborough_id FROM neighbourhoods WHERE name = 'Wellingborough' LIMIT 1;
    IF wellingborough_id IS NULL THEN
        INSERT INTO neighbourhoods (name, description) VALUES ('Wellingborough', 'Wellingborough neighbourhood') RETURNING id INTO wellingborough_id;
    END IF;

    -- Update Corby practices
    UPDATE gp_practices SET neighbourhood_id = corby_id WHERE ods_code IN ('K83002', 'K83002-BP', 'K83059', 'K83614', 'K83614-BP', 'K83622');

    -- Update East Northamptonshire practices
    UPDATE gp_practices SET neighbourhood_id = east_northants_id WHERE ods_code IN ('K83007', 'K83023', 'K83024', 'K83028', 'K83028-BP', 'K83030', 'K83044', 'K83065', 'K83069', 'K83080', 'K83616');

    -- Update Kettering practices
    UPDATE gp_practices SET neighbourhood_id = kettering_id WHERE ods_code IN ('K83006', 'K83013', 'K83021', 'K83036', 'K83036-BP', 'K83037', 'K83039', 'K83051-BP', 'K83051');

    -- Update Wellingborough practices
    UPDATE gp_practices SET neighbourhood_id = wellingborough_id WHERE ods_code IN ('K83005', 'K83011', 'K83026', 'K83026-BP', 'K83047', 'K83059-BP', 'Y00399', 'K83601', 'K83081', 'K83047-BP');

    RAISE NOTICE 'Updated neighbourhood assignments for GP practices';
END $$;
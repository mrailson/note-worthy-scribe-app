-- Correct neighbourhood assignments using practice_code (ODS)
DO $$
DECLARE
  corby_id UUID;
  east_northants_id UUID;
  kettering_id UUID;
  wellingborough_id UUID;
BEGIN
  -- Fetch existing neighbourhood ids
  SELECT id INTO corby_id FROM neighbourhoods WHERE name = 'Corby' LIMIT 1;
  SELECT id INTO east_northants_id FROM neighbourhoods WHERE name = 'East Northamptonshire' LIMIT 1;
  SELECT id INTO kettering_id FROM neighbourhoods WHERE name = 'Kettering' LIMIT 1;
  SELECT id INTO wellingborough_id FROM neighbourhoods WHERE name = 'Wellingborough' LIMIT 1;

  -- Guard: only proceed if all exist
  IF corby_id IS NULL OR east_northants_id IS NULL OR kettering_id IS NULL OR wellingborough_id IS NULL THEN
    RAISE EXCEPTION 'One or more neighbourhoods not found. Aborting.';
  END IF;

  -- Corby
  UPDATE gp_practices SET neighbourhood_id = corby_id
  WHERE practice_code IN ('K83002','K83002-BP','K83059','K83614','K83614-BP','K83622');

  -- East Northamptonshire
  UPDATE gp_practices SET neighbourhood_id = east_northants_id
  WHERE practice_code IN ('K83007','K83023','K83024','K83028','K83028-BP','K83030','K83044','K83065','K83069','K83080','K83616');

  -- Kettering
  UPDATE gp_practices SET neighbourhood_id = kettering_id
  WHERE practice_code IN ('K83006','K83013','K83021','K83036','K83036-BP','K83037','K83039','K83051-BP','K83051');

  -- Wellingborough
  UPDATE gp_practices SET neighbourhood_id = wellingborough_id
  WHERE practice_code IN ('K83005','K83011','K83026','K83026-BP','K83047','K83059-BP','Y00399','K83601','K83081','K83047-BP');
END $$;
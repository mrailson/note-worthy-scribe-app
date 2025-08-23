-- Fix the status_enum constraint to include all valid values
ALTER TABLE traffic_light_medicines DROP CONSTRAINT IF EXISTS traffic_light_medicines_status_enum_check;

ALTER TABLE traffic_light_medicines ADD CONSTRAINT traffic_light_medicines_status_enum_check 
CHECK (status_enum = ANY (ARRAY[
  'DOUBLE_RED'::text, 
  'RED'::text, 
  'SPECIALIST_INITIATED'::text, 
  'SPECIALIST_RECOMMENDED'::text, 
  'AMBER_1'::text,
  'AMBER_2'::text,
  'GREEN'::text,
  'GREY'::text, 
  'UNKNOWN'::text
]));

-- Create the missing deduplicate_medicines function
CREATE OR REPLACE FUNCTION deduplicate_medicines()
RETURNS void AS $$
BEGIN
  -- Remove duplicate medicines based on name and status_enum
  DELETE FROM traffic_light_medicines a
  USING traffic_light_medicines b
  WHERE a.id < b.id
    AND a.name = b.name
    AND a.status_enum = b.status_enum;
END;
$$ LANGUAGE plpgsql;
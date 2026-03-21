UPDATE meeting_groups
SET additional_members = replace(additional_members::text, '"Claire Curely"', '"Claire Curley"')::jsonb
WHERE id = '31af13f9-e567-4dc5-9e9e-a1583b3fbf30';
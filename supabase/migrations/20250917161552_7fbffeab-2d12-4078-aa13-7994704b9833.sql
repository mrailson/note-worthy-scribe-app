-- Update K83020 (Rillwood Medical Centre) to Northampton North and East neighbourhood
UPDATE gp_practices 
SET neighbourhood_id = '8f26a496-ee41-4905-ab7a-a8b861b99576'
WHERE practice_code = 'K83020';

-- Update K83618 (Dr Abbbas (Weston Favell)) to East Northamptonshire neighbourhood  
UPDATE gp_practices 
SET neighbourhood_id = 'e1824813-4d90-4911-9104-e6ac0ba9be15'
WHERE practice_code = 'K83618';
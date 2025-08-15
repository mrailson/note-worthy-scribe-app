-- Create enum for practice-specific roles
CREATE TYPE practice_role AS ENUM (
  'gp_partner',
  'salaried_gp', 
  'reception_team',
  'admin_team',
  'secretaries'
);

-- Add practice_role column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN practice_role practice_role;

-- Create a function to get practice role display names
CREATE OR REPLACE FUNCTION get_practice_role_display_name(role_enum practice_role)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE role_enum
    WHEN 'gp_partner' THEN 'GP Partner'
    WHEN 'salaried_gp' THEN 'Salaried GP'
    WHEN 'reception_team' THEN 'Reception Team'
    WHEN 'admin_team' THEN 'Admin Team'
    WHEN 'secretaries' THEN 'Secretaries'
    ELSE 'Unknown'
  END;
$$;
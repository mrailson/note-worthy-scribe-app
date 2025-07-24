-- Update minimum password length to 8 characters
UPDATE public.security_settings 
SET setting_value = '8', 
    updated_at = now(),
    updated_by = auth.uid()
WHERE setting_name = 'minimum_password_length';
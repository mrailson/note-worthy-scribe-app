-- Update j.railson@nhs.net's role to practice_manager so they can manage attendees
UPDATE user_roles 
SET role = 'practice_manager'
WHERE user_id = 'fcfad128-2a65-4fd0-8b15-5d990262172f';
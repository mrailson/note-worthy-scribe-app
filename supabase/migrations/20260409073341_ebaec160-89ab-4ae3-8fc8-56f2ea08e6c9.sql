-- Insert the "All NRES Users" group
INSERT INTO nres_vault_user_groups (id, name, description, created_by)
VALUES ('a1b2c3d4-0001-4000-8000-000000000001', 'All NRES Users', 'All users activated for the NRES neighbourhood', 'e3aea82f-451b-40fb-8681-2b579a92dc3a')
ON CONFLICT DO NOTHING;

-- Add all NRES-activated users as members
INSERT INTO nres_vault_user_group_members (group_id, user_id)
SELECT 'a1b2c3d4-0001-4000-8000-000000000001', usa.user_id
FROM user_service_activations usa
WHERE usa.service = 'nres'
ON CONFLICT DO NOTHING;

-- Add AI4GP service access for ed.trimbee@nhs.net
INSERT INTO user_service_activations (user_id, service)
VALUES ('f8585588-8c7b-4ae3-b963-26637203d080', 'ai4gp')
ON CONFLICT (user_id, service) DO NOTHING;

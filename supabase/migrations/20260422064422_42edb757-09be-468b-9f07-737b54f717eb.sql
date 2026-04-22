INSERT INTO public.user_service_activations (user_id, service)
VALUES ('9db2022b-f6ac-41eb-85e9-feb9886fa7bf', 'policy_service')
ON CONFLICT DO NOTHING;
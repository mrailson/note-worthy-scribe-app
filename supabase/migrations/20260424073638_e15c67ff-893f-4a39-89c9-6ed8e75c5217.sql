INSERT INTO public.user_service_activations (user_id, service, activated_at)
VALUES ('7a85804c-b5bb-499d-a106-1a6886d2dfd4', 'nres', now())
ON CONFLICT DO NOTHING;
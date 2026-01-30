-- Add policy_service activation for Dr Kant
INSERT INTO public.user_service_activations (user_id, service, activated_by, activated_at)
VALUES (
  'f03e3f37-4e17-441e-b074-933af6a0dc37',
  'policy_service',
  'e3aea82f-451b-40fb-8681-2b579a92dc3a',
  now()
)
ON CONFLICT DO NOTHING;

INSERT INTO public.shared_drive_permissions (target_id, target_type, user_id, permission_level, actions, is_inherited, granted_by)
VALUES
  ('4e517464-b711-4f8c-87e2-6c438dfed47a', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('04dc5ab6-7c21-4cc2-ae51-092f3b333c58', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('2a4af3b7-c044-456a-8b41-aa4a6139b64d', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('421f20f6-c77e-4a40-97aa-2a45990cd025', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('555f2487-7b5d-42d3-be77-5e5e72f78c5e', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('899f04e8-697e-4840-b8cc-5e898e54796a', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('6ec91714-8c6c-482d-8a12-c5ad722f5f5e', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('86a0ec79-1723-4007-a389-1cf7d8dcb0cc', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('520042fd-f3e7-4221-b6fd-795370605463', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('bda2e993-6fdc-4667-b60f-d51d6beadc14', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('08616a40-cef1-4822-bdf4-f3fb6e309805', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a'),
  ('d696b967-2e41-4ea2-b2d2-f197c57da41b', 'folder'::file_type, '8cf36a84-510d-416f-ae94-12aaff2b367f', 'viewer'::permission_level, ARRAY['view']::permission_action[], false, 'e3aea82f-451b-40fb-8681-2b579a92dc3a')
ON CONFLICT (target_id, target_type, user_id) DO NOTHING;

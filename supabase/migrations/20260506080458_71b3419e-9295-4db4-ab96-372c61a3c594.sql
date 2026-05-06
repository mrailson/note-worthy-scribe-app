INSERT INTO public.user_roles (user_id, role, practice_id, can_view_narp_identifiable, can_export_narp_identifiable, narp_upload_access) VALUES
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','c800c954-3928-4a37-a5c4-c4ff3e680333',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','ca27fdcb-2a61-4a22-9c6f-9a8b92a6fbbe',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','85cd140c-2980-40df-8e19-0ffc8a9346d5',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','b2cbe569-30e3-4a66-838a-c2ad54b41ff2',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','09c7d726-5cc5-49a4-8f3d-a65c2993aac5',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','ebb2bf2c-1d20-42d9-8572-ce07a4dae3de',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','cbbb5976-f7a7-4a02-899d-71b18e357e05',true,true,true),
('e3aea82f-451b-40fb-8681-2b579a92dc3a','practice_user','669ec9ca-6d24-43fc-9dc1-a34a8e20965e',true,true,true)
ON CONFLICT (user_id, role, practice_id) DO UPDATE SET
  can_view_narp_identifiable = EXCLUDED.can_view_narp_identifiable,
  can_export_narp_identifiable = EXCLUDED.can_export_narp_identifiable,
  narp_upload_access = EXCLUDED.narp_upload_access;
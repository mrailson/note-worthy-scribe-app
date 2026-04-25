UPDATE public.user_roles
SET narp_upload_access = true
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'::uuid
  AND practice_id = '85cd140c-2980-40df-8e19-0ffc8a9346d5'::uuid
  AND role = 'practice_manager';

ALTER TABLE public.nres_time_entries DISABLE TRIGGER USER;
UPDATE public.nres_time_entries SET practice_id = 'c800c954-3928-4a37-a5c4-c4ff3e680333' WHERE user_id IN ('e3aea82f-451b-40fb-8681-2b579a92dc3a','dbefd7c1-47f5-41de-a58e-ab739558af16') AND practice_id IS NULL;
UPDATE public.nres_time_entries SET practice_id = 'cbbb5976-f7a7-4a02-899d-71b18e357e05' WHERE user_id = '514765c6-bf4e-4586-aa51-29fce84f43ba' AND practice_id IS NULL;
UPDATE public.nres_time_entries SET practice_id = '669ec9ca-6d24-43fc-9dc1-a34a8e20965e' WHERE user_id = '26b95401-77e0-423b-938b-574e8e8bfc8c' AND practice_id IS NULL;
UPDATE public.nres_time_entries SET practice_id = '85cd140c-2980-40df-8e19-0ffc8a9346d5' WHERE user_id = '3eecbf7f-4956-4f29-94d6-21910819b0b5' AND practice_id IS NULL;
UPDATE public.nres_time_entries SET practice_id = 'ca27fdcb-2a61-4a22-9c6f-9a8b92a6fbbe' WHERE user_id = 'abce833a-7df3-4887-8133-68edcc2a36e5' AND practice_id IS NULL;
UPDATE public.nres_time_entries SET practice_id = 'b2cbe569-30e3-4a66-838a-c2ad54b41ff2' WHERE user_id = '8637a642-97d1-4a5a-ba0f-6ea503a4ae3c' AND practice_id IS NULL;
ALTER TABLE public.nres_time_entries ENABLE TRIGGER USER;

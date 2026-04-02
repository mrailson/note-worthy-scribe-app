
-- Move K83023 (Oundle) from Harborough Hub to Meadows Hub
DELETE FROM public.enn_hub_practice_mappings
WHERE hub_id = 'a1000001-0001-0001-0001-000000000001'
  AND practice_id = '070d9c2c-cf7d-4826-8a2d-8ac8350f0632';

INSERT INTO public.enn_hub_practice_mappings (hub_id, practice_id)
VALUES ('a1000001-0001-0001-0001-000000000003', '070d9c2c-cf7d-4826-8a2d-8ac8350f0632')
ON CONFLICT (hub_id, practice_id) DO NOTHING;

-- Move K83065 (Nene Valley) from Harborough Hub to Meadows Hub
DELETE FROM public.enn_hub_practice_mappings
WHERE hub_id = 'a1000001-0001-0001-0001-000000000001'
  AND practice_id = '632bf523-f781-4af6-901a-2b4464139a30';

INSERT INTO public.enn_hub_practice_mappings (hub_id, practice_id)
VALUES ('a1000001-0001-0001-0001-000000000003', '632bf523-f781-4af6-901a-2b4464139a30')
ON CONFLICT (hub_id, practice_id) DO NOTHING;

-- Move K83080 (Higham Ferrers) from Meadows Hub to Harborough Hub
DELETE FROM public.enn_hub_practice_mappings
WHERE hub_id = 'a1000001-0001-0001-0001-000000000003'
  AND practice_id = '5ae2005e-fe5f-4efa-9b76-b0c97bf41e40';

INSERT INTO public.enn_hub_practice_mappings (hub_id, practice_id)
VALUES ('a1000001-0001-0001-0001-000000000001', '5ae2005e-fe5f-4efa-9b76-b0c97bf41e40')
ON CONFLICT (hub_id, practice_id) DO NOTHING;

-- Update hub aggregate data
UPDATE public.enn_hubs SET
  hub_list_size = 42315,
  annual_income = 1114153.95,
  weekly_appts_required = 675
WHERE id = 'a1000001-0001-0001-0001-000000000001';

UPDATE public.enn_hubs SET
  hub_list_size = 24065,
  annual_income = 633704.58,
  weekly_appts_required = 385
WHERE id = 'a1000001-0001-0001-0001-000000000002';

UPDATE public.enn_hubs SET
  hub_list_size = 23861,
  annual_income = 628187.00,
  weekly_appts_required = 378
WHERE id = 'a1000001-0001-0001-0001-000000000003';

-- Update Marshalls Road to participating_winter = true
UPDATE public.enn_practice_data SET participating_winter = true
WHERE ods_code = 'K83069';

-- Update non_winter_appts_required
UPDATE public.enn_practice_data SET non_winter_appts_required = 8294 WHERE ods_code = 'K83007';
UPDATE public.enn_practice_data SET non_winter_appts_required = 6840 WHERE ods_code = 'K83028';
UPDATE public.enn_practice_data SET non_winter_appts_required = 5556 WHERE ods_code = 'K83030';
UPDATE public.enn_practice_data SET non_winter_appts_required = 8069 WHERE ods_code = 'K83044';

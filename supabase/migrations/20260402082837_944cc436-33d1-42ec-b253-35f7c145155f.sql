
-- Insert 3 ENN hubs
INSERT INTO public.enn_hubs (id, practice_id, hub_name, hub_list_size, annual_income, weekly_appts_required) VALUES
  ('a1000001-0001-0001-0001-000000000001', '03c96679-cae4-4507-b84e-2094a989ab6a', 'Harborough Field Surgery Hub', 42315, 1114153.95, 675),
  ('a1000001-0001-0001-0001-000000000002', '6cc9554d-9712-4e17-958d-6dac71c2c0c8', 'The Cottons Hub', 24065, 633631.45, 383),
  ('a1000001-0001-0001-0001-000000000003', '5f30b528-7ef4-490d-a3a8-d63b6c9b5a43', 'The Meadows Hub', 23861, 628260.13, 380);

-- Hub-practice mappings: Harborough Field Hub
INSERT INTO public.enn_hub_practice_mappings (hub_id, practice_id) VALUES
  ('a1000001-0001-0001-0001-000000000001', '03c96679-cae4-4507-b84e-2094a989ab6a'),
  ('a1000001-0001-0001-0001-000000000001', '070d9c2c-cf7d-4826-8a2d-8ac8350f0632'),
  ('a1000001-0001-0001-0001-000000000001', '632bf523-f781-4af6-901a-2b4464139a30'),
  ('a1000001-0001-0001-0001-000000000001', '4efd2c10-73e1-4b56-a453-4d7e4c040bbb'),
  ('a1000001-0001-0001-0001-000000000001', '7620d5ab-54ab-4e75-930d-6f901246bdfe');

-- Hub-practice mappings: Cottons Hub
INSERT INTO public.enn_hub_practice_mappings (hub_id, practice_id) VALUES
  ('a1000001-0001-0001-0001-000000000002', '6cc9554d-9712-4e17-958d-6dac71c2c0c8'),
  ('a1000001-0001-0001-0001-000000000002', 'c5e24ad7-2fe0-4083-84d1-7c06a0767222'),
  ('a1000001-0001-0001-0001-000000000002', '7914fe14-5bd7-4394-8458-605307096b09');

-- Hub-practice mappings: Meadows Hub
INSERT INTO public.enn_hub_practice_mappings (hub_id, practice_id) VALUES
  ('a1000001-0001-0001-0001-000000000003', '5f30b528-7ef4-490d-a3a8-d63b6c9b5a43'),
  ('a1000001-0001-0001-0001-000000000003', '5ae2005e-fe5f-4efa-9b76-b0c97bf41e40');

-- Practice data for all 10 ENN practices
INSERT INTO public.enn_practice_data (practice_id, ods_code, list_size, address, annual_appts_required, weekly_appts_required, participating_winter, winter_appts_required, non_winter_appts_required, weekly_non_winter_appts) VALUES
  ('03c96679-cae4-4507-b84e-2094a989ab6a', 'K83007', 13991, '160 Newton Road, Rushden, NN10 0GP', 11604, 222, true, 253, 6294, 213),
  ('070d9c2c-cf7d-4826-8a2d-8ac8350f0632', 'K83023', 10600, 'Glapthorn Rd, Peterborough PE8 4JA', 8792, 169, true, 193, 6284, 161),
  ('7620d5ab-54ab-4e75-930d-6f901246bdfe', 'K83024', 9143, 'Adnitt Road, Rushden, NN10 9TR', 7583, 146, true, 166, 5420, 139),
  ('c5e24ad7-2fe0-4083-84d1-7c06a0767222', 'K83028', 11537, '59 High St, Irthlingborough, Wellingborough NN9 5GA', 9569, 184, true, 210, 6896, 175),
  ('6cc9554d-9712-4e17-958d-6dac71c2c0c8', 'K83030', 9372, 'Meadow Lane, Raunds, NN9 6UA', 7773, 149, true, 171, 5566, 142),
  ('4efd2c10-73e1-4b56-a453-4d7e4c040bbb', 'K83044', 13612, 'Wymington Road, Rushden NN10 9EB', 11290, 217, true, 248, 6459, 207),
  ('632bf523-f781-4af6-901a-2b4464139a30', 'K83065', 6921, 'Green Lane, Thrapston, NN14 4QL', 5740, 110, true, 126, 4103, 105),
  ('7914fe14-5bd7-4394-8458-605307096b09', 'K83069', 3156, '7 Marshalls Rd, Raunds, Wellingborough NN9 6ET', 2618, 50, false, 57, 1871, 48),
  ('5ae2005e-fe5f-4efa-9b76-b0c97bf41e40', 'K83080', 5569, 'Saffron Rd, Higham Ferrers, Rushden NN10 8ED', 4619, 89, true, 101, 3301, 85),
  ('5f30b528-7ef4-490d-a3a8-d63b6c9b5a43', 'K83616', 6340, 'Meadow Lane, Wellingborough NN8 4GD', 5258, 101, true, 115, 3758, 96);

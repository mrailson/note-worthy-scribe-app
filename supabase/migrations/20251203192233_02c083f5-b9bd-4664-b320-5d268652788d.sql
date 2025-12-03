-- Batch 113-118: Dermatology
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Inflammatory skin conditions
('9014002', 'Psoriasis', 'Dermatology'),
('200956002', 'Plaque psoriasis', 'Dermatology'),
('156372006', 'Guttate psoriasis', 'Dermatology'),
('238602006', 'Pustular psoriasis', 'Dermatology'),
('24079001', 'Atopic dermatitis', 'Dermatology'),
('111196000', 'Contact dermatitis', 'Dermatology'),
('40275004', 'Seborrhoeic dermatitis', 'Dermatology'),
('707096006', 'Venous eczema', 'Dermatology'),
('238575004', 'Discoid eczema', 'Dermatology'),
-- Other skin conditions
('400122007', 'Lichen planus', 'Dermatology'),
('238717006', 'Lichen sclerosus', 'Dermatology'),
('399967006', 'Vitiligo', 'Dermatology'),
('201082009', 'Alopecia areata', 'Dermatology'),
('7200002', 'Acne vulgaris', 'Dermatology'),
('238616008', 'Rosacea', 'Dermatology'),
('81000006', 'Hidradenitis suppurativa', 'Dermatology'),
('238689008', 'Urticaria', 'Dermatology'),
('402387002', 'Chronic spontaneous urticaria', 'Dermatology'),
('402752000', 'Angioedema', 'Dermatology'),
-- Skin infections
('56415008', 'Cellulitis', 'Dermatology'),
('442438000', 'Erysipelas', 'Dermatology'),
('51615001', 'Impetigo', 'Dermatology'),
('47382004', 'Herpes zoster', 'Dermatology'),
('240532009', 'Human papillomavirus infection', 'Dermatology'),
('61462000', 'Molluscum contagiosum', 'Dermatology')
ON CONFLICT (snomed_code) DO NOTHING;
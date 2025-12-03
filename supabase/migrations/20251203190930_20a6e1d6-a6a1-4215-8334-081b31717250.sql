-- Batch 24: Skin conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('9014002', 'Psoriasis', 'diagnoses', 'Dermatology'),
('24079001', 'Atopic dermatitis', 'diagnoses', 'Dermatology'),
('402408009', 'Acne vulgaris', 'diagnoses', 'Dermatology'),
('238575004', 'Rosacea', 'diagnoses', 'Dermatology'),
('200773005', 'Vitiligo', 'diagnoses', 'Dermatology'),
('62315008', 'Alopecia areata', 'diagnoses', 'Dermatology'),
('156378007', 'Urticaria', 'diagnoses', 'Dermatology'),
('399979006', 'Hidradenitis suppurativa', 'diagnoses', 'Dermatology'),
('402226006', 'Lichen planus', 'diagnoses', 'Dermatology'),
('254683007', 'Melanoma', 'diagnoses', 'Dermatology'),
('254651007', 'Basal cell carcinoma', 'diagnoses', 'Dermatology'),
('254658001', 'Squamous cell carcinoma of skin', 'diagnoses', 'Dermatology'),
('238612007', 'Seborrhoeic dermatitis', 'diagnoses', 'Dermatology'),
('84849002', 'Herpes zoster', 'diagnoses', 'Dermatology'),
('56820009', 'Herpes simplex', 'diagnoses', 'Dermatology')
ON CONFLICT (snomed_code) DO NOTHING;
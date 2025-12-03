-- Batch 52: Sexual and reproductive health
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('8098009', 'Chlamydia infection', 'diagnoses', 'Sexual Health'),
('15628003', 'Gonorrhoea', 'diagnoses', 'Sexual Health'),
('76272004', 'Syphilis', 'diagnoses', 'Sexual Health'),
('240589008', 'Genital warts', 'diagnoses', 'Sexual Health'),
('33839006', 'Genital herpes', 'diagnoses', 'Sexual Health'),
('186788009', 'Bacterial vaginosis', 'diagnoses', 'Sexual Health'),
('72934000', 'Candida infection', 'diagnoses', 'Sexual Health'),
('67750007', 'Trichomoniasis', 'diagnoses', 'Sexual Health'),
('82347003', 'Combined oral contraception', 'diagnoses', 'Contraception'),
('169553002', 'Progestogen only pill', 'diagnoses', 'Contraception'),
('169513002', 'Intrauterine device in situ', 'diagnoses', 'Contraception'),
('169467008', 'Contraceptive implant in situ', 'diagnoses', 'Contraception'),
('275611002', 'Contraceptive injection', 'diagnoses', 'Contraception'),
('31068006', 'Sterilisation', 'diagnoses', 'Contraception'),
('4489008', 'Vasectomy', 'diagnoses', 'Contraception')
ON CONFLICT (snomed_code) DO NOTHING;
-- Batch 30: Men's health
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('266569009', 'Benign prostatic hyperplasia', 'diagnoses', 'Urology'),
('399068003', 'Prostate cancer', 'diagnoses', 'Oncology'),
('30753008', 'Erectile dysfunction', 'diagnoses', 'Urology'),
('48723006', 'Male infertility', 'diagnoses', 'Urology'),
('44054006', 'Testicular cancer', 'diagnoses', 'Oncology'),
('235856003', 'Varicocele', 'diagnoses', 'Urology'),
('78904001', 'Hydrocele', 'diagnoses', 'Urology'),
('29000008', 'Epididymitis', 'diagnoses', 'Urology'),
('31070006', 'Orchitis', 'diagnoses', 'Urology'),
('274718005', 'Hypogonadism', 'diagnoses', 'Endocrine'),
('416030007', 'Peyronie disease', 'diagnoses', 'Urology'),
('118188004', 'Phimosis', 'diagnoses', 'Urology'),
('18411001', 'Balanitis', 'diagnoses', 'Urology'),
('34000006', 'Crohn disease of penis', 'diagnoses', 'Urology'),
('197804008', 'Chronic prostatitis', 'diagnoses', 'Urology')
ON CONFLICT (snomed_code) DO NOTHING;
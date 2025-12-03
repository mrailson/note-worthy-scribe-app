-- Batch 95-100: More Oncology
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Urological cancers
('363518002', 'Malignant neoplasm of kidney', 'Oncology'),
('372139008', 'Renal cell carcinoma', 'Oncology'),
('363478007', 'Malignant neoplasm of bladder', 'Oncology'),
('399326009', 'Transitional cell carcinoma of bladder', 'Oncology'),
('254900004', 'Carcinoma of prostate', 'Oncology'),
('314955007', 'Locally advanced prostate cancer', 'Oncology'),
('315004001', 'Metastatic prostate cancer', 'Oncology'),
('254878006', 'Testicular cancer', 'Oncology'),
('402876002', 'Seminoma', 'Oncology'),
-- Gynaecological cancers
('363354003', 'Malignant neoplasm of cervix', 'Oncology'),
('363378002', 'Malignant neoplasm of uterus', 'Oncology'),
('372141009', 'Endometrial carcinoma', 'Oncology'),
('363443007', 'Malignant neoplasm of ovary', 'Oncology'),
('372142002', 'Epithelial ovarian cancer', 'Oncology'),
('363386003', 'Malignant neoplasm of vulva', 'Oncology'),
-- Skin cancers
('372244006', 'Malignant melanoma of skin', 'Oncology'),
('254701007', 'Cutaneous melanoma', 'Oncology'),
('254703005', 'Nodular melanoma', 'Oncology'),
('254704004', 'Lentigo maligna melanoma', 'Oncology'),
('254651007', 'Basal cell carcinoma', 'Oncology'),
('402815007', 'Squamous cell carcinoma of skin', 'Oncology'),
('93655004', 'Merkel cell carcinoma', 'Oncology'),
('403904004', 'Kaposi sarcoma', 'Oncology'),
('254785008', 'Angiosarcoma', 'Oncology'),
('403977003', 'Dermatofibrosarcoma', 'Oncology')
ON CONFLICT (snomed_code) DO NOTHING;
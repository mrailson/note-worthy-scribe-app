-- Batch 89-94: Oncology
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Breast cancer
('254837009', 'Malignant neoplasm of breast', 'Oncology'),
('372137005', 'Primary malignant neoplasm of breast', 'Oncology'),
('315004001', 'Metastatic breast cancer', 'Oncology'),
('429740004', 'Triple negative breast cancer', 'Oncology'),
('450920001', 'HER2 positive breast cancer', 'Oncology'),
('448963000', 'ER positive breast cancer', 'Oncology'),
-- Lung cancer
('254637007', 'Non-small cell lung cancer', 'Oncology'),
('254632001', 'Small cell lung cancer', 'Oncology'),
('372138000', 'Lung adenocarcinoma', 'Oncology'),
('255725003', 'Squamous cell carcinoma of lung', 'Oncology'),
('314994000', 'Metastatic lung cancer', 'Oncology'),
('94391008', 'Mesothelioma', 'Oncology'),
-- GI cancers
('363406005', 'Malignant neoplasm of oesophagus', 'Oncology'),
('363349007', 'Malignant neoplasm of stomach', 'Oncology'),
('93854002', 'Adenocarcinoma of stomach', 'Oncology'),
('363510005', 'Malignant neoplasm of large intestine', 'Oncology'),
('363351006', 'Malignant neoplasm of colon', 'Oncology'),
('363358000', 'Malignant neoplasm of rectum', 'Oncology'),
('314966001', 'Metastatic colorectal cancer', 'Oncology'),
-- Hepatobiliary cancers
('363418001', 'Malignant neoplasm of pancreas', 'Oncology'),
('372003004', 'Hepatocellular carcinoma', 'Oncology'),
('363353009', 'Cholangiocarcinoma', 'Oncology'),
('93824001', 'Malignant neoplasm of gallbladder', 'Oncology'),
('93889004', 'Primary carcinoma of liver', 'Oncology'),
('315280003', 'Metastatic pancreatic cancer', 'Oncology')
ON CONFLICT (snomed_code) DO NOTHING;
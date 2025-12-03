-- Batch 44: Liver and biliary conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('197321007', 'Alcoholic liver disease', 'diagnoses', 'Hepatology'),
('235856003', 'Non-alcoholic fatty liver disease', 'diagnoses', 'Hepatology'),
('19943007', 'Cirrhosis of liver', 'diagnoses', 'Hepatology'),
('36760000', 'Primary biliary cholangitis', 'diagnoses', 'Hepatology'),
('197315008', 'Primary sclerosing cholangitis', 'diagnoses', 'Hepatology'),
('235886009', 'Autoimmune hepatitis', 'diagnoses', 'Hepatology'),
('266474003', 'Portal hypertension', 'diagnoses', 'Hepatology'),
('235494005', 'Ascites', 'diagnoses', 'Hepatology'),
('4740000', 'Hepatic encephalopathy', 'diagnoses', 'Hepatology'),
('60182006', 'Oesophageal varices', 'diagnoses', 'Hepatology'),
('235919008', 'Haemochromatosis', 'diagnoses', 'Hepatology'),
('38016001', 'Wilson disease', 'diagnoses', 'Hepatology'),
('363402007', 'Gilbert syndrome', 'diagnoses', 'Hepatology'),
('95570007', 'Gallstones', 'diagnoses', 'Hepatology'),
('45503006', 'Cholecystitis', 'diagnoses', 'Hepatology')
ON CONFLICT (snomed_code) DO NOTHING;
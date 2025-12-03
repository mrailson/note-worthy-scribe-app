-- Batch 71-76: Respiratory and GI
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description) VALUES
-- Respiratory additional
('233703007', 'Interstitial lung disease', 'Respiratory'),
('196125002', 'Idiopathic pulmonary fibrosis', 'Respiratory'),
('69322001', 'Pneumoconiosis', 'Respiratory'),
('40122008', 'Pneumonitis', 'Respiratory'),
('233604007', 'Pneumonia', 'Respiratory'),
('278516003', 'Lobar pneumonia', 'Respiratory'),
('312342009', 'Infective exacerbation of COPD', 'Respiratory'),
('195951007', 'Acute bronchitis', 'Respiratory'),
('63480004', 'Chronic bronchitis', 'Respiratory'),
('87433001', 'Pulmonary fibrosis', 'Respiratory'),
-- GI additional
('235595009', 'Gastroesophageal reflux disease', 'Gastrointestinal'),
('196731005', 'Oesophagitis', 'Gastrointestinal'),
('235599003', 'Barrett oesophagus', 'Gastrointestinal'),
('126851005', 'Oesophageal stricture', 'Gastrointestinal'),
('363406005', 'Oesophageal cancer', 'Oncology'),
('126824007', 'Gastric ulcer', 'Gastrointestinal'),
('51868009', 'Duodenal ulcer', 'Gastrointestinal'),
('80141007', 'Helicobacter pylori infection', 'Gastrointestinal'),
('235566007', 'Gastritis', 'Gastrointestinal'),
('722944004', 'Gastroparesis', 'Gastrointestinal'),
('59927004', 'Hepatic failure', 'Hepatology'),
('197321007', 'Steatosis of liver', 'Hepatology'),
('197315008', 'Non-alcoholic fatty liver disease', 'Hepatology'),
('442685003', 'Non-alcoholic steatohepatitis', 'Hepatology'),
('328383001', 'Chronic liver disease', 'Hepatology')
ON CONFLICT (snomed_code) DO NOTHING;
-- Batch 40: More GI conditions
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('64613007', 'Hiatus hernia', 'diagnoses', 'Gastroenterology'),
('235653009', 'Barrett oesophagus', 'diagnoses', 'Gastroenterology'),
('79768008', 'Achalasia', 'diagnoses', 'Gastroenterology'),
('47935004', 'Oesophageal stricture', 'diagnoses', 'Gastroenterology'),
('47693006', 'Peptic stricture of oesophagus', 'diagnoses', 'Gastroenterology'),
('235710007', 'Helicobacter pylori infection', 'diagnoses', 'Gastroenterology'),
('397825006', 'Gastric ulcer', 'diagnoses', 'Gastroenterology'),
('51868009', 'Duodenal ulcer', 'diagnoses', 'Gastroenterology'),
('91645004', 'Gastritis', 'diagnoses', 'Gastroenterology'),
('19307009', 'Duodenitis', 'diagnoses', 'Gastroenterology'),
('235653009', 'Gastroparesis', 'diagnoses', 'Gastroenterology'),
('47693006', 'Small bowel obstruction', 'diagnoses', 'Gastroenterology'),
('60728008', 'Large bowel obstruction', 'diagnoses', 'Gastroenterology'),
('91302008', 'Ischaemic colitis', 'diagnoses', 'Gastroenterology'),
('235796008', 'Microscopic colitis', 'diagnoses', 'Gastroenterology')
ON CONFLICT (snomed_code) DO NOTHING;
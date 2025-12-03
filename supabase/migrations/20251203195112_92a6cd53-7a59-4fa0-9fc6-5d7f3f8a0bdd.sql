-- Batch 631-650: Respiratory and GI
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('2776000', 'Pneumothorax', 'Respiratory', 'diagnoses'),
('36971009', 'Lung cancer', 'Oncology', 'diagnoses'),
('254637007', 'Non-small cell lung cancer', 'Oncology', 'diagnoses'),
('254632001', 'Small cell lung cancer', 'Oncology', 'diagnoses'),
('109841003', 'Mesothelioma', 'Oncology', 'diagnoses'),
('78275009', 'Obstructive sleep apnoea', 'Respiratory', 'diagnoses'),
('271825005', 'Respiratory failure', 'Respiratory', 'diagnoses'),
('409622000', 'Type 1 respiratory failure', 'Respiratory', 'diagnoses'),
('409623005', 'Type 2 respiratory failure', 'Respiratory', 'diagnoses'),
('235595009', 'Gastro-oesophageal reflux disease', 'Gastrointestinal', 'diagnoses'),
('196731005', 'Oesophagitis', 'Gastrointestinal', 'diagnoses'),
('126850001', 'Oesophageal stricture', 'Gastrointestinal', 'diagnoses'),
('32230006', 'Barrett oesophagus', 'Gastrointestinal', 'diagnoses'),
('126824007', 'Oesophageal carcinoma', 'Oncology', 'diagnoses'),
('235660007', 'Peptic ulcer disease', 'Gastrointestinal', 'diagnoses'),
('397825006', 'Gastric ulcer', 'Gastrointestinal', 'diagnoses'),
('51868009', 'Duodenal ulcer', 'Gastrointestinal', 'diagnoses'),
('4311000', 'GI haemorrhage', 'Gastrointestinal', 'diagnoses'),
('363518003', 'Upper GI haemorrhage', 'Gastrointestinal', 'diagnoses'),
('3199001', 'Lower GI haemorrhage', 'Gastrointestinal', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 651-670: GI conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('24526004', 'Inflammatory bowel disease', 'Gastrointestinal', 'diagnoses'),
('34000006', 'Crohns disease', 'Gastrointestinal', 'diagnoses'),
('64766004', 'Ulcerative colitis', 'Gastrointestinal', 'diagnoses'),
('202961001', 'Irritable bowel syndrome', 'Gastrointestinal', 'diagnoses'),
('363406005', 'Malignant tumour of colon', 'Oncology', 'diagnoses'),
('363413009', 'Rectal carcinoma', 'Oncology', 'diagnoses'),
('90458007', 'Coeliac disease', 'Gastrointestinal', 'diagnoses'),
('190905008', 'Lactose intolerance', 'Gastrointestinal', 'diagnoses'),
('235796008', 'Gastritis', 'Gastrointestinal', 'diagnoses'),
('4556003', 'Helicobacter pylori infection', 'Gastrointestinal', 'diagnoses'),
('59282003', 'Diverticular disease', 'Gastrointestinal', 'diagnoses'),
('186978008', 'Diverticulitis', 'Gastrointestinal', 'diagnoses'),
('60728008', 'Intestinal obstruction', 'Gastrointestinal', 'diagnoses'),
('367336001', 'Volvulus', 'Gastrointestinal', 'diagnoses'),
('25374005', 'Intussusception', 'Gastrointestinal', 'diagnoses'),
('79963007', 'Perforated viscus', 'Gastrointestinal', 'diagnoses'),
('236023001', 'Anal fissure', 'Gastrointestinal', 'diagnoses'),
('70153002', 'Haemorrhoids', 'Gastrointestinal', 'diagnoses'),
('399294002', 'Fistula in ano', 'Gastrointestinal', 'diagnoses'),
('48532005', 'Rectal prolapse', 'Gastrointestinal', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 671-690: Renal conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('709044004', 'Chronic kidney disease', 'Renal', 'diagnoses'),
('431855005', 'CKD stage 1', 'Renal', 'diagnoses'),
('431856006', 'CKD stage 2', 'Renal', 'diagnoses'),
('433144002', 'CKD stage 3', 'Renal', 'diagnoses'),
('431857002', 'CKD stage 4', 'Renal', 'diagnoses'),
('433146000', 'CKD stage 5', 'Renal', 'diagnoses'),
('46177005', 'End-stage renal disease', 'Renal', 'diagnoses'),
('14669001', 'Acute kidney injury', 'Renal', 'diagnoses'),
('236423003', 'Glomerulonephritis', 'Renal', 'diagnoses'),
('197927001', 'IgA nephropathy', 'Renal', 'diagnoses'),
('236425005', 'Nephrotic syndrome', 'Renal', 'diagnoses'),
('236426006', 'Membranous nephropathy', 'Renal', 'diagnoses'),
('197927001', 'Focal segmental glomerulosclerosis', 'Renal', 'diagnoses'),
('28611005', 'Polycystic kidney disease', 'Renal', 'diagnoses'),
('68566005', 'Urinary tract infection', 'Renal', 'diagnoses'),
('45816000', 'Pyelonephritis', 'Renal', 'diagnoses'),
('80500007', 'Cystitis', 'Renal', 'diagnoses'),
('95570007', 'Urolithiasis', 'Renal', 'diagnoses'),
('36118008', 'Nephrolithiasis', 'Renal', 'diagnoses'),
('63135000', 'Ureteric calculus', 'Renal', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 691-710: More renal and endocrine
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('90708001', 'Kidney cancer', 'Oncology', 'diagnoses'),
('93655004', 'Bladder cancer', 'Oncology', 'diagnoses'),
('271939006', 'Benign prostatic hyperplasia', 'Urology', 'diagnoses'),
('399068003', 'Prostate cancer', 'Oncology', 'diagnoses'),
('372140007', 'Testicular cancer', 'Oncology', 'diagnoses'),
('40930008', 'Hypothyroidism', 'Endocrine', 'diagnoses'),
('80394007', 'Hyperthyroidism', 'Endocrine', 'diagnoses'),
('21983002', 'Graves disease', 'Endocrine', 'diagnoses'),
('363478007', 'Hashimotos thyroiditis', 'Endocrine', 'diagnoses'),
('190268003', 'Thyroid nodule', 'Endocrine', 'diagnoses'),
('363478007', 'Thyroid cancer', 'Oncology', 'diagnoses'),
('26027002', 'Cushings syndrome', 'Endocrine', 'diagnoses'),
('373372003', 'Addisons disease', 'Endocrine', 'diagnoses'),
('68225006', 'Adrenal insufficiency', 'Endocrine', 'diagnoses'),
('190268003', 'Phaeochromocytoma', 'Endocrine', 'diagnoses'),
('36348003', 'Hyperparathyroidism', 'Endocrine', 'diagnoses'),
('36976004', 'Hypoparathyroidism', 'Endocrine', 'diagnoses'),
('237662005', 'Hyperaldosteronism', 'Endocrine', 'diagnoses'),
('190447002', 'Pituitary adenoma', 'Endocrine', 'diagnoses'),
('74728003', 'Prolactinoma', 'Endocrine', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;
-- Add missing SNOMED code for Non-ST-elevation myocardial infarction
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain, source_document)
VALUES ('401314000', 'Non-ST-elevation myocardial infarction', 'Myocardial infarction', 'diagnoses', 'manual_add')
ON CONFLICT (snomed_code) DO NOTHING;
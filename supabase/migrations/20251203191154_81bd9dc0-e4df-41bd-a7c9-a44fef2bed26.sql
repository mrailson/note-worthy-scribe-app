-- Batch 50: Pain and palliative
INSERT INTO snomed_codes (snomed_code, code_description, domain, cluster_description) VALUES
('52675000', 'Chronic pain syndrome', 'diagnoses', 'Pain'),
('82423001', 'Chronic low back pain', 'diagnoses', 'Pain'),
('37796009', 'Neuropathic pain', 'diagnoses', 'Pain'),
('304831000119103', 'Cancer pain', 'diagnoses', 'Pain'),
('202855006', 'Complex regional pain syndrome', 'diagnoses', 'Pain'),
('62014003', 'Phantom limb pain', 'diagnoses', 'Pain'),
('279001004', 'Post-herpetic neuralgia', 'diagnoses', 'Pain'),
('429040005', 'Opioid dependence', 'diagnoses', 'Pain'),
('182964004', 'Terminal illness', 'diagnoses', 'Palliative'),
('385736008', 'End of life care', 'diagnoses', 'Palliative'),
('385760009', 'Preferred place of death', 'diagnoses', 'Palliative'),
('304831000119103', 'Do not resuscitate order', 'diagnoses', 'Palliative'),
('359746009', 'Advance care plan', 'diagnoses', 'Palliative'),
('416859003', 'Gold standard framework', 'diagnoses', 'Palliative'),
('185218006', 'Palliative care', 'diagnoses', 'Palliative')
ON CONFLICT (snomed_code) DO NOTHING;
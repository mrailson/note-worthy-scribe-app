-- Batch 551-570: Diabetic complications
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('4855003', 'Diabetic retinopathy', 'Endocrine', 'diagnoses'),
('127013003', 'Diabetic nephropathy', 'Endocrine', 'diagnoses'),
('230572002', 'Diabetic neuropathy', 'Endocrine', 'diagnoses'),
('280137006', 'Diabetic foot', 'Endocrine', 'diagnoses'),
('421750000', 'Ketoacidosis in type 1 diabetes', 'Endocrine', 'diagnoses'),
('421847006', 'Hyperosmolar hyperglycaemic state', 'Endocrine', 'diagnoses'),
('267384006', 'Hypoglycaemia', 'Endocrine', 'diagnoses'),
('38341003', 'Hypertension', 'Cardiovascular', 'diagnoses'),
('59621000', 'Essential hypertension', 'Cardiovascular', 'diagnoses'),
('70272006', 'Malignant hypertension', 'Cardiovascular', 'diagnoses'),
('48194001', 'Gestational hypertension', 'Cardiovascular', 'diagnoses'),
('398254007', 'Pre-eclampsia', 'Obstetrics', 'diagnoses'),
('15938005', 'Eclampsia', 'Obstetrics', 'diagnoses'),
('73410007', 'Benign intracranial hypertension', 'Neurology', 'diagnoses'),
('34436003', 'Pulmonary hypertension', 'Cardiovascular', 'diagnoses'),
('233815004', 'Portal hypertension', 'Hepatology', 'diagnoses'),
('38481006', 'Hypertensive renal disease', 'Cardiovascular', 'diagnoses'),
('194767001', 'Hypertensive heart disease', 'Cardiovascular', 'diagnoses'),
('59720008', 'Secondary hypertension', 'Cardiovascular', 'diagnoses'),
('1201005', 'Benign hypertension', 'Cardiovascular', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 571-590: Cardiovascular conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('22298006', 'Myocardial infarction', 'Cardiovascular', 'diagnoses'),
('401303003', 'STEMI', 'Cardiovascular', 'diagnoses'),
('401314000', 'NSTEMI', 'Cardiovascular', 'diagnoses'),
('53741008', 'Coronary artery disease', 'Cardiovascular', 'diagnoses'),
('414545008', 'Ischaemic heart disease', 'Cardiovascular', 'diagnoses'),
('194828000', 'Angina pectoris', 'Cardiovascular', 'diagnoses'),
('4557003', 'Unstable angina', 'Cardiovascular', 'diagnoses'),
('233970002', 'Stable angina', 'Cardiovascular', 'diagnoses'),
('42343007', 'Congestive heart failure', 'Cardiovascular', 'diagnoses'),
('84114007', 'Heart failure', 'Cardiovascular', 'diagnoses'),
('441481004', 'Heart failure with reduced ejection fraction', 'Cardiovascular', 'diagnoses'),
('441530006', 'Heart failure with preserved ejection fraction', 'Cardiovascular', 'diagnoses'),
('49436004', 'Atrial fibrillation', 'Cardiovascular', 'diagnoses'),
('5370000', 'Atrial flutter', 'Cardiovascular', 'diagnoses'),
('27885002', 'Ventricular fibrillation', 'Cardiovascular', 'diagnoses'),
('71908006', 'Ventricular tachycardia', 'Cardiovascular', 'diagnoses'),
('418818005', 'Supraventricular tachycardia', 'Cardiovascular', 'diagnoses'),
('28189009', 'Complete heart block', 'Cardiovascular', 'diagnoses'),
('195042002', 'Second degree heart block', 'Cardiovascular', 'diagnoses'),
('270492004', 'First degree heart block', 'Cardiovascular', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 591-610: More cardiac conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('64156001', 'Cardiomyopathy', 'Cardiovascular', 'diagnoses'),
('399020009', 'Dilated cardiomyopathy', 'Cardiovascular', 'diagnoses'),
('45227007', 'Hypertrophic cardiomyopathy', 'Cardiovascular', 'diagnoses'),
('415295002', 'Arrhythmogenic right ventricular cardiomyopathy', 'Cardiovascular', 'diagnoses'),
('399261000', 'Restrictive cardiomyopathy', 'Cardiovascular', 'diagnoses'),
('48724000', 'Mitral valve prolapse', 'Cardiovascular', 'diagnoses'),
('79619009', 'Mitral stenosis', 'Cardiovascular', 'diagnoses'),
('48724000', 'Mitral regurgitation', 'Cardiovascular', 'diagnoses'),
('60573004', 'Aortic stenosis', 'Cardiovascular', 'diagnoses'),
('60234000', 'Aortic regurgitation', 'Cardiovascular', 'diagnoses'),
('49915006', 'Tricuspid regurgitation', 'Cardiovascular', 'diagnoses'),
('91434003', 'Pericarditis', 'Cardiovascular', 'diagnoses'),
('373945007', 'Pericardial effusion', 'Cardiovascular', 'diagnoses'),
('47683004', 'Cardiac tamponade', 'Cardiovascular', 'diagnoses'),
('56265001', 'Endocarditis', 'Cardiovascular', 'diagnoses'),
('3238004', 'Myocarditis', 'Cardiovascular', 'diagnoses'),
('233927002', 'Aortic aneurysm', 'Cardiovascular', 'diagnoses'),
('233985008', 'Aortic dissection', 'Cardiovascular', 'diagnoses'),
('128053003', 'Deep vein thrombosis', 'Cardiovascular', 'diagnoses'),
('59282003', 'Pulmonary embolism', 'Cardiovascular', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 611-630: Respiratory conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('195967001', 'Asthma', 'Respiratory', 'diagnoses'),
('389145006', 'Allergic asthma', 'Respiratory', 'diagnoses'),
('370221004', 'Non-allergic asthma', 'Respiratory', 'diagnoses'),
('304527002', 'Acute severe asthma', 'Respiratory', 'diagnoses'),
('13645005', 'Chronic obstructive pulmonary disease', 'Respiratory', 'diagnoses'),
('195949008', 'Chronic bronchitis', 'Respiratory', 'diagnoses'),
('87433001', 'Emphysema', 'Respiratory', 'diagnoses'),
('233703007', 'Pulmonary fibrosis', 'Respiratory', 'diagnoses'),
('426437004', 'Idiopathic pulmonary fibrosis', 'Respiratory', 'diagnoses'),
('51615001', 'Sarcoidosis', 'Respiratory', 'diagnoses'),
('50043002', 'Bronchiectasis', 'Respiratory', 'diagnoses'),
('233604007', 'Pneumonia', 'Respiratory', 'diagnoses'),
('278516003', 'Community acquired pneumonia', 'Respiratory', 'diagnoses'),
('429271009', 'Hospital acquired pneumonia', 'Respiratory', 'diagnoses'),
('67782005', 'Aspiration pneumonia', 'Respiratory', 'diagnoses'),
('10625071000119104', 'COVID-19', 'Respiratory', 'diagnoses'),
('195951007', 'Acute bronchitis', 'Respiratory', 'diagnoses'),
('82272006', 'Common cold', 'Respiratory', 'diagnoses'),
('6142004', 'Influenza', 'Respiratory', 'diagnoses'),
('43878008', 'Pleural effusion', 'Respiratory', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;
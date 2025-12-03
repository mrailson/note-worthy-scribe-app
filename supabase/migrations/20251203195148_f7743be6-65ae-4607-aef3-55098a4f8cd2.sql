-- Batch 711-730: Neurological conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('230690007', 'Stroke', 'Neurology', 'diagnoses'),
('422504002', 'Ischaemic stroke', 'Neurology', 'diagnoses'),
('274100004', 'Haemorrhagic stroke', 'Neurology', 'diagnoses'),
('266257000', 'Transient ischaemic attack', 'Neurology', 'diagnoses'),
('26929004', 'Alzheimers disease', 'Neurology', 'diagnoses'),
('52448006', 'Dementia', 'Neurology', 'diagnoses'),
('56267009', 'Multi-infarct dementia', 'Neurology', 'diagnoses'),
('312991009', 'Lewy body dementia', 'Neurology', 'diagnoses'),
('230270009', 'Frontotemporal dementia', 'Neurology', 'diagnoses'),
('49049000', 'Parkinsons disease', 'Neurology', 'diagnoses'),
('24700007', 'Multiple sclerosis', 'Neurology', 'diagnoses'),
('86044005', 'Amyotrophic lateral sclerosis', 'Neurology', 'diagnoses'),
('155080004', 'Myasthenia gravis', 'Neurology', 'diagnoses'),
('84757009', 'Epilepsy', 'Neurology', 'diagnoses'),
('230384005', 'Generalised epilepsy', 'Neurology', 'diagnoses'),
('230390002', 'Focal epilepsy', 'Neurology', 'diagnoses'),
('128613002', 'Status epilepticus', 'Neurology', 'diagnoses'),
('193003', 'Benign paroxysmal positional vertigo', 'Neurology', 'diagnoses'),
('37796009', 'Migraine', 'Neurology', 'diagnoses'),
('26079004', 'Cluster headache', 'Neurology', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 731-750: More neurology and mental health
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('398687004', 'Tension headache', 'Neurology', 'diagnoses'),
('278854005', 'Chronic pain syndrome', 'Neurology', 'diagnoses'),
('387834008', 'Trigeminal neuralgia', 'Neurology', 'diagnoses'),
('81680005', 'Facial palsy', 'Neurology', 'diagnoses'),
('193093009', 'Bells palsy', 'Neurology', 'diagnoses'),
('23406000', 'Carpal tunnel syndrome', 'Neurology', 'diagnoses'),
('34742003', 'Guillain-Barre syndrome', 'Neurology', 'diagnoses'),
('2776000', 'Meningitis', 'Neurology', 'diagnoses'),
('95896000', 'Encephalitis', 'Neurology', 'diagnoses'),
('230265002', 'Brain tumour', 'Oncology', 'diagnoses'),
('254935002', 'Glioblastoma', 'Oncology', 'diagnoses'),
('443092002', 'Meningioma', 'Oncology', 'diagnoses'),
('35489007', 'Depression', 'Mental Health', 'diagnoses'),
('370143000', 'Major depressive disorder', 'Mental Health', 'diagnoses'),
('13746004', 'Bipolar affective disorder', 'Mental Health', 'diagnoses'),
('197480006', 'Anxiety disorder', 'Mental Health', 'diagnoses'),
('31781004', 'Panic disorder', 'Mental Health', 'diagnoses'),
('82339001', 'Agoraphobia', 'Mental Health', 'diagnoses'),
('61569007', 'Social phobia', 'Mental Health', 'diagnoses'),
('21897009', 'Generalised anxiety disorder', 'Mental Health', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 751-770: Mental health conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('47505003', 'Post-traumatic stress disorder', 'Mental Health', 'diagnoses'),
('69479009', 'Obsessive-compulsive disorder', 'Mental Health', 'diagnoses'),
('58214004', 'Schizophrenia', 'Mental Health', 'diagnoses'),
('20010003', 'Schizoaffective disorder', 'Mental Health', 'diagnoses'),
('191480000', 'Delusional disorder', 'Mental Health', 'diagnoses'),
('78667006', 'Eating disorder', 'Mental Health', 'diagnoses'),
('56882008', 'Anorexia nervosa', 'Mental Health', 'diagnoses'),
('78004001', 'Bulimia nervosa', 'Mental Health', 'diagnoses'),
('190905008', 'Binge eating disorder', 'Mental Health', 'diagnoses'),
('406506008', 'Attention deficit hyperactivity disorder', 'Mental Health', 'diagnoses'),
('35919005', 'Autism spectrum disorder', 'Mental Health', 'diagnoses'),
('191667009', 'Personality disorder', 'Mental Health', 'diagnoses'),
('20259004', 'Emotionally unstable personality disorder', 'Mental Health', 'diagnoses'),
('75914004', 'Antisocial personality disorder', 'Mental Health', 'diagnoses'),
('86680006', 'Alcohol dependence', 'Mental Health', 'diagnoses'),
('191816009', 'Drug dependence', 'Mental Health', 'diagnoses'),
('70328006', 'Opioid use disorder', 'Mental Health', 'diagnoses'),
('44054006', 'Cannabis use disorder', 'Mental Health', 'diagnoses'),
('6525002', 'Cocaine use disorder', 'Mental Health', 'diagnoses'),
('44054006', 'Benzodiazepine dependence', 'Mental Health', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;

-- Batch 771-790: Rheumatological conditions
INSERT INTO snomed_codes (snomed_code, code_description, cluster_description, domain) VALUES
('69896004', 'Rheumatoid arthritis', 'Rheumatology', 'diagnoses'),
('396275006', 'Osteoarthritis', 'Rheumatology', 'diagnoses'),
('239873007', 'Psoriatic arthritis', 'Rheumatology', 'diagnoses'),
('9631008', 'Ankylosing spondylitis', 'Rheumatology', 'diagnoses'),
('55464009', 'Systemic lupus erythematosus', 'Rheumatology', 'diagnoses'),
('81573002', 'Sjogrens syndrome', 'Rheumatology', 'diagnoses'),
('31996006', 'Scleroderma', 'Rheumatology', 'diagnoses'),
('398100001', 'Dermatomyositis', 'Rheumatology', 'diagnoses'),
('31384009', 'Polymyositis', 'Rheumatology', 'diagnoses'),
('238909007', 'Mixed connective tissue disease', 'Rheumatology', 'diagnoses'),
('195771004', 'Polymyalgia rheumatica', 'Rheumatology', 'diagnoses'),
('400130008', 'Giant cell arteritis', 'Rheumatology', 'diagnoses'),
('155441006', 'Gout', 'Rheumatology', 'diagnoses'),
('40485001', 'Pseudogout', 'Rheumatology', 'diagnoses'),
('239931002', 'Reactive arthritis', 'Rheumatology', 'diagnoses'),
('201794004', 'Septic arthritis', 'Rheumatology', 'diagnoses'),
('35999006', 'Vasculitis', 'Rheumatology', 'diagnoses'),
('155463001', 'Wegener granulomatosis', 'Rheumatology', 'diagnoses'),
('31384009', 'Polyarteritis nodosa', 'Rheumatology', 'diagnoses'),
('95570007', 'Fibromyalgia', 'Rheumatology', 'diagnoses')
ON CONFLICT (snomed_code) DO NOTHING;
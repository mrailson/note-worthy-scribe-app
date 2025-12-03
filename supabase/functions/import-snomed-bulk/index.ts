import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NHS QSR SNOMED codes - comprehensive list from qsr-sfl-2019-20-codes-list.xlsm
const NHS_QSR_CODES = [
  // ========== ASTHMA CODES ==========
  { cluster: 'Asthma diagnosis codes', code: '195967001', description: 'Asthma' },
  { cluster: 'Asthma diagnosis codes', code: '304527002', description: 'Acute asthma' },
  { cluster: 'Asthma diagnosis codes', code: '370218001', description: 'Mild asthma' },
  { cluster: 'Asthma diagnosis codes', code: '370219009', description: 'Moderate asthma' },
  { cluster: 'Asthma diagnosis codes', code: '370221004', description: 'Severe asthma' },
  { cluster: 'Asthma diagnosis codes', code: '233678006', description: 'Childhood asthma' },
  { cluster: 'Asthma diagnosis codes', code: '225057002', description: 'Brittle asthma' },
  { cluster: 'Asthma diagnosis codes', code: '266361008', description: 'Intrinsic asthma' },
  { cluster: 'Asthma diagnosis codes', code: '389145006', description: 'Allergic asthma' },
  { cluster: 'Asthma diagnosis codes', code: '281239006', description: 'Exacerbation of asthma' },
  { cluster: 'Asthma diagnosis codes', code: '708038006', description: 'Acute exacerbation of asthma' },
  { cluster: 'Asthma diagnosis codes', code: '57607007', description: 'Occupational asthma' },
  { cluster: 'Asthma diagnosis codes', code: '31387002', description: 'Exercise-induced asthma' },
  { cluster: 'Asthma diagnosis codes', code: '407674008', description: 'Aspirin-induced asthma' },
  { cluster: 'Asthma diagnosis codes', code: '409663006', description: 'Cough variant asthma' },
  { cluster: 'Asthma diagnosis codes', code: '427603009', description: 'Intermittent asthma' },
  { cluster: 'Asthma diagnosis codes', code: '426979002', description: 'Mild persistent asthma' },
  { cluster: 'Asthma diagnosis codes', code: '427295004', description: 'Moderate persistent asthma' },
  { cluster: 'Asthma diagnosis codes', code: '426656000', description: 'Severe persistent asthma' },
  { cluster: 'Asthma diagnosis codes', code: '195949008', description: 'Chronic asthmatic bronchitis' },
  
  // ========== COPD / RESPIRATORY CODES ==========
  { cluster: 'COPD codes', code: '13645005', description: 'Chronic obstructive pulmonary disease' },
  { cluster: 'COPD codes', code: '185086009', description: 'Chronic obstructive bronchitis' },
  { cluster: 'COPD codes', code: '87433001', description: 'Pulmonary emphysema' },
  { cluster: 'COPD codes', code: '195951007', description: 'Acute exacerbation of chronic obstructive airways disease' },
  { cluster: 'COPD codes', code: '313296004', description: 'Mild chronic obstructive pulmonary disease' },
  { cluster: 'COPD codes', code: '313297008', description: 'Moderate chronic obstructive pulmonary disease' },
  { cluster: 'COPD codes', code: '313299006', description: 'Severe chronic obstructive pulmonary disease' },
  { cluster: 'COPD codes', code: '135836000', description: 'End stage chronic obstructive airways disease' },
  { cluster: 'Chronic respiratory disease codes', code: '12295008', description: 'Bronchiectasis' },
  { cluster: 'Chronic respiratory disease codes', code: '190905008', description: 'Cystic fibrosis' },
  { cluster: 'Chronic respiratory disease codes', code: '51615001', description: 'Fibrosis of lung' },
  { cluster: 'Chronic respiratory disease codes', code: '700250006', description: 'Idiopathic pulmonary fibrosis' },
  { cluster: 'Chronic respiratory disease codes', code: '22607003', description: 'Asbestosis' },
  { cluster: 'Chronic respiratory disease codes', code: '40122008', description: 'Pneumoconiosis' },
  { cluster: 'Chronic respiratory disease codes', code: '63480004', description: 'Chronic bronchitis' },
  { cluster: 'Chronic respiratory disease codes', code: '233703007', description: 'Interstitial lung disease' },
  { cluster: 'Chronic respiratory disease codes', code: '44274007', description: 'Lymphoid interstitial pneumonia' },
  
  // ========== DIABETES CODES ==========
  { cluster: 'Diabetes codes', code: '73211009', description: 'Diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '46635009', description: 'Type 1 diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '44054006', description: 'Type 2 diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '11687002', description: 'Gestational diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '314903002', description: 'Diabetic retinopathy' },
  { cluster: 'Diabetes codes', code: '127014009', description: 'Diabetic nephropathy' },
  { cluster: 'Diabetes codes', code: '230572002', description: 'Diabetic neuropathy' },
  { cluster: 'Diabetes codes', code: '421895002', description: 'Peripheral neuropathy due to diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '399144008', description: 'Diabetic foot' },
  { cluster: 'Diabetes codes', code: '237599002', description: 'Insulin-treated type 2 diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '237627000', description: 'Pregnancy and type 2 diabetes mellitus' },
  { cluster: 'Diabetes codes', code: '609568004', description: 'Pre-diabetes' },
  
  // ========== HYPERTENSION CODES ==========
  { cluster: 'Hypertension codes', code: '38341003', description: 'Hypertension' },
  { cluster: 'Hypertension codes', code: '59621000', description: 'Essential hypertension' },
  { cluster: 'Hypertension codes', code: '70272006', description: 'Malignant hypertension' },
  { cluster: 'Hypertension codes', code: '31992008', description: 'Secondary hypertension' },
  { cluster: 'Hypertension codes', code: '48194001', description: 'Pregnancy-induced hypertension' },
  { cluster: 'Hypertension codes', code: '15394000', description: 'Pre-eclampsia' },
  { cluster: 'Hypertension codes', code: '194783001', description: 'Secondary malignant hypertension' },
  { cluster: 'Hypertension codes', code: '78975002', description: 'Malignant essential hypertension' },
  { cluster: 'Hypertension codes', code: '1201005', description: 'Benign essential hypertension' },
  
  // ========== CHRONIC HEART DISEASE CODES ==========
  { cluster: 'Chronic heart disease codes', code: '53741008', description: 'Coronary heart disease' },
  { cluster: 'Chronic heart disease codes', code: '22298006', description: 'Myocardial infarction' },
  { cluster: 'Chronic heart disease codes', code: '194828000', description: 'Angina pectoris' },
  { cluster: 'Chronic heart disease codes', code: '84114007', description: 'Heart failure' },
  { cluster: 'Chronic heart disease codes', code: '42343007', description: 'Congestive heart failure' },
  { cluster: 'Chronic heart disease codes', code: '49436004', description: 'Atrial fibrillation' },
  { cluster: 'Chronic heart disease codes', code: '426749004', description: 'Chronic atrial fibrillation' },
  { cluster: 'Chronic heart disease codes', code: '698247007', description: 'Cardiac arrhythmia' },
  { cluster: 'Chronic heart disease codes', code: '27885002', description: 'Heart valve disorder' },
  { cluster: 'Chronic heart disease codes', code: '48724000', description: 'Mitral valve stenosis' },
  { cluster: 'Chronic heart disease codes', code: '79619009', description: 'Mitral valve regurgitation' },
  { cluster: 'Chronic heart disease codes', code: '60573004', description: 'Aortic stenosis' },
  { cluster: 'Chronic heart disease codes', code: '60234000', description: 'Aortic regurgitation' },
  { cluster: 'Chronic heart disease codes', code: '128238001', description: 'Chronic heart disease' },
  { cluster: 'Chronic heart disease codes', code: '13213009', description: 'Congenital heart disease' },
  { cluster: 'Chronic heart disease codes', code: '399211009', description: 'History of myocardial infarction' },
  { cluster: 'Chronic heart disease codes', code: '414545008', description: 'Ischaemic heart disease' },
  { cluster: 'Chronic heart disease codes', code: '195080001', description: 'Atrial flutter' },
  { cluster: 'Chronic heart disease codes', code: '233817007', description: 'Stable angina' },
  { cluster: 'Chronic heart disease codes', code: '25106000', description: 'Unstable angina' },
  { cluster: 'Chronic heart disease codes', code: '429559004', description: 'Acute coronary syndrome' },
  { cluster: 'Chronic heart disease codes', code: '233897008', description: 'Dilated cardiomyopathy' },
  { cluster: 'Chronic heart disease codes', code: '45227007', description: 'Hypertrophic cardiomyopathy' },
  { cluster: 'Chronic heart disease codes', code: '399020009', description: 'Stent in coronary artery' },
  
  // ========== STROKE / NEUROLOGICAL CODES ==========
  { cluster: 'Stroke codes', code: '230690007', description: 'Stroke' },
  { cluster: 'Stroke codes', code: '422504002', description: 'Ischaemic stroke' },
  { cluster: 'Stroke codes', code: '274100004', description: 'Cerebral haemorrhage' },
  { cluster: 'Stroke codes', code: '266257000', description: 'Transient ischaemic attack' },
  { cluster: 'Chronic neurological disease codes', code: '84757009', description: 'Epilepsy' },
  { cluster: 'Chronic neurological disease codes', code: '230461009', description: 'Generalised epilepsy' },
  { cluster: 'Chronic neurological disease codes', code: '230414002', description: 'Focal epilepsy' },
  { cluster: 'Chronic neurological disease codes', code: '24700007', description: 'Multiple sclerosis' },
  { cluster: 'Chronic neurological disease codes', code: '49049000', description: 'Parkinson disease' },
  { cluster: 'Chronic neurological disease codes', code: '86044005', description: 'Amyotrophic lateral sclerosis' },
  { cluster: 'Chronic neurological disease codes', code: '91637004', description: 'Myasthenia gravis' },
  { cluster: 'Chronic neurological disease codes', code: '26929004', description: 'Alzheimer disease' },
  { cluster: 'Chronic neurological disease codes', code: '56717001', description: 'Dementia' },
  { cluster: 'Chronic neurological disease codes', code: '52448006', description: 'Dementia' },
  
  // ========== KIDNEY DISEASE CODES ==========
  { cluster: 'CKD codes', code: '709044004', description: 'Chronic kidney disease' },
  { cluster: 'CKD codes', code: '431855005', description: 'Chronic kidney disease stage 1' },
  { cluster: 'CKD codes', code: '431856006', description: 'Chronic kidney disease stage 2' },
  { cluster: 'CKD codes', code: '433144002', description: 'Chronic kidney disease stage 3' },
  { cluster: 'CKD codes', code: '431857002', description: 'Chronic kidney disease stage 4' },
  { cluster: 'CKD codes', code: '433146000', description: 'Chronic kidney disease stage 5' },
  { cluster: 'CKD codes', code: '46177005', description: 'End stage renal disease' },
  { cluster: 'CKD codes', code: '90688005', description: 'Chronic renal failure' },
  { cluster: 'CKD codes', code: '236425005', description: 'Chronic renal impairment' },
  
  // ========== CANCER CODES ==========
  { cluster: 'Cancer codes', code: '363346000', description: 'Malignant neoplastic disease' },
  { cluster: 'Cancer codes', code: '93761005', description: 'Primary malignant neoplasm of colon' },
  { cluster: 'Cancer codes', code: '254837009', description: 'Primary malignant neoplasm of breast' },
  { cluster: 'Cancer codes', code: '254632001', description: 'Malignant melanoma of skin' },
  { cluster: 'Cancer codes', code: '363358000', description: 'Malignant neoplasm of lung' },
  { cluster: 'Cancer codes', code: '399068003', description: 'Malignant neoplasm of prostate' },
  { cluster: 'Cancer codes', code: '93870000', description: 'Malignant neoplasm of bladder' },
  { cluster: 'Cancer codes', code: '363449006', description: 'Malignant neoplasm of kidney' },
  { cluster: 'Cancer codes', code: '109838007', description: 'Ovarian cancer' },
  { cluster: 'Cancer codes', code: '363353009', description: 'Malignant neoplasm of cervix' },
  { cluster: 'Cancer codes', code: '363418001', description: 'Malignant neoplasm of pancreas' },
  { cluster: 'Cancer codes', code: '363406005', description: 'Malignant neoplasm of liver' },
  { cluster: 'Cancer codes', code: '254915003', description: 'Malignant neoplasm of stomach' },
  { cluster: 'Cancer codes', code: '109841003', description: 'Oesophageal cancer' },
  { cluster: 'Cancer codes', code: '93143009', description: 'Leukaemia' },
  { cluster: 'Cancer codes', code: '109989006', description: 'Multiple myeloma' },
  { cluster: 'Cancer codes', code: '118600007', description: 'Malignant lymphoma' },
  { cluster: 'Cancer codes', code: '188529003', description: 'Hodgkin lymphoma' },
  { cluster: 'Cancer codes', code: '363443007', description: 'Malignant neoplasm of thyroid' },
  { cluster: 'Cancer codes', code: '92546004', description: 'Carcinoma of brain' },
  
  // ========== MENTAL HEALTH CODES ==========
  { cluster: 'Mental health codes', code: '35489007', description: 'Depressive disorder' },
  { cluster: 'Mental health codes', code: '370143000', description: 'Major depressive disorder' },
  { cluster: 'Mental health codes', code: '197480006', description: 'Anxiety disorder' },
  { cluster: 'Mental health codes', code: '191722009', description: 'Generalised anxiety disorder' },
  { cluster: 'Mental health codes', code: '13746004', description: 'Bipolar disorder' },
  { cluster: 'Mental health codes', code: '58214004', description: 'Schizophrenia' },
  { cluster: 'Mental health codes', code: '724992007', description: 'Alcohol dependence syndrome' },
  { cluster: 'Mental health codes', code: '191816009', description: 'Drug dependence' },
  { cluster: 'Mental health codes', code: '47505003', description: 'Post-traumatic stress disorder' },
  { cluster: 'Mental health codes', code: '69322001', description: 'Psychosis' },
  { cluster: 'Mental health codes', code: '72366004', description: 'Eating disorder' },
  { cluster: 'Mental health codes', code: '56882008', description: 'Anorexia nervosa' },
  { cluster: 'Mental health codes', code: '78004001', description: 'Bulimia nervosa' },
  { cluster: 'Mental health codes', code: '192080009', description: 'Chronic depression' },
  { cluster: 'Mental health codes', code: '36923009', description: 'Major depression single episode' },
  { cluster: 'Mental health codes', code: '231499006', description: 'Recurrent depression' },
  
  // ========== THYROID CODES ==========
  { cluster: 'Thyroid codes', code: '40930008', description: 'Hypothyroidism' },
  { cluster: 'Thyroid codes', code: '34486009', description: 'Hyperthyroidism' },
  { cluster: 'Thyroid codes', code: '190268003', description: 'Autoimmune thyroiditis' },
  { cluster: 'Thyroid codes', code: '353295004', description: 'Toxic diffuse goitre' },
  { cluster: 'Thyroid codes', code: '83664006', description: 'Hashimoto thyroiditis' },
  { cluster: 'Thyroid codes', code: '14304000', description: 'Thyroid disorder' },
  
  // ========== LIVER DISEASE CODES ==========
  { cluster: 'Liver disease codes', code: '328383001', description: 'Chronic liver disease' },
  { cluster: 'Liver disease codes', code: '19943007', description: 'Cirrhosis of liver' },
  { cluster: 'Liver disease codes', code: '197321007', description: 'Non-alcoholic fatty liver disease' },
  { cluster: 'Liver disease codes', code: '235874008', description: 'Non-alcoholic steatohepatitis' },
  { cluster: 'Liver disease codes', code: '61977001', description: 'Chronic hepatitis' },
  { cluster: 'Liver disease codes', code: '50711007', description: 'Hepatitis C' },
  { cluster: 'Liver disease codes', code: '66071002', description: 'Hepatitis B' },
  { cluster: 'Liver disease codes', code: '235856003', description: 'Hepatitis A' },
  { cluster: 'Liver disease codes', code: '41309000', description: 'Alcoholic liver disease' },
  
  // ========== RHEUMATOLOGY CODES ==========
  { cluster: 'Rheumatology codes', code: '69896004', description: 'Rheumatoid arthritis' },
  { cluster: 'Rheumatology codes', code: '396275006', description: 'Osteoarthritis' },
  { cluster: 'Rheumatology codes', code: '201820006', description: 'Psoriatic arthritis' },
  { cluster: 'Rheumatology codes', code: '55464009', description: 'Systemic lupus erythematosus' },
  { cluster: 'Rheumatology codes', code: '64859006', description: 'Osteoporosis' },
  { cluster: 'Rheumatology codes', code: '200936003', description: 'Gout' },
  { cluster: 'Rheumatology codes', code: '31996006', description: 'Ankylosing spondylitis' },
  { cluster: 'Rheumatology codes', code: '396332003', description: 'Fibromyalgia' },
  { cluster: 'Rheumatology codes', code: '239872002', description: 'Osteoarthritis of hip' },
  { cluster: 'Rheumatology codes', code: '239873007', description: 'Osteoarthritis of knee' },
  
  // ========== GI CONDITIONS ==========
  { cluster: 'GI codes', code: '34000006', description: 'Crohn disease' },
  { cluster: 'GI codes', code: '64766004', description: 'Ulcerative colitis' },
  { cluster: 'GI codes', code: '235595009', description: 'Gastroesophageal reflux disease' },
  { cluster: 'GI codes', code: '128601007', description: 'Coeliac disease' },
  { cluster: 'GI codes', code: '25374005', description: 'Irritable bowel syndrome' },
  { cluster: 'GI codes', code: '235653009', description: 'Peptic ulcer' },
  { cluster: 'GI codes', code: '196731005', description: 'Gallstones' },
  { cluster: 'GI codes', code: '48340000', description: 'Incisional hernia' },
  { cluster: 'GI codes', code: '60051002', description: 'Inguinal hernia' },
  { cluster: 'GI codes', code: '235675006', description: 'Barrett oesophagus' },
  { cluster: 'GI codes', code: '302770006', description: 'Diverticular disease of colon' },
  
  // ========== ALLERGY CODES ==========
  { cluster: 'Allergy codes', code: '91936005', description: 'Penicillin allergy' },
  { cluster: 'Allergy codes', code: '294505008', description: 'Amoxicillin allergy' },
  { cluster: 'Allergy codes', code: '293586001', description: 'NSAID allergy' },
  { cluster: 'Allergy codes', code: '213020009', description: 'Egg allergy' },
  { cluster: 'Allergy codes', code: '91935009', description: 'Peanut allergy' },
  { cluster: 'Allergy codes', code: '91934008', description: 'Nut allergy' },
  { cluster: 'Allergy codes', code: '300913006', description: 'Shellfish allergy' },
  { cluster: 'Allergy codes', code: '782576004', description: 'Tree nut allergy' },
  { cluster: 'Allergy codes', code: '293591003', description: 'Aspirin allergy' },
  { cluster: 'Allergy codes', code: '293963004', description: 'ACE inhibitor allergy' },
  { cluster: 'Allergy codes', code: '419511003', description: 'Drug allergy' },
  { cluster: 'Allergy codes', code: '441631006', description: 'Food allergy' },
  { cluster: 'Allergy codes', code: '419199007', description: 'Latex allergy' },
  { cluster: 'Allergy codes', code: '294497005', description: 'Sulfonamide allergy' },
  { cluster: 'Allergy codes', code: '293618001', description: 'Codeine allergy' },
  { cluster: 'Allergy codes', code: '294461007', description: 'Morphine allergy' },
  { cluster: 'Allergy codes', code: '294911003', description: 'Contrast media allergy' },
  { cluster: 'Allergy codes', code: '300916003', description: 'Milk allergy' },
  { cluster: 'Allergy codes', code: '402387002', description: 'Soya allergy' },
  { cluster: 'Allergy codes', code: '419474003', description: 'Allergy to wheat' },
  { cluster: 'Allergy codes', code: '418689008', description: 'Allergy to grass pollen' },
  { cluster: 'Allergy codes', code: '232350006', description: 'House dust mite allergy' },
  { cluster: 'Allergy codes', code: '418634005', description: 'Allergy to cat dander' },
  { cluster: 'Allergy codes', code: '418184004', description: 'Allergy to dog dander' },
  { cluster: 'Allergy codes', code: '294540002', description: 'Metformin allergy' },
  { cluster: 'Allergy codes', code: '293662005', description: 'Erythromycin allergy' },
  { cluster: 'Allergy codes', code: '294498000', description: 'Trimethoprim allergy' },
  { cluster: 'Allergy codes', code: '294560007', description: 'Statin allergy' },
  
  // ========== IMMUNISATION CODES ==========
  { cluster: 'Immunisation codes', code: '86198006', description: 'Influenza vaccination' },
  { cluster: 'Immunisation codes', code: '12866006', description: 'Pneumococcal vaccination' },
  { cluster: 'Immunisation codes', code: '170399005', description: 'Shingles vaccination' },
  { cluster: 'Immunisation codes', code: '170433008', description: 'Tetanus vaccination' },
  { cluster: 'Immunisation codes', code: '871875004', description: 'COVID-19 vaccination' },
  { cluster: 'Immunisation codes', code: '170398002', description: 'MMR vaccination' },
  { cluster: 'Immunisation codes', code: '170395004', description: 'Hepatitis B vaccination' },
  { cluster: 'Immunisation codes', code: '170393006', description: 'Hepatitis A vaccination' },
  { cluster: 'Immunisation codes', code: '170405004', description: 'DTP vaccination' },
  { cluster: 'Immunisation codes', code: '170370000', description: 'BCG vaccination' },
  { cluster: 'Immunisation codes', code: '170381004', description: 'Meningococcal vaccination' },
  { cluster: 'Immunisation codes', code: '170391008', description: 'HPV vaccination' },
  { cluster: 'Immunisation codes', code: '170378007', description: 'Polio vaccination' },
  { cluster: 'Immunisation codes', code: '170379004', description: 'Typhoid vaccination' },
  { cluster: 'Immunisation codes', code: '170380001', description: 'Yellow fever vaccination' },
  { cluster: 'Immunisation codes', code: '170389002', description: 'Rotavirus vaccination' },
  { cluster: 'Immunisation codes', code: '170367005', description: 'Varicella vaccination' },
  { cluster: 'Immunisation codes', code: '170401008', description: 'Diphtheria vaccination' },
  { cluster: 'Immunisation codes', code: '170406003', description: 'Pertussis vaccination' },
  { cluster: 'Immunisation codes', code: '170388005', description: 'Haemophilus influenzae type b vaccination' },
  
  // ========== SURGICAL PROCEDURE CODES ==========
  { cluster: 'Surgical codes', code: '80146002', description: 'Appendectomy' },
  { cluster: 'Surgical codes', code: '38102005', description: 'Cholecystectomy' },
  { cluster: 'Surgical codes', code: '116028008', description: 'Total hip replacement' },
  { cluster: 'Surgical codes', code: '179344006', description: 'Total knee replacement' },
  { cluster: 'Surgical codes', code: '36969009', description: 'Coronary artery bypass graft' },
  { cluster: 'Surgical codes', code: '33195004', description: 'Percutaneous coronary intervention' },
  { cluster: 'Surgical codes', code: '387713003', description: 'Cardiac pacemaker insertion' },
  { cluster: 'Surgical codes', code: '172043006', description: 'Mastectomy' },
  { cluster: 'Surgical codes', code: '116140006', description: 'Total abdominal hysterectomy' },
  { cluster: 'Surgical codes', code: '265056007', description: 'Vaginal hysterectomy' },
  { cluster: 'Surgical codes', code: '35057001', description: 'Prostatectomy' },
  { cluster: 'Surgical codes', code: '175135009', description: 'Bowel resection' },
  { cluster: 'Surgical codes', code: '173422009', description: 'Splenectomy' },
  { cluster: 'Surgical codes', code: '287664005', description: 'Thyroidectomy' },
  { cluster: 'Surgical codes', code: '234319005', description: 'Cataract extraction' },
  { cluster: 'Surgical codes', code: '112798008', description: 'Hernia repair' },
  { cluster: 'Surgical codes', code: '57703003', description: 'Tonsillectomy' },
  { cluster: 'Surgical codes', code: '13619001', description: 'Caesarean section' },
  { cluster: 'Surgical codes', code: '5880005', description: 'Laminectomy' },
  { cluster: 'Surgical codes', code: '179406005', description: 'Shoulder replacement' },
  { cluster: 'Surgical codes', code: '44946007', description: 'Carpal tunnel release' },
  { cluster: 'Surgical codes', code: '175095005', description: 'Carotid endarterectomy' },
  { cluster: 'Surgical codes', code: '313039003', description: 'Surgical repair of abdominal aortic aneurysm' },
  { cluster: 'Surgical codes', code: '42866001', description: 'Gastrectomy' },
  { cluster: 'Surgical codes', code: '26390003', description: 'Colostomy' },
  { cluster: 'Surgical codes', code: '387731002', description: 'Ileostomy' },
  { cluster: 'Surgical codes', code: '14163005', description: 'Nephrectomy' },
  { cluster: 'Surgical codes', code: '397956004', description: 'Renal transplant' },
  { cluster: 'Surgical codes', code: '18027006', description: 'Liver transplant' },
  { cluster: 'Surgical codes', code: '32413006', description: 'Heart transplant' },
  { cluster: 'Surgical codes', code: '232717009', description: 'Lung transplant' },
  { cluster: 'Surgical codes', code: '70536003', description: 'Corneal transplant' },
  { cluster: 'Surgical codes', code: '234337002', description: 'Laser eye surgery' },
  { cluster: 'Surgical codes', code: '232654009', description: 'Retinal detachment surgery' },
  { cluster: 'Surgical codes', code: '116028008', description: 'Hip replacement' },
  { cluster: 'Surgical codes', code: '179344006', description: 'Knee replacement' },
  { cluster: 'Surgical codes', code: '265764009', description: 'Laparoscopic cholecystectomy' },
  { cluster: 'Surgical codes', code: '118819004', description: 'Aortic valve replacement' },
  { cluster: 'Surgical codes', code: '40701008', description: 'Mitral valve replacement' },
  { cluster: 'Surgical codes', code: '174813001', description: 'Inguinal hernia repair' },
  { cluster: 'Surgical codes', code: '86789000', description: 'Femoral hernia repair' },
  { cluster: 'Surgical codes', code: '82035006', description: 'Umbilical hernia repair' },
  { cluster: 'Surgical codes', code: '174937006', description: 'Total colectomy' },
  { cluster: 'Surgical codes', code: '90470006', description: 'Pancreatectomy' },
  { cluster: 'Surgical codes', code: '303631003', description: 'Whipple procedure' },
  
  // ========== HIV / IMMUNOSUPPRESSION CODES ==========
  { cluster: 'Immunosuppression codes', code: '86406008', description: 'Human immunodeficiency virus infection' },
  { cluster: 'Immunosuppression codes', code: '62479008', description: 'AIDS' },
  { cluster: 'Immunosuppression codes', code: '234532001', description: 'Immunodeficiency disorder' },
  { cluster: 'Immunosuppression codes', code: '36070007', description: 'Bone marrow transplant' },
  { cluster: 'Immunosuppression codes', code: '234319005', description: 'Splenectomy' },
  { cluster: 'Immunosuppression codes', code: '93030006', description: 'Congenital absence of spleen' },
];

// Map cluster to domain
function clusterToDomain(cluster: string): string {
  const lowerCluster = cluster.toLowerCase();
  if (lowerCluster.includes('asthma') || lowerCluster.includes('copd') || lowerCluster.includes('respiratory')) return 'respiratory';
  if (lowerCluster.includes('diabetes')) return 'endocrine';
  if (lowerCluster.includes('hypertension') || lowerCluster.includes('heart') || lowerCluster.includes('cardiac')) return 'cardiovascular';
  if (lowerCluster.includes('stroke') || lowerCluster.includes('neuro')) return 'neurological';
  if (lowerCluster.includes('kidney') || lowerCluster.includes('renal') || lowerCluster.includes('ckd')) return 'renal';
  if (lowerCluster.includes('cancer') || lowerCluster.includes('malignant') || lowerCluster.includes('neoplasm')) return 'oncology';
  if (lowerCluster.includes('mental') || lowerCluster.includes('depression') || lowerCluster.includes('anxiety')) return 'mental_health';
  if (lowerCluster.includes('thyroid')) return 'endocrine';
  if (lowerCluster.includes('liver') || lowerCluster.includes('hepat')) return 'hepatic';
  if (lowerCluster.includes('rheumat') || lowerCluster.includes('arthritis') || lowerCluster.includes('osteo')) return 'musculoskeletal';
  if (lowerCluster.includes('gi ') || lowerCluster.includes('gastrointestinal') || lowerCluster.includes('bowel')) return 'gastrointestinal';
  if (lowerCluster.includes('allergy')) return 'allergy';
  if (lowerCluster.includes('immunis') || lowerCluster.includes('vaccin')) return 'immunisation';
  if (lowerCluster.includes('surgical') || lowerCluster.includes('surgery')) return 'surgery';
  if (lowerCluster.includes('immunosuppression') || lowerCluster.includes('hiv')) return 'immunology';
  return 'general';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`Importing ${NHS_QSR_CODES.length} NHS QSR SNOMED codes...`);

    // Clear existing codes first
    await supabase.from('snomed_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Cleared existing codes');

    // Prepare records for insert
    const records = NHS_QSR_CODES.map(code => ({
      cluster_description: code.cluster,
      snomed_code: code.code,
      code_description: code.description,
      domain: clusterToDomain(code.cluster),
      source_document: 'NHS-QSR-SFL-2019-20',
    }));

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from('snomed_codes')
        .upsert(batch, { onConflict: 'snomed_code' });
      
      if (error) {
        console.error(`Batch insert error at ${i}:`, error);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Import complete. Inserted ${inserted} codes.`);

    // Count by domain
    const { data: domainCounts } = await supabase
      .from('snomed_codes')
      .select('domain')
      .then(result => {
        const counts: Record<string, number> = {};
        result.data?.forEach((row: any) => {
          counts[row.domain] = (counts[row.domain] || 0) + 1;
        });
        return { data: counts };
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        codesImported: inserted,
        domainBreakdown: domainCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Import failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

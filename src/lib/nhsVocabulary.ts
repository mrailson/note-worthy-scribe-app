/**
 * OTEWELL NHS Vocabulary - Single source of truth for NHS terminology
 * Used across all transcription services for word boosting
 */

export const NHS_GOVERNANCE_TERMS = [
  // OTEWELL Primary Care & Ageing Well
  "Ageing Well", "Frailty", "frailty score", "LD", "Learning Disability",
  "QOF", "DES", "Arden", "EMIS", "SystmOne", "NHFT", "PCN", "PCM",
  
  // Clinical governance & safety
  "CGA", "CQC", "clinical negligence", "indemnity", "safeguarding",
  "ACP", "DNACPR", "ReSPECT", "coronial", "complaint",
  "clinical negligence scheme", "liability",
  
  // NHS organisations & roles
  "ARRS", "ICS", "ICB", "HCA", "ANP", "SPLW", "NP", "PA",
  "AccuRx", "Docman", "TeamNet", "eConsult", "NHS",
  
  // Clinical measurements
  "BP", "blood pressure", "systolic", "diastolic", "pulse",
  "SpO2", "oxygen saturation", "BMI", "weight", "height",
  "temperature", "respiratory rate", "NEWS", "NEWS2",
  "eGFR", "HbA1c", "cholesterol", "LDL", "HDL", "triglycerides",
  
  // Common medications
  "metformin", "gliclazide", "sitagliptin", "empagliflozin", "semaglutide",
  "ramipril", "lisinopril", "amlodipine", "atenolol", "bisoprolol",
  "atorvastatin", "simvastatin", "rosuvastatin",
  "omeprazole", "lansoprazole", "pantoprazole",
  "levothyroxine", "carbimazole",
  "sertraline", "citalopram", "fluoxetine", "mirtazapine", "amitriptyline",
  "gabapentin", "pregabalin", "tramadol", "codeine", "morphine",
  "salbutamol", "Ventolin", "Fostair", "Seretide", "Symbicort",
  "warfarin", "apixaban", "rivaroxaban", "edoxaban", "dabigatran",
  "paracetamol", "ibuprofen", "naproxen", "diclofenac",
  
  // Clinical conditions
  "diabetes", "type 2 diabetes", "type 1 diabetes",
  "hypertension", "hypercholesterolaemia", "hyperlipidaemia",
  "COPD", "asthma", "bronchiectasis",
  "CKD", "chronic kidney disease", "AKI",
  "atrial fibrillation", "AF", "heart failure",
  "dementia", "Alzheimer's", "cognitive impairment", "MCI",
  "depression", "anxiety", "PTSD",
  "osteoarthritis", "rheumatoid", "fibromyalgia",
  "hypothyroidism", "hyperthyroidism",
  
  // Procedures & referrals
  "phlebotomy", "ECG", "spirometry", "24-hour BP",
  "ABPM", "Holter", "echocardiogram",
  "urgent referral", "2WW", "two week wait", "routine referral",
  "secondary care", "tertiary care", "MDT",
  
  // Administrative
  "fit note", "sick note", "DVLA", "blue badge",
  "prescription", "repeat prescription", "acute prescription",
  "home visit", "telephone consultation", "face to face",
  "annual review", "medication review", "SMR",
];

// JSON-encoded for edge function use
export const NHS_GOVERNANCE_TERMS_JSON = JSON.stringify(NHS_GOVERNANCE_TERMS);

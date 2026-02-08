import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SNOMED codes from NHS QSR/SFL 2019-20 code list
// This is a curated subset covering common conditions in Lloyd George records
const SNOMED_CODES = [
  // Asthma codes
  { cluster: "Asthma diagnosis codes", code: "195967001", description: "Asthma" },
  { cluster: "Asthma diagnosis codes", code: "389145006", description: "Allergic asthma" },
  { cluster: "Asthma diagnosis codes", code: "233678006", description: "Childhood asthma" },
  { cluster: "Asthma diagnosis codes", code: "266361008", description: "Intrinsic asthma" },
  { cluster: "Asthma diagnosis codes", code: "57607007", description: "Occupational asthma" },
  { cluster: "Asthma diagnosis codes", code: "426656000", description: "Severe persistent asthma" },
  { cluster: "Asthma diagnosis codes", code: "427295004", description: "Moderate persistent asthma" },
  { cluster: "Asthma diagnosis codes", code: "426979002", description: "Mild persistent asthma" },
  { cluster: "Asthma diagnosis codes", code: "708038006", description: "Acute exacerbation of asthma" },
  { cluster: "Asthma diagnosis codes", code: "195949008", description: "Chronic asthmatic bronchitis" },
  
  // COPD codes
  { cluster: "COPD diagnosis codes", code: "13645005", description: "Chronic obstructive lung disease" },
  { cluster: "COPD diagnosis codes", code: "185086009", description: "Chronic obstructive bronchitis" },
  { cluster: "COPD diagnosis codes", code: "313296004", description: "Mild chronic obstructive pulmonary disease" },
  { cluster: "COPD diagnosis codes", code: "313297008", description: "Moderate chronic obstructive pulmonary disease" },
  { cluster: "COPD diagnosis codes", code: "313299006", description: "Severe chronic obstructive pulmonary disease" },
  { cluster: "COPD diagnosis codes", code: "135836000", description: "End stage chronic obstructive airways disease" },
  
  // Diabetes codes
  { cluster: "Diabetes diagnosis codes", code: "73211009", description: "Diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "44054006", description: "Type 2 diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "46635009", description: "Type 1 diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "237599002", description: "Insulin treated Type 2 diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "237604008", description: "Diet controlled diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "237627000", description: "Gestational diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "421893009", description: "Renal disorder due to diabetes mellitus" },
  { cluster: "Diabetes diagnosis codes", code: "4855003", description: "Diabetic retinopathy" },
  { cluster: "Diabetes diagnosis codes", code: "422034002", description: "Diabetic neuropathy" },
  { cluster: "Diabetes diagnosis codes", code: "230572002", description: "Diabetic foot" },
  
  // Hypertension codes
  { cluster: "Hypertension diagnosis codes", code: "38341003", description: "Hypertensive disorder" },
  { cluster: "Hypertension diagnosis codes", code: "59621000", description: "Essential hypertension" },
  { cluster: "Hypertension diagnosis codes", code: "194783001", description: "Secondary hypertension" },
  { cluster: "Hypertension diagnosis codes", code: "48146000", description: "Diastolic hypertension" },
  { cluster: "Hypertension diagnosis codes", code: "56218007", description: "Systolic hypertension" },
  { cluster: "Hypertension diagnosis codes", code: "1201005", description: "Benign essential hypertension" },
  { cluster: "Hypertension diagnosis codes", code: "78975002", description: "Malignant essential hypertension" },
  
  // Chronic heart disease codes
  { cluster: "Chronic heart disease codes", code: "53741008", description: "Coronary artery disease" },
  { cluster: "Chronic heart disease codes", code: "22298006", description: "Myocardial infarction" },
  { cluster: "Chronic heart disease codes", code: "57054005", description: "Acute myocardial infarction" },
  { cluster: "Chronic heart disease codes", code: "414545008", description: "Ischaemic heart disease" },
  { cluster: "Chronic heart disease codes", code: "84114007", description: "Heart failure" },
  { cluster: "Chronic heart disease codes", code: "42343007", description: "Congestive heart failure" },
  { cluster: "Chronic heart disease codes", code: "88805009", description: "Chronic congestive heart failure" },
  { cluster: "Chronic heart disease codes", code: "49436004", description: "Atrial fibrillation" },
  { cluster: "Chronic heart disease codes", code: "5370000", description: "Atrial flutter" },
  { cluster: "Chronic heart disease codes", code: "195080001", description: "Angina pectoris" },
  { cluster: "Chronic heart disease codes", code: "233817007", description: "Stable angina" },
  { cluster: "Chronic heart disease codes", code: "4557003", description: "Unstable angina" },
  { cluster: "Chronic heart disease codes", code: "266263008", description: "Aortic stenosis" },
  { cluster: "Chronic heart disease codes", code: "79619009", description: "Mitral stenosis" },
  { cluster: "Chronic heart disease codes", code: "60234000", description: "Aortic regurgitation" },
  { cluster: "Chronic heart disease codes", code: "48724000", description: "Mitral regurgitation" },
  { cluster: "Chronic heart disease codes", code: "25114006", description: "Pacemaker present" },
  
  // Stroke/CVA codes
  { cluster: "Stroke diagnosis codes", code: "230690007", description: "Cerebrovascular accident" },
  { cluster: "Stroke diagnosis codes", code: "422504002", description: "Ischaemic stroke" },
  { cluster: "Stroke diagnosis codes", code: "274100004", description: "Cerebral haemorrhage" },
  { cluster: "Stroke diagnosis codes", code: "266257000", description: "Transient ischaemic attack" },
  
  // Chronic kidney disease codes
  { cluster: "Chronic kidney disease codes", code: "709044004", description: "Chronic kidney disease" },
  { cluster: "Chronic kidney disease codes", code: "431855005", description: "Chronic kidney disease stage 1" },
  { cluster: "Chronic kidney disease codes", code: "431856006", description: "Chronic kidney disease stage 2" },
  { cluster: "Chronic kidney disease codes", code: "433144002", description: "Chronic kidney disease stage 3" },
  { cluster: "Chronic kidney disease codes", code: "431857002", description: "Chronic kidney disease stage 4" },
  { cluster: "Chronic kidney disease codes", code: "433146000", description: "Chronic kidney disease stage 5" },
  { cluster: "Chronic kidney disease codes", code: "46177005", description: "End stage renal disease" },
  
  // Cancer codes
  { cluster: "Cancer diagnosis codes", code: "363346000", description: "Malignant neoplastic disease" },
  { cluster: "Cancer diagnosis codes", code: "254837009", description: "Malignant neoplasm of breast" },
  { cluster: "Cancer diagnosis codes", code: "93880001", description: "Malignant neoplasm of lung" },
  { cluster: "Cancer diagnosis codes", code: "399068003", description: "Malignant neoplasm of prostate" },
  { cluster: "Cancer diagnosis codes", code: "363406005", description: "Malignant neoplasm of colon" },
  { cluster: "Cancer diagnosis codes", code: "93870000", description: "Malignant neoplasm of rectum" },
  { cluster: "Cancer diagnosis codes", code: "93933008", description: "Malignant neoplasm of skin" },
  { cluster: "Cancer diagnosis codes", code: "372244006", description: "Melanoma of skin" },
  { cluster: "Cancer diagnosis codes", code: "254935002", description: "Malignant neoplasm of cervix" },
  { cluster: "Cancer diagnosis codes", code: "363358000", description: "Malignant neoplasm of kidney" },
  { cluster: "Cancer diagnosis codes", code: "254502005", description: "Malignant neoplasm of thyroid gland" },
  { cluster: "Cancer diagnosis codes", code: "118601006", description: "Neoplasm in remission" },
  
  // Thyroid codes
  { cluster: "Thyroid diagnosis codes", code: "40930008", description: "Hypothyroidism" },
  { cluster: "Thyroid diagnosis codes", code: "34486009", description: "Hyperthyroidism" },
  { cluster: "Thyroid diagnosis codes", code: "14304000", description: "Thyroid disorder" },
  { cluster: "Thyroid diagnosis codes", code: "190268003", description: "Autoimmune thyroiditis" },
  { cluster: "Thyroid diagnosis codes", code: "353295004", description: "Toxic multinodular goitre" },
  
  // Mental health codes
  { cluster: "Mental health diagnosis codes", code: "35489007", description: "Depressive disorder" },
  { cluster: "Mental health diagnosis codes", code: "14183003", description: "Chronic depression" },
  { cluster: "Mental health diagnosis codes", code: "370143000", description: "Major depressive disorder" },
  { cluster: "Mental health diagnosis codes", code: "197480006", description: "Anxiety disorder" },
  { cluster: "Mental health diagnosis codes", code: "191736004", description: "Generalised anxiety disorder" },
  { cluster: "Mental health diagnosis codes", code: "13746004", description: "Bipolar disorder" },
  { cluster: "Mental health diagnosis codes", code: "58214004", description: "Schizophrenia" },
  { cluster: "Mental health diagnosis codes", code: "47505003", description: "Post-traumatic stress disorder" },
  { cluster: "Mental health diagnosis codes", code: "69322001", description: "Psychotic disorder" },
  
  // Epilepsy codes
  { cluster: "Epilepsy diagnosis codes", code: "84757009", description: "Epilepsy" },
  { cluster: "Epilepsy diagnosis codes", code: "313307000", description: "Generalised epilepsy" },
  { cluster: "Epilepsy diagnosis codes", code: "230388006", description: "Partial epilepsy" },
  { cluster: "Epilepsy diagnosis codes", code: "735758002", description: "Absence epilepsy" },
  
  // Liver disease codes
  { cluster: "Liver disease codes", code: "328383001", description: "Chronic liver disease" },
  { cluster: "Liver disease codes", code: "19943007", description: "Cirrhosis of liver" },
  { cluster: "Liver disease codes", code: "235856003", description: "Non-alcoholic fatty liver disease" },
  { cluster: "Liver disease codes", code: "235869004", description: "Alcoholic liver disease" },
  { cluster: "Liver disease codes", code: "66071002", description: "Viral hepatitis B" },
  { cluster: "Liver disease codes", code: "50711007", description: "Viral hepatitis C" },
  
  // Rheumatoid/Inflammatory codes
  { cluster: "Rheumatoid diagnosis codes", code: "69896004", description: "Rheumatoid arthritis" },
  { cluster: "Rheumatoid diagnosis codes", code: "396275006", description: "Osteoarthritis" },
  { cluster: "Rheumatoid diagnosis codes", code: "239873007", description: "Gout" },
  { cluster: "Rheumatoid diagnosis codes", code: "64859006", description: "Osteoporosis" },
  { cluster: "Rheumatoid diagnosis codes", code: "55822004", description: "Hyperlipidaemia" },
  
  // Gastrointestinal codes
  { cluster: "Gastrointestinal codes", code: "235595009", description: "Gastro-oesophageal reflux disease" },
  { cluster: "Gastrointestinal codes", code: "34000006", description: "Crohn's disease" },
  { cluster: "Gastrointestinal codes", code: "64766004", description: "Ulcerative colitis" },
  { cluster: "Gastrointestinal codes", code: "13200003", description: "Peptic ulcer" },
  { cluster: "Gastrointestinal codes", code: "196731005", description: "Coeliac disease" },
  { cluster: "Gastrointestinal codes", code: "10743008", description: "Irritable bowel syndrome" },
  { cluster: "Gastrointestinal codes", code: "235494005", description: "Chronic pancreatitis" },
  
  // Allergy codes
  { cluster: "Allergy codes", code: "91936005", description: "Allergy to penicillin" },
  { cluster: "Allergy codes", code: "294505008", description: "Allergy to amoxicillin" },
  { cluster: "Allergy codes", code: "91931000", description: "Allergy to erythromycin" },
  { cluster: "Allergy codes", code: "300916003", description: "Latex allergy" },
  { cluster: "Allergy codes", code: "91935009", description: "Allergy to peanut" },
  { cluster: "Allergy codes", code: "91934008", description: "Allergy to nut" },
  { cluster: "Allergy codes", code: "91930004", description: "Allergy to eggs" },
  { cluster: "Allergy codes", code: "91938006", description: "Allergy to shellfish" },
  { cluster: "Allergy codes", code: "418634005", description: "Allergic reaction to drug" },
  { cluster: "Allergy codes", code: "419511003", description: "Drug allergy" },
  { cluster: "Allergy codes", code: "293104008", description: "Adverse reaction to aspirin" },
  { cluster: "Allergy codes", code: "416098002", description: "Allergy to NSAID" },
  { cluster: "Allergy codes", code: "294499002", description: "Allergy to sulphonamide" },
  { cluster: "Allergy codes", code: "300913006", description: "Allergy to bee venom" },
  { cluster: "Allergy codes", code: "300912001", description: "Allergy to wasp venom" },
  { cluster: "Allergy codes", code: "232347008", description: "Anaphylaxis" },
  
  // Immunisation codes
  { cluster: "Immunisation codes", code: "170433008", description: "Influenza vaccination" },
  { cluster: "Immunisation codes", code: "170399005", description: "Pneumococcal vaccination" },
  { cluster: "Immunisation codes", code: "170370000", description: "Tetanus vaccination" },
  { cluster: "Immunisation codes", code: "170378007", description: "Diphtheria vaccination" },
  { cluster: "Immunisation codes", code: "170380004", description: "Polio vaccination" },
  { cluster: "Immunisation codes", code: "170407005", description: "Pertussis vaccination" },
  { cluster: "Immunisation codes", code: "170395004", description: "Measles mumps and rubella vaccination" },
  { cluster: "Immunisation codes", code: "281040003", description: "Hepatitis B vaccination" },
  { cluster: "Immunisation codes", code: "170397007", description: "Hepatitis A vaccination" },
  { cluster: "Immunisation codes", code: "473168000", description: "Shingles vaccination" },
  { cluster: "Immunisation codes", code: "76668005", description: "BCG vaccination" },
  { cluster: "Immunisation codes", code: "170418004", description: "Typhoid vaccination" },
  { cluster: "Immunisation codes", code: "170421003", description: "Yellow fever vaccination" },
  { cluster: "Immunisation codes", code: "840534001", description: "COVID-19 vaccination" },
  
  // Surgical procedure codes
  { cluster: "Surgical procedure codes", code: "80146002", description: "Appendectomy" },
  { cluster: "Surgical procedure codes", code: "38102005", description: "Cholecystectomy" },
  { cluster: "Surgical procedure codes", code: "236886002", description: "Hysterectomy" },
  { cluster: "Surgical procedure codes", code: "265764009", description: "Total abdominal hysterectomy" },
  { cluster: "Surgical procedure codes", code: "116028008", description: "Total knee replacement" },
  { cluster: "Surgical procedure codes", code: "52734007", description: "Total hip replacement" },
  { cluster: "Surgical procedure codes", code: "232717009", description: "Coronary artery bypass graft" },
  { cluster: "Surgical procedure codes", code: "414088005", description: "Percutaneous coronary intervention" },
  { cluster: "Surgical procedure codes", code: "172043006", description: "Mastectomy" },
  { cluster: "Surgical procedure codes", code: "176242006", description: "Lumpectomy" },
  { cluster: "Surgical procedure codes", code: "44946007", description: "Colectomy" },
  { cluster: "Surgical procedure codes", code: "174041007", description: "Colostomy" },
  { cluster: "Surgical procedure codes", code: "387731002", description: "Ileostomy" },
  { cluster: "Surgical procedure codes", code: "173422009", description: "Tonsillectomy" },
  { cluster: "Surgical procedure codes", code: "274031008", description: "Hernia repair" },
  { cluster: "Surgical procedure codes", code: "42934001", description: "Prostatectomy" },
  { cluster: "Surgical procedure codes", code: "236883004", description: "Caesarean section" },
  { cluster: "Surgical procedure codes", code: "174776001", description: "Cataract extraction" },
  { cluster: "Surgical procedure codes", code: "119954001", description: "Adenoidectomy" },
  { cluster: "Surgical procedure codes", code: "80933006", description: "Thyroidectomy" },
  { cluster: "Surgical procedure codes", code: "90199006", description: "Transurethral resection of prostate" },
  { cluster: "Surgical procedure codes", code: "234319005", description: "Splenectomy" },
  { cluster: "Surgical procedure codes", code: "107963000", description: "Excision of lesion of skin" },
  { cluster: "Surgical procedure codes", code: "33195004", description: "Amputation" },
  { cluster: "Surgical procedure codes", code: "445185007", description: "Pacemaker insertion" },
  { cluster: "Surgical procedure codes", code: "395218007", description: "Implantation of cardiac defibrillator" },
  
  // Additional common diagnoses
  { cluster: "Dementia diagnosis codes", code: "52448006", description: "Dementia" },
  { cluster: "Dementia diagnosis codes", code: "26929004", description: "Alzheimer's disease" },
  { cluster: "Dementia diagnosis codes", code: "429998004", description: "Vascular dementia" },
  { cluster: "Parkinson diagnosis codes", code: "49049000", description: "Parkinson's disease" },
  { cluster: "Multiple sclerosis codes", code: "24700007", description: "Multiple sclerosis" },
  { cluster: "Anaemia codes", code: "271737000", description: "Anaemia" },
  { cluster: "Anaemia codes", code: "87522002", description: "Iron deficiency anaemia" },
  { cluster: "Anaemia codes", code: "234349007", description: "Vitamin B12 deficiency anaemia" },
  { cluster: "DVT/PE codes", code: "128053003", description: "Deep vein thrombosis" },
  { cluster: "DVT/PE codes", code: "59282003", description: "Pulmonary embolism" },
  { cluster: "Peripheral vascular codes", code: "400047006", description: "Peripheral arterial disease" },
  { cluster: "Peripheral vascular codes", code: "233952000", description: "Abdominal aortic aneurysm" },
];

// Map clusters to domains for easier filtering
function clusterToDomain(cluster: string): string {
  if (cluster.includes('Asthma') || cluster.includes('COPD')) return 'respiratory';
  if (cluster.includes('Diabetes')) return 'endocrine';
  if (cluster.includes('Hypertension') || cluster.includes('heart') || cluster.includes('Heart') || cluster.includes('Stroke') || cluster.includes('DVT') || cluster.includes('vascular')) return 'cardiovascular';
  if (cluster.includes('kidney')) return 'renal';
  if (cluster.includes('Cancer')) return 'oncology';
  if (cluster.includes('Thyroid')) return 'endocrine';
  if (cluster.includes('Mental') || cluster.includes('Dementia')) return 'mental_health';
  if (cluster.includes('Epilepsy') || cluster.includes('Parkinson') || cluster.includes('sclerosis')) return 'neurological';
  if (cluster.includes('Liver')) return 'hepatic';
  if (cluster.includes('Rheumatoid') || cluster.includes('Osteo')) return 'musculoskeletal';
  if (cluster.includes('Gastrointestinal')) return 'gastrointestinal';
  if (cluster.includes('Allergy')) return 'allergy';
  if (cluster.includes('Immunisation')) return 'immunisation';
  if (cluster.includes('Surgical')) return 'procedure';
  if (cluster.includes('Anaemia')) return 'haematology';
  return 'other';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`Importing ${SNOMED_CODES.length} SNOMED codes...`);
    
    // Clear existing codes first
    const { error: deleteError } = await supabase
      .from('snomed_codes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.error('Error clearing existing codes:', deleteError);
    }

    // Prepare records for insert
    const records = SNOMED_CODES.map(code => ({
      cluster_description: code.cluster,
      snomed_code: code.code,
      code_description: code.description,
      domain: clusterToDomain(code.cluster),
      source_document: 'qsr-sfl-2019-20',
    }));

    // Insert in batches
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('snomed_codes')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize}:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Successfully imported ${insertedCount} SNOMED codes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: insertedCount,
        total: SNOMED_CODES.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

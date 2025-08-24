import { supabase } from "@/integrations/supabase/client";

export interface FormularySeedItem {
  drug_name: string;
  status: string;
  prior_approval_required: string;
  notes_restrictions: string;
  therapeutic_area: string;
  icb_region: string;
  source_document: string;
  source_page: string;
  last_reviewed_date: string;
}

export const importFormularySeedData = async (formularyData: FormularySeedItem[]) => {
  try {
    console.log('Importing formulary seed data...', formularyData.length, 'items');
    
    const { data, error } = await supabase.functions.invoke('import-icb-formulary-seed', {
      body: { formulary_data: formularyData }
    });

    if (error) {
      console.error('Import error:', error);
      throw error;
    }

    console.log('Import successful:', data);
    return data;
  } catch (error) {
    console.error('Failed to import formulary seed data:', error);
    throw error;
  }
};

// Seed data
export const FORMULARY_SEED_DATA: FormularySeedItem[] = [
  {
    "drug_name": "Carbocisteine",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Preferred mucolytic for COPD vs acetylcysteine effervescent.",
    "therapeutic_area": "Respiratory",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Finetest Lite blood glucose test strips",
    "status": "Green (Preferred)",
    "prior_approval_required": "No",
    "notes_restrictions": "Preferred first‑line BG test strips; use unless specific clinical reason.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Magnaspartate® (magnesium aspartate)",
    "status": "Green (Preferred)",
    "prior_approval_required": "No",
    "notes_restrictions": "Preferred oral magnesium; try before specials or citrate/chewables.",
    "therapeutic_area": "Electrolytes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Sildenafil (generic)",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "SLS restrictions do not apply to generic sildenafil; follow local ED guidance on quantities.",
    "therapeutic_area": "Urology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Tadalafil 5 mg daily",
    "status": "Formulary",
    "prior_approval_required": "No",
    "notes_restrictions": "Licensed indications under SLS criteria; max 1 tablet daily.",
    "therapeutic_area": "Urology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Melatonin MR 2 mg tablets",
    "status": "Green (Licensed)",
    "prior_approval_required": "No",
    "notes_restrictions": "Green for licensed indications; paediatric insomnia pathway via Sleep Right applies.",
    "therapeutic_area": "Neurology / Sleep",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Insulin degludec (Tresiba®)",
    "status": "Amber 2 (Shared Care)",
    "prior_approval_required": "No",
    "notes_restrictions": "Shared‑care cohort per SCP; outside cohort requires PA.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Insulin degludec/liraglutide (Xultophy®)",
    "status": "Amber 2 (Shared Care)",
    "prior_approval_required": "No",
    "notes_restrictions": "Amber 2 for cohort per SCP; other indications require IFR.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Sildenafil + Bosentan for digital ulcers (systemic sclerosis)",
    "status": "Amber 2",
    "prior_approval_required": "No",
    "notes_restrictions": "Per NHSE pathway; Bosentan is Red (NHSE).",
    "therapeutic_area": "Rheumatology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Dexcom ONE / FreeStyle Libre 2 for Type 1 diabetes",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Green for Type 1 DM and for people with learning disability on insulin; PA required for Type 2 DM.",
    "therapeutic_area": "Diabetes / Monitoring",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "Prior Approval Criteria – August 2025 (formulary notes)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  }
];
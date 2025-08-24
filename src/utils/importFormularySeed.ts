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

// Seed data - Updated comprehensive formulary
export const FORMULARY_SEED_DATA: FormularySeedItem[] = [
  {
    "drug_name": "Ramipril",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ACE inhibitor; first-line in HFrEF and post-MI per NICE; use formulary ACE before ARB.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Lisinopril",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ACE inhibitor; alternative to ramipril per local preference.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Perindopril",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ACE inhibitor; consider where clinically indicated.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Candesartan",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ARB; preferred in HFrEF if ACE-intolerant.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Losartan",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ARB; formulary option when ACE-intolerant.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Indapamide",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Thiazide-like diuretic; NICE NG136 aligned.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Spironolactone",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "MRA; first-line in HFrEF; monitor U+Es.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Eplerenone",
    "status": "Formulary - restricted",
    "prior_approval_required": "No",
    "notes_restrictions": "Use if spironolactone not tolerated (e.g., gynaecomastia).",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Bisoprolol",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "HF-licensed beta-blocker; target dose 10 mg daily.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Carvedilol",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "HF-licensed beta-blocker; consider by weight-based target.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Atorvastatin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "High-intensity statin; first-line per NICE CVD risk guidance.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Rosuvastatin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Consider when atorvastatin not tolerated/insufficient response.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Ezetimibe",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Adjunct to statin when LDL targets not met or statin intolerant.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Warfarin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Vitamin K antagonist; anticoagulation per local clinic protocols.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Apixaban",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "DOAC for AF/VTE per license and local guidance.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Rivaroxaban",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "DOAC for AF/VTE per license and local guidance.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Dabigatran",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "DOAC; consider renal function and interactions.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Edoxaban",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "DOAC; once-daily option; check renal dosing.",
    "therapeutic_area": "Cardiovascular",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Metformin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "First-line in T2DM unless contraindicated; titrate to GI tolerance.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Gliclazide",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Preferred SU when needed; risk of hypoglycaemia.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Empagliflozin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "SGLT2i with CV and renal benefit; check eGFR thresholds.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Dapagliflozin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "SGLT2i option; consider heart failure indications.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Saxagliptin",
    "status": "Formulary - preferred gliptin",
    "prior_approval_required": "No",
    "notes_restrictions": "Preferred DPP-4 inhibitor per local note; consider alternatives if not suitable.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Insulin degludec (Tresiba)",
    "status": "Amber 2 (Shared Care)",
    "prior_approval_required": "No",
    "notes_restrictions": "Shared-care cohort; outside cohort requires PA.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Xultophy (degludec/liraglutide)",
    "status": "Amber 2 (Shared Care)",
    "prior_approval_required": "No",
    "notes_restrictions": "Shared-care cohort; other indications via IFR.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Finetest Lite test strips",
    "status": "Green (Preferred)",
    "prior_approval_required": "No",
    "notes_restrictions": "Preferred BG test strips in primary care.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "GlucoRx CarePoint pen needles",
    "status": "Green (Preferred)",
    "prior_approval_required": "No",
    "notes_restrictions": "Standard screw-on single-use needles.",
    "therapeutic_area": "Diabetes",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Beclometasone inhaler (pMDI)",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ICS; choose low-global-warming propellants where possible.",
    "therapeutic_area": "Respiratory",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Budesonide/formoterol DPI",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "ICS/LABA combination per asthma/COPD guidelines.",
    "therapeutic_area": "Respiratory",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Tiotropium",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "LAMA option in COPD treatment algorithm.",
    "therapeutic_area": "Respiratory",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Salbutamol generic MDI",
    "status": "Formulary",
    "prior_approval_required": "No",
    "notes_restrictions": "Short-acting beta-agonist; prefer lower carbon footprint brands where tolerated.",
    "therapeutic_area": "Respiratory",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Omeprazole",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "PPI; use lowest effective dose; review need regularly.",
    "therapeutic_area": "Gastrointestinal",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Lansoprazole",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Alternative PPI per formulary.",
    "therapeutic_area": "Gastrointestinal",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Mesalazine (oral)",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Aminosalicylate for UC; brand consistency advised.",
    "therapeutic_area": "Gastrointestinal",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Sertraline",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "SSRIs first-line for depression/anxiety; review and titrate.",
    "therapeutic_area": "CNS",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Mirtazapine",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Alternative antidepressant; sedation/weight gain profile.",
    "therapeutic_area": "CNS",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Amitriptyline (low dose)",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Neuropathic pain where appropriate; consider safer alternatives in elderly.",
    "therapeutic_area": "CNS",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Naproxen",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "NSAID; lowest dose for shortest time; gastroprotection if needed.",
    "therapeutic_area": "Musculoskeletal",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Co-codamol 8/500",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Short-course for acute pain; counsel re constipation.",
    "therapeutic_area": "Musculoskeletal",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Amoxicillin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Use per local antimicrobial guidance; avoid inappropriate use.",
    "therapeutic_area": "Infections",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Doxycycline",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Use per local antimicrobial guidance; photosensitivity risk.",
    "therapeutic_area": "Infections",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Nitrofurantoin MR 100 mg",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "First-line for uncomplicated UTI if eGFR adequate.",
    "therapeutic_area": "Infections",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Tamsulosin",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Alpha-blocker for LUTS in men per NICE.",
    "therapeutic_area": "Urology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Mirabegron",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Beta-3 agonist for OAB when antimuscarinics not tolerated.",
    "therapeutic_area": "Urology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Tadalafil 5 mg daily",
    "status": "Formulary",
    "prior_approval_required": "No",
    "notes_restrictions": "Licensed indications with SLS criteria; max 1 per day.",
    "therapeutic_area": "Urology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Generic sildenafil",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "No SLS for generic; follow local ED guidance on quantities.",
    "therapeutic_area": "Urology",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Carbomer eye gel",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "First-line ocular lubricant for dry eye.",
    "therapeutic_area": "Eye",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Sodium hyaluronate eye drops (low cost brands)",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Use low-cost formulations first.",
    "therapeutic_area": "Eye",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Fluticasone nasal spray",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Allergic rhinitis per BNF dosing.",
    "therapeutic_area": "ENT",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Betamethasone 0.1% cream",
    "status": "Green",
    "prior_approval_required": "No",
    "notes_restrictions": "Potent topical steroid; use fingertip unit guidance.",
    "therapeutic_area": "Skin",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  },
  {
    "drug_name": "Emollient cream (e.g., Zeroveen/Epimax)",
    "status": "Green (Preferred)",
    "prior_approval_required": "No",
    "notes_restrictions": "First-line emollients; avoid branded cosmetics.",
    "therapeutic_area": "Skin",
    "icb_region": "NHS Northamptonshire ICB",
    "source_document": "NGH / Northamptonshire Formulary (compiled - see site)",
    "source_page": "",
    "last_reviewed_date": "2025-08-24"
  }
];
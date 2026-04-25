export type MethodologySection = {
  id: string;
  title: string;
  blocks: Array<{ type: "p"; text: string } | { type: "list"; items: string[] } | { type: "table"; rows: [string, string][] }>;
};

export const METHODOLOGY_PATH = "/nres/population-risk/methodology";

export const scoreTooltips = {
  poa: {
    label: "PoA",
    anchor: "poa",
    text: "Probability of emergency admission in 12 months. Higher = greater risk.",
  },
  polos: {
    label: "PoLoS",
    anchor: "polos",
    text: "Probability of extended length of stay if admitted.",
  },
  rub: {
    label: "RUB",
    anchor: "rub",
    text: "Resource Utilisation Band — overall morbidity burden, 0 (none) to 5 (very high).",
  },
  frailty: {
    label: "Frailty",
    anchor: "efi",
    text: "Electronic Frailty Index category. Severe = NICE threshold for proactive care.",
  },
  drugs: {
    label: "Drugs",
    anchor: "polypharmacy",
    text: "Distinct repeat medications. 10+ = SMR-eligible.",
  },
  riskTier: {
    label: "Risk Tier",
    anchor: "risk-stratification-framework-used-here",
    text: "Stratification tier based on PoA. See methodology.",
  },
  highRisk: {
    label: "High-risk (PoA ≥ 20%)",
    anchor: "poa",
    text: "PoA ≥ 20% means high or very high predicted emergency admission risk and is typically the MDT caseload.",
  },
  risingRisk: {
    label: "Rising-risk (5–10% PoA)",
    anchor: "poa",
    text: "The prevention target — patients not yet admitting but trending up.",
  },
} as const;

export const cohortTooltips: Record<string, { text: string; anchor: string }> = {
  vhhr: { text: "Intensive MDT caseload: PoA ≥ 20%. Intended intervention: Weekly MDT review · care coordinator · PCP.", anchor: "risk-stratification-framework-used-here" },
  ltc: { text: "LTC anchor: Age ≥ 65 AND eFI Mod/Severe. Intended intervention: Annual structured LTC review · ACP in place.", anchor: "risk-stratification-framework-used-here" },
  smr: { text: "SMR-eligible: 10+ repeat medications. Intended intervention: Clinical Pharmacist structured medication review.", anchor: "risk-stratification-framework-used-here" },
  rising: { text: "Rising-risk prevention: PoA 5–10%. Intended intervention: SPLW / HCA annual review · lifestyle + screening.", anchor: "risk-stratification-framework-used-here" },
  adm: { text: "Admission avoidance: 2+ inpatient admissions in past year. Intended intervention: Post-discharge review · ACP · virtual ward flag.", anchor: "risk-stratification-framework-used-here" },
  falls: { text: "Falls-risk: Severe eFI. Intended intervention: Falls pathway · home assessment · strength/balance.", anchor: "risk-stratification-framework-used-here" },
  frev: { text: "Frailty review backlog: Moderate + Severe eFI. Intended intervention: CGA · ReSPECT · annual frailty review.", anchor: "risk-stratification-framework-used-here" },
};

export const methodologySections: MethodologySection[] = [
  {
    id: "where-this-data-comes-from",
    title: "WHERE THIS DATA COMES FROM",
    blocks: [
      { type: "p", text: "This dashboard uses NARP (National Audit of Risk Profiles) data produced by the Johns Hopkins ACG® System and supplied by Graphnet Health, the platform that powers the Northamptonshire Care Record." },
      { type: "p", text: "Each NARP export is a monthly extract. It covers every registered patient in the practice and includes:" },
      { type: "list", items: ["Demographics (age, list status)", "Frailty score (eFI)", "Polypharmacy count", "Secondary care utilisation (admissions, A&E, outpatient)", "Two predictive risk scores (PoA, PoLoS)", "A morbidity classification (RUB)", "A pseudonymised internal patient key (FK_Patient_Link_ID)"] },
      { type: "p", text: "The data is \"as at\" the export date — typically 2–3 weeks behind real time depending on when the upstream feeds reconcile. The header of every page shows the data-as-at date for the currently loaded export." },
    ],
  },
  {
    id: "johns-hopkins-acg-system-what-it-is",
    title: "JOHNS HOPKINS ACG® SYSTEM — WHAT IT IS",
    blocks: [
      { type: "p", text: "The Johns Hopkins Adjusted Clinical Groups (ACG) System is a population health analytics methodology developed by Johns Hopkins University over 30+ years. It is the most widely used population risk-stratification tool in the NHS — currently embedded across approximately 9 million NHS patients in England, including the whole of Northamptonshire." },
      { type: "p", text: "The ACG System takes a patient's age, sex, diagnoses, prescribing, and utilisation history, and produces a series of derived scores that classify their morbidity burden and predict their future healthcare needs." },
      { type: "p", text: "It is used by Integrated Care Systems including Frimley, Kent, Cheshire & Merseyside, and Northamptonshire to:" },
      { type: "list", items: ["Identify patients at rising risk before they escalate", "Target proactive care to those most likely to benefit", "Compare populations across practices and PCNs", "Justify workforce and commissioning decisions"] },
      { type: "p", text: "The scores in this dashboard — PoA, PoLoS, RUB — are all standard ACG outputs." },
    ],
  },
  {
    id: "poa",
    title: "POA — PROBABILITY OF EMERGENCY ADMISSION",
    blocks: [
      { type: "p", text: "What it is:" },
      { type: "p", text: "The predicted likelihood, as a percentage from 0–100%, that this patient will have at least one UNPLANNED EMERGENCY hospital admission in the next 12 months." },
      { type: "p", text: "How to read it:" },
      { type: "p", text: "A PoA of 42% means: if you took 100 patients all scoring 42%, roughly 42 of them would be admitted as an emergency within 12 months. It is a forward-looking prediction, not a record of past events." },
      { type: "p", text: "How it's calculated:" },
      { type: "p", text: "The ACG System combines age, sex, recorded diagnoses (ICD-10), prescribing patterns, and prior utilisation to produce this score. The calculation is proprietary to Johns Hopkins." },
      { type: "p", text: "Risk tiers used in this dashboard:" },
      { type: "table", rows: [["Very High", "PoA > 50%"], ["High", "PoA 20 – 50%"], ["Moderate", "PoA 10 – 20%"], ["Rising", "PoA 5 – 10%   ← the prevention target"], ["Low", "PoA < 5%"], ["Unknown", "PoA not calculable (usually new registrations with insufficient history)"]] },
      { type: "p", text: "Operational use:" },
      { type: "p", text: "PoA is the case-finding signal. The \"rising risk\" tier (5–10%) is where proactive NRES intervention prevents escalation. The \"high\" and \"very high\" tiers are typically the MDT caseload." },
      { type: "p", text: "Caveat:" },
      { type: "p", text: "The ACG model is calibrated against the global population it was trained on, not specifically against Northamptonshire. The RANKING of patients is reliable; the absolute percentage is a calibrated estimate, not an exact local probability. Use it comparatively (this patient is higher risk than that one), not as a precise number to quote." },
    ],
  },
  {
    id: "polos",
    title: "POLOS — PROBABILITY OF EXTENDED LENGTH OF STAY",
    blocks: [
      { type: "p", text: "What it is:" },
      { type: "p", text: "The predicted likelihood, as a percentage 0–100%, that IF this patient is admitted, their hospital stay will be extended (longer than the median for their condition mix — Johns Hopkins uses a threshold around 6+ days)." },
      { type: "p", text: "How to read it:" },
      { type: "p", text: "PoA tells you HOW LIKELY admission is. PoLoS tells you, given an admission, HOW COMPLEX it's likely to be." },
      { type: "p", text: "A patient with PoA 42% and PoLoS 28% means: 42% chance of emergency admission, and if admitted, 28% chance of an extended stay." },
      { type: "p", text: "Operational use:" },
      { type: "p", text: "High PoLoS patients are the discharge-complexity cohort — candidates for virtual ward, community step-down, or anticipatory care planning to prevent the long stay happening at all. Pairing PoA and PoLoS lets you sub-segment the high-risk list:" },
      { type: "table", rows: [["High PoA + High PoLoS", "complex MDT case (e.g. severe frailty with multiple LTCs)"], ["High PoA + Low PoLoS", "frequent-flyer pattern (e.g. COPD exacerbations, repeated short stays)"], ["Low PoA + High PoLoS", "less common; often indicates planned admission risk"]] },
    ],
  },
  {
    id: "rub",
    title: "RUB — RESOURCE UTILISATION BAND",
    blocks: [
      { type: "p", text: "What it is:" },
      { type: "p", text: "A six-level summary of overall morbidity burden, derived from the patient's full ACG classification. RUB represents the RELATIVE level of healthcare resources the patient is expected to consume compared to the average." },
      { type: "p", text: "The six bands (as Johns Hopkins defines them):" },
      { type: "table", rows: [["0", "Non-user / no diagnoses recorded"], ["1", "Healthy users"], ["2", "Low morbidity"], ["3", "Moderate morbidity"], ["4", "High morbidity"], ["5", "Very high morbidity"]] },
      { type: "p", text: "How to read it:" },
      { type: "p", text: "Where PoA and PoLoS predict specific events, RUB describes overall complexity. International validation studies show patients in RUB 5 use approximately 10–11x the GP visits of patients in RUB 1 — a strong gradient." },
      { type: "p", text: "PoA vs RUB — when to use which:" },
      { type: "p", text: "Use PoA when you want to find patients at risk of a SPECIFIC event (admission). Use RUB when you want to understand the OVERALL CASE-MIX of a population — how complex is this practice's list compared to that one?" },
      { type: "p", text: "Both together: a patient with RUB 5 AND high PoA is both complex AND at imminent risk — top-priority MDT. A patient with RUB 5 and low PoA is complex but currently stable — keep an eye on, but not the urgent case." },
    ],
  },
  {
    id: "efi",
    title: "EFI — ELECTRONIC FRAILTY INDEX",
    blocks: [
      { type: "p", text: "What it is:" },
      { type: "p", text: "A separate, NICE-recommended frailty score derived from primary care records. Categories:" },
      { type: "table", rows: [["Fit", "(eFI < 0.12)"], ["Mild", "(0.12 – 0.24)"], ["Moderate", "(0.24 – 0.36)"], ["Severe", "(eFI > 0.36)"]] },
      { type: "p", text: "How it differs from the ACG scores:" },
      { type: "p", text: "eFI is specifically about FRAILTY (cumulative deficit accumulation in the older population). PoA / RUB are broader morbidity / utilisation predictions across all ages." },
      { type: "p", text: "Operational use:" },
      { type: "p", text: "Severe frailty is a national QOF / contractual category. It is also the trigger for falls assessment, polypharmacy review, and ReSPECT conversations. The \"frailty review backlog\" cohort in this dashboard is moderate + severe eFI patients." },
    ],
  },
  {
    id: "polypharmacy",
    title: "POLYPHARMACY — DRUG COUNT",
    blocks: [
      { type: "p", text: "The number of distinct repeat medications on the patient's record at the export date. Used to identify candidates for Structured Medication Review (SMR) by Clinical Pharmacists. Thresholds in this dashboard:" },
      { type: "table", rows: [["10+ drugs", "SMR-eligible (primary cohort)"], ["15+ drugs", "Complex polypharmacy"], ["20+ drugs", "Very complex — often warrants geriatrician input"]] },
    ],
  },
  {
    id: "risk-stratification-framework-used-here",
    title: "RISK STRATIFICATION FRAMEWORK USED HERE",
    blocks: [
      { type: "p", text: "This dashboard stratifies patients into seven action cohorts. Each cohort has a defined intervention pattern:" },
      { type: "table", rows: [["Intensive MDT caseload", "PoA ≥ 20%"], ["LTC anchor", "Age ≥ 65 AND eFI Mod/Severe"], ["SMR-eligible", "10+ repeat medications"], ["Rising-risk prevention", "PoA 5–10% (the upstream cohort)"], ["Admission avoidance", "2+ inpatient admissions in past year"], ["Falls-risk", "Severe eFI"], ["Frailty review backlog", "Moderate + Severe eFI"]] },
      { type: "p", text: "A patient may appear in multiple cohorts. The drill-through feature lets you stack filters (e.g. \"Intensive MDT caseload AND SMR-eligible\") to find narrower target groups." },
    ],
  },
  {
    id: "relationship-to-png-patient-needs-groups",
    title: "RELATIONSHIP TO PNG (PATIENT NEEDS GROUPS)",
    blocks: [
      { type: "p", text: "The Northants ICB New Models specification refers to \"Patient Needs Groups\" (PNG 1–11) as the operational triage taxonomy. PNG is also a Johns Hopkins ACG output but is NOT currently included in our NARP feed." },
      { type: "p", text: "Until PNG is added to the feed (under discussion with Graphnet), this dashboard uses PoA tiers and cohort definitions as a working approximation. A rough mapping:" },
      { type: "table", rows: [["PNG 8–11", "≈   PoA ≥ 20%  +  Mod/Severe frailty"], ["PNG 5–7", "≈   Rising / Moderate risk"], ["PNG 1–4", "≈   Low risk"]] },
      { type: "p", text: "This mapping is INDICATIVE only and should not be reported as a true PNG figure to the ICB. When PNG is added to the feed, the dashboard will display PNG values directly and these proxies will be retired." },
    ],
  },
  {
    id: "what-the-dashboard-cannot-tell-you",
    title: "WHAT THE DASHBOARD CANNOT TELL YOU",
    blocks: [
      { type: "p", text: "For transparency, this layer of the dashboard intentionally does NOT include:" },
      { type: "list", items: ["Disease registers (COPD, diabetes, dementia, palliative, etc.) — these live in EMIS / SystmOne and are being scoped for inclusion in a future enrichment phase.", "RESPECT status — held in the Northamptonshire Care Record; integration planned.", "Last review dates — practice clinical system data.", "Named accountable GP — practice clinical system data.", "IMD decile / ethnicity — separate feed required for Core20PLUS5 reporting.", "Free-text consultation content — out of scope."] },
      { type: "p", text: "The dashboard is the case-finding and population stratification layer of NMoC reporting. It is not a substitute for the practice clinical record." },
    ],
  },
  {
    id: "data-governance",
    title: "DATA GOVERNANCE",
    blocks: [
      { type: "list", items: ["NARP data is processed under the New Models of Care Data Sharing Agreement signed with Northamptonshire ICB.", "Patient identifiable data (NHS number, name, DOB) is visible only to named users explicitly authorised under the DSA.", "All access to identifiable data is logged in narp_pii_access_log; all identifiable exports in narp_export_log. These logs are reviewable by the ICB and the Notewell Caldicott Guardian on request.", "FK_Patient_Link_ID is the Graphnet-assigned pseudonymised internal key used to link records across exports without exposing NHS number.", "Notewell AI holds MHRA Class I medical device registration and conforms to DCB0129 / DCB0160 clinical safety standards."] },
    ],
  },
  {
    id: "sources-further-reading",
    title: "SOURCES & FURTHER READING",
    blocks: [
      { type: "list", items: ["Johns Hopkins ACG® System: hopkinsacg.org", "NHS England Neighbourhood Health Guidelines 2025/26", "Fuller Stocktake Report (2022)", "Northamptonshire ICB New Models Programme — Service Specification (held internally)", "NICE guidance on frailty identification and management"] },
    ],
  },
];

export const glossaryEntries = [
  { term: "ACG System", anchor: "johns-hopkins-acg-system-what-it-is", text: "The Johns Hopkins Adjusted Clinical Groups System; the population health analytics methodology that produces PoA, PoLoS, RUB and related outputs." },
  { term: "ACP (Anticipatory Care Plan)", anchor: "risk-stratification-framework-used-here", text: "A proactive plan for likely future care needs, often used for patients at high risk of deterioration, admission, or complex discharge." },
  { term: "Cohort", anchor: "risk-stratification-framework-used-here", text: "A defined group of patients matching a filter or intervention pattern, such as PoA ≥ 20% or 10+ repeat medications." },
  { term: "Core20PLUS5", anchor: "what-the-dashboard-cannot-tell-you", text: "The NHS England approach to reducing healthcare inequalities; IMD decile and ethnicity feeds are required for full reporting." },
  { term: "CGA (Comprehensive Geriatric Assessment)", anchor: "risk-stratification-framework-used-here", text: "A multidimensional assessment for older people with frailty, covering medical, functional, psychological, and social needs." },
  { term: "Drill-through", anchor: "risk-stratification-framework-used-here", text: "The dashboard feature that lets users click counts or cohorts to view the underlying patient references and stack filters." },
  { term: "eFI (Electronic Frailty Index)", anchor: "efi", text: "A NICE-recommended frailty score derived from primary care records, categorised as Fit, Mild, Moderate, or Severe." },
  { term: "FK_Patient_Link_ID", anchor: "where-this-data-comes-from", text: "The Graphnet-assigned pseudonymised internal patient key used to link records across exports without exposing NHS number." },
  { term: "Frailty", anchor: "efi", text: "A clinical state of increased vulnerability; in this dashboard it is represented by the Electronic Frailty Index category." },
  { term: "Graphnet", anchor: "where-this-data-comes-from", text: "Graphnet Health supplies the NARP export and powers the Northamptonshire Care Record platform." },
  { term: "ICB", anchor: "johns-hopkins-acg-system-what-it-is", text: "Integrated Care Board; the NHS organisation responsible for local system planning and commissioning." },
  { term: "Johns Hopkins", anchor: "johns-hopkins-acg-system-what-it-is", text: "Johns Hopkins University developed the ACG System used to derive standard population risk outputs." },
  { term: "LTC anchor", anchor: "risk-stratification-framework-used-here", text: "The cohort of patients aged 65+ with moderate or severe frailty, used as an anchor for structured long-term condition review." },
  { term: "MDT", anchor: "poa", text: "Multi-disciplinary team; the clinical group that typically reviews high and very-high risk patients." },
  { term: "Movers", anchor: "risk-stratification-framework-used-here", text: "Patients whose risk score, cohort membership, or utilisation pattern changes between snapshots." },
  { term: "NARP", anchor: "where-this-data-comes-from", text: "National Audit of Risk Profiles; the monthly export used by this dashboard." },
  { term: "NHS number", anchor: "data-governance", text: "A patient-identifiable NHS identifier visible only to named authorised users under the Data Sharing Agreement." },
  { term: "NMoC", anchor: "what-the-dashboard-cannot-tell-you", text: "New Models of Care; the programme context for NRES case-finding and population stratification reporting." },
  { term: "NRES", anchor: "risk-stratification-framework-used-here", text: "Rural East & South Neighbourhood, the programme area served by this dashboard." },
  { term: "PCN", anchor: "johns-hopkins-acg-system-what-it-is", text: "Primary Care Network; a grouping of GP practices used for local service delivery and population health planning." },
  { term: "PNG (Patient Needs Groups)", anchor: "relationship-to-png-patient-needs-groups", text: "A Johns Hopkins ACG output used as an operational triage taxonomy, not currently included in the NARP feed." },
  { term: "PoA (Probability of Admission)", anchor: "poa", text: "The predicted likelihood that a patient will have at least one unplanned emergency hospital admission in the next 12 months." },
  { term: "PoLoS (Probability of Extended Length of Stay)", anchor: "polos", text: "The predicted likelihood that, if admitted, a patient's hospital stay will be extended." },
  { term: "Polypharmacy", anchor: "polypharmacy", text: "The number of distinct repeat medications on the patient's record; 10+ is treated as SMR-eligible in this dashboard." },
  { term: "Practice", anchor: "where-this-data-comes-from", text: "The GP practice list covered by the selected NARP export." },
  { term: "Programme Board", anchor: "sources-further-reading", text: "The governance forum that reviews programme delivery, reporting, and commissioning decisions." },
  { term: "RESPECT / ReSPECT", anchor: "efi", text: "Recommended Summary Plan for Emergency Care and Treatment; referenced as a proactive care planning consideration for frailty." },
  { term: "Risk pyramid", anchor: "poa", text: "The dashboard view that groups patients into PoA tiers from Low to Very High." },
  { term: "Risk stratification", anchor: "risk-stratification-framework-used-here", text: "The process of grouping patients by predicted risk and action cohort to target proactive care." },
  { term: "Rising risk", anchor: "poa", text: "The PoA 5–10% prevention target cohort: patients not yet high risk but showing upstream risk." },
  { term: "RUB (Resource Utilisation Band)", anchor: "rub", text: "A six-level ACG summary of overall morbidity burden and expected relative healthcare resource use." },
  { term: "SDA", anchor: "risk-stratification-framework-used-here", text: "Service delivery activity; used in related NRES reporting and intervention tracking." },
  { term: "SMR (Structured Medication Review)", anchor: "polypharmacy", text: "A Clinical Pharmacist review for patients with polypharmacy; 10+ repeat medications is the primary cohort threshold here." },
  { term: "Snapshot", anchor: "where-this-data-comes-from", text: "A point-in-time NARP export, typically monthly and as at the export date." },
  { term: "Worklist", anchor: "risk-stratification-framework-used-here", text: "A saved action list of patient references for review, follow-up, or intervention tracking." },
];

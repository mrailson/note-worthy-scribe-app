import { BookOpen, Shield, AlertTriangle, FileText, CheckSquare, HelpCircle, Activity, TrendingUp, FileHeart, Settings, MessageSquare, Users, ClipboardCheck, Building, Calendar, Database, Scale, UserCheck, Syringe, Megaphone, NotebookPen, Mic, TestTube } from 'lucide-react';

const nhsSafetyPreamble = "You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.";

export interface QuickAction {
  label: string;
  icon: any;
  prompt: string;
  requiresFile: boolean;
  action?: string;
}

export const quickActions: QuickAction[] = [
  { 
    label: 'NICE Guidance Finder',
    icon: BookOpen, 
    prompt: `${nhsSafetyPreamble} Summarise NICE guidance [insert NG/CG number or condition] for GP use. Include: key diagnostic criteria, first-line and step-up treatments, relevant referral triggers, and monitoring recommendations. Cite the latest NICE update date.`,
    requiresFile: false 
  },
  { 
    label: 'BNF Drug Lookup - Metformin', 
    icon: Shield, 
    prompt: `${nhsSafetyPreamble} Provide a concise BNF summary including: adult dosing range, titration guidance, renal/hepatic adjustments, major interactions, contraindications, and common adverse effects. Insert Drug name metformin`,
    requiresFile: false 
  },
  { 
    label: 'Red Flag Symptom Checker', 
    icon: AlertTriangle, 
    prompt: `${nhsSafetyPreamble} List red flag symptoms for [insert symptom/condition] that require urgent or 2WW referral according to NICE/NHS pathways. Include pathway names and recommended referral timeframes.`,
    requiresFile: false 
  },
  { 
    label: 'Complaint Response Helper', 
    icon: MessageSquare, 
    prompt: `${nhsSafetyPreamble} 

ROLE: UK NHS GP practice complaints response assistant.

OBJECTIVE: Gather facts, confirm understanding, then generate three outputs: (A) patient reply, (B) staff communication (if practice-based complaint), (C) lessons learnt & improvement plan.

IF ATTACHMENTS/EVIDENCE PROVIDED: First, extract a concise evidence summary and a dated chronology. Identify key issues raised, any policy references, and any clinical/admin touchpoints.

INTERVIEW (ask one set at a time, wait for answers):
1) Who is making the complaint (patient, representative, staff)?
2) Short summary of the main issue in their words.
3) Date(s)/time(s) of incident(s); location/service.
4) People involved (roles only; avoid attributing blame).
5) What actions have been taken so far?
6) What outcome is the complainant seeking?
7) Any related policies/guidance or records to reference?
8) Any learning/change already identified?

CONFIRMATION: Restate facts and obtain confirmation before drafting.

OUTPUTS (use headings):
A) Patient Reply (empathetic, addresses each point, explains findings, apologises where appropriate, states actions taken/planned, timelines, and signposts escalation e.g., PALS/Ombudsman).
B) Staff Communication (constructive, fact-focused, supportive tone; include next steps, supervision/learning actions; avoid blame).
C) Lessons Learnt & Improvement Plan (bullet points suitable for CQC evidence: root cause themes, process/policy/training/IT changes, owners, target dates, how to audit effectiveness).

STYLE: Plain English, culturally sensitive, trauma-informed, non-defensive. Use GP-practice context. Provide a short version and an expanded version for each output.`,
    requiresFile: true 
  },
  { 
    label: 'QOF Indicator Quick Check', 
    icon: CheckSquare, 
    prompt: `${nhsSafetyPreamble} Summarise the QOF indicators for [insert condition] for 2025/26. Include indicator codes, thresholds, recall rules, and exception reporting criteria. Focus on what a GP practice team needs to know.`,
    requiresFile: false 
  },
  { 
    label: 'Patient Leaflet Finder', 
    icon: HelpCircle, 
    prompt: `${nhsSafetyPreamble} Find and summarise an NHS-approved patient information leaflet for [insert condition/treatment]. Include plain-English summary, NHS.uk link, and a printable PDF link if available.`,
    requiresFile: false 
  },
  { 
    label: 'Immunisation Schedule Lookup', 
    icon: Activity, 
    prompt: `${nhsSafetyPreamble} Provide the current UK vaccination schedule for [insert age/risk group] according to Green Book/NHS guidance. Include vaccine names, doses, intervals, and special considerations.`,
    requiresFile: false 
  },
  { 
    label: 'Primary Care Prescribing Alerts', 
    icon: TrendingUp, 
    prompt: `${nhsSafetyPreamble} List the most recent MHRA/NHS prescribing safety alerts relevant to primary care in [insert month/year]. Include drug name, nature of alert, key GP actions, and link to official notice.`,
    requiresFile: false 
  },
  { 
    label: 'Practice Policy & Protocol Finder', 
    icon: Settings, 
    prompt: `${nhsSafetyPreamble} Search for the local or PCN protocol on [insert topic] and summarise the key steps. Include source document link and any NHS/national guidance references.`,
    requiresFile: false 
  },
  { 
    label: 'Referral Criteria & Forms', 
    icon: FileText, 
    prompt: `${nhsSafetyPreamble} Provide referral criteria and process for [insert specialty/condition] in [insert local area or ICB], including NHS eRS form links, local service inclusion/exclusion criteria, and relevant NICE guidance.`,
    requiresFile: false 
  },
];

const pmSafetyPreamble = "You are an expert UK NHS Practice Manager assistant. Use current NHS England guidance, PCN DES specifications, CQC standards, and UK GDPR/IG requirements. Present information clearly for practice management use.";

export const practiceManagerQuickActions: QuickAction[] = [
  {
    label: 'Complaint Response Helper (PM)',
    icon: MessageSquare,
    prompt: `${pmSafetyPreamble} 

ROLE: PM complaints assistant. 

OBJECTIVE: Gather facts, confirm, then generate: (A) patient reply, (B) staff comms, (C) lessons learnt & improvement plan, (D) partner/exec brief, (E) action log (owner, due, status). 

IF ATTACHMENTS: extract a concise evidence summary + dated chronology. 

INTERVIEW (ask stepwise, wait for answers): complainant; issue summary; dates/locations; people (roles); actions so far; outcome sought; relevant policies/records; learning so far; target response deadline. 

CONFIRM facts. 

OUTPUTS with headings; plain English; short and expanded versions for A & B; signpost escalation.`,
    requiresFile: true
  },
  {
    label: 'ARRS Claim Checker',
    icon: ClipboardCheck,
    prompt: `${pmSafetyPreamble} Validate an ARRS claim for [role title] in [PCN name]. Assess: eligibility, reimbursable cost elements, WTE/hours calc, supervisor requirements, claim window, evidence needed (contract, JD, payroll), common rejection reasons, and back-claim options. Provide a checklist and a ready-to-send query email to the ICB if needed.`,
    requiresFile: true
  },
  {
    label: 'PCN DES / Contract Finder',
    icon: Building,
    prompt: `${pmSafetyPreamble} Find the relevant clause for [topic] within the PCN DES/contract and provide: plain-English summary, 'what this means operationally', deadlines, evidence required, and any dependencies (e.g., workforce or IT).`,
    requiresFile: false
  },
  {
    label: 'Staff Rota & Leave Planner',
    icon: Calendar,
    prompt: `${pmSafetyPreamble} Given [staff count] staff, [FTE] FTE, [leave days] leave days, [clinics per day] clinics/day, and [avg contacts] contacts/day, estimate coverage, identify shortfalls, and propose mitigations (locum, role-mix, overtime, redirect to PCN services). Output a table and 5 bullet risks with actions.`,
    requiresFile: false
  },
  {
    label: 'CQC Evidence Pack Builder',
    icon: Database,
    prompt: `${pmSafetyPreamble} From the inputs and any uploads, map current evidence to CQC quality statements/KLOEs, list gaps, and produce an action plan (owner, due date, evidence needed). Provide a 1-page summary for inspectors.`,
    requiresFile: true
  },
  {
    label: 'DPIA / IG Helper',
    icon: Scale,
    prompt: `${pmSafetyPreamble} Guide a DPIA for [project name]. Collect purpose, lawful basis, data flows, processors, risks (confidentiality/integrity/availability), mitigations, DCB0129/0160 relevance, and decision. Produce: (1) DPIA summary, (2) risk register, (3) comms plan, (4) approvals list.`,
    requiresFile: true
  },
  {
    label: 'Subject Access Request (SAR) Assistant',
    icon: UserCheck,
    prompt: `${pmSafetyPreamble} Build a SAR plan for requester [name]. Create: (1) timeline with statutory deadline, (2) scope/data sources list, (3) redaction checklist (3rd-party/clinical risk), (4) response letter template, (5) proof-of-identity checklist.`,
    requiresFile: true
  },
  {
    label: 'Vaccine Clinic Planner',
    icon: Syringe,
    prompt: `${pmSafetyPreamble} Plan a vaccine clinic for [programme] on [date]. Inputs: staff [list], site constraints [notes], target doses [number]. Output: session timetable, staffing matrix, consumables list, booking target curve, risk/contingency notes.`,
    requiresFile: false
  },
  {
    label: 'Practice Comms Builder',
    icon: Megaphone,
    prompt: `${pmSafetyPreamble} From this core message: [message], generate: (1) 160-char SMS, (2) patient letter, (3) website news post, (4) phone/IVR script, (5) social post. Keep consistent tone; add accessibility/readability improvements.`,
    requiresFile: false
  },
  {
    label: 'Meeting Notes Summariser',
    icon: NotebookPen,
    prompt: `${pmSafetyPreamble} Summarise the attached/pasted transcript into: (1) executive summary, (2) decisions, (3) actions with owner/due date, (4) risks/issues log. Keep neutral, no hallucinations; mark any unclear sections for review.`,
    requiresFile: true
  },
];
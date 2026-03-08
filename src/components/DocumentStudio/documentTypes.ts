import {
  FileText, FileCheck, FileSpreadsheet, Shield, Users, Heart,
  AlertTriangle, BarChart3, Mail, Building2, GraduationCap,
  ClipboardList, Scale, Briefcase, TrendingUp, Stethoscope,
  Pill, Activity, BookOpen, Landmark, Search, Phone, RefreshCw
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type DocumentCategory = 'nmp' | 'clinical' | 'governance' | 'hr' | 'letters' | 'finance';

export interface DefaultQuestion {
  question: string;
  type: 'text' | 'pills';
  options?: string[];
  multiSelect?: boolean;
  required?: boolean;
}

export interface DocumentType {
  type_key: string;
  display_name: string;
  icon: LucideIcon;
  category: DocumentCategory;
  use_when: string;
  description: string;
  default_input_fields: string[];
  output_format: 'prose' | 'structured' | 'letter';
  default_questions: DefaultQuestion[];
  system_prompt_template: string;
  special_behaviour?: 'harm_triage_gate';
}

export const CATEGORY_COLOURS: Record<DocumentCategory, string> = {
  nmp: '#8B5CF6',
  clinical: '#3B82F6',
  governance: '#EF4444',
  hr: '#F97316',
  letters: '#14B8A6',
  finance: '#10B981',
};

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  nmp: 'NMP',
  clinical: 'Clinical',
  governance: 'Governance',
  hr: 'HR',
  letters: 'Letters',
  finance: 'Finance',
};

const sharedPreamble = `You are generating a professional document for a UK GP practice. Follow these rules:

ANTI-FABRICATION RULE (HIGHEST PRIORITY):
Only include facts, data, and details explicitly provided in the user's inputs, uploaded files, and clarifying answers. If information is not provided, do not invent it. Write around gaps honestly.

LANGUAGE:
- British English throughout (organisation, centre, recognise, apologise, colour, behaviour, programme, judgement, acknowledgement, cancelled, labelled, fulfil, enquiry)
- UK date format: "8 March 2026" (no leading zeros, no American format)
- NHS terminology: patient, practice, surgery

FORMAT:
- Professional flowing prose — no bullet points unless explicitly appropriate for the document type
- No markdown formatting (no ##, **, --, bullets) unless the document type specifically calls for structured sections
- Clean, well-organised sections with clear headings where appropriate for the document type

TONE:
- Professional, clear, and practical
- For clinical documents: evidence-based and appropriately cautious
- For patient-facing documents: warm, accessible, plain English
- For governance documents: thorough and compliant without being bureaucratic`;

export const DOCUMENT_TYPES: DocumentType[] = [
  // ==========================================
  // NMP TOOLS (5)
  // ==========================================
  {
    type_key: 'nmp_prescribing_review',
    display_name: 'NMP Prescribing Review',
    icon: Pill,
    category: 'nmp',
    use_when: 'Preparing for a supervision meeting, appraisal, or want a snapshot of prescribing patterns',
    description: 'Upload ePACT2 data and personal formulary. Generates a review of prescribing patterns against agreed scope with flags for out-of-formulary items, antibiotic stewardship, controlled drugs, and cost trends.',
    default_input_fields: ['ePACT2 prescribing data', 'NMP personal formulary', 'BNF chapters in scope'],
    output_format: 'structured',
    default_questions: [
      { question: 'Which NMP is this review for?', type: 'text', required: true },
      { question: 'What BNF chapters are in scope?', type: 'pills', options: ['Infections', 'CNS', 'Cardiovascular', 'Respiratory', 'Endocrine', 'Musculoskeletal', 'GI', 'Other'], multiSelect: true, required: true },
      { question: 'Any specific concerns to investigate?', type: 'text', required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a prescribing review document with sections for: prescribing volume summary, BNF chapter breakdown, in-scope vs out-of-scope analysis, cost trends, controlled drug summary, antibiotic prescribing comparison, recommendations, and a GP mentor sign-off section. Use tables where helpful for data presentation. Include a space for the GP mentor to sign and date.`,
  },
  {
    type_key: 'nmp_annual_declaration',
    display_name: 'NMP Annual Declaration',
    icon: FileCheck,
    category: 'nmp',
    use_when: 'ICB annual declaration due, or onboarding/renewing an NMP authority to practice',
    description: 'Pull together CPD evidence, prescribing summary, supervision log, and competency self-assessment into the formal annual declaration. Covers RPS Competency Framework, scope of practice, and triple sign-off.',
    default_input_fields: ['CPD portfolio', 'Prescribing summary', 'Supervision records', 'RPS competency self-assessment'],
    output_format: 'structured',
    default_questions: [
      { question: 'Has scope of practice changed this year?', type: 'pills', options: ['No changes', 'Yes — expanded', 'Yes — reduced'], required: true },
      { question: 'Any prescribing incidents to declare?', type: 'pills', options: ['None', 'Yes — details in uploaded docs'], required: true },
      { question: 'Clinical supervision completed to schedule?', type: 'pills', options: ['Yes — at least every 90 days', 'Partially', 'No — gaps exist'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an annual declaration document matching ICB requirements. Include: scope of practice confirmation, RPS Competency Framework review mapped to the 10 competencies, CPD summary with hours, prescribing activity overview, supervision compliance statement, incident declaration section, action plan for the coming year, and three sign-off blocks (NMP, GP mentor, practice lead) each with name/signature/date fields.`,
  },
  {
    type_key: 'nmp_case_review',
    display_name: 'NMP Case Review',
    icon: Search,
    category: 'nmp',
    use_when: 'Preparing for clinical supervision, after a concern, or reflective review',
    description: 'Upload anonymised patient consultations. Generates a structured peer review assessing clinical decision-making, prescribing appropriateness, documentation, safety netting, and guideline adherence.',
    default_input_fields: ['Anonymised consultation records (5-10 cases)', 'Relevant clinical guidelines', 'NMP personal formulary'],
    output_format: 'structured',
    default_questions: [
      { question: 'What clinical area do these cases cover?', type: 'text', required: true },
      { question: 'Random sample or targeted review?', type: 'pills', options: ['Random sample', 'Targeted — specific concern', 'NMP self-selected'], required: true },
      { question: 'NMP experience level?', type: 'pills', options: ['Newly qualified (< 1 year)', 'Developing (1-3 years)', 'Experienced (3+ years)'], required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a clinical case review document. For each case: assess prescribing decision, safety netting, documentation quality, and guideline adherence. Then provide overall themes, strengths, development areas, agreed actions, and a supervision sign-off section. Be constructive and learning-focused — not punitive. Frame feedback as development opportunities.`,
  },
  {
    type_key: 'nmp_governance_pack',
    display_name: 'NMP Governance Pack',
    icon: Shield,
    category: 'nmp',
    use_when: 'New NMP starting, renewal due, ICB asking for documentation, CQC prep',
    description: 'Assembles a complete governance pack: Authority to Practice, personal formulary, scope of practice agreement, indemnity checklist, supervision arrangements.',
    default_input_fields: ['NMP qualification certificate', 'Registration number', 'Indemnity evidence', 'DBS confirmation', 'GP mentor details'],
    output_format: 'structured',
    default_questions: [
      { question: 'New NMP or annual renewal?', type: 'pills', options: ['New NMP onboarding', 'Annual renewal', 'Change of details'], required: true },
      { question: 'Which practices will they prescribe at?', type: 'text', required: true },
      { question: 'Independent, supplementary, or both?', type: 'pills', options: ['Independent prescriber', 'Supplementary prescriber', 'Both'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a complete NMP governance pack document with: cover page, Authority to Practice form (with fields for NMP details, registration number, BNF chapters, GP mentor details, authorised signatory), personal formulary template, scope of practice agreement, supervision schedule template, completion checklist showing required/completed items, and an ICB cover letter. Use form-style layouts with clear field labels.`,
  },
  {
    type_key: 'nmp_prescribing_comparison',
    display_name: 'NMP Prescribing Comparison',
    icon: BarChart3,
    category: 'nmp',
    use_when: 'Want to compare NMP prescribing across the practice or PCN',
    description: 'Upload data for multiple NMPs. Get a side-by-side comparison of volume, cost, antibiotic rates, and formulary adherence.',
    default_input_fields: ['ePACT2 data for multiple NMPs', 'Prescribing targets', 'Individual formularies'],
    output_format: 'structured',
    default_questions: [
      { question: 'How many NMPs are you comparing?', type: 'pills', options: ['2', '3-5', '6-10', '10+'], required: true },
      { question: 'Practice or PCN comparison?', type: 'pills', options: ['Single practice', 'Across PCN'], required: true },
      { question: 'Specific indicators to focus on?', type: 'pills', options: ['Antibiotics', 'Opioids', 'High-cost items', 'Controlled drugs', 'Overall volume', 'Cost per item'], multiSelect: true, required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a benchmarking comparison report. Include: summary table comparing all NMPs, per-NMP profiles, variation analysis highlighting outliers, cost comparison, antibiotic stewardship comparison, and recommendations. Use tables for data and describe patterns in prose. Do not name individual NMPs negatively — frame as variation for discussion.`,
  },

  // ==========================================
  // CORE TOOLS (10)
  // ==========================================
  {
    type_key: 'cqc_preparation',
    display_name: 'CQC Preparation Report',
    icon: BarChart3,
    category: 'governance',
    use_when: 'Getting ready for an inspection, or just want to see where you stand',
    description: 'Upload audits, learning events, complaints, staffing, patient surveys. Generates a CQC-ready evidence summary mapped to the 5 key questions with gaps identified.',
    default_input_fields: ['Clinical audits', 'Learning event reports', 'Patient surveys', 'Staffing data', 'Complaints summary'],
    output_format: 'structured',
    default_questions: [
      { question: 'Focus on all 5 key questions or specific ones?', type: 'pills', options: ['All 5', 'Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'], multiSelect: true, required: true },
      { question: 'Any known areas of concern?', type: 'text', required: false },
      { question: 'When is your expected inspection?', type: 'pills', options: ['Next 3 months', '3-6 months', '6+ months', 'Not scheduled'], required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a CQC preparation report structured by the 5 key questions (Safe, Effective, Caring, Responsive, Well-led). For each: summarise available evidence, identify strengths, flag gaps, and recommend actions. Include an executive summary and a gap analysis table. Reference CQC assessment framework language.`,
  },
  {
    type_key: 'learning_event',
    display_name: 'Learning Event Report',
    icon: AlertTriangle,
    category: 'clinical',
    use_when: 'After an incident, near-miss, or anything the team can learn from',
    description: 'Describe what happened. Generates a structured report with contributing factors (systems thinking, not blame), learning points, and action plan. Includes LFPSE reminder.',
    default_input_fields: ['Event description', 'Staff reflections', 'Timeline', 'Outcome'],
    output_format: 'structured',
    special_behaviour: 'harm_triage_gate',
    default_questions: [
      { question: 'What category best describes this event?', type: 'pills', options: ['Prescribing / Medication', 'Administrative / Process', 'Clinical Assessment', 'Communication', 'IT Systems', 'Other'], required: true },
      { question: 'Were any immediate actions taken?', type: 'text', required: false },
      { question: 'Has the team already discussed this informally?', type: 'pills', options: ['Yes', 'No', 'Partially'], required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Learning Event Report using systems thinking — NOT blame. Frame all contributing factors as process or system issues. Include: event summary, timeline, contributing factors analysis, learning points, action plan with owners and deadlines. Use language like "a contributing factor was..." rather than "staff failed to...". Include footer reminder about LFPSE recording. Do NOT include any patient identifiable information. Do NOT include fields for patient name, DOB, or NHS number.`,
  },
  {
    type_key: 'business_case',
    display_name: 'Business Case / Funding Bid',
    icon: Briefcase,
    category: 'finance',
    use_when: 'Pitching for funding, proposing a new service, or making a case to partners',
    description: 'Describe your proposal and upload supporting data. Generates a structured NHS business case with rationale, cost-benefit, implementation plan, and risk assessment.',
    default_input_fields: ['Proposal description', 'Cost estimates', 'Demand data', 'Strategic alignment'],
    output_format: 'structured',
    default_questions: [
      { question: 'What is the total investment needed?', type: 'text', required: true },
      { question: 'Funding source?', type: 'pills', options: ['PCN', 'ICB', 'ARRS', 'Practice investment', 'Other / mixed'], required: true },
      { question: 'Expected patient benefit?', type: 'text', required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a structured NHS business case with: executive summary, strategic context, current state, proposed solution, cost-benefit analysis, implementation timeline, risk assessment with mitigations, and recommendation. Use professional but accessible language suitable for both clinical and non-clinical board members.`,
  },
  {
    type_key: 'clinical_audit',
    display_name: 'Clinical Audit Report',
    icon: Activity,
    category: 'clinical',
    use_when: 'Completed an audit and need to write it up properly',
    description: 'Upload audit data and criteria. Generates a formal report with methodology, results, comparison to standards, and recommendations.',
    default_input_fields: ['Audit data (CSV/Excel)', 'Criteria/standards', 'Previous results', 'NICE guidelines'],
    output_format: 'structured',
    default_questions: [
      { question: 'First cycle or re-audit?', type: 'pills', options: ['First cycle', 'Re-audit'], required: true },
      { question: 'Standard measured against?', type: 'text', required: true },
      { question: 'Sample size and date range?', type: 'text', required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a clinical audit report following standard audit methodology: title, aim, standard/criteria, methodology (sample, data collection, date range), results with percentages, comparison to standard and to previous cycle if re-audit, discussion, conclusions, recommendations, and action plan. Include space for data tables/charts descriptions.`,
  },
  {
    type_key: 'formal_letter',
    display_name: 'Formal Letter / Response',
    icon: Mail,
    category: 'letters',
    use_when: 'Need to write something formal and want it done properly',
    description: 'Draft professional correspondence — ICB submissions, complaint responses, staff references, contractual letters, MP responses.',
    default_input_fields: ['Context documents', 'Key points', 'Recipient details', 'Tone guidance'],
    output_format: 'letter',
    default_questions: [
      { question: 'Who is the recipient and their role?', type: 'text', required: true },
      { question: 'What tone?', type: 'pills', options: ['Formal', 'Empathetic', 'Firm', 'Diplomatic', 'Apologetic'], required: true },
      { question: 'Is this legally sensitive?', type: 'pills', options: ['No', 'Possibly — please be careful with wording', 'Yes — keep factual and cautious'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a formal letter in proper UK business correspondence format. Date (DD Month YYYY, no leading zeros), recipient address, salutation, subject line, body in flowing paragraphs (no bullets), closing (Yours sincerely if named, Yours faithfully if not), single signature block. British English throughout. If legally sensitive, keep factual and avoid admissions or speculation.`,
  },
  {
    type_key: 'annual_report',
    display_name: 'Practice Annual Report',
    icon: BookOpen,
    category: 'governance',
    use_when: 'Year-end reporting, PPG meeting, practice website update',
    description: 'Upload KPIs, surveys, workforce data, financials. Generates a comprehensive annual report.',
    default_input_fields: ['Appointment data', 'Patient surveys', 'QOF', 'Workforce', 'Financials'],
    output_format: 'structured',
    default_questions: [
      { question: 'Reporting year?', type: 'text', required: true },
      { question: 'Achievements to highlight?', type: 'text', required: false },
      { question: 'Public or internal use?', type: 'pills', options: ['Public (website/PPG)', 'Internal (partners only)', 'Both versions'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a professional practice annual report with: welcome/introduction, practice overview, key achievements, service delivery statistics, patient feedback summary, workforce update, quality improvement, plans for next year. For public versions, use accessible language. Include suggestions for where charts/images could be inserted.`,
  },
  {
    type_key: 'risk_assessment',
    display_name: 'Risk Assessment / DPIA',
    icon: AlertTriangle,
    category: 'governance',
    use_when: 'Introducing a new system, changing a process, or sharing data with a third party',
    description: 'Describe the change. Generates a formal risk assessment or DPIA with risk matrix, mitigations, and residual scores.',
    default_input_fields: ['System/process description', 'Data flows', 'Existing controls', 'Supplier docs'],
    output_format: 'structured',
    default_questions: [
      { question: 'What type?', type: 'pills', options: ['New system/technology', 'Process change', 'Data sharing arrangement', 'Premises/estates change'], required: true },
      { question: 'Does it involve patient identifiable data?', type: 'pills', options: ['Yes', 'No', 'Unsure'], required: true },
      { question: 'Who is the data processor (if applicable)?', type: 'text', required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a formal risk assessment or DPIA. Include: description of change, scope, data flows (if DPIA), risk identification with likelihood/impact scoring (5x5 matrix), existing controls, additional mitigations, residual risk scores, approval section. Use standard NHS IG terminology. If DPIA, follow ICO DPIA template structure.`,
  },
  {
    type_key: 'board_report',
    display_name: 'Board / Committee Report',
    icon: Building2,
    category: 'governance',
    use_when: 'Preparing for a PCN board, neighbourhood meeting, or partnership meeting',
    description: 'Compile multi-source data into a board-ready paper with KPIs, finance, risks, and decisions needed.',
    default_input_fields: ['Workforce data', 'Finance reports', 'Service activity', 'Risk register', 'Action log'],
    output_format: 'structured',
    default_questions: [
      { question: 'Which board or committee?', type: 'text', required: true },
      { question: 'Any decisions needed from the board?', type: 'text', required: false },
      { question: 'Key risks to escalate?', type: 'text', required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a board-ready report with: executive summary (1 paragraph), KPI dashboard summary, finance overview, workforce update, risk register highlights (top 5), decisions required (clearly flagged), action log update. Use professional governance language. Keep the executive summary punchy — a busy board member should get the key messages from the first paragraph.`,
  },
  {
    type_key: 'meeting_minutes',
    display_name: 'Meeting Summary / Minutes',
    icon: ClipboardList,
    category: 'governance',
    use_when: 'After any meeting that needs a proper record',
    description: 'Upload notes, transcript, or agenda. Generates structured minutes with decisions, actions, owners, and deadlines.',
    default_input_fields: ['Audio/transcript', 'Notes', 'Agenda', 'Previous minutes'],
    output_format: 'structured',
    default_questions: [
      { question: 'What type of meeting?', type: 'pills', options: ['Partners meeting', 'Clinical meeting', 'Staff meeting', 'PCN/Network meeting', 'Board meeting', 'Other'], required: true },
      { question: 'Any confidential items to flag?', type: 'pills', options: ['No', 'Yes — mark them'], required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate formal meeting minutes with: meeting title, date, time, attendees, apologies, agenda items discussed (with key discussion points), decisions made (clearly boxed/highlighted), action items (with owner and deadline), matters arising from previous minutes, date of next meeting. Be concise — minutes should capture decisions and actions, not transcribe the entire discussion.`,
  },
  {
    type_key: 'policy_summariser',
    display_name: 'Policy / Guidance Summariser',
    icon: FileText,
    category: 'governance',
    use_when: 'New policy lands, guidance changes, or staff need a quick-read version',
    description: 'Upload a lengthy policy or NHS guidance. Generates a staff summary with key points, what has changed, who it affects, plus a Top 10 Things one-pager.',
    default_input_fields: ['Full document', 'Previous version', 'Staff briefing notes'],
    output_format: 'structured',
    default_questions: [
      { question: 'New policy or update to existing?', type: 'pills', options: ['Brand new', 'Update — changes from previous version', 'Just need a summary of existing'], required: true },
      { question: 'Which staff groups does it affect?', type: 'pills', options: ['All staff', 'Clinical only', 'Admin/reception', 'Management', 'Specific role'], multiSelect: true, required: true },
      { question: 'Any urgent actions required?', type: 'pills', options: ['No', 'Yes — time-critical'], required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate TWO outputs: (1) A staff-facing summary (1-2 pages) with: what the policy is about, who it affects, key requirements, what has changed (if update), and what staff need to do. Written in plain English. (2) A "Top 10 Things You Need to Know" one-pager with numbered points, each 1-2 sentences. If comparing to a previous version, include a change log section.`,
  },

  // ==========================================
  // EXTENDED TOOLS (10)
  // ==========================================
  {
    type_key: 'staff_appraisal',
    display_name: 'Staff Appraisal Summary',
    icon: Users,
    category: 'hr',
    use_when: 'Preparing or writing up an appraisal',
    description: 'Upload appraisal notes, previous objectives, training records. Generates a structured appraisal document ready for sign-off.',
    default_input_fields: ['Previous objectives', 'Discussion notes', 'Training records'],
    output_format: 'structured',
    default_questions: [
      { question: 'Role?', type: 'text', required: true },
      { question: 'Performance concerns?', type: 'pills', options: ['None', 'Minor development areas', 'Formal concerns'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an appraisal document with: achievements against previous objectives, assessment of each objective, development needs, mandatory training compliance, agreed objectives for next year, support required, and sign-off section.`,
  },
  {
    type_key: 'patient_communication',
    display_name: 'Patient Communication',
    icon: Phone,
    category: 'letters',
    use_when: 'Need to tell patients about something',
    description: 'Generates patient-facing content in plain English for website, text, screen, or newsletter.',
    default_input_fields: ['Key messages', 'Target group', 'Clinical info'],
    output_format: 'prose',
    default_questions: [
      { question: 'Format?', type: 'pills', options: ['Website post', 'SMS/text', 'Newsletter', 'Waiting room screen', 'Printed leaflet'], required: true },
      { question: 'Call to action?', type: 'text', required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nWrite in plain English at reading age 11-12. Be warm and accessible. Include a clear call to action if applicable. Avoid medical jargon — explain any clinical terms used.`,
  },
  {
    type_key: 'qof_report',
    display_name: 'QOF Achievement Report',
    icon: TrendingUp,
    category: 'clinical',
    use_when: 'Want to see where you are on QOF, or prepping for partners meeting',
    description: 'Upload QOF data. Generates a report with achievement by domain, comparators, projected income, and gap recommendations.',
    default_input_fields: ['QOF data', 'Previous year', 'Comparators'],
    output_format: 'structured',
    default_questions: [
      { question: 'QOF year?', type: 'text', required: true },
      { question: 'Include income projections?', type: 'pills', options: ['Yes', 'No'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a QOF achievement report with: overall achievement summary, domain-by-domain breakdown, comparison to previous year and PCN/national averages, exception reporting analysis, projected income, and prioritised recommendations for closing gaps.`,
  },
  {
    type_key: 'dspt_report',
    display_name: 'DSPT / IG Compliance Report',
    icon: Shield,
    category: 'governance',
    use_when: 'DSPT submission coming up, or want to check IG compliance',
    description: 'Upload DSPT status and training data. Generates a compliance report with status, gaps, and action plan.',
    default_input_fields: ['DSPT status', 'Training completion', 'Audit results'],
    output_format: 'structured',
    default_questions: [
      { question: 'Submission deadline?', type: 'text', required: false },
      { question: 'Assertions not met?', type: 'text', required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a DSPT compliance report with: overall status, per-assertion breakdown, training compliance percentages, gap analysis, prioritised action plan with deadlines, and evidence summary.`,
  },
  {
    type_key: 'partnership_summary',
    display_name: 'Partnership Summary',
    icon: Landmark,
    category: 'finance',
    use_when: 'New partner joining, deed review, or partners want a refresher',
    description: 'Upload partnership deed. Generates plain-English summary plus Top 10 one-pager.',
    default_input_fields: ['Partnership deed', 'Amendments'],
    output_format: 'structured',
    default_questions: [
      { question: 'For existing or incoming partner?', type: 'pills', options: ['Existing partner refresher', 'Incoming partner briefing'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a plain-English summary of the partnership agreement covering: profit sharing, decision-making, retirement terms, restrictive covenants, property arrangements, leave entitlements, and dispute resolution. Plus a "Top 10 Things Every Partner Must Know" one-pager. Flag any clauses that are unusual or warrant legal review.`,
  },
  {
    type_key: 'service_change_impact',
    display_name: 'Service Change Impact Assessment',
    icon: RefreshCw,
    category: 'governance',
    use_when: 'Planning a change and need to think through the implications',
    description: 'Generates an impact assessment covering patients, workforce, finance, risk, and communications.',
    default_input_fields: ['Proposal', 'Service data', 'Demographics', 'Financials'],
    output_format: 'structured',
    default_questions: [
      { question: 'Type of change?', type: 'pills', options: ['New service', 'Service closure', 'Hours change', 'Premises move', 'Digital transformation', 'Staffing restructure'], required: true },
      { question: 'ICB approval needed?', type: 'pills', options: ['Yes', 'No', 'Unsure'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an impact assessment with: proposal summary, patient impact analysis, workforce implications, financial modelling, risk assessment, equality impact considerations, stakeholder communication plan, and implementation timeline.`,
  },
  {
    type_key: 'training_needs',
    display_name: 'Training Needs Analysis',
    icon: GraduationCap,
    category: 'hr',
    use_when: 'Planning PLT sessions, after incidents highlight gaps, or CQC prep',
    description: 'Upload training records and compliance data. Generates a gap analysis with recommended programme.',
    default_input_fields: ['Training records', 'Mandatory matrix', 'Event themes'],
    output_format: 'structured',
    default_questions: [
      { question: 'Staff groups?', type: 'pills', options: ['All staff', 'Clinical', 'Admin', 'Management', 'NMPs'], multiSelect: true, required: true },
      { question: 'Recent incidents highlighting gaps?', type: 'text', required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a training needs analysis with: mandatory training compliance by role, gap identification, themes from incidents/events, recommended training programme, priority actions, and budget considerations.`,
  },
  {
    type_key: 'patient_survey_report',
    display_name: 'Patient Survey Report',
    icon: Heart,
    category: 'clinical',
    use_when: 'Survey results are in and you need to make sense of them',
    description: 'Upload raw survey data. Generates a report with scores, thematic analysis, trends, and You Said We Did actions.',
    default_input_fields: ['Survey data', 'Previous results', 'Free-text responses'],
    output_format: 'structured',
    default_questions: [
      { question: 'Survey period?', type: 'text', required: true },
      { question: 'Include national comparison?', type: 'pills', options: ['Yes', 'No'], required: false },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a patient survey report with: response rate, overall satisfaction scores, domain breakdown, free-text thematic analysis (positive and negative themes), trend comparison to previous surveys, and a "You Said, We Did" action summary section.`,
  },
  {
    type_key: 'estates_report',
    display_name: 'Estates & Premises Report',
    icon: Building2,
    category: 'governance',
    use_when: 'Premises review, improvement planning, or responding to NHSPS/ICB',
    description: 'Upload condition surveys, lease docs, utilisation data. Generates premises report with compliance, space analysis, and funding options.',
    default_input_fields: ['Condition survey', 'Lease docs', 'Room utilisation', 'H&S assessments'],
    output_format: 'structured',
    default_questions: [
      { question: 'Owned or leased?', type: 'pills', options: ['Owned', 'Leased (NHSPS)', 'Leased (private)', 'Mixed'], required: true },
      { question: 'Urgent compliance issues?', type: 'pills', options: ['None known', 'Yes — details in docs'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a premises report with: current status, compliance issues, space utilisation analysis, improvement priorities, cost estimates, funding options (ETTF, ICB capital, practice investment, notional rent review), and recommended actions.`,
  },
  {
    type_key: 'hr_document',
    display_name: 'HR / Employment Document',
    icon: Scale,
    category: 'hr',
    use_when: 'Dealing with an HR matter and want the document done right',
    description: 'Generates the appropriate HR document following ACAS and NHS best practice.',
    default_input_fields: ['Situation', 'Policies', 'Timeline', 'Previous correspondence'],
    output_format: 'letter',
    default_questions: [
      { question: 'Type of HR action?', type: 'pills', options: ['Disciplinary', 'Grievance', 'Restructure / redundancy', 'Reference', 'Contract variation', 'Capability', 'Other'], required: true },
      { question: 'Process stage?', type: 'pills', options: ['Informal', 'Formal stage 1', 'Formal stage 2', 'Appeal', 'Other'], required: true },
      { question: 'Legal advice obtained?', type: 'pills', options: ['Yes', 'No', 'Not yet — plan to'], required: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate the appropriate HR document following ACAS Code of Practice and NHS employment best practice. Use correct legal phrasing for the stage of process. Include: reference to relevant policy, factual description of events, specific allegations or concerns (if disciplinary), process steps, right of accompaniment, right of appeal. If legally sensitive, flag that the practice should seek HR/legal advice before sending.`,
  },
];

export function getDocumentType(typeKey: string): DocumentType | undefined {
  return DOCUMENT_TYPES.find(dt => dt.type_key === typeKey);
}

export function getDocumentsByCategory(category: DocumentCategory): DocumentType[] {
  return DOCUMENT_TYPES.filter(dt => dt.category === category);
}

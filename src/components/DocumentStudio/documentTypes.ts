import {
  FileText, FileCheck, FileSpreadsheet, Shield, Users, Heart,
  AlertTriangle, BarChart3, Mail, Building2, GraduationCap,
  ClipboardList, Scale, Briefcase, TrendingUp, Stethoscope,
  Pill, Activity, BookOpen, Landmark
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type DocumentCategory = 'nmp' | 'clinical' | 'governance' | 'hr' | 'letters' | 'finance';

export interface DocumentType {
  type_key: string;
  display_name: string;
  icon: LucideIcon;
  category: DocumentCategory;
  use_when: string;
  output_format: 'prose' | 'structured' | 'letter';
  default_questions: DefaultQuestion[];
  system_prompt_template: string;
}

export interface DefaultQuestion {
  question: string;
  type: 'text' | 'pills';
  options?: string[];
  multiSelect?: boolean;
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
  // === NMP (5) ===
  {
    type_key: 'nmp_prescribing_review',
    display_name: 'NMP Prescribing Review',
    icon: Pill,
    category: 'nmp',
    use_when: 'Reviewing an NMP\'s prescribing patterns and competency',
    output_format: 'structured',
    default_questions: [
      { question: 'Which NMP is this review for?', type: 'text' },
      { question: 'What BNF chapters are in scope?', type: 'pills', options: ['Infections', 'CNS', 'Cardiovascular', 'Respiratory', 'Endocrine', 'Other'], multiSelect: true },
      { question: 'Any specific areas of concern?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nYou are generating an NMP Prescribing Review. Structure it with: Executive Summary, Prescribing Activity Overview, BNF Chapter Analysis, Competency Assessment, Areas for Development, and Recommendations. Include reference to relevant NICE guidelines where applicable.`,
  },
  {
    type_key: 'nmp_annual_declaration',
    display_name: 'NMP Annual Declaration',
    icon: FileCheck,
    category: 'nmp',
    use_when: 'Completing the annual NMP declaration of competency',
    output_format: 'structured',
    default_questions: [
      { question: 'NMP name and registration number?', type: 'text' },
      { question: 'Scope of practice?', type: 'text' },
      { question: 'CPD activities completed this year?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an NMP Annual Declaration of Competency. Include: Personal Details, Scope of Practice, CPD Summary, Clinical Supervision Arrangements, Declaration Statement, and Sign-off section.`,
  },
  {
    type_key: 'nmp_case_review',
    display_name: 'NMP Case Review',
    icon: Stethoscope,
    category: 'nmp',
    use_when: 'Documenting an NMP clinical case review for governance',
    output_format: 'structured',
    default_questions: [
      { question: 'What type of case is being reviewed?', type: 'pills', options: ['Routine prescribing', 'Complex case', 'Adverse event', 'Near miss'] },
      { question: 'Key learning points from this case?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an NMP Case Review document. Do NOT include any patient-identifiable information. Structure: Case Overview (anonymised), Clinical Decision-Making, Prescribing Rationale, Outcome, Learning Points, and Actions. Use systems thinking language.`,
  },
  {
    type_key: 'nmp_governance_pack',
    display_name: 'NMP Governance Pack',
    icon: Shield,
    category: 'nmp',
    use_when: 'Compiling NMP governance documentation for CQC or ICB',
    output_format: 'structured',
    default_questions: [
      { question: 'How many NMPs does the practice have?', type: 'text' },
      { question: 'What is the purpose of this pack?', type: 'pills', options: ['CQC inspection', 'ICB review', 'Internal governance', 'Annual review'] },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an NMP Governance Pack. Include: Introduction, NMP Register Summary, Supervision Arrangements, CPD Framework, Audit Schedule, Incident Reporting Process, and Compliance Checklist.`,
  },
  {
    type_key: 'nmp_prescribing_comparison',
    display_name: 'NMP Prescribing Comparison',
    icon: BarChart3,
    category: 'nmp',
    use_when: 'Comparing prescribing data between NMPs or against benchmarks',
    output_format: 'structured',
    default_questions: [
      { question: 'What period does this comparison cover?', type: 'text' },
      { question: 'What are you comparing?', type: 'pills', options: ['NMP vs NMP', 'NMP vs GP', 'Practice vs PCN average', 'Year-on-year'] },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an NMP Prescribing Comparison report. Include: Summary, Methodology, Comparative Data Tables, Key Findings, Outlier Analysis, and Recommendations. Use provided data only — do not fabricate statistics.`,
  },

  // === Core (10) ===
  {
    type_key: 'cqc_preparation_report',
    display_name: 'CQC Preparation Report',
    icon: Shield,
    category: 'governance',
    use_when: 'Preparing for a CQC inspection or self-assessment',
    output_format: 'structured',
    default_questions: [
      { question: 'When is the expected inspection?', type: 'text' },
      { question: 'Which key lines of enquiry to focus on?', type: 'pills', options: ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'], multiSelect: true },
      { question: 'Any known areas of concern?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a CQC Preparation Report structured around the five key questions (Safe, Effective, Caring, Responsive, Well-led). For each domain: summarise current position, evidence available, gaps identified, and recommended actions. Reference CQC provider handbook requirements.`,
  },
  {
    type_key: 'learning_event_report',
    display_name: 'Learning Event Report',
    icon: AlertTriangle,
    category: 'clinical',
    use_when: 'Documenting a significant event, near miss, or learning opportunity',
    output_format: 'structured',
    default_questions: [
      { question: 'What type of event was this?', type: 'pills', options: ['Near miss', 'No harm incident', 'Process failure', 'Communication issue', 'Positive learning'] },
      { question: 'What happened? (no patient-identifiable information)', type: 'text' },
      { question: 'What changes have been or will be made?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Learning Event Report (Significant Event Analysis). Do NOT include any patient-identifiable information. Use systems thinking — focus on contributing factors, not blame. Structure: Event Summary, Timeline, Contributing Factors (using Yorkshire Contributory Factors Framework where appropriate), Root Cause Analysis, Lessons Learned, Action Plan with owners and deadlines. Include footer: "Reminder: Record this event on LFPSE if it involved actual or potential patient harm."`,
  },
  {
    type_key: 'business_case',
    display_name: 'Business Case / Funding Bid',
    icon: Briefcase,
    category: 'finance',
    use_when: 'Making a case for investment, new service, or funding application',
    output_format: 'structured',
    default_questions: [
      { question: 'What is the proposal?', type: 'text' },
      { question: 'What is the estimated cost?', type: 'text' },
      { question: 'Who is the target audience for this document?', type: 'pills', options: ['Partners', 'ICB/CCG', 'PCN', 'NHS England', 'Internal'] },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Business Case. Structure: Executive Summary, Background & Context, Proposal, Options Appraisal, Financial Analysis, Benefits (clinical & operational), Risks & Mitigations, Implementation Timeline, and Recommendation.`,
  },
  {
    type_key: 'clinical_audit_report',
    display_name: 'Clinical Audit Report',
    icon: Activity,
    category: 'clinical',
    use_when: 'Writing up a clinical audit cycle with findings and actions',
    output_format: 'structured',
    default_questions: [
      { question: 'What is the audit topic?', type: 'text' },
      { question: 'Is this a first cycle or re-audit?', type: 'pills', options: ['First cycle', 'Re-audit', 'Continuous monitoring'] },
      { question: 'What standards or guidelines are you auditing against?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Clinical Audit Report. Structure: Title, Aim & Objectives, Standards/Criteria, Methodology, Results (with data tables if data provided), Discussion, Conclusions, Action Plan, and Re-audit Date. Reference relevant NICE guidelines or standards.`,
  },
  {
    type_key: 'formal_letter',
    display_name: 'Formal Letter / Response',
    icon: Mail,
    category: 'letters',
    use_when: 'Drafting a formal letter to patients, organisations, or stakeholders',
    output_format: 'letter',
    default_questions: [
      { question: 'Who is this letter to?', type: 'text' },
      { question: 'What is the purpose?', type: 'pills', options: ['Response to complaint', 'Formal notification', 'Request', 'Invitation', 'Thank you'] },
      { question: 'Key points to include?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a formal letter. Use professional letter format with practice letterhead details (if provided), date, recipient details, subject line, body paragraphs, and appropriate sign-off. Tone should be warm but professional.`,
  },
  {
    type_key: 'practice_annual_report',
    display_name: 'Practice Annual Report',
    icon: BookOpen,
    category: 'governance',
    use_when: 'Compiling the practice\'s annual report for patients or stakeholders',
    output_format: 'structured',
    default_questions: [
      { question: 'What period does this report cover?', type: 'text' },
      { question: 'Any key achievements to highlight?', type: 'text' },
      { question: 'Any changes to services?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Practice Annual Report. Structure: Welcome/Introduction, About the Practice, Our Team, Services Overview, Key Achievements, Patient Feedback Summary, Quality Improvement, Looking Ahead, and Contact Information. Tone should be accessible for a patient audience.`,
  },
  {
    type_key: 'risk_assessment',
    display_name: 'Risk Assessment / DPIA',
    icon: AlertTriangle,
    category: 'governance',
    use_when: 'Documenting risks or conducting a data protection impact assessment',
    output_format: 'structured',
    default_questions: [
      { question: 'What is being assessed?', type: 'text' },
      { question: 'What type of assessment?', type: 'pills', options: ['Risk Assessment', 'DPIA', 'Health & Safety', 'Clinical Risk'] },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Risk Assessment or DPIA document. Structure: Scope, Description of Processing/Activity, Risk Matrix (Likelihood × Impact), Identified Risks with ratings, Existing Controls, Residual Risk, Recommended Actions, and Review Date. For DPIAs, include Data Protection Principles compliance assessment.`,
  },
  {
    type_key: 'board_committee_report',
    display_name: 'Board / Committee Report',
    icon: Building2,
    category: 'governance',
    use_when: 'Writing a report for partners, PCN board, or committee meeting',
    output_format: 'structured',
    default_questions: [
      { question: 'Which board or committee is this for?', type: 'pills', options: ['Partners meeting', 'PCN board', 'Quality committee', 'Finance committee', 'Other'] },
      { question: 'What is the main topic?', type: 'text' },
      { question: 'Is a decision required?', type: 'pills', options: ['Yes — decision needed', 'No — for information only', 'For discussion'] },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Board/Committee Report. Structure: Title, Author, Date, Purpose (For Decision/Discussion/Information), Executive Summary, Background, Current Position, Options (if decision needed), Financial Implications, Risks, Recommendation, and Appendices.`,
  },
  {
    type_key: 'meeting_summary',
    display_name: 'Meeting Summary / Minutes',
    icon: ClipboardList,
    category: 'governance',
    use_when: 'Creating formal minutes or a summary from meeting notes',
    output_format: 'structured',
    default_questions: [
      { question: 'What type of meeting?', type: 'pills', options: ['Partners meeting', 'Staff meeting', 'Clinical meeting', 'PCN meeting', 'Other'] },
      { question: 'Meeting date and attendees?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate professional Meeting Minutes. Structure: Meeting Title, Date & Time, Attendees, Apologies, Minutes of Previous Meeting, Agenda Items (with discussion summaries and decisions), Action Items (with owners and deadlines), Date of Next Meeting.`,
  },
  {
    type_key: 'policy_summariser',
    display_name: 'Policy / Guidance Summariser',
    icon: FileText,
    category: 'governance',
    use_when: 'Summarising a policy, guidance, or regulation into key actions',
    output_format: 'structured',
    default_questions: [
      { question: 'What type of document is being summarised?', type: 'pills', options: ['NHS policy', 'NICE guideline', 'CQC guidance', 'ICB directive', 'Legal/regulatory', 'Other'] },
      { question: 'What should the summary focus on?', type: 'pills', options: ['Key actions for practice', 'Compliance requirements', 'Changes from previous version', 'General overview'], multiSelect: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nSummarise the provided document into a clear, actionable format. Structure: Document Overview (title, author, date, purpose), Key Points, What This Means for the Practice, Required Actions (with deadlines if mentioned), and Compliance Checklist.`,
  },

  // === Extended (10) ===
  {
    type_key: 'staff_appraisal_summary',
    display_name: 'Staff Appraisal Summary',
    icon: Users,
    category: 'hr',
    use_when: 'Documenting an annual appraisal or performance review',
    output_format: 'structured',
    default_questions: [
      { question: 'Staff member\'s role?', type: 'text' },
      { question: 'Key achievements this period?', type: 'text' },
      { question: 'Any development areas?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Staff Appraisal Summary. Structure: Employee Details, Review Period, Key Achievements, Performance Against Objectives, Development Areas, Training Needs, Objectives for Next Period, Overall Assessment, and Signatures section.`,
  },
  {
    type_key: 'patient_communication',
    display_name: 'Patient Communication',
    icon: Heart,
    category: 'letters',
    use_when: 'Writing a letter, leaflet, or notice for patients',
    output_format: 'letter',
    default_questions: [
      { question: 'What type of communication?', type: 'pills', options: ['Letter', 'Information leaflet', 'Practice notice', 'SMS/text template'] },
      { question: 'What is the subject?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a patient-facing communication. Use plain English (aim for reading age 11-12). Be warm, reassuring, and clear. Avoid jargon. Include any relevant contact details and next steps for the patient.`,
  },
  {
    type_key: 'qof_achievement_report',
    display_name: 'QOF Achievement Report',
    icon: TrendingUp,
    category: 'clinical',
    use_when: 'Reviewing QOF performance and achievement rates',
    output_format: 'structured',
    default_questions: [
      { question: 'Which QOF year?', type: 'text' },
      { question: 'Focus areas?', type: 'pills', options: ['All domains', 'Underperforming indicators', 'Year-on-year comparison', 'PCN benchmarking'], multiSelect: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a QOF Achievement Report. Structure: Summary Dashboard, Domain-by-Domain Analysis, Indicator Performance, Exception Reporting Analysis, Financial Impact, Comparison (if data provided), Improvement Actions, and Targets for Next Year.`,
  },
  {
    type_key: 'dspt_ig_report',
    display_name: 'DSPT / IG Compliance Report',
    icon: Shield,
    category: 'governance',
    use_when: 'Documenting DSPT submission or information governance compliance',
    output_format: 'structured',
    default_questions: [
      { question: 'Current DSPT status?', type: 'pills', options: ['Standards met', 'Approaching standards', 'Standards not met', 'Not yet submitted'] },
      { question: 'Any areas of non-compliance?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a DSPT/IG Compliance Report. Structure: Executive Summary, DSPT Assertion Status, Evidence Summary by Standard, Gaps & Non-Compliance, Remediation Plan, Training Compliance, Incident Log Summary, and Next Steps.`,
  },
  {
    type_key: 'partnership_summary',
    display_name: 'Partnership Summary',
    icon: Landmark,
    category: 'finance',
    use_when: 'Summarising partnership matters, agreements, or changes',
    output_format: 'structured',
    default_questions: [
      { question: 'What is the purpose?', type: 'pills', options: ['New partner joining', 'Partner leaving', 'Profit share review', 'Partnership agreement update', 'General summary'] },
      { question: 'Key details?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Partnership Summary document. Structure as appropriate for the purpose: Background, Current Partnership Structure, Proposed Changes, Financial Implications, Legal Considerations, Timeline, and Agreed Actions.`,
  },
  {
    type_key: 'service_change_impact',
    display_name: 'Service Change Impact Assessment',
    icon: Scale,
    category: 'governance',
    use_when: 'Assessing the impact of proposed service changes on patients and staff',
    output_format: 'structured',
    default_questions: [
      { question: 'What service change is proposed?', type: 'text' },
      { question: 'Who is affected?', type: 'pills', options: ['Patients', 'Staff', 'Partners', 'PCN', 'All'], multiSelect: true },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Service Change Impact Assessment. Structure: Proposal Summary, Rationale, Stakeholder Analysis, Patient Impact Assessment, Staff Impact Assessment, Equality Impact, Risk Assessment, Consultation Requirements, Implementation Plan, and Monitoring Arrangements.`,
  },
  {
    type_key: 'training_needs_analysis',
    display_name: 'Training Needs Analysis',
    icon: GraduationCap,
    category: 'hr',
    use_when: 'Identifying training gaps and planning development activities',
    output_format: 'structured',
    default_questions: [
      { question: 'Scope of analysis?', type: 'pills', options: ['Whole practice', 'Clinical team', 'Admin team', 'Individual', 'Specific topic'] },
      { question: 'Any mandatory training gaps known?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Training Needs Analysis. Structure: Introduction, Methodology, Current Training Status, Mandatory Training Compliance, Identified Gaps, Priority Training Needs, Recommended Training Plan (with timelines and costs), Budget Requirements, and Evaluation Framework.`,
  },
  {
    type_key: 'patient_survey_report',
    display_name: 'Patient Survey Report',
    icon: BarChart3,
    category: 'clinical',
    use_when: 'Writing up patient survey results and action plans',
    output_format: 'structured',
    default_questions: [
      { question: 'What type of survey?', type: 'pills', options: ['GP Patient Survey', 'Friends & Family Test', 'Custom practice survey', 'Specific service feedback'] },
      { question: 'Survey period and response rate?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate a Patient Survey Report. Structure: Executive Summary, Methodology, Response Rate, Key Findings (with data if provided), Comparison (previous years/national benchmarks if available), Themes from Free-Text Comments, Areas of Strength, Areas for Improvement, Action Plan, and Publication Arrangements.`,
  },
  {
    type_key: 'estates_premises_report',
    display_name: 'Estates & Premises Report',
    icon: Building2,
    category: 'governance',
    use_when: 'Documenting premises condition, improvement plans, or lease matters',
    output_format: 'structured',
    default_questions: [
      { question: 'What is the focus?', type: 'pills', options: ['Condition survey', 'Improvement plan', 'Lease review', 'Space utilisation', 'Accessibility audit'] },
      { question: 'Key issues or requirements?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate an Estates & Premises Report. Structure as appropriate: Executive Summary, Current Position, Condition Assessment (if applicable), Identified Issues, Options Appraisal, Financial Considerations (NHSPS/rent review implications), Timeline, Recommendations, and Appendices.`,
  },
  {
    type_key: 'hr_employment_document',
    display_name: 'HR / Employment Document',
    icon: FileSpreadsheet,
    category: 'hr',
    use_when: 'Creating HR documents like job descriptions, contracts, or policies',
    output_format: 'structured',
    default_questions: [
      { question: 'What type of HR document?', type: 'pills', options: ['Job description', 'Person specification', 'Offer letter', 'Disciplinary letter', 'Reference', 'Other'] },
      { question: 'Role or subject details?', type: 'text' },
    ],
    system_prompt_template: `${sharedPreamble}\n\nGenerate the requested HR/employment document. Ensure compliance with UK employment law and NHS terms and conditions where applicable. Use appropriate formal language and include all necessary sections for the document type.`,
  },
];

export function getDocumentType(typeKey: string): DocumentType | undefined {
  return DOCUMENT_TYPES.find(dt => dt.type_key === typeKey);
}

export function getDocumentsByCategory(category: DocumentCategory): DocumentType[] {
  return DOCUMENT_TYPES.filter(dt => dt.category === category);
}

import { 
  BookOpen, 
  Shield, 
  Stethoscope, 
  MessageSquare, 
  FileText,
  Activity,
  Sparkles,
  AlertTriangle,
  Heart,
  Brain,
  Baby,
  Pill,
  TestTube,
  ClipboardList,
  Phone,
  Mail,
  Scale,
  Users,
  Thermometer,
  Syringe,
  HeartPulse,
  Clipboard,
  FileCheck,
  FilePlus,
  Search,
  Zap,
  Clock,
  TrendingUp,
  Target,
  Ambulance,
  UserCheck,
  CircleAlert,
  Workflow,
  Microscope,
  Beaker,
  Tablets,
  Hospital,
  Accessibility
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PromptItem {
  id: string;
  shortTitle: string;
  title: string;
  description: string;
  prompt: string;
  specialAction?: 'bnf-lookup-panel'; // Opens dedicated BNF lookup panel
}

export interface SubCategory {
  id: string;
  shortTitle: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  prompts: PromptItem[];
}

export interface MainCategory {
  id: string;
  shortTitle: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  subCategories: SubCategory[];
  focusOnly?: boolean;
  prompt?: string;
}

const nhsSafetyPreamble = `You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NICE CKS, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.`;

const anonymisationPreamble = `First, automatically remove or mask any patient-identifiable information (names, dates of birth, addresses, phone numbers, NHS numbers). Replace with generic placeholders: "the patient", "age X", "relative/friend".`;

export const gpCategories: MainCategory[] = [
  // 1. Clinical Decision Support
  {
    id: 'clinical-decision',
    shortTitle: 'Clinical',
    title: 'Clinical Decision Support',
    description: 'NICE guidance, BNF, red flags, and differential diagnosis',
    icon: Stethoscope,
    gradient: 'from-blue-500 to-blue-600',
    subCategories: [
      {
        id: 'nice-guidance',
        shortTitle: 'NICE',
        title: 'NICE Guidance',
        description: 'Find and interpret NICE guidelines',
        icon: BookOpen,
        gradient: 'from-blue-400 to-blue-500',
        prompts: [
          { id: 'nice-condition', shortTitle: 'Condition', title: 'Condition Guidance', description: 'Find NICE guidance for a condition', prompt: `${nhsSafetyPreamble}\n\nFind the latest NICE guidance for [condition]. Include:\n• Key recommendations for primary care\n• Red flags requiring urgent action\n• Referral thresholds\n• First-line treatments\n• Monitoring requirements\n• Link to full guidance\n\nCondition:` },
          { id: 'nice-pathway', shortTitle: 'Pathway', title: 'Treatment Pathways', description: 'Stepwise treatment pathways', prompt: `${nhsSafetyPreamble}\n\nOutline the NICE treatment pathway for [condition]. Present as a clear stepwise approach:\n• Step 1: First-line treatment\n• Step 2: If inadequate response\n• Step 3: Escalation options\n• When to refer\n\nCondition:` },
          { id: 'nice-referral', shortTitle: 'Referral', title: 'Referral Criteria', description: 'When to refer according to NICE', prompt: `${nhsSafetyPreamble}\n\nProvide NICE referral criteria for [condition]. Include:\n• Urgent (2WW) referral triggers\n• Routine referral thresholds\n• What to include in referral\n• Pre-referral workup required\n\nCondition:` },
          { id: 'nice-qs', shortTitle: 'Quality', title: 'Quality Standards', description: 'NICE quality standards', prompt: `${nhsSafetyPreamble}\n\nSummarise the NICE Quality Standards for [condition]. Include:\n• Key quality statements\n• What this means for our practice\n• Audit criteria\n• Improvement opportunities\n\nCondition:` },
          { id: 'nice-medicines', shortTitle: 'Medicines', title: 'Medicines Optimisation', description: 'NICE prescribing guidance', prompt: `${nhsSafetyPreamble}\n\nProvide NICE medicines optimisation guidance for [condition/drug class]. Include:\n• Recommended agents\n• Dosing and titration\n• Monitoring requirements\n• When to switch or escalate\n\nCondition or drug class:` },
        ]
      },
      {
        id: 'bnf-prescribing',
        shortTitle: 'BNF',
        title: 'BNF & Prescribing',
        description: 'Drug information and prescribing guidance',
        icon: Pill,
        gradient: 'from-green-500 to-green-600',
        prompts: [
          { id: 'bnf-lookup', shortTitle: 'Drug Lookup', title: 'Drug Lookup', description: 'Top 10 NHS drugs + search 500+ medicines', prompt: '', specialAction: 'bnf-lookup-panel' },
          { id: 'bnf-interactions', shortTitle: 'Interactions', title: 'Interactions Check', description: 'Check drug interactions', prompt: `${nhsSafetyPreamble}\n\nCheck interactions between the following medications. Highlight:\n• Clinically significant interactions\n• Severity (avoid/caution/monitor)\n• Mechanism and effect\n• Management advice\n\nMedications:` },
          { id: 'bnf-dose', shortTitle: 'Dose Calc', title: 'Dose Calculations', description: 'Help with dosing calculations', prompt: `${nhsSafetyPreamble}\n\nHelp me calculate the correct dose for:\n• Drug: [name]\n• Patient weight: [kg]\n• Renal function (eGFR): [if known]\n\nProvide:\n• Standard dose calculation\n• Any adjustments needed\n• Maximum doses\n• Administration guidance` },
          { id: 'bnf-renal', shortTitle: 'Renal', title: 'Renal Adjustments', description: 'Dosing in renal impairment', prompt: `${nhsSafetyPreamble}\n\nProvide renal dosing guidance for [drug] with eGFR [value]. Include:\n• Dose adjustment required\n• Alternative if contraindicated\n• Monitoring needed\n• Drugs to avoid in this eGFR range\n\nDrug and eGFR:` },
          { id: 'bnf-pregnancy', shortTitle: 'Pregnancy', title: 'Pregnancy/BF Safety', description: 'Safety in pregnancy and breastfeeding', prompt: `${nhsSafetyPreamble}\n\nProvide safety information for [drug] in pregnancy/breastfeeding. Include:\n• UK SPC pregnancy category\n• Trimester-specific risks\n• Breastfeeding safety\n• Safer alternatives if needed\n• Specialist advice triggers\n\nDrug:` },
        ]
      },
      {
        id: 'red-flags',
        shortTitle: 'Red Flags',
        title: 'Red Flags & Safety',
        description: 'Identify red flags and safety net advice',
        icon: AlertTriangle,
        gradient: 'from-red-500 to-red-600',
        prompts: [
          { id: 'red-checker', shortTitle: 'Red Flag Check', title: 'Red Flag Checker', description: 'Check for red flags in presentation', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nReview this presentation for red flags. List:\n• Urgent red flags (immediate action)\n• Amber flags (close monitoring)\n• Green reassurance factors\n• Recommended safety netting\n\nPresentation:` },
          { id: 'red-safety', shortTitle: 'Safety Net', title: 'Safety Netting Advice', description: 'Generate safety netting advice', prompt: `${nhsSafetyPreamble}\n\nProvide comprehensive safety netting advice for [presentation/diagnosis]. Include:\n• Specific symptoms to watch for\n• Timeframes for re-presentation\n• Who to contact (111/999/GP)\n• Written advice for patient\n\nPresentation:` },
          { id: 'red-refer', shortTitle: 'When to Refer', title: 'When to Refer Urgently', description: 'Urgent referral triggers', prompt: `${nhsSafetyPreamble}\n\nList urgent referral triggers for [condition/presentation]. Include:\n• Same-day referral criteria\n• 2WW cancer pathway triggers\n• Emergency admission criteria\n• What to include in referral\n\nCondition:` },
          { id: 'red-sepsis', shortTitle: 'Sepsis', title: 'Sepsis Screening', description: 'Sepsis screening guidance', prompt: `${nhsSafetyPreamble}\n\nProvide sepsis screening guidance for [age group/setting]. Include:\n• NEWS2/PEWS score interpretation\n• Red flag sepsis criteria\n• Immediate actions required\n• Sepsis 6 bundle overview\n• Documentation requirements\n\nAge group:` },
          { id: 'red-mhra', shortTitle: 'MHRA Alerts', title: 'MHRA Alerts', description: 'Check recent MHRA drug safety updates', prompt: `${nhsSafetyPreamble}\n\nCheck for recent MHRA Drug Safety Updates relevant to [drug/condition]. Summarise:\n• Key safety concerns\n• Required actions for prescribers\n• Patient communication needed\n• Monitoring changes\n\nDrug or condition:` },
        ]
      },
      {
        id: 'differentials',
        shortTitle: 'Differentials',
        title: 'Differential Diagnosis',
        description: 'Generate and analyse differentials',
        icon: Search,
        gradient: 'from-purple-500 to-purple-600',
        prompts: [
          { id: 'diff-symptom', shortTitle: 'Symptom Analysis', title: 'Symptom Analysis', description: 'Analyse symptoms for differentials', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAnalyse this presentation and provide:\n• Top 5 differential diagnoses (most to least likely)\n• Key features supporting each diagnosis\n• Key features against each diagnosis\n• Discriminating investigations\n• Red flags not to miss\n\nPresentation:` },
          { id: 'diff-list', shortTitle: 'Differential List', title: 'Differential List', description: 'Comprehensive differential list', prompt: `${nhsSafetyPreamble}\n\nProvide a comprehensive differential diagnosis list for [symptom/presentation]. Organise by:\n• Most common causes\n• Must-not-miss causes\n• Less common but important\n• How to distinguish between them\n\nSymptom:` },
          { id: 'diff-atypical', shortTitle: 'Atypical', title: 'Atypical Presentations', description: 'Atypical presentations to consider', prompt: `${nhsSafetyPreamble}\n\nDescribe atypical presentations of [condition] that might be missed. Include:\n• Elderly presentations\n• Presentations in different demographics\n• Early/prodromal features\n• Mimics to consider\n• Clinical pearls\n\nCondition:` },
        ]
      },
    ]
  },

  // 2. Consultation Support
  {
    id: 'consultation',
    shortTitle: 'Consult',
    title: 'Consultation Support',
    description: 'Case review, communication, and documentation',
    icon: ClipboardList,
    gradient: 'from-purple-500 to-purple-600',
    subCategories: [
      {
        id: 'case-analysis',
        shortTitle: 'Cases',
        title: 'Case Analysis',
        description: 'Review complex or uncertain cases',
        icon: Stethoscope,
        gradient: 'from-purple-400 to-purple-500',
        prompts: [
          { id: 'case-tricky', shortTitle: 'Tricky Case', title: 'Tricky Case Review', description: 'Get help with a difficult case', prompt: `You are an NHS Clinical Case Review Assistant. Your outputs are for UK healthcare professionals only. Always use UK NHS sources: NICE CKS/Guidelines, BNF, NHS.uk, MHRA Drug Safety Updates, UKHSA Green Book.\n\n${anonymisationPreamble}\n\nProvide a structured review:\n• Case summary (anonymised)\n• Top 3 differential diagnoses with reasoning\n• Red and amber flags to consider\n• Key investigations needed\n• Management options with evidence\n• Safety netting advice\n• Follow-up triggers\n\nDescribe your case:` },
          { id: 'case-multi', shortTitle: 'Multimorbidity', title: 'Complex Multimorbidity', description: 'Managing multiple conditions', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me manage this patient with multiple conditions. Consider:\n• Condition interactions\n• Medication interactions and burden\n• Prioritisation of problems\n• Deprescribing opportunities\n• Holistic management approach\n\nConditions and medications:` },
          { id: 'case-uncertain', shortTitle: 'Uncertainty', title: 'Diagnostic Uncertainty', description: 'Navigate diagnostic uncertainty', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nI have diagnostic uncertainty about this case. Help me:\n• Identify what's known vs unknown\n• Key discriminating features to seek\n• Investigations to clarify\n• Watchful waiting vs active investigation\n• Safety netting approach\n\nCase details:` },
          { id: 'case-resistant', shortTitle: 'Resistant', title: 'Treatment Resistance', description: 'When treatment isn\'t working', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nThis patient isn't responding to treatment. Help me consider:\n• Is the diagnosis correct?\n• Compliance and technique issues\n• Drug interactions affecting response\n• Escalation options\n• Referral thresholds\n\nCase details:` },
        ]
      },
      {
        id: 'communication',
        shortTitle: 'Communicate',
        title: 'Communication',
        description: 'Difficult conversations and explanations',
        icon: MessageSquare,
        gradient: 'from-purple-500 to-purple-600',
        prompts: [
          { id: 'comm-bad-news', shortTitle: 'Bad News', title: 'Breaking Bad News', description: 'Help with difficult news', prompt: `${nhsSafetyPreamble}\n\nHelp me prepare to break bad news about [diagnosis/result]. Provide:\n• SPIKES framework application\n• Key phrases to use\n• What to avoid saying\n• Emotional support strategies\n• Follow-up plan\n\nSituation:` },
          { id: 'comm-difficult', shortTitle: 'Difficult Chat', title: 'Difficult Conversations', description: 'Navigate challenging consultations', prompt: `${nhsSafetyPreamble}\n\nHelp me prepare for a difficult conversation about [topic]. Consider:\n• Opening the discussion\n• Key points to cover\n• Anticipated responses and how to handle\n• De-escalation techniques\n• Documenting appropriately\n\nSituation:` },
          { id: 'comm-explain', shortTitle: 'Explain', title: 'Patient Explanation', description: 'Explain conditions or results simply', prompt: `${nhsSafetyPreamble}\n\nHelp me explain [condition/result/treatment] to a patient in simple terms. Use:\n• Everyday language (no jargon)\n• Simple analogies if helpful\n• What this means for them\n• What happens next\n• Questions they might have\n\nTopic to explain:` },
          { id: 'comm-shared', shortTitle: 'Shared Decision', title: 'Shared Decision Making', description: 'Facilitate shared decisions', prompt: `${nhsSafetyPreamble}\n\nHelp me facilitate shared decision-making for [treatment choice]. Provide:\n• Options to present (including do nothing)\n• Pros and cons of each in patient terms\n• Risk communication (absolute numbers)\n• Values clarification questions\n• Decision aids available\n\nDecision:` },
        ]
      },
      {
        id: 'documentation',
        shortTitle: 'Document',
        title: 'Documentation',
        description: 'Clinical documentation and records',
        icon: FileText,
        gradient: 'from-purple-600 to-purple-700',
        prompts: [
          { id: 'doc-summary', shortTitle: 'Summary', title: 'Consultation Summary', description: 'Structure consultation notes', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me structure consultation notes for [presentation]. Use format:\n• Presenting complaint\n• History (SOCRATES/relevant)\n• Examination findings\n• Working diagnosis\n• Plan (investigations/treatment/safety net)\n• Follow-up\n\nConsultation details:` },
          { id: 'doc-safety', shortTitle: 'Safety Net Doc', title: 'Safety Net Documentation', description: 'Document safety netting properly', prompt: `${nhsSafetyPreamble}\n\nHelp me document safety netting for [diagnosis/presentation]. Include:\n• Specific advice given\n• Red flags explained\n• Timeframe for re-presentation\n• Written info provided\n• Patient understanding confirmed\n\nPresentation:` },
          { id: 'doc-medicolegal', shortTitle: 'Medico-Legal', title: 'Medico-Legal Phrasing', description: 'Defensive documentation wording', prompt: `${nhsSafetyPreamble}\n\nHelp me document [situation] in a medico-legally robust way. Consider:\n• Objective factual language\n• What was said and by whom\n• Clinical reasoning documented\n• Appropriate terminology\n• Avoiding assumptions\n\nSituation:` },
          { id: 'doc-fit-note', shortTitle: 'Fit Note', title: 'Fit Note Wording', description: 'Appropriate fit note phrasing', prompt: `${nhsSafetyPreamble}\n\nSuggest appropriate fit note wording for [condition/situation]. Include:\n• Functional limitations\n• Suggested workplace adjustments\n• Review period recommendations\n• What to avoid stating\n\nCondition and job:` },
        ]
      },
      {
        id: 'second-opinion',
        shortTitle: '2nd Opinion',
        title: 'Second Opinion',
        description: 'Prepare for peer review and MDT',
        icon: Users,
        gradient: 'from-indigo-500 to-indigo-600',
        prompts: [
          { id: '2op-peer', shortTitle: 'Peer Review', title: 'Peer Review Request', description: 'Structure a peer discussion', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me structure this case for peer review discussion. Include:\n• Case summary (anonymised)\n• My clinical reasoning\n• Specific question(s) for colleague\n• What I've already considered\n\nCase:` },
          { id: '2op-mdt', shortTitle: 'MDT Prep', title: 'MDT Preparation', description: 'Prepare case for MDT', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me prepare this case for MDT discussion. Structure:\n• Case summary\n• Relevant investigations and results\n• Current management\n• Specific question for MDT\n• Proposed plan pending MDT input\n\nCase:` },
          { id: '2op-rationale', shortTitle: 'Referral Why', title: 'External Referral Rationale', description: 'Justify referral decision', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me articulate why I'm referring this patient to [specialty]. Include:\n• Clinical reasoning for referral\n• Why primary care management insufficient\n• NICE criteria met (if applicable)\n• What I expect from referral\n\nCase:` },
        ]
      },
    ]
  },

  // 3. Letters & Referrals
  {
    id: 'letters',
    shortTitle: 'Letters',
    title: 'Letters & Referrals',
    description: 'Draft referrals, patient letters, and professional correspondence',
    icon: Mail,
    gradient: 'from-red-500 to-red-600',
    subCategories: [
      {
        id: 'referrals',
        shortTitle: 'Referrals',
        title: 'Referral Letters',
        description: 'Draft specialty referral letters',
        icon: FilePlus,
        gradient: 'from-red-400 to-red-500',
        prompts: [
          { id: 'ref-2ww', shortTitle: '2WW Cancer', title: '2WW Cancer Referral', description: 'Urgent suspected cancer referral', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a 2-week wait cancer referral for suspected [cancer type]. Include:\n• Presenting symptoms meeting NG12 criteria\n• Duration and progression\n• Relevant examination findings\n• Investigation results\n• Risk factors\n• Contact preference\n\nClinical details:` },
          { id: 'ref-routine', shortTitle: 'Routine', title: 'Routine Referral', description: 'Non-urgent specialty referral', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a routine referral to [specialty] for [condition]. Include:\n• Clinical summary\n• Relevant history\n• What's been tried in primary care\n• Specific question for specialist\n• Urgency justification\n\nDetails:` },
          { id: 'ref-urgent', shortTitle: 'Urgent', title: 'Urgent Referral', description: 'Urgent (non-2WW) referral', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft an urgent referral to [specialty]. Include:\n• Why urgent (not 2WW)\n• Clinical summary\n• Red/amber flags present\n• Interim management plan\n• Specific timeframe needed\n\nDetails:` },
          { id: 'ref-mh', shortTitle: 'Mental Health', title: 'Mental Health Referral', description: 'CMHT or psychology referral', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a mental health referral to [CMHT/IAPT/other]. Include:\n• Presenting problems\n• Risk assessment summary\n• Previous treatments tried\n• Current medications\n• Social circumstances\n• Specific support requested\n\nDetails:` },
          { id: 'ref-paeds', shortTitle: 'Paediatric', title: 'Paediatric Referral', description: 'Referral for children', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a paediatric referral to [specialty] for [age] with [concern]. Include:\n• Developmental history if relevant\n• Growth parameters\n• Parent/carer concerns\n• School/nursery input\n• Specific question\n\nDetails:` },
        ]
      },
      {
        id: 'patient-letters',
        shortTitle: 'Patient',
        title: 'Patient Letters',
        description: 'Letters to patients',
        icon: Mail,
        gradient: 'from-red-500 to-red-600',
        prompts: [
          { id: 'let-results', shortTitle: 'Results', title: 'Results Letter', description: 'Communicate test results', prompt: `${nhsSafetyPreamble}\n\nDraft a patient letter communicating [test] results. Include:\n• Clear explanation of result\n• What this means for them\n• Any action needed\n• Next steps/follow-up\n• Contact for questions\n\nResults to communicate:` },
          { id: 'let-recall', shortTitle: 'Recall', title: 'Recall Letter', description: 'Recall for review or screening', prompt: `${nhsSafetyPreamble}\n\nDraft a recall letter for [reason]. Include:\n• Why they're being recalled\n• Importance of attendance\n• How to book\n• What to bring/prepare\n• Contact details\n\nReason for recall:` },
          { id: 'let-dna', shortTitle: 'DNA', title: 'Did Not Attend', description: 'Following missed appointment', prompt: `${nhsSafetyPreamble}\n\nDraft a letter following a missed appointment for [type]. Strike appropriate tone:\n• Note appointment was missed\n• Importance of the appointment\n• How to rebook\n• Consequences if pattern continues (if appropriate)\n• Support available\n\nAppointment type:` },
          { id: 'let-removal', shortTitle: 'Removal', title: 'Removal Warning', description: 'Warning about list removal', prompt: `${nhsSafetyPreamble}\n\nDraft a patient removal warning letter for [reason]. Ensure:\n• Clear explanation of concerns\n• Specific behaviours/incidents cited\n• Warning of consequences\n• Expectations going forward\n• Right to respond\n• Appropriate tone\n\nReason:` },
        ]
      },
      {
        id: 'professional-letters',
        shortTitle: 'Professional',
        title: 'Professional Letters',
        description: 'Professional correspondence',
        icon: FileCheck,
        gradient: 'from-red-600 to-red-700',
        prompts: [
          { id: 'pro-handover', shortTitle: 'GP Handover', title: 'GP-to-GP Handover', description: 'Detailed handover for patient transfer', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a GP-to-GP handover summary for a patient transferring out. Include:\n• Active problems and management\n• Repeat medications\n• Allergies and alerts\n• Ongoing monitoring requirements\n• Pending investigations/referrals\n• Social circumstances\n\nPatient details:` },
          { id: 'pro-coroner', shortTitle: 'Coroner', title: 'Coroner Statement', description: 'Statement for coroner', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a factual statement for the coroner regarding [deceased]. Structure:\n• My professional details\n• How I knew the patient\n• Relevant medical history\n• Recent consultations (factual)\n• Last contact\n• Any concerns raised\n\nDetails:` },
          { id: 'pro-insurance', shortTitle: 'Insurance', title: 'Insurance/Medico-Legal', description: 'Medical reports for insurance', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me draft a medical report for [insurance/solicitor] regarding [condition]. Note:\n• This is based on medical records\n• Objective clinical findings only\n• Avoid speculation on causation\n• State limitations of opinion\n\nRequest details:` },
          { id: 'pro-fitness', shortTitle: 'Fitness', title: 'Fitness to Work', description: 'Occupational fitness assessment', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me write regarding fitness to work for [role]. Consider:\n• Relevant medical conditions\n• Functional limitations\n• Safety critical aspects of role\n• Adjustments that might help\n• Review requirements\n\nDetails:` },
          { id: 'pro-dvla', shortTitle: 'DVLA', title: 'DVLA Notification', description: 'DVLA medical reporting', prompt: `${nhsSafetyPreamble}\n\nHelp me draft a DVLA notification/report for [condition]. Using DVLA At a Glance guidance:\n• Relevant medical condition\n• Group 1/2 implications\n• Current fitness to drive\n• Patient advised of responsibility\n• Required assessments\n\nCondition:` },
        ]
      },
    ]
  },

  // 4. Prescribing & Medicines
  {
    id: 'prescribing',
    shortTitle: 'Prescribing',
    title: 'Prescribing & Medicines',
    description: 'Medication reviews, deprescribing, and formulary guidance',
    icon: Tablets,
    gradient: 'from-green-500 to-green-600',
    subCategories: [
      {
        id: 'medication-review',
        shortTitle: 'Reviews',
        title: 'Medication Reviews',
        description: 'Structured medication reviews',
        icon: Clipboard,
        gradient: 'from-green-400 to-green-500',
        prompts: [
          { id: 'med-polypharmacy', shortTitle: 'Polypharmacy', title: 'Polypharmacy Review', description: 'Review multiple medications', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nReview this medication list for polypharmacy concerns. Assess:\n• Potentially inappropriate medications (STOPP)\n• Potentially omitted medications (START)\n• Drug-drug interactions\n• Drug-disease interactions\n• Adherence concerns\n• Deprescribing opportunities\n\nMedication list and conditions:` },
          { id: 'med-deprescribe', shortTitle: 'Deprescribe', title: 'Deprescribing Plan', description: 'Safe medication reduction', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nCreate a deprescribing plan for [medication]. Include:\n• Why deprescribing is appropriate\n• Tapering schedule\n• Monitoring during withdrawal\n• Patient counselling points\n• When to stop reduction\n\nMedication and indication:` },
          { id: 'med-stopp-start', shortTitle: 'STOPP/START', title: 'STOPP/START Criteria', description: 'Apply STOPP/START', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nApply STOPP/START criteria to this elderly patient's medications. Identify:\n• STOPP criteria triggered (potentially inappropriate)\n• START criteria triggered (potentially beneficial omissions)\n• Specific recommendations\n• Priority changes\n\nAge, conditions, and medications:` },
          { id: 'med-high-risk', shortTitle: 'High Risk', title: 'High-Risk Medicines', description: 'Review high-risk medications', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nReview this patient's high-risk medications. Check:\n• DOACs - renal function, interactions\n• Opioids - indication, dose, need for review\n• NSAIDs - contraindications, gastroprotection\n• Methotrexate - monitoring, interactions\n• Lithium - levels, interactions\n\nMedications and context:` },
        ]
      },
      {
        id: 'drug-queries',
        shortTitle: 'Drug Queries',
        title: 'Specific Drug Queries',
        description: 'Antibiotic choice, pain management, controlled drugs',
        icon: Pill,
        gradient: 'from-green-500 to-green-600',
        prompts: [
          { id: 'drug-antibiotic', shortTitle: 'Antibiotic', title: 'Antibiotic Choice', description: 'Antibiotic selection guidance', prompt: `${nhsSafetyPreamble}\n\nSuggest appropriate antibiotic therapy for [infection]. Using local antimicrobial guidance and NICE:\n• First-line choice and dose\n• Duration of treatment\n• Allergy alternatives\n• When to review/escalate\n• Red flags\n\nInfection and patient details:` },
          { id: 'drug-pain', shortTitle: 'Pain Ladder', title: 'Pain Management Ladder', description: 'Stepwise pain management', prompt: `${nhsSafetyPreamble}\n\nAdvise on pain management for [type of pain]. Using WHO ladder and NICE:\n• Current step assessment\n• Escalation options\n• Adjuvants to consider\n• Non-pharmacological options\n• Red flags for specialist referral\n\nPain type and current treatment:` },
          { id: 'drug-controlled', shortTitle: 'Controlled', title: 'Controlled Drug Guidance', description: 'CD prescribing requirements', prompt: `${nhsSafetyPreamble}\n\nProvide guidance on prescribing [controlled drug]. Include:\n• Legal prescribing requirements\n• Dosing guidance\n• Monitoring requirements\n• Red flags for misuse\n• Documentation standards\n\nControlled drug:` },
          { id: 'drug-shared', shortTitle: 'Shared Care', title: 'Shared Care Protocol', description: 'Shared care requirements', prompt: `${nhsSafetyPreamble}\n\nOutline shared care requirements for [drug]. Include:\n• Initiation (specialist/GP)\n• Monitoring schedule and parameters\n• Responsibility split\n• Communication expectations\n• When to refer back\n\nDrug:` },
        ]
      },
      {
        id: 'formulary',
        shortTitle: 'Formulary',
        title: 'Formulary & Cost',
        description: 'Formulary compliance and cost-effective prescribing',
        icon: TrendingUp,
        gradient: 'from-green-600 to-green-700',
        prompts: [
          { id: 'form-check', shortTitle: 'Formulary', title: 'Formulary Check', description: 'Check formulary status', prompt: `${nhsSafetyPreamble}\n\nCheck formulary status and restrictions for [drug]. Advise on:\n• First-line formulary alternatives\n• Amber/red drug status\n• Prior approval requirements\n• Dose formulation preferences\n\nDrug:` },
          { id: 'form-switch', shortTitle: 'Cost Switch', title: 'Cost-Effective Switch', description: 'Switch to cheaper equivalent', prompt: `${nhsSafetyPreamble}\n\nSuggest cost-effective switch from [current drug]. Consider:\n• Therapeutically equivalent alternatives\n• Price comparison\n• Patient factors affecting choice\n• Switch protocol\n• Counselling points\n\nCurrent drug:` },
          { id: 'form-generic', shortTitle: 'Generic', title: 'Generic Alternatives', description: 'Generic prescribing options', prompt: `${nhsSafetyPreamble}\n\nIdentify generic alternatives for [brand name]. Note:\n• Bioequivalent generic options\n• Cost savings\n• Any therapeutic reasons to maintain brand\n• Switch considerations\n\nBrand drug:` },
          { id: 'form-pip', shortTitle: 'PIP', title: 'PIP Avoidance', description: 'Avoid prescribing indicators', prompt: `${nhsSafetyPreamble}\n\nCheck this prescribing against Prescribing Indicators. Identify:\n• PIP indicators triggered\n• Safety concerns\n• Recommended changes\n• Patient-specific exceptions\n\nMedications and conditions:` },
        ]
      },
    ]
  },

  // 5. Investigations & Results
  {
    id: 'investigations',
    shortTitle: 'Investig.',
    title: 'Investigations & Results',
    description: 'Test interpretation and investigation planning',
    icon: TestTube,
    gradient: 'from-cyan-500 to-cyan-600',
    subCategories: [
      {
        id: 'interpretation',
        shortTitle: 'Interpret',
        title: 'Test Interpretation',
        description: 'Interpret investigation results',
        icon: Microscope,
        gradient: 'from-cyan-400 to-cyan-500',
        prompts: [
          { id: 'int-bloods', shortTitle: 'Bloods', title: 'Blood Test Interpretation', description: 'Interpret blood results', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me interpret these blood results. Consider:\n• Abnormalities and their significance\n• Clinical correlation needed\n• Further tests required\n• Urgency of follow-up\n• Action plan\n\nResults and clinical context:` },
          { id: 'int-ecg', shortTitle: 'ECG', title: 'ECG Analysis Support', description: 'ECG interpretation help', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me interpret this ECG description. Systematically review:\n• Rate and rhythm\n• Axis\n• Intervals (PR, QRS, QT)\n• ST/T wave changes\n• Clinical significance\n• Recommended action\n\nECG findings and context:` },
          { id: 'int-urine', shortTitle: 'Urinalysis', title: 'Urinalysis Interpretation', description: 'Interpret urine results', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nInterpret these urinalysis results in context. Consider:\n• Dipstick findings significance\n• MSU interpretation if available\n• Treatment implications\n• Further investigation needed\n\nResults and clinical context:` },
          { id: 'int-hba1c', shortTitle: 'HbA1c', title: 'HbA1c Trends', description: 'Interpret HbA1c patterns', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAnalyse this HbA1c trend and advise. Consider:\n• Trajectory analysis\n• Target appropriateness for this patient\n• Medication adjustment needed\n• NICE escalation thresholds\n• Lifestyle factors\n\nHbA1c history and current treatment:` },
          { id: 'int-lft', shortTitle: 'LFTs', title: 'Liver Function Tests', description: 'Interpret LFT patterns', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nInterpret this LFT pattern. Consider:\n• Hepatocellular vs cholestatic pattern\n• Likely differentials\n• Further tests needed\n• Red flags for urgent action\n• Monitoring plan\n\nLFT results and context:` },
        ]
      },
      {
        id: 'planning',
        shortTitle: 'Plan',
        title: 'Investigation Planning',
        description: 'What tests to order',
        icon: Beaker,
        gradient: 'from-cyan-500 to-cyan-600',
        prompts: [
          { id: 'plan-tests', shortTitle: 'Which Tests', title: 'Which Tests to Order', description: 'Appropriate investigation selection', prompt: `${nhsSafetyPreamble}\n\nAdvise on appropriate investigations for [presentation]. Consider:\n• First-line tests in primary care\n• Cost-effectiveness\n• What each test would tell us\n• Logical order of investigations\n• When imaging is needed\n\nPresentation:` },
          { id: 'plan-pre-ref', shortTitle: 'Pre-Referral', title: 'Pre-Referral Workup', description: 'Tests before specialist referral', prompt: `${nhsSafetyPreamble}\n\nWhat investigations should I do before referring to [specialty] for [condition]? Include:\n• Standard pre-referral tests\n• Specialty-specific requirements\n• Results that would change referral urgency\n• Information specialist needs\n\nSpecialty and condition:` },
          { id: 'plan-monitor', shortTitle: 'Monitoring', title: 'Monitoring Protocols', description: 'Ongoing monitoring requirements', prompt: `${nhsSafetyPreamble}\n\nOutline the monitoring protocol for [condition/drug]. Include:\n• What to monitor\n• Frequency of monitoring\n• Target ranges\n• Action triggers\n• When to stop monitoring\n\nCondition or drug:` },
          { id: 'plan-action', shortTitle: 'Result Actions', title: 'Result Action Plans', description: 'What to do with results', prompt: `${nhsSafetyPreamble}\n\nProvide an action plan template for [test] results. Include:\n• Normal result action\n• Mildly abnormal - action\n• Significantly abnormal - action\n• Critical values - immediate action\n• Documentation standards\n\nTest:` },
        ]
      },
    ]
  },

  // 6. Chronic Disease
  {
    id: 'chronic',
    shortTitle: 'Chronic',
    title: 'Chronic Disease',
    description: 'Long-term condition management and reviews',
    icon: HeartPulse,
    gradient: 'from-orange-500 to-orange-600',
    subCategories: [
      {
        id: 'condition-reviews',
        shortTitle: 'Reviews',
        title: 'Condition Reviews',
        description: 'Structured condition reviews',
        icon: Clipboard,
        gradient: 'from-orange-400 to-orange-500',
        prompts: [
          { id: 'chron-dm', shortTitle: 'Diabetes', title: 'Diabetes Review', description: 'Type 2 diabetes review', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure a Type 2 diabetes review. Cover:\n• HbA1c trend and target\n• Medication review (NICE pathway position)\n• Complications screening (eyes, feet, kidneys)\n• BP and lipids\n• Lifestyle and weight\n• Sick day rules reminder\n\nPatient details:` },
          { id: 'chron-htn', shortTitle: 'Hypertension', title: 'Hypertension Review', description: 'Blood pressure review', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure a hypertension review. Cover:\n• BP readings (clinic and home/ABPM)\n• Target appropriateness\n• Medication optimisation\n• Secondary cause indicators\n• CVD risk factors\n• End-organ assessment\n\nPatient details:` },
          { id: 'chron-asthma', shortTitle: 'Asthma/COPD', title: 'Asthma/COPD Review', description: 'Respiratory condition review', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure an asthma/COPD review. Cover:\n• Symptom control (ACT/CAT score)\n• Inhaler technique check\n• Medication step review\n• Exacerbation history\n• Smoking status\n• Self-management plan\n• Annual checks (spirometry, eosinophils)\n\nPatient details:` },
          { id: 'chron-chd', shortTitle: 'CHD', title: 'CHD Review', description: 'Coronary heart disease review', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure a CHD secondary prevention review. Cover:\n• Symptom assessment\n• Medication optimisation (antiplatelet, statin, ACEi, beta-blocker)\n• BP and lipid targets\n• Lifestyle factors\n• Cardiac rehabilitation\n• Red flags\n\nPatient details:` },
          { id: 'chron-ckd', shortTitle: 'CKD', title: 'CKD Review', description: 'Chronic kidney disease review', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure a CKD review. Cover:\n• eGFR trend and staging\n• ACR and proteinuria\n• BP target and medication\n• Medication review (nephrotoxics, renally-excreted)\n• Anaemia and bone health\n• Referral triggers\n\nPatient details:` },
        ]
      },
      {
        id: 'annual-reviews',
        shortTitle: 'Annual',
        title: 'Annual Reviews',
        description: 'Comprehensive annual health checks',
        icon: Target,
        gradient: 'from-orange-500 to-orange-600',
        prompts: [
          { id: 'ann-comprehensive', shortTitle: 'Full Review', title: 'Comprehensive Annual Review', description: 'Full annual review template', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nCreate a comprehensive annual review template for patient with [conditions]. Include:\n• All condition-specific checks\n• Medication review\n• Vaccination status\n• Screening due\n• Mental wellbeing\n• Social circumstances\n\nConditions:` },
          { id: 'ann-ld', shortTitle: 'LD Check', title: 'Learning Disability Health Check', description: 'Annual LD health check', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure a Learning Disability annual health check. Include:\n• Communication adaptations\n• Physical health review\n• Mental health screening\n• Medication review (including psychotropics - STOMP)\n• Screening uptake\n• Health Action Plan output\n• Reasonable adjustments\n\nPatient details:` },
          { id: 'ann-smi', shortTitle: 'SMI Check', title: 'SMI Health Check', description: 'Severe mental illness health check', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nStructure an SMI annual health check. Include:\n• Physical health monitoring (metabolic, cardiovascular)\n• Medication side effects review\n• Lifestyle factors\n• Alcohol and substance use\n• Cancer screening uptake\n• Care coordination\n\nPatient details:` },
        ]
      },
      {
        id: 'treatment-targets',
        shortTitle: 'Targets',
        title: 'Treatment Targets',
        description: 'Target setting and optimisation',
        icon: TrendingUp,
        gradient: 'from-orange-600 to-orange-700',
        prompts: [
          { id: 'target-set', shortTitle: 'Set Targets', title: 'Target Setting', description: 'Individualised treatment targets', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me set individualised treatment targets for [condition]. Consider:\n• NICE recommended targets\n• Patient factors (age, frailty, comorbidities)\n• Patient preferences\n• Realistic goals\n• Safety considerations\n\nPatient details:` },
          { id: 'target-intensify', shortTitle: 'Intensify', title: 'Intensification Advice', description: 'When and how to intensify treatment', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAdvise on treatment intensification for [condition]. Patient not at target despite current treatment. Consider:\n• Next step per NICE pathway\n• Barriers to intensification\n• Patient factors\n• Monitoring after change\n\nCurrent treatment and results:` },
          { id: 'target-qof', shortTitle: 'QOF', title: 'QOF Optimisation', description: 'Meet QOF targets', prompt: `${nhsSafetyPreamble}\n\nAdvise on meeting QOF targets for [indicator]. Include:\n• Current target thresholds\n• Exception reporting criteria\n• Improvement strategies\n• Evidence-based interventions\n\nIndicator:` },
          { id: 'target-self', shortTitle: 'Self-Manage', title: 'Patient Self-Management', description: 'Empower patient self-management', prompt: `${nhsSafetyPreamble}\n\nCreate a self-management plan for patient with [condition]. Include:\n• Daily management tasks\n• Monitoring guidance\n• Warning signs to watch for\n• When to seek help\n• Goal setting with patient\n\nCondition:` },
        ]
      },
    ]
  },

  // 7. Urgent & Emergency
  {
    id: 'urgent',
    shortTitle: 'Urgent',
    title: 'Urgent & Emergency',
    description: 'Acute presentations and emergency protocols',
    icon: Ambulance,
    gradient: 'from-rose-500 to-rose-600',
    subCategories: [
      {
        id: 'acute',
        shortTitle: 'Acute',
        title: 'Acute Presentations',
        description: 'Managing acute clinical presentations',
        icon: Zap,
        gradient: 'from-rose-400 to-rose-500',
        prompts: [
          { id: 'acute-chest', shortTitle: 'Chest Pain', title: 'Chest Pain Algorithm', description: 'Assess acute chest pain', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nGuide me through chest pain assessment in primary care. Using NICE/SIGN guidance:\n• Risk stratification\n• ACS vs non-cardiac differentiation\n• Immediate actions required\n• Referral pathway\n• Safety netting\n\nPresentation:` },
          { id: 'acute-abdo', shortTitle: 'Acute Abdomen', title: 'Acute Abdomen', description: 'Assess acute abdominal pain', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me assess this acute abdominal presentation. Consider:\n• Surgical vs medical causes\n• Red flags requiring same-day assessment\n• Age/sex-specific differentials\n• Key examination findings\n• Investigation and referral pathway\n\nPresentation:` },
          { id: 'acute-sob', shortTitle: 'Breathlessness', title: 'Breathlessness Assessment', description: 'Assess acute breathlessness', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me assess acute breathlessness. Using systematic approach:\n• Severity assessment\n• Key differentials to consider\n• Discriminating features\n• Red flags for emergency\n• Primary care management vs referral\n\nPresentation:` },
          { id: 'acute-neuro', shortTitle: 'Neuro Red Flags', title: 'Neurological Red Flags', description: 'Identify neurological emergencies', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAssess for neurological red flags in this presentation. Check for:\n• Stroke/TIA features (FAST+)\n• Cord compression signs\n• Raised ICP features\n• Cauda equina symptoms\n• Immediate actions required\n\nPresentation:` },
        ]
      },
      {
        id: 'emergency-protocols',
        shortTitle: 'Emergency',
        title: 'Emergency Protocols',
        description: 'Emergency management guidance',
        icon: CircleAlert,
        gradient: 'from-rose-500 to-rose-600',
        prompts: [
          { id: 'emerg-anaph', shortTitle: 'Anaphylaxis', title: 'Anaphylaxis Management', description: 'Anaphylaxis protocol', prompt: `${nhsSafetyPreamble}\n\nProvide anaphylaxis management protocol for primary care. Include:\n• Recognition features\n• Immediate treatment algorithm\n• Adrenaline dosing (IM)\n• Monitoring requirements\n• Post-event management\n• Referral for investigation\n\nAge/weight if relevant:` },
          { id: 'emerg-seizure', shortTitle: 'Seizure', title: 'Seizure Protocol', description: 'Seizure management', prompt: `${nhsSafetyPreamble}\n\nProvide seizure management protocol. Include:\n• Immediate safety measures\n• Timing and when to treat\n• Benzodiazepine dosing\n• Status epilepticus criteria\n• Post-ictal management\n• When to call 999\n\nContext:` },
          { id: 'emerg-hypo', shortTitle: 'Hypoglycaemia', title: 'Hypoglycaemia Treatment', description: 'Hypoglycaemia protocol', prompt: `${nhsSafetyPreamble}\n\nProvide hypoglycaemia treatment protocol. Include:\n• Severity assessment\n• Conscious patient treatment\n• Unconscious patient treatment\n• Glucagon dosing\n• Recovery and follow-up\n• Prevention advice\n\nContext:` },
          { id: 'emerg-mh-crisis', shortTitle: 'MH Crisis', title: 'Acute Mental Health', description: 'Mental health crisis management', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nGuide me through acute mental health crisis management. Cover:\n• Immediate risk assessment\n• De-escalation strategies\n• Safety planning\n• Crisis team involvement\n• Section 136 considerations\n• Documentation\n\nSituation:` },
        ]
      },
      {
        id: 'triage',
        shortTitle: 'Triage',
        title: 'Triage Support',
        description: 'Telephone triage and prioritisation',
        icon: Phone,
        gradient: 'from-rose-600 to-rose-700',
        prompts: [
          { id: 'triage-phone', shortTitle: 'Phone Triage', title: 'Telephone Triage Questions', description: 'Key questions for phone triage', prompt: `${nhsSafetyPreamble}\n\nProvide key telephone triage questions for [presenting complaint]. Include:\n• Red flag symptoms to ask about\n• Discriminating questions\n• Risk stratification\n• Disposition guidance\n• Safety netting advice\n\nPresenting complaint:` },
          { id: 'triage-visit', shortTitle: 'Home Visit', title: 'Home Visit Priority', description: 'Prioritise home visit requests', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me prioritise this home visit request. Consider:\n• Urgency indicators\n• Could patient travel safely?\n• Key information to gather by phone\n• What to bring if visiting\n• Alternative options\n\nRequest details:` },
        ]
      },
    ]
  },

  // 8. Mental Health
  {
    id: 'mental-health',
    shortTitle: 'Mental',
    title: 'Mental Health',
    description: 'Assessment, management, and crisis support',
    icon: Brain,
    gradient: 'from-indigo-500 to-indigo-600',
    subCategories: [
      {
        id: 'mh-assessment',
        shortTitle: 'Assess',
        title: 'Assessment',
        description: 'Mental health assessment tools',
        icon: ClipboardList,
        gradient: 'from-indigo-400 to-indigo-500',
        prompts: [
          { id: 'mh-depression', shortTitle: 'Depression', title: 'Depression Severity', description: 'Assess depression severity', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me assess depression severity using PHQ-9 interpretation. Consider:\n• Score interpretation and severity\n• Risk factors to explore\n• Functional impact assessment\n• Treatment threshold\n• Stepped care positioning\n\nPHQ-9 score and context:` },
          { id: 'mh-anxiety', shortTitle: 'Anxiety', title: 'Anxiety Assessment', description: 'Assess anxiety disorders', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me assess this anxiety presentation. Consider:\n• GAD-7 interpretation\n• Specific anxiety disorder features\n• Differential diagnoses\n• Physical health exclusions\n• Treatment options\n\nGAD-7 score and presentation:` },
          { id: 'mh-risk', shortTitle: 'Risk', title: 'Risk Assessment', description: 'Suicide and self-harm risk', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nGuide me through suicide/self-harm risk assessment. Using structured approach:\n• Key questions to ask\n• Risk and protective factors\n• Risk stratification\n• Safety planning\n• Documentation requirements\n• Escalation thresholds\n\nContext:` },
          { id: 'mh-capacity', shortTitle: 'Capacity', title: 'Capacity Assessment', description: 'Mental capacity assessment', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nGuide me through mental capacity assessment for [decision]. Using MCA principles:\n• Decision-specific assessment\n• Two-stage test\n• Documentation requirements\n• Best interests process if lacking capacity\n• Next steps\n\nDecision to be assessed:` },
        ]
      },
      {
        id: 'mh-management',
        shortTitle: 'Manage',
        title: 'Management',
        description: 'Treatment and referral pathways',
        icon: Workflow,
        gradient: 'from-indigo-500 to-indigo-600',
        prompts: [
          { id: 'mh-ladder', shortTitle: 'Treatment Ladder', title: 'Treatment Ladder', description: 'Stepped care for anxiety/depression', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nApply NICE stepped care model for this patient's [anxiety/depression]. Consider:\n• Current step positioning\n• Treatment options at this step\n• When to step up\n• IAPT referral criteria\n• Combined treatment considerations\n\nSeverity and current treatment:` },
          { id: 'mh-med-select', shortTitle: 'Med Selection', title: 'Medication Selection', description: 'Choose appropriate psychotropic', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me select appropriate medication for [condition]. Consider:\n• First-line options per NICE\n• Patient factors affecting choice\n• Side effect profile matching\n• Monitoring requirements\n• Duration and review plan\n\nCondition and patient factors:` },
          { id: 'mh-crisis-plan', shortTitle: 'Crisis Plan', title: 'Crisis Safety Plan', description: 'Create safety crisis plan', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp create a crisis safety plan. Include:\n• Warning signs\n• Coping strategies\n• People to contact\n• Professional support contacts\n• Environment safety\n• Reasons for living\n\nPatient context:` },
          { id: 'mh-iapt', shortTitle: 'IAPT', title: 'IAPT Referral Criteria', description: 'When to refer to IAPT', prompt: `${nhsSafetyPreamble}\n\nClarify IAPT referral criteria. Include:\n• Appropriate presentations\n• Exclusion criteria\n• Severity thresholds\n• Self-referral vs GP referral\n• What to include in referral\n\nPatient presentation:` },
        ]
      },
      {
        id: 'mh-special',
        shortTitle: 'Special',
        title: 'Special Populations',
        description: 'Perinatal, elderly, and other groups',
        icon: Users,
        gradient: 'from-indigo-600 to-indigo-700',
        prompts: [
          { id: 'mh-perinatal', shortTitle: 'Perinatal', title: 'Perinatal Mental Health', description: 'Pregnancy and postnatal mental health', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAssess and advise on perinatal mental health. Consider:\n• Antenatal vs postnatal presentation\n• EPDS interpretation\n• Red flags (psychosis, severe depression, bonding)\n• Safe medication options\n• Specialist referral triggers\n• Support services\n\nPresentation:` },
          { id: 'mh-elderly', shortTitle: 'Elderly', title: 'Elderly Depression', description: 'Depression in older adults', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAssess depression in this older adult. Consider:\n• Atypical presentations in elderly\n• Dementia vs depression differentiation\n• Physical health contributions\n• Medication considerations (side effects, interactions)\n• Social factors\n• Referral options\n\nPresentation:` },
        ]
      },
    ]
  },

  // 9. Paediatrics & Women's Health
  {
    id: 'paeds-womens',
    shortTitle: 'Paeds/Women',
    title: 'Paediatrics & Women\'s Health',
    description: 'Child health, women\'s health, and immunisations',
    icon: Baby,
    gradient: 'from-pink-500 to-pink-600',
    subCategories: [
      {
        id: 'paediatrics',
        shortTitle: 'Paeds',
        title: 'Paediatrics',
        description: 'Child health and development',
        icon: Baby,
        gradient: 'from-pink-400 to-pink-500',
        prompts: [
          { id: 'paeds-dev', shortTitle: 'Development', title: 'Developmental Concerns', description: 'Assess developmental delay', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAssess developmental concerns in [age] child. Consider:\n• Expected milestones for age\n• Red flags for concern\n• Domains affected\n• Referral pathways (CDC, SALT, etc.)\n• Parental support\n\nConcerns:` },
          { id: 'paeds-illness', shortTitle: 'Childhood Illness', title: 'Childhood Illness', description: 'Common paediatric presentations', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me assess this unwell child. Using traffic light/NICE guidance:\n• Severity assessment\n• Red/amber/green features\n• Key differentials\n• When to refer\n• Safety netting for parents\n\nPresentation and age:` },
          { id: 'paeds-safeguard', shortTitle: 'Safeguarding', title: 'Safeguarding Concerns', description: 'Child safeguarding guidance', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nI have safeguarding concerns about a child. Guide me through:\n• What I've observed\n• Documentation requirements\n• Who to contact\n• Immediate safety considerations\n• My responsibilities\n\nConcerns:` },
          { id: 'paeds-send', shortTitle: 'SEND', title: 'SEND Support', description: 'Special educational needs support', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAdvise on supporting a child with [condition] in terms of SEND. Include:\n• Medical evidence needed for EHCP\n• How GP can support application\n• Relevant referrals\n• Reasonable adjustments\n\nCondition:` },
        ]
      },
      {
        id: 'womens-health',
        shortTitle: 'Women',
        title: 'Women\'s Health',
        description: 'Contraception, menopause, and gynaecology',
        icon: Heart,
        gradient: 'from-pink-500 to-pink-600',
        prompts: [
          { id: 'wh-contraception', shortTitle: 'Contraception', title: 'Contraception Choice', description: 'Contraception counselling', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nHelp me counsel on contraception options. For this patient consider:\n• UKMEC categories for relevant methods\n• Efficacy comparison\n• Non-contraceptive benefits\n• Side effects to discuss\n• Follow-up requirements\n\nPatient factors:` },
          { id: 'wh-menopause', shortTitle: 'Menopause', title: 'Menopause Management', description: 'HRT and symptom management', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAdvise on menopause management. Using NICE guidance:\n• Symptom assessment\n• HRT options and contraindications\n• Non-hormonal alternatives\n• Risk/benefit discussion\n• Monitoring requirements\n\nSymptoms and history:` },
          { id: 'wh-pregnancy', shortTitle: 'Pregnancy', title: 'Pregnancy Queries', description: 'Pregnancy-related questions', prompt: `${nhsSafetyPreamble}\n\n${anonymisationPreamble}\n\nAdvise on this pregnancy-related query. Consider:\n• Stage of pregnancy\n• Safety of medications/interventions\n• Referral pathways\n• Normal vs concerning symptoms\n• When to escalate\n\nQuery:` },
          { id: 'wh-cervical', shortTitle: 'Cervical', title: 'Cervical Screening', description: 'Cervical screening guidance', prompt: `${nhsSafetyPreamble}\n\nAdvise on cervical screening. Cover:\n• NHS screening programme details\n• Result interpretation\n• Colposcopy referral criteria\n• Non-attender counselling\n• HPV and screening\n\nSpecific question:` },
        ]
      },
      {
        id: 'immunisation',
        shortTitle: 'Vaccines',
        title: 'Immunisations',
        description: 'Vaccination schedules and guidance',
        icon: Syringe,
        gradient: 'from-pink-600 to-pink-700',
        prompts: [
          { id: 'imm-schedule', shortTitle: 'Schedule', title: 'Childhood Schedule', description: 'UK childhood immunisation schedule', prompt: `${nhsSafetyPreamble}\n\nProvide the current UK childhood immunisation schedule for [age]. Using Green Book:\n• Vaccines due at this age\n• Catch-up if behind\n• Contraindications to check\n• Consent and documentation\n\nAge:` },
          { id: 'imm-catchup', shortTitle: 'Catch-Up', title: 'Catch-Up Vaccines', description: 'Catch-up vaccination schedule', prompt: `${nhsSafetyPreamble}\n\nCreate a catch-up vaccination plan. Child is [age] with [vaccination history]. Using Green Book:\n• Priority vaccines\n• Scheduling\n• Minimum intervals\n• Maximum doses needed\n\nVaccination history:` },
          { id: 'imm-travel', shortTitle: 'Travel', title: 'Travel Vaccines', description: 'Travel vaccination advice', prompt: `${nhsSafetyPreamble}\n\nAdvise on travel vaccinations for trip to [destination]. Include:\n• NHS-provided vaccines\n• Private vaccines needed\n• Timing requirements\n• Malaria prophylaxis if applicable\n• Other travel health advice\n\nDestination and travel details:` },
          { id: 'imm-occupational', shortTitle: 'Occupational', title: 'Occupational Health', description: 'Occupational vaccination needs', prompt: `${nhsSafetyPreamble}\n\nAdvise on occupational health vaccinations for [role/setting]. Include:\n• Required vaccines\n• Who provides/pays\n• Immunity testing\n• Documentation needed\n\nRole:` },
        ]
      },
    ]
  },

  // 10. Ask AI Anything
  {
    id: 'ask-anything',
    shortTitle: 'Ask AI',
    title: 'Ask AI Anything',
    description: 'Get AI assistance with any clinical question',
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    subCategories: [],
    focusOnly: true,
  },
];

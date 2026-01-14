import { BookOpen, Shield, CheckSquare, HelpCircle, Activity, TrendingUp, FileHeart, Settings, MessageSquare, Users, ClipboardCheck, Building, Calendar, Database, Scale, UserCheck, Syringe, Megaphone, NotebookPen, Mic, TestTube, Download, Search, FileText, Stethoscope, Presentation, Languages, Video, Image, Sparkles } from 'lucide-react';

const nhsSafetyPreamble = "You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.";

export interface QuickAction {
  label: string;
  icon: any;
  prompt: string;
  requiresFile: boolean;
  action?: string;
  submenu?: Array<{
    label: string;
    prompt: string;
    action?: string;
  }>;
}

export const quickActions: QuickAction[] = [
  { 
    label: 'NICE Guidance Finder',
    icon: BookOpen, 
    prompt: nhsSafetyPreamble + '\n\nFind the latest NICE guidance on [medical condition/topic]. Include key recommendations, implementation timeline, and links to full guidance.',
    requiresFile: false 
  },
  { 
    label: 'BNF Drug Lookup', 
    icon: Shield, 
    prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for [drug name] including indications, dosing, contraindications, interactions, and monitoring requirements.',
    requiresFile: false,
    submenu: [
      {
        label: 'I will insert the drug name...',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for [drug name] including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Metformin',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Metformin including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Amlodipine',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Amlodipine including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Atorvastatin',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Atorvastatin including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Ramipril',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Ramipril including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Omeprazole',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Omeprazole including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Amoxicillin',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Amoxicillin including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Levothyroxine',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Levothyroxine including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Prednisolone',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Prednisolone including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Bisoprolol',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Bisoprolol including indications, dosing, contraindications, interactions, and monitoring requirements.'
      },
      {
        label: 'Warfarin',
        prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for Warfarin including indications, dosing, contraindications, interactions, and monitoring requirements.'
      }
    ]
  },
  {
    label: 'Northamptonshire Prescribing Guidance',
    icon: Search,
    prompt: '', 
    requiresFile: false,
    action: 'open-drug-lookup-modal'
  },
  {
    label: 'Tricky Case Check',
    icon: Stethoscope,
    prompt: 'You are an NHS Clinical Case Review Assistant. Your outputs are for UK healthcare professionals only. Always use UK NHS sources: NICE CKS/Guidelines, BNF, NHS.uk, MHRA Drug Safety Updates, UKHSA Green Book, and local ICB formulary/policies. Never use non-UK sources.\n\nFirst, automatically remove or mask any patient-identifiable information (names, dates of birth, addresses, phone numbers, NHS numbers). Replace with generic placeholders: "the patient", "age X", "relative/friend".\n\nAt the top of the output, insert this note:\n⚠️ Patient-identifiable information has been automatically removed for governance. Review is based on anonymised case details only.\n\nThen provide a Brief Review:\n\n• Case recap (anonymised)\n• Top 3 differentials\n• Red/amber flags\n• Key medication/prescribing point\n• Follow-up trigger\n\nCHECKLIST: All case details are anonymised. Always verify with NICE/BNF/ICB policy. Adapt to the patient in front of you. For discussion/education/quality improvement – not as a standalone protocol.',
    requiresFile: false,
    submenu: [
      {
        label: 'Brief Review',
        prompt: 'You are an NHS Clinical Case Review Assistant. Your outputs are for UK healthcare professionals only. Always use UK NHS sources: NICE CKS/Guidelines, BNF, NHS.uk, MHRA Drug Safety Updates, UKHSA Green Book, and local ICB formulary/policies. Never use non-UK sources.\n\nFirst, automatically remove or mask any patient-identifiable information (names, dates of birth, addresses, phone numbers, NHS numbers). Replace with generic placeholders: "the patient", "age X", "relative/friend".\n\nAt the top of the output, insert this note:\n⚠️ Patient-identifiable information has been automatically removed for governance. Review is based on anonymised case details only.\n\nThen provide a Brief Review:\n\n• Case recap (anonymised)\n• Top 3 differentials\n• Red/amber flags\n• Key medication/prescribing point\n• Follow-up trigger\n\nCHECKLIST: All case details are anonymised. Always verify with NICE/BNF/ICB policy. Adapt to the patient in front of you. For discussion/education/quality improvement – not as a standalone protocol.'
      },
      {
        label: 'Detailed Review',
        prompt: 'You are an NHS Clinical Case Review Assistant. Your outputs are for UK healthcare professionals only. Always use UK NHS sources: NICE CKS/Guidelines, BNF, NHS.uk, MHRA Drug Safety Updates, UKHSA Green Book, and local ICB formulary/policies. Never use non-UK sources.\n\nFirst, automatically remove or mask any patient-identifiable information (names, dates of birth, addresses, phone numbers, NHS numbers). Replace with generic placeholders: "the patient", "age X", "relative/friend".\n\nAt the top of the output, insert this note:\n⚠️ Patient-identifiable information has been automatically removed for governance. Review is based on anonymised case details only.\n\nThen provide a Detailed Review:\n\n• Case recap (anonymised)\n• Differential diagnoses\n• Red/amber flags\n• Investigations (primary care vs referral)\n• Management options (NICE/local formulary)\n• Medication safety (BNF dosing, renal/hepatic adjustments, interactions)\n• Follow-up & monitoring\n• Quality/contractual considerations (QOF, IIF, local pathway)\n\nCHECKLIST: All case details are anonymised. Always verify with NICE/BNF/ICB policy. Adapt to the patient in front of you. For discussion/education/quality improvement – not as a standalone protocol.'
      },
      {
        label: 'Teaching/Reflective Review',
        prompt: 'You are an NHS Clinical Case Review Assistant. Your outputs are for UK healthcare professionals only. Always use UK NHS sources: NICE CKS/Guidelines, BNF, NHS.uk, MHRA Drug Safety Updates, UKHSA Green Book, and local ICB formulary/policies. Never use non-UK sources.\n\nFirst, automatically remove or mask any patient-identifiable information (names, dates of birth, addresses, phone numbers, NHS numbers). Replace with generic placeholders: "the patient", "age X", "relative/friend".\n\nAt the top of the output, insert this note:\n⚠️ Patient-identifiable information has been automatically removed for governance. Review is based on anonymised case details only.\n\nThen provide a Teaching/Reflective Review:\n\n• Case recap (anonymised, with context)\n• Differential reasoning\n• Common pitfalls & misdiagnoses\n• Guideline anchors (NICE, BNF, NHS.uk)\n• "Double-check" items (hx, exam, labs, prescribing safety)\n• Reflective learning points (QI, audit, trainee teaching)\n• Patient communication tips (plain-English explanation, safety-netting phrases)\n\nCHECKLIST: All case details are anonymised. Always verify with NICE/BNF/ICB policy. Adapt to the patient in front of you. For discussion/education/quality improvement – not as a standalone protocol.'
      }
    ]
  },
  {
    label: 'PowerPoint Generator',
    icon: Presentation,
    prompt: nhsSafetyPreamble + '\n\nGenerate professional PowerPoint presentations for NHS meetings, training, and communications.',
    requiresFile: false,
    action: 'open-powerpoint-generator'
  },
  {
    label: 'Quick Image Generator',
    icon: Image,
    prompt: nhsSafetyPreamble + '\n\nGenerate professional images for NHS practice communications, patient education, and presentations.',
    requiresFile: false,
    action: 'open-quick-image-modal'
  },
  { 
    label: 'QOF Indicator Quick Check', 
    icon: CheckSquare, 
    prompt: nhsSafetyPreamble + '\n\nCheck QOF achievement for [indicator] and provide guidance on improving performance and meeting targets.',
    requiresFile: false 
  },
  { 
    label: 'Patient Leaflet Finder', 
    icon: HelpCircle, 
    prompt: nhsSafetyPreamble + '\n\nFind patient information leaflets for [condition/treatment] from NHS.uk or NICE patient decision aids.',
    requiresFile: false 
  },
  { 
    label: 'Immunisation Schedule Lookup', 
    icon: Activity, 
    prompt: nhsSafetyPreamble + '\n\nProvide current UK immunisation schedule information for [age group/vaccine] from the Green Book.',
    requiresFile: false 
  },
  { 
    label: 'Primary Care Prescribing Alerts', 
    icon: TrendingUp, 
    prompt: nhsSafetyPreamble + '\n\nCheck for current MHRA Drug Safety Updates and prescribing alerts relevant to [drug/condition].',
    requiresFile: false 
  },
  { 
    label: 'Practice Policy & Protocol Finder', 
    icon: Settings, 
    prompt: nhsSafetyPreamble + '\n\nHelp find NHS policy and guidance on [practice management topic] including implementation requirements.',
    requiresFile: false 
  },
];

const pmSafetyPreamble = "You are an expert UK NHS Practice Manager assistant. Use current NHS England guidance, PCN DES specifications, CQC standards, and UK GDPR/IG requirements. Present information clearly for practice management use.";

export const practiceManagerQuickActions: QuickAction[] = [
  {
    label: 'Load Teams Transcript',
    icon: Video,
    prompt: '',
    requiresFile: false,
    action: 'open-teams-import'
  },
  {
    label: 'Audio Transcribe',
    icon: Mic,
    prompt: pmSafetyPreamble + '\n\nUpload and transcribe audio files for meetings, consultations, or other practice documentation needs.',
    requiresFile: false,
    action: 'open-audio-upload'
  },
  {
    label: 'Complaint Response Helper',
    icon: MessageSquare,
    prompt: pmSafetyPreamble + '\n\nHelp me draft a professional NHS complaint response that acknowledges concerns, explains our position, and outlines next steps.\n\nCRITICAL INSTRUCTION: You have access to my practice details in your system context. DO NOT use placeholder text like "[Your Practice Address]" or "[Phone Number]". Instead, use the ACTUAL practice information provided to you in the CONTEXT ABOUT THE USER AND PRACTICE section of your system prompt. If specific details are not available in the context, simply omit those fields rather than using placeholders.\n\nFormat the response with proper letterhead using the actual practice name, address, phone, and email from your context. The response should be fully personalized to my specific practice.',
    requiresFile: true
  },
  {
    label: 'Meeting Notes Service',
    icon: NotebookPen,
    prompt: pmSafetyPreamble + '\n\nSummarise meeting notes into key decisions, actions, and follow-up items with responsible parties and deadlines.',
    requiresFile: true,
    action: 'open-meeting-recorder',
    submenu: [
      {
        label: 'Formal board/committee minutes',
        prompt: 'Summarise this transcript into formal board/committee meeting minutes. Start with the meeting title, date, start–end time, venue and a list of attendees. Use the agenda as your outline and under each agenda item write a one‑ or two‑sentence summary of the discussion and the decision taken. Record motions and votes in neutral language (e.g., "Action: motion made, seconded and carried") and include names only when legally required. Highlight approved actions and decisions separately, showing who is responsible and any deadlines. Finish with the next meeting date. Use clear, objective language and omit direct quotations and side conversations.'
      },
      {
        label: 'Informal team meeting summary',
        prompt: 'Create a concise, informal meeting summary. Provide the meeting title, date/time and attendees. Write a one‑sentence meeting purpose. Use bullet points to capture the main discussion points, interesting ideas and any questions raised. List key decisions and action steps, noting who will do each task and the due date. Include a line for the next meeting date. Use a friendly tone and keep each bullet under three sentences.'
      },
      {
        label: 'Agenda‑based notes for structured meetings',
        prompt: 'Generate meeting notes that follow the agenda. Begin with meeting details (title, date, time, location, attendees) and the meeting purpose. For each agenda item, create a heading and summarise the discussion, key responses, questions and decisions. Capture action items with names and deadlines. End with a summary of all decisions and a "follow‑up" section that lists unresolved items or action items carried over from previous meetings.'
      },
      {
        label: 'Narrative minutes for complex or negotiation meetings',
        prompt: 'Write narrative‑style minutes for this strategic or negotiation meeting. Open with the meeting title, date/time, location and participants. Provide a paragraph‑style summary of the discussion that conveys the flow of topics, different viewpoints and rationales. Use objective phrasing (e.g., "Participant expressed concerns") rather than emotional descriptions. Where appropriate, note external documents or references mentioned. Conclude with a section listing the decisions made and action items, including responsible individuals and deadlines, and include any scheduled follow‑up meeting.'
      },
      {
        label: 'Resolution‑style minutes',
        prompt: 'Produce resolution‑style minutes focused on the outcomes of the meeting. State the meeting title, date/time, location and attendees. List each resolution or decision approved, along with a brief note of any motion made and the result (e.g., "Motion to approve budget carried unanimously"). Note any assignments or deadlines arising from each decision. Omit the details of the discussion, simply stating that discussion occurred. Finish with the next meeting date.'
      },
      {
        label: 'Brainstorming session summary',
        prompt: 'Turn this brainstorming transcript into organised notes. Include the session title, date/time and attendees. Briefly describe the objective. Group ideas under thematic headings (e.g., "Patient‑care ideas", "Operational improvements") and list notable ideas under each heading. Note any key questions and answers. Identify which ideas were selected for further exploration and why. Record action items with responsible people and timelines. Close with the next steps or follow‑up meeting date.'
      },
      {
        label: 'HR meeting/performance‑review summary',
        prompt: 'Create a confidential HR meeting summary. Provide meeting details (title, date/time, location) and participants by role rather than name if necessary. Summarise each topic discussed (such as performance feedback, policy updates or disciplinary issues) using neutral, objective language. Document the decisions and agreed actions, including who will do what and by when. Avoid including personal opinions or verbatim remarks; instead, describe sensitive matters generically and focus on outcomes. Conclude with follow‑up steps and the next meeting date.'
      },
      {
        label: 'GP partnership (primary care) meeting notes',
        prompt: 'Summarise a GP partnership meeting. Start with the meeting title, date/time, venue and attendees (roles). State the meeting purpose. For each agenda topic (e.g., clinical updates, operational issues, supplier contracts, staffing), summarise the key points discussed, questions raised and any ideas or proposals. Highlight decisions made and action items with responsible partners and deadlines. Maintain patient confidentiality by omitting patient‑specific information. End with unresolved issues and the next meeting date.'
      },
      {
        label: 'Supplier‑negotiation meeting summary',
        prompt: 'Generate notes for a supplier‑negotiation meeting. Include meeting details (title, date/time, location, attendees from both sides) and a brief meeting objective. Summarise each proposal and negotiation point discussed, such as pricing, deliverables and contract terms. Record agreements reached, including pricing or terms approved, and any outstanding questions or issues that require follow‑up. List action items with responsible parties and deadlines. Use clear, factual language and avoid disclosing sensitive numbers; present the essence of the agreements instead.'
      },
      {
        label: 'Executive session/confidential minutes',
        prompt: 'Draft minutes for a confidential executive session. Provide the meeting title, date/time, location and attendees (e.g., board members). Note that the meeting was held in executive session for confidential discussions. For each agenda item, record only the action or decision taken using neutral phrasing (e.g., "Action: motion made, seconded and carried"). Do not include details of the discussion or direct quotations. Identify any names only when legally required (e.g., when recording votes on conflicts of interest). List any approved resolutions or actions and the next meeting date.'
      }
    ]
  },
  {
    label: 'PowerPoint Generator',
    icon: Presentation,
    prompt: pmSafetyPreamble + '\n\nGenerate professional PowerPoint presentations for NHS meetings, training, and communications.',
    requiresFile: false,
    action: 'open-powerpoint-generator'
  },
  {
    label: 'ARRS Claim Checker',
    icon: ClipboardCheck,
    prompt: pmSafetyPreamble + '\n\nReview ARRS workforce claim documentation for accuracy and compliance with current PCN DES requirements.',
    requiresFile: true
  },
  {
    label: 'PCN DES / Contract Finder',
    icon: Building,
    prompt: pmSafetyPreamble + '\n\nFind current PCN DES specifications and contract requirements for [service/topic].',
    requiresFile: false
  },
  {
    label: 'Staff Rota & Leave Planner',
    icon: Calendar,
    prompt: pmSafetyPreamble + '\n\nHelp plan staff rotas and manage leave requests while maintaining service requirements and TUPE obligations.',
    requiresFile: false
  },
  {
    label: 'CQC Evidence Pack Builder',
    icon: Database,
    prompt: pmSafetyPreamble + '\n\nOrganise and structure evidence for CQC inspection across all key domains with clear documentation.',
    requiresFile: true
  },
  {
    label: 'DPIA / IG Helper',
    icon: Scale,
    prompt: pmSafetyPreamble + '\n\nAssist with Data Protection Impact Assessment and Information Governance compliance requirements.',
    requiresFile: true
  },
  {
    label: 'Subject Access Request (SAR) Assistant',
    icon: UserCheck,
    prompt: pmSafetyPreamble + '\n\nGuide through Subject Access Request process including timelines, exemptions, and required documentation.',
    requiresFile: true
  },
  {
    label: 'Vaccine Clinic Planner',
    icon: Syringe,
    prompt: pmSafetyPreamble + '\n\nPlan vaccine clinic logistics including staffing, scheduling, and resource requirements.',
    requiresFile: false
  },
  {
    label: 'Practice Comms Builder',
    icon: Megaphone,
    prompt: pmSafetyPreamble + '\n\nCreate professional practice communications for patients, staff, or external stakeholders.',
    requiresFile: false
  },
  {
    label: 'Image Studio',
    icon: Sparkles,
    prompt: '',
    requiresFile: false,
    action: 'open-image-studio'
  },
];
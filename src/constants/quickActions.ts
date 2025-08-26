import { BookOpen, Shield, CheckSquare, HelpCircle, Activity, TrendingUp, FileHeart, Settings, MessageSquare, Users, ClipboardCheck, Building, Calendar, Database, Scale, UserCheck, Syringe, Megaphone, NotebookPen, Mic, TestTube, Languages, Download, Search, FileText } from 'lucide-react';

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
    label: 'Complaint Response Helper', 
    icon: MessageSquare, 
    prompt: nhsSafetyPreamble + '\n\nHelp me draft a professional NHS complaint response that acknowledges concerns, explains our position, and outlines next steps.',
    requiresFile: true 
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
    label: 'Complaint Response Helper (PM)',
    icon: MessageSquare,
    prompt: pmSafetyPreamble + '\n\nHelp me draft a professional NHS complaint response that acknowledges concerns, explains our position, and outlines next steps.',
    requiresFile: true
  },
  {
    label: 'Meeting Notes Summariser',
    icon: NotebookPen,
    prompt: pmSafetyPreamble + '\n\nSummarise meeting notes into key decisions, actions, and follow-up items with responsible parties and deadlines.',
    requiresFile: true
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
];
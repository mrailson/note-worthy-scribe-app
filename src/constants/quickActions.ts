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
    prompt: '',
    requiresFile: false 
  },
  { 
    label: 'BNF Drug Lookup', 
    icon: Shield, 
    prompt: '',
    requiresFile: false,
    submenu: [
      {
        label: 'I will insert the drug name...',
        prompt: ''
      },
      {
        label: 'Metformin',
        prompt: ''
      },
      {
        label: 'Amlodipine',
        prompt: ''
      },
      {
        label: 'Atorvastatin',
        prompt: ''
      },
      {
        label: 'Ramipril',
        prompt: ''
      },
      {
        label: 'Omeprazole',
        prompt: ''
      },
      {
        label: 'Amoxicillin',
        prompt: ''
      },
      {
        label: 'Levothyroxine',
        prompt: ''
      },
      {
        label: 'Prednisolone',
        prompt: ''
      },
      {
        label: 'Bisoprolol',
        prompt: ''
      },
      {
        label: 'Warfarin',
        prompt: ''
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
    prompt: '',
    requiresFile: true 
  },
  { 
    label: 'QOF Indicator Quick Check', 
    icon: CheckSquare, 
    prompt: '',
    requiresFile: false 
  },
  { 
    label: 'Patient Leaflet Finder', 
    icon: HelpCircle, 
    prompt: '',
    requiresFile: false 
  },
  { 
    label: 'Immunisation Schedule Lookup', 
    icon: Activity, 
    prompt: '',
    requiresFile: false 
  },
  { 
    label: 'Primary Care Prescribing Alerts', 
    icon: TrendingUp, 
    prompt: '',
    requiresFile: false 
  },
  { 
    label: 'Practice Policy & Protocol Finder', 
    icon: Settings, 
    prompt: '',
    requiresFile: false 
  },
];

const pmSafetyPreamble = "You are an expert UK NHS Practice Manager assistant. Use current NHS England guidance, PCN DES specifications, CQC standards, and UK GDPR/IG requirements. Present information clearly for practice management use.";

export const practiceManagerQuickActions: QuickAction[] = [
  {
    label: 'Complaint Response Helper (PM)',
    icon: MessageSquare,
    prompt: '',
    requiresFile: true
  },
  {
    label: 'Meeting Notes Summariser',
    icon: NotebookPen,
    prompt: '',
    requiresFile: true
  },
  {
    label: 'ARRS Claim Checker',
    icon: ClipboardCheck,
    prompt: '',
    requiresFile: true
  },
  {
    label: 'PCN DES / Contract Finder',
    icon: Building,
    prompt: '',
    requiresFile: false
  },
  {
    label: 'Staff Rota & Leave Planner',
    icon: Calendar,
    prompt: '',
    requiresFile: false
  },
  {
    label: 'CQC Evidence Pack Builder',
    icon: Database,
    prompt: '',
    requiresFile: true
  },
  {
    label: 'DPIA / IG Helper',
    icon: Scale,
    prompt: '',
    requiresFile: true
  },
  {
    label: 'Subject Access Request (SAR) Assistant',
    icon: UserCheck,
    prompt: '',
    requiresFile: true
  },
  {
    label: 'Vaccine Clinic Planner',
    icon: Syringe,
    prompt: '',
    requiresFile: false
  },
  {
    label: 'Practice Comms Builder',
    icon: Megaphone,
    prompt: '',
    requiresFile: false
  },
];
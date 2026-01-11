import { 
  FileText, 
  ImageIcon, 
  MessageSquare, 
  Users, 
  ClipboardCheck, 
  BarChart3, 
  Mic, 
  Search, 
  Sparkles,
  FileEdit,
  FilePlus,
  FileCheck,
  FileSpreadsheet,
  Palette,
  Presentation,
  LayoutPanelTop,
  Image,
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  UserPlus,
  GraduationCap,
  HeartHandshake,
  Shield,
  BookOpen,
  AlertTriangle,
  Activity,
  TrendingUp,
  PieChart,
  Volume2,
  Radio,
  FileAudio,
  HelpCircle,
  Briefcase,
  Clock,
  Star,
  Stethoscope,
  Heart,
  Share2,
  QrCode,
  Newspaper,
  Building2,
  Landmark,
  Network,
  Handshake,
  Headphones,
  Signpost
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PromptItem {
  id: string;
  shortTitle: string;
  title: string;
  description: string;
  prompt: string;
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

export const mainCategories: MainCategory[] = [
  // Row 1
  {
    id: 'documents',
    shortTitle: 'Documents',
    title: 'Create Documents',
    description: 'Summarise, draft, and create professional documents',
    icon: FileText,
    gradient: 'from-blue-500 to-blue-600',
    subCategories: [
      {
        id: 'summarise',
        shortTitle: 'Summarise',
        title: 'Summarise Documents',
        description: 'Get concise summaries of lengthy documents',
        icon: FileCheck,
        gradient: 'from-blue-400 to-blue-500',
        prompts: [
          { id: 'sum-policy', shortTitle: 'Policy Document', title: 'Summarise Policy', description: 'Summarise a policy document', prompt: 'Please summarise this policy document concisely, highlighting key requirements, deadlines, and actions needed for our GP practice.' },
          { id: 'sum-guidance', shortTitle: 'NHS Guidance', title: 'Summarise NHS Guidance', description: 'Summarise NHS guidance', prompt: 'Summarise this NHS guidance document, focusing on what changes for GP practices, key dates, and required actions.' },
          { id: 'sum-report', shortTitle: 'Report', title: 'Summarise Report', description: 'Summarise a report', prompt: 'Summarise this report highlighting the key findings, recommendations, and any actions required for our practice.' },
          { id: 'sum-contract', shortTitle: 'Contract', title: 'Summarise Contract', description: 'Summarise a contract', prompt: 'Summarise this contract document, highlighting key terms, obligations, deadlines, and financial implications.' },
          { id: 'sum-meeting', shortTitle: 'Meeting Notes', title: 'Summarise Meeting Notes', description: 'Summarise meeting notes', prompt: 'Summarise these meeting notes into key decisions, action items with owners, and follow-up dates.' },
        ]
      },
      {
        id: 'draft',
        shortTitle: 'Draft',
        title: 'Draft Documents',
        description: 'Create professional draft documents',
        icon: FileEdit,
        gradient: 'from-blue-500 to-blue-600',
        prompts: [
          { id: 'draft-policy', shortTitle: 'Policy', title: 'Draft Policy', description: 'Draft a practice policy', prompt: 'Help me draft a professional practice policy on the following topic. Include purpose, scope, responsibilities, and review date:' },
          { id: 'draft-protocol', shortTitle: 'Protocol', title: 'Draft Protocol', description: 'Draft a clinical protocol', prompt: 'Help me draft a clinical protocol for our practice covering the following procedure:' },
          { id: 'draft-sop', shortTitle: 'SOP', title: 'Draft SOP', description: 'Draft a standard operating procedure', prompt: 'Create a Standard Operating Procedure (SOP) for the following process in our GP practice:' },
          { id: 'draft-job', shortTitle: 'Job Description', title: 'Draft Job Description', description: 'Draft a job description', prompt: 'Draft a professional job description for the following role in our GP practice:' },
          { id: 'draft-proposal', shortTitle: 'Business Case', title: 'Draft Business Case', description: 'Draft a business case', prompt: 'Help me draft a business case proposal for the following initiative:' },
          { id: 'draft-newsletter', shortTitle: 'Newsletter', title: 'Draft Newsletter', description: 'Draft a practice newsletter', prompt: 'Draft a practice newsletter for patients covering:' },
        ]
      },
      {
        id: 'templates',
        shortTitle: 'Templates',
        title: 'Create Templates',
        description: 'Generate reusable document templates',
        icon: FilePlus,
        gradient: 'from-blue-600 to-blue-700',
        prompts: [
          { id: 'temp-checklist', shortTitle: 'Checklist', title: 'Create Checklist', description: 'Create a checklist template', prompt: 'Create a comprehensive checklist template for the following process:' },
          { id: 'temp-form', shortTitle: 'Form', title: 'Create Form', description: 'Create a form template', prompt: 'Design a form template for collecting the following information:' },
          { id: 'temp-agenda', shortTitle: 'Meeting Agenda', title: 'Create Agenda', description: 'Create a meeting agenda template', prompt: 'Create a structured meeting agenda template for the following type of meeting:' },
          { id: 'temp-action-plan', shortTitle: 'Action Plan', title: 'Create Action Plan', description: 'Create an action plan template', prompt: 'Create an action plan template with SMART objectives for:' },
          { id: 'temp-induction', shortTitle: 'Induction Pack', title: 'Create Induction Pack', description: 'Create new starter induction', prompt: 'Create a new starter induction checklist covering first day, first week, and first month activities for:' },
        ]
      },
      {
        id: 'spreadsheets',
        shortTitle: 'Spreadsheets',
        title: 'Spreadsheet Help',
        description: 'Excel formulas and data analysis',
        icon: FileSpreadsheet,
        gradient: 'from-green-500 to-green-600',
        prompts: [
          { id: 'xl-formula', shortTitle: 'Excel Formula', title: 'Excel Formula Help', description: 'Get help with Excel formulas', prompt: 'Help me create an Excel formula to:' },
          { id: 'xl-analysis', shortTitle: 'Data Analysis', title: 'Analyse Data', description: 'Analyse spreadsheet data', prompt: 'Analyse this spreadsheet data and provide insights on:' },
          { id: 'xl-template', shortTitle: 'Tracker Template', title: 'Create Tracker', description: 'Create a tracking spreadsheet', prompt: 'Help me create a tracking spreadsheet template for:' },
          { id: 'xl-budget', shortTitle: 'Budget Template', title: 'Budget Spreadsheet', description: 'Create budget template', prompt: 'Create a practice budget summary template with income and expenditure breakdown for:' },
        ]
      },
      {
        id: 'qr-codes',
        shortTitle: 'QR Codes',
        title: 'QR Codes',
        description: 'Generate QR codes for patient resources',
        icon: QrCode,
        gradient: 'from-gray-500 to-gray-600',
        prompts: [
          { id: 'qr-website', shortTitle: 'Website', title: 'Website QR Code', description: 'Create website QR code', prompt: 'Create a QR code linking to our practice website' },
          { id: 'qr-feedback', shortTitle: 'Feedback Form', title: 'Feedback QR Code', description: 'Create feedback QR code', prompt: 'Create a QR code for our online patient feedback form' },
          { id: 'qr-nhsapp', shortTitle: 'NHS App', title: 'NHS App QR Code', description: 'Create NHS App QR code', prompt: 'Create a QR code linking to the NHS App download page' },
        ]
      },
    ]
  },
  {
    id: 'visuals',
    shortTitle: 'Visuals',
    title: 'Design Visuals',
    description: 'Create images, posters, presentations, and infographics',
    icon: ImageIcon,
    gradient: 'from-purple-500 to-purple-600',
    subCategories: [
      {
        id: 'patient-leaflets',
        shortTitle: 'Leaflets',
        title: 'Patient Leaflets',
        description: 'Create patient information leaflets',
        icon: FileText,
        gradient: 'from-purple-400 to-purple-500',
        prompts: [
          { id: 'leaf-diabetes', shortTitle: 'Diabetes', title: 'Diabetes Leaflet', description: 'Create diabetes management leaflet', prompt: 'Create a patient leaflet explaining Type 2 diabetes management including diet, exercise, and medication adherence' },
          { id: 'leaf-wound', shortTitle: 'Wound Care', title: 'Wound Care Leaflet', description: 'Post-operative care leaflet', prompt: 'Create an A4 patient information leaflet for post-minor surgery wound care' },
          { id: 'leaf-medication', shortTitle: 'Medication', title: 'Medication Leaflet', description: 'Medication side effects leaflet', prompt: 'Create a leaflet explaining common side effects of this medication and when to seek help:' },
          { id: 'leaf-vaccine', shortTitle: 'Vaccinations', title: 'Vaccination Leaflet', description: 'Childhood vaccination leaflet', prompt: 'Create a parent-friendly leaflet about the childhood vaccination schedule' },
          { id: 'leaf-mental', shortTitle: 'Mental Health', title: 'Mental Health Leaflet', description: 'Mental health support leaflet', prompt: 'Create a patient leaflet about anxiety management techniques and local support services' },
        ]
      },
      {
        id: 'social-media',
        shortTitle: 'Social Media',
        title: 'Social Media Posts',
        description: 'Create engaging social content',
        icon: Share2,
        gradient: 'from-pink-500 to-pink-600',
        prompts: [
          { id: 'social-flu', shortTitle: 'Flu Campaign', title: 'Flu Vaccination Post', description: 'Flu vaccine campaign post', prompt: 'Create a social media image promoting flu vaccinations - book your appointment now' },
          { id: 'social-hours', shortTitle: 'Extended Hours', title: 'Extended Hours Post', description: 'Announce extended hours', prompt: 'Create a social media post announcing our new Saturday morning appointments' },
          { id: 'social-mental', shortTitle: 'Mental Health', title: 'Mental Health Week', description: 'Mental health awareness post', prompt: 'Create a social media graphic for Mental Health Awareness Week' },
          { id: 'social-staff', shortTitle: 'New Staff', title: 'Welcome New Staff', description: 'Welcome new team member', prompt: 'Create a social media welcome post for our new team member:' },
          { id: 'social-app', shortTitle: 'NHS App', title: 'NHS App Promotion', description: 'Promote NHS App', prompt: 'Create a social media post encouraging patients to use the NHS App for repeat prescriptions' },
        ]
      },
      {
        id: 'waiting-room',
        shortTitle: 'Waiting Room',
        title: 'Waiting Room Displays',
        description: 'Posters and displays for waiting areas',
        icon: Image,
        gradient: 'from-amber-500 to-amber-600',
        prompts: [
          { id: 'wait-dna', shortTitle: 'DNA Reminder', title: 'DNA Poster', description: 'Missed appointments poster', prompt: 'Create a waiting room poster about DNA rates and how missed appointments affect others' },
          { id: 'wait-respect', shortTitle: 'Staff Respect', title: 'Respect Staff Poster', description: 'Staff respect poster', prompt: 'Create a waiting room poster asking patients to be respectful to reception staff' },
          { id: 'wait-prescription', shortTitle: 'Prescriptions', title: 'Prescription Times', description: 'Prescription turnaround poster', prompt: 'Create a waiting room display explaining prescription turnaround times - 48 hours' },
          { id: 'wait-selfcare', shortTitle: 'Self-Care', title: 'Self-Care Guidance', description: 'Pharmacy first poster', prompt: 'Create a waiting room poster about self-care for minor illnesses - pharmacy first' },
          { id: 'wait-services', shortTitle: 'Services', title: 'Practice Services', description: 'Services overview poster', prompt: 'Create a waiting room display listing all services we offer including travel vaccines' },
          { id: 'wait-ppg', shortTitle: 'PPG', title: 'PPG Recruitment', description: 'PPG recruitment poster', prompt: 'Create a waiting room poster recruiting members for our Patient Participation Group' },
        ]
      },
      {
        id: 'health-campaigns',
        shortTitle: 'Campaigns',
        title: 'Health Campaigns',
        description: 'Seasonal and awareness campaigns',
        icon: Heart,
        gradient: 'from-red-500 to-red-600',
        prompts: [
          { id: 'camp-bp', shortTitle: 'Blood Pressure', title: 'BP Awareness', description: 'Blood pressure campaign', prompt: 'Create a health campaign poster for Know Your Numbers blood pressure week' },
          { id: 'camp-cervical', shortTitle: 'Cervical Screening', title: 'Smear Test Campaign', description: 'Cervical screening campaign', prompt: 'Create a cervical screening awareness campaign image - book your smear test' },
          { id: 'camp-bowel', shortTitle: 'Bowel Cancer', title: 'FIT Test Campaign', description: 'Bowel cancer screening', prompt: 'Create a campaign poster encouraging patients to complete their FIT test' },
          { id: 'camp-health-check', shortTitle: 'NHS Health Check', title: 'Health Check Campaign', description: 'NHS Health Checks poster', prompt: 'Create a campaign poster for our free NHS Health Checks for patients aged 40-74' },
          { id: 'camp-smoking', shortTitle: 'Stoptober', title: 'Stop Smoking', description: 'Smoking cessation campaign', prompt: 'Create a Stoptober campaign poster with local quit smoking support details' },
        ]
      },
      {
        id: 'infographics',
        shortTitle: 'Infographics',
        title: 'Data Infographics',
        description: 'Transform data into visual summaries',
        icon: LayoutPanelTop,
        gradient: 'from-teal-500 to-teal-600',
        prompts: [
          { id: 'info-qof', shortTitle: 'QOF Performance', title: 'QOF Infographic', description: 'QOF achievement rates', prompt: 'Create an infographic showing our QOF achievement rates for the past year' },
          { id: 'info-fft', shortTitle: 'Patient Survey', title: 'FFT Results', description: 'Friends and Family results', prompt: 'Create an infographic summarising our Friends and Family Test results' },
          { id: 'info-appointments', shortTitle: 'Appointments', title: 'Appointment Stats', description: 'Appointment statistics', prompt: 'Create an infographic showing our appointment availability and DNA rates' },
          { id: 'info-demographics', shortTitle: 'Demographics', title: 'Patient Demographics', description: 'Practice demographics', prompt: 'Create an infographic showing our patient population demographics' },
          { id: 'info-referral', shortTitle: 'Referral Pathway', title: 'Cancer Pathway', description: '2-week wait pathway', prompt: 'Create an infographic showing the 2-week wait cancer referral pathway' },
        ]
      },
      {
        id: 'presentations',
        shortTitle: 'Slides',
        title: 'Create Presentations',
        description: 'Build PowerPoint presentations',
        icon: Presentation,
        gradient: 'from-orange-500 to-orange-600',
        prompts: [
          { id: 'ppt-training', shortTitle: 'Training', title: 'Training Presentation', description: 'Create training slides', prompt: 'Create a training presentation for practice staff on:' },
          { id: 'ppt-meeting', shortTitle: 'Meeting', title: 'Meeting Presentation', description: 'Create meeting slides', prompt: 'Create a presentation for our practice meeting covering:' },
          { id: 'ppt-patient', shortTitle: 'Patient Ed', title: 'Patient Education', description: 'Create patient education slides', prompt: 'Create a patient education presentation about:' },
          { id: 'ppt-business', shortTitle: 'Business Case', title: 'Business Presentation', description: 'Create business case slides', prompt: 'Create a business case presentation for:' },
          { id: 'ppt-pcn', shortTitle: 'PCN Meeting', title: 'PCN Presentation', description: 'PCN meeting slides', prompt: 'Create presentation slides for PCN meetings showing:' },
        ]
      },
    ]
  },
  {
    id: 'respond',
    shortTitle: 'Respond',
    title: 'Respond & Draft',
    description: 'Draft responses, letters, and emails',
    icon: MessageSquare,
    gradient: 'from-red-500 to-red-600',
    subCategories: [
      {
        id: 'complaints',
        shortTitle: 'Complaints',
        title: 'Complaint Responses',
        description: 'Professional complaint handling',
        icon: AlertTriangle,
        gradient: 'from-red-400 to-red-500',
        prompts: [
          { id: 'comp-ack', shortTitle: 'Acknowledgement', title: 'Complaint Acknowledgement', description: 'Draft complaint acknowledgement', prompt: 'Draft a professional complaint acknowledgement letter. The complaint is about:' },
          { id: 'comp-response', shortTitle: 'Full Response', title: 'Complaint Response', description: 'Draft full complaint response', prompt: 'Draft a comprehensive complaint response letter addressing:' },
          { id: 'comp-apology', shortTitle: 'Apology', title: 'Apology Letter', description: 'Draft sincere apology', prompt: 'Draft a sincere apology letter for a complaint regarding:' },
          { id: 'comp-resolution', shortTitle: 'Resolution', title: 'Resolution Letter', description: 'Draft resolution outcome', prompt: 'Draft a resolution letter explaining the outcome and actions taken for:' },
        ]
      },
      {
        id: 'letters',
        shortTitle: 'Letters',
        title: 'Professional Letters',
        description: 'Formal business correspondence',
        icon: Mail,
        gradient: 'from-red-500 to-red-600',
        prompts: [
          { id: 'let-patient', shortTitle: 'Patient Letter', title: 'Patient Letter', description: 'Draft patient communication', prompt: 'Draft a professional letter to a patient regarding:' },
          { id: 'let-referral', shortTitle: 'Referral', title: 'Referral Letter', description: 'Draft referral letter', prompt: 'Draft a referral letter for a patient being referred for:' },
          { id: 'let-nhs', shortTitle: 'NHS/ICB', title: 'NHS Letter', description: 'Draft NHS correspondence', prompt: 'Draft a formal letter to NHS England/ICB regarding:' },
          { id: 'let-stakeholder', shortTitle: 'Stakeholder', title: 'Stakeholder Letter', description: 'Draft stakeholder communication', prompt: 'Draft a letter to our stakeholders about:' },
        ]
      },
      {
        id: 'emails',
        shortTitle: 'Emails',
        title: 'Email Drafts',
        description: 'Professional email communications',
        icon: MessageCircle,
        gradient: 'from-orange-500 to-orange-600',
        prompts: [
          { id: 'email-staff', shortTitle: 'Staff Update', title: 'Staff Email', description: 'Draft staff email', prompt: 'Draft a professional email to all staff about:' },
          { id: 'email-patient', shortTitle: 'Patient Comms', title: 'Patient Email', description: 'Draft patient email', prompt: 'Draft a patient communication email about:' },
          { id: 'email-external', shortTitle: 'External', title: 'External Email', description: 'Draft external email', prompt: 'Draft a professional email to an external organisation about:' },
          { id: 'email-followup', shortTitle: 'Follow-up', title: 'Follow-up Email', description: 'Draft follow-up email', prompt: 'Draft a follow-up email regarding:' },
          { id: 'email-polish', shortTitle: 'Polish Draft', title: 'Polish My Email', description: 'Review and improve your draft email', prompt: `Please review and polish my draft email below. Check for:

1. **Accuracy** - Ensure all facts, dates, and details are consistent and clear
2. **Professional Tone** - Make it appropriately formal for NHS/healthcare communication
3. **NHS Best Practice** - Follow NHS communication guidelines (clear, concise, patient-centred)
4. **Grammar & Spelling** - Correct any errors
5. **Structure** - Ensure logical flow with clear opening, body, and closing
6. **Clarity** - Remove jargon and ensure the message is easily understood

Please provide:
- The polished version of my email
- A brief summary of changes made
- Any suggestions for improvement

My draft email:` },
        ]
      },
      {
        id: 'phone-scripts',
        shortTitle: 'Phone Scripts',
        title: 'Telephone Scripts',
        description: 'Scripts for phone conversations',
        icon: Phone,
        gradient: 'from-yellow-500 to-yellow-600',
        prompts: [
          { id: 'phone-callback', shortTitle: 'Callback', title: 'Callback Script', description: 'Patient callback script', prompt: 'Create a professional telephone script for calling patients back about:' },
          { id: 'phone-difficult', shortTitle: 'Difficult Calls', title: 'Difficult Conversation', description: 'Difficult conversation script', prompt: 'Create a script for handling a difficult phone conversation about:' },
          { id: 'phone-triage', shortTitle: 'Triage', title: 'Triage Script', description: 'Telephone triage script', prompt: 'Create a telephone triage script for assessing:' },
        ]
      },
    ]
  },
  // Row 2
  {
    id: 'workforce',
    shortTitle: 'Workforce',
    title: 'Workforce & HR',
    description: 'Staff management, HR, training, and rotas',
    icon: Users,
    gradient: 'from-indigo-500 to-indigo-600',
    subCategories: [
      {
        id: 'recruitment',
        shortTitle: 'Recruitment',
        title: 'Recruitment',
        description: 'Hiring and onboarding support',
        icon: UserPlus,
        gradient: 'from-indigo-400 to-indigo-500',
        prompts: [
          { id: 'rec-job', shortTitle: 'Job Advert', title: 'Draft Job Advert', description: 'Create job advertisement', prompt: 'Create a compelling job advertisement for the following role at our GP practice:' },
          { id: 'rec-questions', shortTitle: 'Interview Q\'s', title: 'Interview Questions', description: 'Generate interview questions', prompt: 'Generate competency-based interview questions for the role of:' },
          { id: 'rec-onboard', shortTitle: 'Onboarding', title: 'Onboarding Plan', description: 'Create onboarding checklist', prompt: 'Create a comprehensive onboarding checklist for a new:' },
          { id: 'rec-offer', shortTitle: 'Offer Letter', title: 'Offer Letter', description: 'Draft offer letter', prompt: 'Draft a professional offer letter for:' },
          { id: 'rec-person-spec', shortTitle: 'Person Spec', title: 'Person Specification', description: 'Create person specification', prompt: 'Create a person specification for the role of:' },
        ]
      },
      {
        id: 'training',
        shortTitle: 'Training',
        title: 'Training & Development',
        description: 'Staff training and CPD',
        icon: GraduationCap,
        gradient: 'from-indigo-500 to-indigo-600',
        prompts: [
          { id: 'train-needs', shortTitle: 'Training Needs', title: 'Training Needs Analysis', description: 'Analyse training needs', prompt: 'Help me conduct a training needs analysis for:' },
          { id: 'train-plan', shortTitle: 'Training Plan', title: 'Training Plan', description: 'Create training plan', prompt: 'Create a training plan for staff on:' },
          { id: 'train-material', shortTitle: 'Materials', title: 'Training Materials', description: 'Create training materials', prompt: 'Create training materials covering:' },
          { id: 'train-assess', shortTitle: 'Assessment', title: 'Competency Assessment', description: 'Create competency assessment', prompt: 'Create a competency assessment for:' },
          { id: 'train-calendar', shortTitle: 'Training Calendar', title: 'Training Calendar', description: 'Create training calendar', prompt: 'Create a quarterly training calendar for mandatory training sessions' },
        ]
      },
      {
        id: 'rotas',
        shortTitle: 'Rotas',
        title: 'Rota Management',
        description: 'Staff scheduling and rotas',
        icon: Calendar,
        gradient: 'from-violet-500 to-violet-600',
        prompts: [
          { id: 'rota-template', shortTitle: 'Rota Template', title: 'Create Rota Template', description: 'Create rota template', prompt: 'Help me create a rota template for:' },
          { id: 'rota-cover', shortTitle: 'Cover Request', title: 'Cover Request', description: 'Draft cover request', prompt: 'Draft a cover request email for:' },
          { id: 'rota-leave', shortTitle: 'Leave Policy', title: 'Leave Policy', description: 'Draft leave policy', prompt: 'Help me draft an annual leave policy including:' },
          { id: 'rota-bank-holiday', shortTitle: 'Bank Holidays', title: 'Bank Holiday Schedule', description: 'Bank holiday opening hours', prompt: 'Create a calendar showing practice opening hours over Christmas and New Year' },
        ]
      },
      {
        id: 'hr-policies',
        shortTitle: 'HR Policies',
        title: 'HR Policies',
        description: 'HR documentation and policies',
        icon: Briefcase,
        gradient: 'from-purple-500 to-purple-600',
        prompts: [
          { id: 'hr-absence', shortTitle: 'Absence Policy', title: 'Absence Management', description: 'Draft absence policy', prompt: 'Draft an absence management policy for our practice:' },
          { id: 'hr-appraisal', shortTitle: 'Appraisal', title: 'Appraisal Template', description: 'Create appraisal template', prompt: 'Create an appraisal template for:' },
          { id: 'hr-disciplinary', shortTitle: 'Disciplinary', title: 'Disciplinary Process', description: 'Draft disciplinary policy', prompt: 'Outline the disciplinary process for:' },
          { id: 'hr-wellbeing', shortTitle: 'Wellbeing', title: 'Staff Wellbeing', description: 'Create wellbeing initiative', prompt: 'Create a staff wellbeing initiative plan for:' },
          { id: 'hr-eap', shortTitle: 'EAP Poster', title: 'EAP Promotion', description: 'EAP wellbeing poster', prompt: 'Create a staff wellbeing poster promoting the Employee Assistance Programme' },
        ]
      },
      {
        id: 'reception',
        shortTitle: 'Reception',
        title: 'Reception Team',
        description: 'Scripts and guides for front desk',
        icon: Headphones,
        gradient: 'from-pink-500 to-pink-600',
        prompts: [
          { id: 'rec-appt-guide', shortTitle: 'Appointment Guide', title: 'Booking Guide', description: 'Appointment types guide', prompt: 'Create a quick-reference guide for reception showing all appointment types, durations, and booking criteria' },
          { id: 'rec-scripts', shortTitle: 'Phone Scripts', title: 'Telephone Scripts', description: 'Common query scripts', prompt: 'Create telephone scripts for handling common patient queries - results, prescriptions, referrals' },
          { id: 'rec-triage', shortTitle: 'Triage Questions', title: 'Triage Protocol', description: 'Appointment triage', prompt: 'Create a reception desk poster showing appointment triage questions and escalation criteria' },
          { id: 'rec-difficult', shortTitle: 'Difficult Callers', title: 'Difficult Conversations', description: 'Managing difficult calls', prompt: 'Create guidance for handling difficult or aggressive callers at reception' },
          { id: 'rec-signpost', shortTitle: 'Signposting', title: 'Pharmacy First Guide', description: 'Signposting to pharmacy', prompt: 'Create a reception signposting guide for Pharmacy First conditions' },
        ]
      },
    ]
  },
  {
    id: 'comply',
    shortTitle: 'Comply',
    title: 'Comply & Govern',
    description: 'CQC, policies, compliance, and governance',
    icon: ClipboardCheck,
    gradient: 'from-emerald-500 to-emerald-600',
    subCategories: [
      {
        id: 'cqc',
        shortTitle: 'CQC',
        title: 'CQC Compliance',
        description: 'CQC preparation and evidence',
        icon: Shield,
        gradient: 'from-emerald-400 to-emerald-500',
        prompts: [
          { id: 'cqc-evidence', shortTitle: 'Evidence', title: 'CQC Evidence', description: 'Prepare CQC evidence', prompt: 'Help me prepare evidence for CQC demonstrating:' },
          { id: 'cqc-action', shortTitle: 'Action Plan', title: 'CQC Action Plan', description: 'Create improvement action plan', prompt: 'Create an action plan to address the following CQC requirement:' },
          { id: 'cqc-audit', shortTitle: 'Self-Audit', title: 'CQC Self-Audit', description: 'Conduct self-audit', prompt: 'Help me conduct a CQC self-audit for the key question:' },
          { id: 'cqc-statement', shortTitle: 'Statement', title: 'Provider Statement', description: 'Draft provider statement', prompt: 'Draft a provider information statement for CQC about:' },
        ]
      },
      {
        id: 'policies',
        shortTitle: 'Policies',
        title: 'Practice Policies',
        description: 'Create and review policies',
        icon: BookOpen,
        gradient: 'from-emerald-500 to-emerald-600',
        prompts: [
          { id: 'pol-clinical', shortTitle: 'Clinical', title: 'Clinical Policy', description: 'Draft clinical policy', prompt: 'Draft a clinical policy for our practice on:' },
          { id: 'pol-safeguarding', shortTitle: 'Safeguarding', title: 'Safeguarding Policy', description: 'Draft safeguarding policy', prompt: 'Draft a comprehensive safeguarding policy including:' },
          { id: 'pol-infection', shortTitle: 'IPC', title: 'Infection Control', description: 'Draft IPC policy', prompt: 'Draft an infection prevention and control policy for:' },
          { id: 'pol-info-gov', shortTitle: 'Info Governance', title: 'IG Policy', description: 'Draft IG policy', prompt: 'Draft an information governance policy covering:' },
        ]
      },
      {
        id: 'risk',
        shortTitle: 'Risk',
        title: 'Risk Management',
        description: 'Risk assessments and registers',
        icon: AlertTriangle,
        gradient: 'from-yellow-500 to-yellow-600',
        prompts: [
          { id: 'risk-assess', shortTitle: 'Assessment', title: 'Risk Assessment', description: 'Conduct risk assessment', prompt: 'Help me conduct a risk assessment for:' },
          { id: 'risk-register', shortTitle: 'Risk Register', title: 'Risk Register Entry', description: 'Add to risk register', prompt: 'Create a risk register entry for:' },
          { id: 'risk-mitigation', shortTitle: 'Mitigation', title: 'Mitigation Plan', description: 'Create mitigation plan', prompt: 'Create a risk mitigation plan for:' },
        ]
      },
      {
        id: 'incidents',
        shortTitle: 'Incidents',
        title: 'Incident Management',
        description: 'Significant events and incidents',
        icon: Activity,
        gradient: 'from-red-500 to-red-600',
        prompts: [
          { id: 'inc-report', shortTitle: 'Report', title: 'Incident Report', description: 'Draft incident report', prompt: 'Help me document a significant event/incident involving:' },
          { id: 'inc-analysis', shortTitle: 'RCA', title: 'Root Cause Analysis', description: 'Conduct root cause analysis', prompt: 'Help me conduct a root cause analysis for:' },
          { id: 'inc-lessons', shortTitle: 'Lessons', title: 'Lessons Learned', description: 'Document lessons learned', prompt: 'Document lessons learned and improvements from:' },
        ]
      },
    ]
  },
  {
    id: 'analyse',
    shortTitle: 'Analyse',
    title: 'Analyse & Report',
    description: 'Data analysis, QOF, and performance reports',
    icon: BarChart3,
    gradient: 'from-cyan-500 to-cyan-600',
    subCategories: [
      {
        id: 'qof',
        shortTitle: 'QOF',
        title: 'QOF Analysis',
        description: 'Quality and Outcomes Framework',
        icon: Star,
        gradient: 'from-cyan-400 to-cyan-500',
        prompts: [
          { id: 'qof-analysis', shortTitle: 'QOF Review', title: 'QOF Data Analysis', description: 'Analyse QOF data', prompt: 'Analyse our QOF data and suggest improvements for:' },
          { id: 'qof-action', shortTitle: 'Action Plan', title: 'QOF Action Plan', description: 'Create QOF action plan', prompt: 'Create an action plan to improve QOF performance in:' },
          { id: 'qof-template', shortTitle: 'Template', title: 'QOF Search Template', description: 'Create search template', prompt: 'Help me create a patient search template for QOF indicator:' },
        ]
      },
      {
        id: 'performance',
        shortTitle: 'Performance',
        title: 'Performance Reports',
        description: 'KPIs and performance metrics',
        icon: TrendingUp,
        gradient: 'from-cyan-500 to-cyan-600',
        prompts: [
          { id: 'perf-kpi', shortTitle: 'KPIs', title: 'KPI Dashboard', description: 'Create KPI dashboard', prompt: 'Help me create a KPI dashboard for tracking:' },
          { id: 'perf-report', shortTitle: 'Monthly Report', title: 'Performance Report', description: 'Draft performance report', prompt: 'Draft a monthly performance report covering:' },
          { id: 'perf-benchmark', shortTitle: 'Benchmarking', title: 'Benchmark Analysis', description: 'Benchmark against peers', prompt: 'Analyse our performance against benchmarks for:' },
        ]
      },
      {
        id: 'data-analysis',
        shortTitle: 'Data',
        title: 'Data Analysis',
        description: 'Analyse practice data',
        icon: PieChart,
        gradient: 'from-blue-500 to-blue-600',
        prompts: [
          { id: 'data-trends', shortTitle: 'Trends', title: 'Trend Analysis', description: 'Identify trends', prompt: 'Analyse trends in our data for:' },
          { id: 'data-compare', shortTitle: 'Compare', title: 'Comparative Analysis', description: 'Compare data sets', prompt: 'Compare and analyse the differences between:' },
          { id: 'data-predict', shortTitle: 'Forecast', title: 'Forecasting', description: 'Forecast future trends', prompt: 'Help me forecast based on this data:' },
        ]
      },
      {
        id: 'clinical-audit',
        shortTitle: 'Audits',
        title: 'Clinical Audits',
        description: 'Clinical audit support',
        icon: Stethoscope,
        gradient: 'from-green-500 to-green-600',
        prompts: [
          { id: 'audit-design', shortTitle: 'Design Audit', title: 'Design Clinical Audit', description: 'Design an audit', prompt: 'Help me design a clinical audit for:' },
          { id: 'audit-analyse', shortTitle: 'Analyse Results', title: 'Analyse Audit Results', description: 'Analyse audit results', prompt: 'Analyse these clinical audit results and suggest improvements:' },
          { id: 'audit-report', shortTitle: 'Audit Report', title: 'Audit Report', description: 'Write audit report', prompt: 'Draft a clinical audit report for:' },
        ]
      },
    ]
  },
  // Row 3
  {
    id: 'audio',
    shortTitle: 'Audio',
    title: 'Audio & Voice',
    description: 'Voice generation, transcription, and meetings',
    icon: Mic,
    gradient: 'from-green-500 to-green-600',
    subCategories: [
      {
        id: 'voice-gen',
        shortTitle: 'Voice',
        title: 'Generate Voice',
        description: 'Convert text to speech',
        icon: Volume2,
        gradient: 'from-green-400 to-green-500',
        prompts: [
          { id: 'voice-ivr', shortTitle: 'Phone Message', title: 'Phone System Message', description: 'Create IVR message', prompt: 'Create a professional phone system message for our GP practice:\n\n' },
          { id: 'voice-patient', shortTitle: 'Patient Info', title: 'Patient Information', description: 'Create patient audio', prompt: 'Create an audio script for patients about:\n\n' },
          { id: 'voice-training', shortTitle: 'Training Audio', title: 'Training Voiceover', description: 'Create training audio', prompt: 'Create a voiceover script for a training video on:\n\n' },
        ]
      },
      {
        id: 'transcribe',
        shortTitle: 'Transcribe',
        title: 'Transcription',
        description: 'Transcribe audio to text',
        icon: FileAudio,
        gradient: 'from-green-500 to-green-600',
        prompts: [
          { id: 'trans-meeting', shortTitle: 'Meeting', title: 'Transcribe Meeting', description: 'Transcribe meeting audio', prompt: 'Transcribe this meeting audio and create structured notes with key decisions and actions:' },
          { id: 'trans-dictation', shortTitle: 'Dictation', title: 'Transcribe Dictation', description: 'Transcribe dictation', prompt: 'Transcribe this dictation and format appropriately:' },
          { id: 'trans-interview', shortTitle: 'Interview', title: 'Transcribe Interview', description: 'Transcribe interview', prompt: 'Transcribe this interview recording:' },
        ]
      },
      {
        id: 'meetings',
        shortTitle: 'Meetings',
        title: 'Meeting Support',
        description: 'Meeting notes and agendas',
        icon: Radio,
        gradient: 'from-teal-500 to-teal-600',
        prompts: [
          { id: 'meet-notes', shortTitle: 'Meeting Notes', title: 'Generate Notes', description: 'Create meeting notes', prompt: 'Convert this meeting transcript into structured meeting notes with decisions and actions:' },
          { id: 'meet-agenda', shortTitle: 'Agenda', title: 'Create Agenda', description: 'Create meeting agenda', prompt: 'Create a structured agenda for a meeting about:' },
          { id: 'meet-minutes', shortTitle: 'Minutes', title: 'Format Minutes', description: 'Format meeting minutes', prompt: 'Format these meeting notes into formal minutes:' },
        ]
      },
    ]
  },
  {
    id: 'search',
    shortTitle: 'Guidance',
    title: 'Search Guidance',
    description: 'Find NHS guidance, contracts, and regulations',
    icon: Search,
    gradient: 'from-slate-500 to-slate-600',
    subCategories: [
      {
        id: 'nhs-guidance',
        shortTitle: 'NHS Guidance',
        title: 'NHS Guidance',
        description: 'Search NHS guidance documents',
        icon: BookOpen,
        gradient: 'from-slate-400 to-slate-500',
        prompts: [
          { id: 'nhs-latest', shortTitle: 'Latest Updates', title: 'Latest NHS Updates', description: 'Find latest NHS updates', prompt: 'Find the latest NHS guidance on:' },
          { id: 'nhs-nice', shortTitle: 'NICE Guidelines', title: 'NICE Guidelines', description: 'Search NICE guidelines', prompt: 'Find NICE guidelines for:' },
          { id: 'nhs-contractual', shortTitle: 'Contract Terms', title: 'Contractual Requirements', description: 'Find contract requirements', prompt: 'What are the contractual requirements for:' },
          { id: 'nhs-contract-compare', shortTitle: 'Contract Comparison', title: 'GMS/PMS Comparison', description: 'Compare contracts', prompt: 'Create a comparison table of GMS, PMS, and APMS contracts highlighting key differences and requirements' },
        ]
      },
      {
        id: 'pcn',
        shortTitle: 'PCN',
        title: 'PCN & DES',
        description: 'PCN requirements and specifications',
        icon: Network,
        gradient: 'from-purple-500 to-purple-600',
        prompts: [
          { id: 'pcn-des', shortTitle: 'DES Summary', title: 'PCN DES Requirements', description: 'PCN DES requirements', prompt: 'Create an infographic summarising PCN DES requirements and service specifications for 2025/26' },
          { id: 'pcn-iif', shortTitle: 'IIF Tracker', title: 'IIF Performance', description: 'IIF indicator tracking', prompt: 'Create an IIF indicator dashboard showing performance across all PCN practices with RAG ratings' },
          { id: 'pcn-arrs', shortTitle: 'ARRS Roles', title: 'ARRS Business Case', description: 'ARRS recruitment case', prompt: 'Create a business case template for recruiting additional ARRS roles within PCN funding allocation' },
          { id: 'pcn-governance', shortTitle: 'PCN Governance', title: 'Board Agenda', description: 'PCN board meeting', prompt: 'Create a PCN Clinical Director board meeting agenda template with standard governance items' },
        ]
      },
      {
        id: 'regulations',
        shortTitle: 'Regulations',
        title: 'Regulations',
        description: 'Regulatory requirements',
        icon: Shield,
        gradient: 'from-slate-500 to-slate-600',
        prompts: [
          { id: 'reg-cqc', shortTitle: 'CQC Regs', title: 'CQC Regulations', description: 'Find CQC regulations', prompt: 'What are the CQC requirements for:' },
          { id: 'reg-gdpr', shortTitle: 'GDPR/IG', title: 'Data Protection', description: 'Find GDPR guidance', prompt: 'What are the GDPR/data protection requirements for:' },
          { id: 'reg-employment', shortTitle: 'Employment', title: 'Employment Law', description: 'Find employment regulations', prompt: 'What are the employment law requirements for:' },
          { id: 'reg-sar', shortTitle: 'SAR Requests', title: 'Subject Access', description: 'SAR handling guide', prompt: 'Create a staff guide for handling Subject Access Requests under GDPR with timelines and process' },
        ]
      },
      {
        id: 'help',
        shortTitle: 'How To',
        title: 'How To Guides',
        description: 'Step-by-step guidance',
        icon: HelpCircle,
        gradient: 'from-blue-500 to-blue-600',
        prompts: [
          { id: 'how-process', shortTitle: 'Process', title: 'Process Guide', description: 'Explain a process', prompt: 'Explain step-by-step how to:' },
          { id: 'how-best', shortTitle: 'Best Practice', title: 'Best Practice', description: 'Find best practice', prompt: 'What is the best practice for:' },
          { id: 'how-implement', shortTitle: 'Implementation', title: 'Implementation Guide', description: 'Implementation steps', prompt: 'How should we implement:' },
          { id: 'how-continuity', shortTitle: 'Business Continuity', title: 'BCP Template', description: 'Business continuity plan', prompt: 'Create a business continuity plan template for GP practices covering IT failure, staff absence, and premises issues' },
        ]
      },
    ]
  },
  {
    id: 'anything',
    shortTitle: 'Ask AI',
    title: 'Ask AI Anything',
    description: 'Get AI assistance with any practice question',
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    subCategories: [],
    focusOnly: true,
    prompt: '',
  },
];

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
  Stethoscope
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
        id: 'images',
        shortTitle: 'Images',
        title: 'Generate Images',
        description: 'AI-generated images for your practice',
        icon: Image,
        gradient: 'from-purple-400 to-purple-500',
        prompts: [
          { id: 'img-poster', shortTitle: 'Health Poster', title: 'Create Health Poster', description: 'Create a health awareness poster', prompt: 'Create a professional NHS-style health awareness poster about:' },
          { id: 'img-social', shortTitle: 'Social Media', title: 'Create Social Post', description: 'Create social media graphic', prompt: 'Create an engaging social media graphic for our GP practice about:' },
          { id: 'img-banner', shortTitle: 'Banner', title: 'Create Banner', description: 'Create a banner image', prompt: 'Create a professional banner image for our practice website/display about:' },
          { id: 'img-infographic', shortTitle: 'Info Visual', title: 'Create Info Visual', description: 'Create an informational visual', prompt: 'Create a visual infographic-style image explaining:' },
          { id: 'img-seasonal', shortTitle: 'Seasonal', title: 'Seasonal Campaign', description: 'Create seasonal health campaign image', prompt: 'Create a seasonal health campaign image for:' },
        ]
      },
      {
        id: 'presentations',
        shortTitle: 'Slides',
        title: 'Create Presentations',
        description: 'Build PowerPoint presentations',
        icon: Presentation,
        gradient: 'from-amber-500 to-amber-600',
        prompts: [
          { id: 'ppt-training', shortTitle: 'Training', title: 'Training Presentation', description: 'Create training slides', prompt: 'Create a training presentation for practice staff on:' },
          { id: 'ppt-meeting', shortTitle: 'Meeting', title: 'Meeting Presentation', description: 'Create meeting slides', prompt: 'Create a presentation for our practice meeting covering:' },
          { id: 'ppt-patient', shortTitle: 'Patient Ed', title: 'Patient Education', description: 'Create patient education slides', prompt: 'Create a patient education presentation about:' },
          { id: 'ppt-business', shortTitle: 'Business Case', title: 'Business Presentation', description: 'Create business case slides', prompt: 'Create a business case presentation for:' },
        ]
      },
      {
        id: 'infographics',
        shortTitle: 'Infographics',
        title: 'Create Infographics',
        description: 'Transform data into visual summaries',
        icon: LayoutPanelTop,
        gradient: 'from-teal-500 to-teal-600',
        prompts: [
          { id: 'info-data', shortTitle: 'Data Summary', title: 'Data Infographic', description: 'Create data visualisation', prompt: 'Create an infographic summarising this data in a visually engaging way:' },
          { id: 'info-process', shortTitle: 'Process Flow', title: 'Process Infographic', description: 'Create process flow visual', prompt: 'Create an infographic showing the steps in this process:' },
          { id: 'info-comparison', shortTitle: 'Comparison', title: 'Comparison Visual', description: 'Create comparison infographic', prompt: 'Create a comparison infographic showing the differences between:' },
          { id: 'info-timeline', shortTitle: 'Timeline', title: 'Timeline Visual', description: 'Create timeline infographic', prompt: 'Create a timeline infographic for:' },
        ]
      },
      {
        id: 'posters',
        shortTitle: 'Posters',
        title: 'Design Posters',
        description: 'Professional posters for display',
        icon: Palette,
        gradient: 'from-pink-500 to-pink-600',
        prompts: [
          { id: 'post-waiting', shortTitle: 'Waiting Room', title: 'Waiting Room Poster', description: 'Create waiting room display', prompt: 'Create a professional poster for our waiting room about:' },
          { id: 'post-staff', shortTitle: 'Staff Notice', title: 'Staff Notice', description: 'Create staff notice poster', prompt: 'Create a staff notice poster for our practice about:' },
          { id: 'post-campaign', shortTitle: 'Campaign', title: 'Health Campaign', description: 'Create health campaign poster', prompt: 'Create a health campaign poster promoting:' },
          { id: 'post-info', shortTitle: 'Information', title: 'Information Poster', description: 'Create information poster', prompt: 'Create an informational poster explaining:' },
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

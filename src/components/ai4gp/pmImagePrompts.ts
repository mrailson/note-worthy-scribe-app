import { 
  FileText, 
  ImageIcon, 
  Share2, 
  Heart, 
  BarChart3, 
  Newspaper, 
  Monitor, 
  ClipboardList,
  Calendar,
  QrCode,
  Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ImageDetailPrompt {
  id: string;
  shortTitle: string;
  prompt: string; // Template prompt ending with ":"
}

export interface ImageSubCategory {
  id: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  prompts: ImageDetailPrompt[];
}

export const imageSubCategories: ImageSubCategory[] = [
  {
    id: 'social-media',
    shortTitle: 'Social Media',
    description: 'Facebook, Instagram posts promoting services',
    icon: Share2,
    gradient: 'from-purple-500 to-purple-600',
    prompts: [
      { id: 'flu-vaccine', shortTitle: 'Flu Campaign', prompt: 'Create a social media image promoting flu vaccinations:' },
      { id: 'extended-hours', shortTitle: 'Extended Hours', prompt: 'Create a social media post announcing our extended opening hours:' },
      { id: 'mental-health', shortTitle: 'Mental Health', prompt: 'Create a social media graphic for Mental Health Awareness Week:' },
      { id: 'new-staff', shortTitle: 'New Staff', prompt: 'Create a social media welcome post for a new staff member:' },
      { id: 'online-services', shortTitle: 'Online Services', prompt: 'Create a social media post encouraging patients to use the NHS App:' },
      { id: 'seasonal-health', shortTitle: 'Seasonal Tips', prompt: 'Create a seasonal health tips social media post:' },
      { id: 'practice-milestone', shortTitle: 'Milestone', prompt: 'Create a celebratory social media post for our practice:' },
      { id: 'community-event', shortTitle: 'Event', prompt: 'Create a social media post for a practice event:' },
    ],
  },
  {
    id: 'patient-leaflet',
    shortTitle: 'Leaflet',
    description: 'A4/A5 patient information leaflets',
    icon: FileText,
    gradient: 'from-blue-500 to-blue-600',
    prompts: [
      { id: 'diabetes-leaflet', shortTitle: 'Diabetes', prompt: 'Create a patient leaflet explaining Type 2 diabetes management:' },
      { id: 'post-op-care', shortTitle: 'Post-Op Care', prompt: 'Create a patient information leaflet for post-surgery wound care:' },
      { id: 'medication-side-effects', shortTitle: 'Medication', prompt: 'Create a leaflet explaining common medication side effects:' },
      { id: 'childhood-vaccines', shortTitle: 'Vaccinations', prompt: 'Create a parent-friendly leaflet about childhood vaccinations:' },
      { id: 'mental-health-support', shortTitle: 'Mental Health', prompt: 'Create a patient leaflet about anxiety management and support:' },
      { id: 'asthma-plan', shortTitle: 'Asthma Plan', prompt: 'Create a visual asthma action plan leaflet:' },
      { id: 'pregnancy-advice', shortTitle: 'Pregnancy', prompt: 'Create an early pregnancy advice leaflet:' },
      { id: 'copd-management', shortTitle: 'COPD', prompt: 'Create a COPD patient information leaflet:' },
    ],
  },
  {
    id: 'poster',
    shortTitle: 'Poster',
    description: 'Waiting room and staff area posters',
    icon: ImageIcon,
    gradient: 'from-orange-500 to-orange-600',
    prompts: [
      { id: 'staff-wellbeing', shortTitle: 'Staff Wellbeing', prompt: 'Create a staff wellbeing poster promoting the Employee Assistance Programme:' },
      { id: 'infection-control', shortTitle: 'Hand Hygiene', prompt: 'Create a hand hygiene poster for clinical rooms:' },
      { id: 'fire-safety', shortTitle: 'Fire Safety', prompt: 'Create a fire evacuation route poster:' },
      { id: 'confidentiality', shortTitle: 'GDPR', prompt: 'Create a staff poster about patient confidentiality and GDPR:' },
      { id: 'staff-flu', shortTitle: 'Staff Flu Jab', prompt: 'Create a poster encouraging staff to get their flu vaccination:' },
      { id: 'training', shortTitle: 'Training', prompt: 'Create a poster announcing mandatory training:' },
      { id: 'cqc-prep', shortTitle: 'CQC Prep', prompt: 'Create a poster reminding staff about CQC inspection preparation:' },
      { id: 'zero-tolerance', shortTitle: 'Zero Tolerance', prompt: 'Create a zero tolerance poster about abuse towards NHS staff:' },
    ],
  },
  {
    id: 'health-campaign',
    shortTitle: 'Campaign',
    description: 'NHS awareness campaigns and screening',
    icon: Heart,
    gradient: 'from-red-500 to-red-600',
    prompts: [
      { id: 'bp-awareness', shortTitle: 'Blood Pressure', prompt: 'Create a health campaign poster for Know Your Numbers week:' },
      { id: 'cervical-screening', shortTitle: 'Cervical Smear', prompt: 'Create a cervical screening awareness campaign image:' },
      { id: 'bowel-screening', shortTitle: 'Bowel Cancer', prompt: 'Create a campaign poster encouraging patients to complete their FIT test:' },
      { id: 'nhs-health-check', shortTitle: 'NHS Health Check', prompt: 'Create a campaign poster for free NHS Health Checks:' },
      { id: 'stoptober', shortTitle: 'Stoptober', prompt: 'Create a Stoptober smoking cessation campaign poster:' },
      { id: 'dry-january', shortTitle: 'Dry January', prompt: 'Create a Dry January alcohol awareness campaign poster:' },
    ],
  },
  {
    id: 'infographic',
    shortTitle: 'Infographic',
    description: 'Data visualisation and statistics',
    icon: BarChart3,
    gradient: 'from-cyan-500 to-cyan-600',
    prompts: [
      { id: 'qof-performance', shortTitle: 'QOF Results', prompt: 'Create an infographic showing our QOF achievement rates:' },
      { id: 'patient-survey', shortTitle: 'FFT Results', prompt: 'Create an infographic summarising Friends and Family Test results:' },
      { id: 'appointment-stats', shortTitle: 'DNA Rates', prompt: 'Create an infographic showing appointment availability and DNA rates:' },
      { id: 'demographics', shortTitle: 'Demographics', prompt: 'Create an infographic showing our patient population demographics:' },
      { id: 'referral-pathway', shortTitle: 'Referrals', prompt: 'Create an infographic showing the 2-week wait cancer referral pathway:' },
    ],
  },
  {
    id: 'newsletter',
    shortTitle: 'Newsletter',
    description: 'Newsletter headers and banners',
    icon: Newspaper,
    gradient: 'from-pink-500 to-pink-600',
    prompts: [
      { id: 'winter-header', shortTitle: 'Winter', prompt: 'Create a winter newsletter header with seasonal imagery:' },
      { id: 'spring-header', shortTitle: 'Spring', prompt: 'Create a spring newsletter header with fresh imagery:' },
      { id: 'summer-header', shortTitle: 'Summer', prompt: 'Create a summer newsletter header with bright imagery:' },
      { id: 'autumn-header', shortTitle: 'Autumn', prompt: 'Create an autumn newsletter header with seasonal colours:' },
      { id: 'monthly-update', shortTitle: 'Monthly Update', prompt: 'Create a monthly practice update newsletter header:' },
    ],
  },
  {
    id: 'waiting-room',
    shortTitle: 'Display',
    description: 'Waiting room digital displays',
    icon: Monitor,
    gradient: 'from-green-500 to-green-600',
    prompts: [
      { id: 'dna-reminder', shortTitle: 'DNA Rates', prompt: 'Create a waiting room poster about missed appointments and how they affect others:' },
      { id: 'respect-staff', shortTitle: 'Respect Staff', prompt: 'Create a waiting room poster asking patients to be respectful to reception staff:' },
      { id: 'prescription-times', shortTitle: 'Prescriptions', prompt: 'Create a waiting room display explaining prescription turnaround times:' },
      { id: 'self-care', shortTitle: 'Self-Care', prompt: 'Create a waiting room poster about self-care for minor illnesses - pharmacy first:' },
      { id: 'services-list', shortTitle: 'Our Services', prompt: 'Create a waiting room display listing all services we offer:' },
      { id: 'ppg-recruit', shortTitle: 'Join PPG', prompt: 'Create a waiting room poster recruiting Patient Participation Group members:' },
    ],
  },
  {
    id: 'staff-notice',
    shortTitle: 'Staff Notice',
    description: 'Internal staff communications',
    icon: ClipboardList,
    gradient: 'from-amber-500 to-amber-600',
    prompts: [
      { id: 'team-meeting', shortTitle: 'Team Meeting', prompt: 'Create a staff notice about an upcoming team meeting:' },
      { id: 'policy-update', shortTitle: 'Policy Update', prompt: 'Create a staff notice about a policy or procedure update:' },
      { id: 'holiday-cover', shortTitle: 'Holiday Cover', prompt: 'Create a staff notice about holiday cover arrangements:' },
      { id: 'new-system', shortTitle: 'New System', prompt: 'Create a staff notice about a new IT system or process:' },
      { id: 'reminder', shortTitle: 'Reminder', prompt: 'Create a staff reminder notice:' },
    ],
  },
  {
    id: 'calendar',
    shortTitle: 'Calendar',
    description: 'Clinic schedules and training calendars',
    icon: Calendar,
    gradient: 'from-indigo-500 to-indigo-600',
    prompts: [
      { id: 'clinic-schedule', shortTitle: 'Clinic Times', prompt: 'Create a weekly clinic schedule showing specialist clinics and times:' },
      { id: 'vaccine-calendar', shortTitle: 'Vaccine Schedule', prompt: 'Create a childhood immunisation schedule calendar:' },
      { id: 'training-calendar', shortTitle: 'Training', prompt: 'Create a quarterly training calendar for mandatory training:' },
      { id: 'bank-holidays', shortTitle: 'Bank Holidays', prompt: 'Create a calendar showing practice opening hours over bank holidays:' },
    ],
  },
  {
    id: 'qr-code',
    shortTitle: 'QR Code',
    description: 'QR codes linking to resources',
    icon: QrCode,
    gradient: 'from-slate-500 to-slate-600',
    prompts: [
      { id: 'website-qr', shortTitle: 'Website', prompt: 'Create a QR code poster linking to our practice website:' },
      { id: 'feedback-qr', shortTitle: 'Feedback', prompt: 'Create a QR code poster for our online feedback form:' },
      { id: 'nhs-app-qr', shortTitle: 'NHS App', prompt: 'Create a QR code poster linking to the NHS App download page:' },
    ],
  },
  {
    id: 'custom',
    shortTitle: 'Custom',
    description: 'Describe any image you need',
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    prompts: [], // Empty = skip third level, insert directly
  },
];

// Direct prompt for categories that skip the third level
export const customImagePrompt = 'Create a professional NHS-style image for my practice. I want:';

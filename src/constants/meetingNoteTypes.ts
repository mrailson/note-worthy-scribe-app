export interface MeetingNoteType {
  id: string;
  label: string;
  description: string;
  iconName: 'FileText' | 'Award' | 'Stethoscope' | 'Target' | 'GraduationCap' | 'Heart';
}

export const MEETING_NOTE_TYPES: MeetingNoteType[] = [
  { 
    id: 'standard', 
    label: 'Standard', 
    description: 'Full structured format with Context, Discussion, Agreed, Implication',
    iconName: 'FileText'
  },
  { 
    id: 'nhs-formal', 
    label: 'NHS Formal', 
    description: 'Shorter, formal key points — ideal for board packs and ICB circulation',
    iconName: 'Award'
  },
  { 
    id: 'clinical', 
    label: 'Clinical Notes', 
    description: 'SOAP-style format for MDT and clinical governance meetings',
    iconName: 'Stethoscope'
  },
  { 
    id: 'action-focused', 
    label: 'Action-Focused', 
    description: 'Minimal narrative — leads with decisions and actions for busy executives',
    iconName: 'Target'
  },
  { 
    id: 'educational', 
    label: 'Educational/CPD', 
    description: 'Learning objectives, takeaways, and CPD portfolio statement',
    iconName: 'GraduationCap'
  },
  { 
    id: 'ageing-well', 
    label: 'Ageing Well', 
    description: 'Comprehensive frailty review — History & Plan for EMIS/SystmOne',
    iconName: 'Heart'
  }
];

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
    description: 'Balanced professional format for general meetings',
    iconName: 'FileText'
  },
  { 
    id: 'nhs-formal', 
    label: 'NHS Formal', 
    description: 'Board-ready governance documents, CQC-compliant',
    iconName: 'Award'
  },
  { 
    id: 'clinical', 
    label: 'Clinical Notes', 
    description: 'SOAP-style format for clinical team meetings',
    iconName: 'Stethoscope'
  },
  { 
    id: 'action-focused', 
    label: 'Action-Focused', 
    description: 'Emphasis on decisions and action items',
    iconName: 'Target'
  },
  { 
    id: 'educational', 
    label: 'Educational/CPD', 
    description: 'Learning objectives and key takeaways',
    iconName: 'GraduationCap'
  },
  { 
    id: 'ageing-well', 
    label: 'Ageing Well', 
    description: 'CGA/Frailty review – History & Plan format',
    iconName: 'Heart'
  }
];

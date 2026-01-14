// NHS and custom colour palettes for AI4GP Image Studio

export interface ColourPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export const NHS_PALETTES: ColourPalette[] = [
  {
    id: 'nhs-classic',
    name: 'NHS Classic',
    primary: '#005EB8',
    secondary: '#003087',
    accent: '#41B6E6',
    background: '#FFFFFF',
    text: '#231F20'
  },
  {
    id: 'nhs-warm',
    name: 'NHS Warm',
    primary: '#005EB8',
    secondary: '#78BE20',
    accent: '#FAE100',
    background: '#F0F4F5',
    text: '#231F20'
  },
  {
    id: 'nhs-emergency',
    name: 'NHS Emergency',
    primary: '#DA291C',
    secondary: '#005EB8',
    accent: '#FAE100',
    background: '#FFFFFF',
    text: '#231F20'
  },
  {
    id: 'calm-health',
    name: 'Calm Health',
    primary: '#00A499',
    secondary: '#006747',
    accent: '#AE2573',
    background: '#FFFFFF',
    text: '#231F20'
  },
  {
    id: 'wellbeing',
    name: 'Wellbeing',
    primary: '#78BE20',
    secondary: '#00A499',
    accent: '#7C2855',
    background: '#F0F4F5',
    text: '#231F20'
  },
  {
    id: 'mental-health',
    name: 'Mental Health',
    primary: '#330072',
    secondary: '#7C2855',
    accent: '#00A499',
    background: '#FFFFFF',
    text: '#231F20'
  },
  {
    id: 'child-health',
    name: 'Child & Family',
    primary: '#41B6E6',
    secondary: '#78BE20',
    accent: '#FAE100',
    background: '#FFFFFF',
    text: '#231F20'
  },
  {
    id: 'senior-health',
    name: 'Senior Health',
    primary: '#003087',
    secondary: '#005EB8',
    accent: '#768692',
    background: '#F0F4F5',
    text: '#231F20'
  }
];

export const STYLE_PRESETS = [
  {
    id: 'nhs-professional',
    name: 'NHS Professional',
    description: 'Clean, authoritative NHS look with blues and whites',
    defaultPalette: 'nhs-classic'
  },
  {
    id: 'modern-minimal',
    name: 'Modern Minimalist',
    description: 'Clean lines, plenty of white space, subtle colours',
    defaultPalette: 'calm-health'
  },
  {
    id: 'friendly-welcoming',
    name: 'Friendly & Welcoming',
    description: 'Warm colours, approachable design for patients',
    defaultPalette: 'nhs-warm'
  },
  {
    id: 'bold-impactful',
    name: 'Bold & Impactful',
    description: 'High contrast, eye-catching for campaigns',
    defaultPalette: 'nhs-emergency'
  },
  {
    id: 'clinical-medical',
    name: 'Clinical/Medical',
    description: 'Professional medical aesthetic with trust signals',
    defaultPalette: 'nhs-classic'
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Define your own colours and style',
    defaultPalette: null
  }
] as const;

export const TARGET_AUDIENCES = [
  { id: 'patients', label: 'Patients', description: 'General patient population' },
  { id: 'staff', label: 'Staff', description: 'Practice/healthcare staff' },
  { id: 'public', label: 'General Public', description: 'Community awareness' },
  { id: 'clinical', label: 'Clinical', description: 'Healthcare professionals' },
  { id: 'elderly', label: 'Elderly', description: 'Senior patients (65+)' },
  { id: 'parents', label: 'Parents/Carers', description: 'Parents and carers of patients' },
  { id: 'young-adults', label: 'Young Adults', description: 'Age 18-35' }
] as const;

export const PURPOSE_TYPES = [
  { id: 'poster', label: 'Poster', description: 'A4/A3 print poster', aspectRatio: '3:4' },
  { id: 'social', label: 'Social Media', description: 'Facebook, Instagram, X', aspectRatio: '1:1' },
  { id: 'leaflet', label: 'Leaflet', description: 'Patient information leaflet', aspectRatio: '3:4' },
  { id: 'newsletter', label: 'Newsletter', description: 'Practice newsletter header', aspectRatio: '16:9' },
  { id: 'banner', label: 'Banner', description: 'Website or email banner', aspectRatio: '16:9' },
  { id: 'waiting-room', label: 'Waiting Room Display', description: 'TV screen display', aspectRatio: '16:9' },
  { id: 'infographic', label: 'Infographic', description: 'Data visualisation', aspectRatio: '9:16' },
  { id: 'campaign', label: 'Campaign', description: 'Health campaign material', aspectRatio: '1:1' },
  { id: 'form-header', label: 'Letterhead', description: 'Document header/logo', aspectRatio: '4:1' },
  { id: 'general', label: 'General', description: 'Custom purpose', aspectRatio: '1:1' }
] as const;

export const LAYOUT_OPTIONS = [
  { id: 'portrait', label: 'Portrait', description: 'A4/Poster style', ratio: '3:4' },
  { id: 'landscape', label: 'Landscape', description: 'Banner/Screen style', ratio: '16:9' },
  { id: 'square', label: 'Square', description: 'Social media style', ratio: '1:1' }
] as const;

export const LOGO_PLACEMENTS = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'reserve-space', label: 'Reserve Space (add manually)' }
] as const;

export const REFERENCE_MODES = [
  { 
    id: 'style-reference', 
    label: 'Create Similar', 
    description: 'Use as style/layout inspiration' 
  },
  { 
    id: 'edit-source', 
    label: 'Edit This Image', 
    description: 'Modify the uploaded image directly' 
  },
  { 
    id: 'update-previous', 
    label: 'Update Previous Result', 
    description: 'Refine your last generated image' 
  }
] as const;

export const CUSTOM_PALETTE_DEFAULTS: ColourPalette = {
  id: 'custom',
  name: 'Custom',
  primary: '#005EB8',
  secondary: '#003087',
  accent: '#41B6E6',
  background: '#FFFFFF',
  text: '#231F20'
};

export type StylePresetId = typeof STYLE_PRESETS[number]['id'];
export type TargetAudienceId = typeof TARGET_AUDIENCES[number]['id'];
export type PurposeTypeId = typeof PURPOSE_TYPES[number]['id'];
export type LayoutOptionId = typeof LAYOUT_OPTIONS[number]['id'];
export type LogoPlacementId = typeof LOGO_PLACEMENTS[number]['id'];
export type ReferenceModeId = typeof REFERENCE_MODES[number]['id'];

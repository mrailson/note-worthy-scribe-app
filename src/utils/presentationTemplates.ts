export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingColor: string;
  footerColor: string;
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  preview: string;
  style: 'professional' | 'modern' | 'clean' | 'bright' | 'dark' | 'custom';
  backgroundImage?: string; // Base64 encoded background image
}

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: 'nhs-professional',
    name: 'NHS Professional',
    description: 'Classic NHS branding with professional blue theme',
    primaryColor: '#005EB8',
    secondaryColor: '#E8F4FD',
    accentColor: '#0072CE',
    backgroundColor: '#FFFFFF',
    textColor: '#333333',
    headingColor: '#005EB8',
    footerColor: '#666666',
    gradients: {
      primary: 'linear-gradient(135deg, #005EB8, #0072CE)',
      secondary: 'linear-gradient(180deg, #E8F4FD, #F0F8FF)',
      accent: 'linear-gradient(45deg, #005EB8, #003D7A)'
    },
    fonts: {
      heading: 'Calibri',
      body: 'Calibri'
    },
    preview: 'Traditional NHS theme with formal presentation layout',
    style: 'professional'
  },
  {
    id: 'nhs-modern',
    name: 'NHS Modern',
    description: 'Contemporary NHS design with gradient accents',
    primaryColor: '#003087',
    secondaryColor: '#41B6E6',
    accentColor: '#8FBC8F',
    backgroundColor: '#FAFBFC',
    textColor: '#2D3748',
    headingColor: '#003087',
    footerColor: '#718096',
    gradients: {
      primary: 'linear-gradient(135deg, #003087, #41B6E6)',
      secondary: 'linear-gradient(180deg, #41B6E6, #87CEEB)',
      accent: 'linear-gradient(45deg, #8FBC8F, #98FB98)'
    },
    fonts: {
      heading: 'Segoe UI',
      body: 'Segoe UI'
    },
    preview: 'Modern gradient design with contemporary layout',
    style: 'modern'
  },
  {
    id: 'clinical-clean',
    name: 'Clinical Clean',
    description: 'Minimalist white and grey theme for medical content',
    primaryColor: '#2D3748',
    secondaryColor: '#F7FAFC',
    accentColor: '#4299E1',
    backgroundColor: '#FFFFFF',
    textColor: '#4A5568',
    headingColor: '#2D3748',
    footerColor: '#A0AEC0',
    gradients: {
      primary: 'linear-gradient(135deg, #2D3748, #4A5568)',
      secondary: 'linear-gradient(180deg, #F7FAFC, #EDF2F7)',
      accent: 'linear-gradient(45deg, #4299E1, #63B3ED)'
    },
    fonts: {
      heading: 'Roboto',
      body: 'Roboto'
    },
    preview: 'Clean minimalist design with subtle medical aesthetics',
    style: 'clean'
  },
  {
    id: 'educational-bright',
    name: 'Educational Bright',
    description: 'Colorful and engaging design for patient education',
    primaryColor: '#2B6CB0',
    secondaryColor: '#FED7D7',
    accentColor: '#38A169',
    backgroundColor: '#FFFAF0',
    textColor: '#2D3748',
    headingColor: '#2B6CB0',
    footerColor: '#4A5568',
    gradients: {
      primary: 'linear-gradient(135deg, #2B6CB0, #3182CE)',
      secondary: 'linear-gradient(180deg, #FED7D7, #FEE2E2)',
      accent: 'linear-gradient(45deg, #38A169, #48BB78)'
    },
    fonts: {
      heading: 'Open Sans',
      body: 'Open Sans'
    },
    preview: 'Bright and engaging design perfect for patient education',
    style: 'bright'
  },
  {
    id: 'executive-dark',
    name: 'Executive Dark',
    description: 'Professional dark theme for board presentations',
    primaryColor: '#4A90E2',
    secondaryColor: '#2D3748',
    accentColor: '#ED8936',
    backgroundColor: '#1A202C',
    textColor: '#E2E8F0',
    headingColor: '#4A90E2',
    footerColor: '#A0AEC0',
    gradients: {
      primary: 'linear-gradient(135deg, #4A90E2, #5A67D8)',
      secondary: 'linear-gradient(180deg, #2D3748, #4A5568)',
      accent: 'linear-gradient(45deg, #ED8936, #F6AD55)'
    },
    fonts: {
      heading: 'Montserrat',
      body: 'Montserrat'
    },
    preview: 'Sophisticated dark theme for executive presentations',
    style: 'dark'
  }
];

export const getTemplateById = (id: string): PresentationTemplate | undefined => {
  return PRESENTATION_TEMPLATES.find(template => template.id === id);
};

export const getTemplateByStyle = (style: PresentationTemplate['style']): PresentationTemplate[] => {
  return PRESENTATION_TEMPLATES.filter(template => template.style === style);
};
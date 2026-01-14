// Presentation Studio types for PowerPoint generation

import type { ColourPalette } from '@/utils/colourPalettes';
import type { PracticeContext } from '@/types/ai4gp';
import type { BrandingLevel, CustomBrandingOptions } from '@/components/ai4gp/ImageBrandingDialog';

// Presentation Types
export const PRESENTATION_TYPES = [
  { id: 'executive-overview', label: 'Executive Overview', description: 'Strategic insights and key decisions' },
  { id: 'training-materials', label: 'Training Materials', description: 'Staff training and education' },
  { id: 'clinical-guidelines', label: 'Clinical Guidelines', description: 'Evidence-based recommendations' },
  { id: 'patient-education', label: 'Patient Education', description: 'Patient-friendly information' },
  { id: 'board-meeting', label: 'Board Meeting', description: 'PCN/Partnership board presentation' },
  { id: 'research-presentation', label: 'Research', description: 'Academic findings and analysis' },
  { id: 'project-update', label: 'Project Update', description: 'Progress reports and milestones' },
  { id: 'custom', label: 'Custom', description: 'Custom presentation topic' },
] as const;

export const TARGET_AUDIENCES = [
  { id: 'board-members', label: 'Board/Executives', description: 'Senior decision makers' },
  { id: 'staff', label: 'Practice Staff', description: 'Clinical and admin team' },
  { id: 'clinical', label: 'Clinical Team', description: 'Healthcare professionals' },
  { id: 'patients', label: 'Patients', description: 'Patient education' },
  { id: 'stakeholders', label: 'Stakeholders', description: 'External partners' },
  { id: 'general', label: 'General', description: 'Mixed audience' },
] as const;

// Slide Type Definitions
export const SLIDE_TYPES = [
  { id: 'title', label: 'Title Slide', description: 'Opening slide with main topic', defaultOrder: 1, required: true },
  { id: 'executive-summary', label: 'Executive Summary', description: 'Key takeaways overview', defaultOrder: 2, required: false },
  { id: 'agenda', label: 'Agenda/Contents', description: 'Presentation outline', defaultOrder: 3, required: false },
  { id: 'key-metrics', label: 'Key Metrics', description: 'Data and statistics dashboard', defaultOrder: 4, required: false },
  { id: 'insights', label: 'Insights/Analysis', description: 'Detailed findings and analysis', defaultOrder: 5, required: false },
  { id: 'recommendations', label: 'Recommendations', description: 'Action items and suggestions', defaultOrder: 6, required: false },
  { id: 'timeline', label: 'Timeline/Next Steps', description: 'Implementation roadmap', defaultOrder: 7, required: false },
  { id: 'challenges', label: 'Challenges/Risks', description: 'Issues and mitigation strategies', defaultOrder: 8, required: false },
  { id: 'questions', label: 'Q&A/Discussion', description: 'Questions and discussion points', defaultOrder: 9, required: false },
  { id: 'appendix', label: 'Appendix', description: 'Supporting materials', defaultOrder: 10, required: false },
] as const;

// Template Definitions
export const PRESENTATION_TEMPLATES = [
  { id: 'nhs-professional', name: 'NHS Professional', description: 'Clean, authoritative NHS look', preview: 'blue' },
  { id: 'modern-minimal', name: 'Modern Minimal', description: 'Clean lines, white space', preview: 'white' },
  { id: 'executive-dark', name: 'Executive Dark', description: 'Dark theme for impact', preview: 'dark' },
  { id: 'clinical-clean', name: 'Clinical Clean', description: 'Medical professional style', preview: 'teal' },
  { id: 'friendly-warm', name: 'Friendly & Warm', description: 'Approachable design', preview: 'warm' },
] as const;

// Font Styles
export const FONT_STYLES = [
  { id: 'professional', name: 'Professional', fontFamily: 'Calibri, sans-serif' },
  { id: 'modern', name: 'Modern', fontFamily: 'Arial, sans-serif' },
  { id: 'elegant', name: 'Elegant', fontFamily: 'Georgia, serif' },
  { id: 'clean', name: 'Clean', fontFamily: 'Helvetica, sans-serif' },
] as const;

// Logo Placement Options
export const LOGO_PLACEMENTS = [
  { id: 'header-left', label: 'Header Left' },
  { id: 'header-right', label: 'Header Right' },
  { id: 'header-center', label: 'Header Centre' },
  { id: 'footer-left', label: 'Footer Left' },
  { id: 'footer-right', label: 'Footer Right' },
  { id: 'none', label: 'No Logo' },
] as const;

// Complexity Levels
export const COMPLEXITY_LEVELS = [
  { id: 'basic', label: 'Basic', description: '2-3 bullets per slide, simple language' },
  { id: 'intermediate', label: 'Intermediate', description: '3-4 bullets, balanced detail' },
  { id: 'advanced', label: 'Advanced', description: '4-5 bullets, comprehensive' },
] as const;

// Slide Count Presets
export const SLIDE_COUNT_PRESETS = [
  { label: 'Quick (5-6)', min: 5, max: 6, description: 'Brief overview' },
  { label: 'Standard (8-10)', min: 8, max: 10, description: 'Typical presentation' },
  { label: 'Comprehensive (12-15)', min: 12, max: 15, description: 'Detailed coverage' },
  { label: 'Custom', min: 3, max: 20, description: 'Choose your own' },
] as const;

// Type IDs
export type PresentationTypeId = typeof PRESENTATION_TYPES[number]['id'];
export type TargetAudienceId = typeof TARGET_AUDIENCES[number]['id'];
export type SlideTypeId = typeof SLIDE_TYPES[number]['id'];
export type TemplateId = typeof PRESENTATION_TEMPLATES[number]['id'];
export type FontStyleId = typeof FONT_STYLES[number]['id'];
export type LogoPlacementId = typeof LOGO_PLACEMENTS[number]['id'];
export type ComplexityLevel = typeof COMPLEXITY_LEVELS[number]['id'];

// Supporting Document
export interface SupportingDocument {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  selected: boolean;
  preview?: string;
}

// Slide Type Selection
export interface SlideTypeSelection {
  type: SlideTypeId;
  enabled: boolean;
  order: number;
}

// Main Settings Interface
export interface PresentationStudioSettings {
  // Content & Sources
  topic: string;
  presentationType: PresentationTypeId;
  targetAudience: TargetAudienceId;
  keyPoints: string[];
  supportingDocuments: SupportingDocument[];
  
  // Style & Design
  templateId: TemplateId;
  colourPalette: ColourPalette;
  fontStyle: FontStyleId;
  useCustomColours: boolean;
  
  // Branding & Logo
  includeBranding: boolean;
  brandingLevel: BrandingLevel;
  logoImage: string | null;
  logoPlacement: LogoPlacementId;
  includeFooterDate: boolean;
  includePageNumbers: boolean;
  customFooterText: string;
  
  // Slides Configuration
  slideCount: number;
  slideTypes: SlideTypeSelection[];
  complexityLevel: ComplexityLevel;
  generateImages: boolean;
  includeSpeakerNotes: boolean;
  includeVoiceover: boolean;
  voiceId: string;
}

// Generation Progress Phase
export type GenerationPhase = 
  | 'idle'
  | 'preparing'
  | 'analyzing-documents'
  | 'generating-content'
  | 'creating-slides'
  | 'generating-images'
  | 'generating-audio'
  | 'packaging'
  | 'complete'
  | 'error';

// Generated Presentation Result
export interface GeneratedPresentation {
  id: string;
  title: string;
  slideCount: number;
  downloadUrl?: string;
  pptxBase64?: string;
  gammaUrl?: string;
  hasVoiceover: boolean;
  generatedAt: Date;
}

// Generation History Item
export interface PresentationHistoryItem {
  id: string;
  timestamp: Date;
  settings: Partial<PresentationStudioSettings>;
  result: GeneratedPresentation;
}

// Studio State
export interface PresentationStudioState {
  settings: PresentationStudioSettings;
  activeTab: 'content' | 'style' | 'branding' | 'slides' | 'generate';
  isGenerating: boolean;
  generationPhase: GenerationPhase;
  generationProgress: number;
  currentResult: GeneratedPresentation | null;
  generationHistory: PresentationHistoryItem[];
  error: string | null;
}

// Request payload for edge function
export interface PresentationStudioRequest {
  topic: string;
  presentationType: PresentationTypeId;
  targetAudience: TargetAudienceId;
  keyPoints?: string[];
  slideCount: number;
  complexityLevel: ComplexityLevel;
  slideTypes?: SlideTypeId[];
  templateId: TemplateId;
  // Theme settings for Gamma API
  themeId?: string;
  themeSource?: 'gamma' | 'local';
  localThemeStyle?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    themeName: string;
  };
  // Legacy colour palette (still supported)
  colourPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fontStyle?: FontStyleId;
  generateImages?: boolean;
  includeSpeakerNotes?: boolean;
  includeVoiceover?: boolean;
  voiceId?: string;
  practiceContext?: PracticeContext;
  brandingLevel?: BrandingLevel;
  logoPlacement?: LogoPlacementId;
  customFooterText?: string;
  includeFooterDate?: boolean;
  includePageNumbers?: boolean;
  supportingFiles?: {
    name: string;
    content: string;
    type: string;
  }[];
  isStudioRequest: true;
}

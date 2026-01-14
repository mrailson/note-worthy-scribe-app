import type { 
  StylePresetId, 
  TargetAudienceId, 
  PurposeTypeId, 
  LayoutOptionId, 
  LogoPlacementId,
  ReferenceModeId,
  ColourPalette 
} from '@/utils/colourPalettes';
import type { PracticeContext, GeneratedImage } from '@/types/ai4gp';
import type { BrandingLevel, CustomBrandingOptions } from '@/components/ai4gp/ImageBrandingDialog';

export interface ImageStudioSettings {
  // Context & Content
  description: string;
  supportingContent: string;
  keyMessages: string[];
  targetAudience: TargetAudienceId;
  purpose: PurposeTypeId;
  
  // Style & Design
  stylePreset: StylePresetId;
  colourPalette: ColourPalette;
  layoutPreference: LayoutOptionId;
  
  // Branding & Logo
  brandingLevel: BrandingLevel;
  customBranding: CustomBrandingOptions;
  logoPlacement: LogoPlacementId;
  includeLogo: boolean;
  
  // Reference Images
  referenceImages: ReferenceImage[];
  referenceMode: ReferenceModeId;
  referenceInstructions: string;
}

export interface ReferenceImage {
  id: string;
  name: string;
  content: string;  // Base64 or data URL
  type: string;     // MIME type
  mode: ReferenceModeId;
  preview?: string; // Thumbnail URL
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: Date;
  settings: Partial<ImageStudioSettings>;
  result: GeneratedImage;
}

export interface ImageStudioState {
  settings: ImageStudioSettings;
  activeTab: 'context' | 'style' | 'branding' | 'reference' | 'generate';
  isGenerating: boolean;
  generationProgress: number;
  currentResult: GeneratedImage | null;
  generationHistory: GenerationHistoryItem[];
  error: string | null;
}

export interface ImageStudioRequest {
  // Context
  prompt: string;
  supportingContent?: string;
  keyMessages?: string[];
  targetAudience?: TargetAudienceId;
  purpose?: PurposeTypeId;
  
  // Style
  stylePreset?: StylePresetId;
  colourPalette?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  layoutPreference?: LayoutOptionId;
  
  // Branding
  practiceContext?: PracticeContext;
  brandingLevel?: BrandingLevel;
  customBranding?: CustomBrandingOptions;
  logoPlacement?: LogoPlacementId;
  includeLogo?: boolean;
  
  // Reference images
  referenceImages?: {
    content: string;
    type: string;
    mode: ReferenceModeId;
    instructions?: string;
  }[];
  
  // Model selection
  imageModel?: 'google/gemini-2.5-flash-image' | 'google/gemini-3-pro-image-preview' | 'openai/gpt-image-1';
  
  // Studio mode flag
  isStudioRequest: true;
}

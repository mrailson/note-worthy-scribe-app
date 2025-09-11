export interface SlideContent {
  title: string;
  type: string;
  content: string[];
  notes?: string;
  meetingSection?: string;
}

export interface PresentationContent {
  title: string;
  slides: SlideContent[];
}

export interface GenerationMetadata {
  topic: string;
  presentationType: string;
  slideCount: number;
  complexityLevel: string;
  generatedAt: string;
}

export interface PresentationGenerationOptions {
  topic: string;
  presentationType: string;
  slideCount?: number;
  complexityLevel?: string;
  templateId?: string;
  supportingFiles?: {
    name: string;
    content: string;
    type: string;
  }[];
}
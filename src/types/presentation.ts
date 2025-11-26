export interface SlideAnimation {
  type: 'none' | 'fade' | 'slide' | 'zoom' | 'appear';
  duration: number;
  delay: number;
  elementOrder: boolean; // true for sequential, false for simultaneous
}

export interface MetricData {
  value: string;
  label: string;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: string;
}

export interface ActionItem {
  priority: number;
  action: string;
  owner?: string;
  deadline?: string;
}

export interface TimelineStep {
  phase: string;
  duration: string;
  description: string;
}

export interface SlideContent {
  title: string;
  type: string;
  content: string[];
  notes?: string;
  meetingSection?: string;
  animation?: SlideAnimation;
  imageDescription?: string;
  metrics?: MetricData[];
  actions?: ActionItem[];
  timeline?: TimelineStep[];
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
  backgroundImage?: string; // Base64 encoded background image
  animations?: SlideAnimation[];
  globalAnimation?: SlideAnimation; // Applied to all content slides
  titleFontSize?: number;
  contentFontSize?: number;
  supportingFiles?: {
    name: string;
    content: string;
    type: string;
  }[];
}
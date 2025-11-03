export interface StyleDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
  systemPrompt: string;
}

export interface StylePreview {
  key: string;
  content: string;
  generatedAt: string;
}

export interface StylePreviewsCache {
  previews: Record<string, string>;
  generated_at: string;
  transcript_hash: string;
}

export interface GenerationProgress {
  current: number;
  total: number;
  currentStyle: string;
}

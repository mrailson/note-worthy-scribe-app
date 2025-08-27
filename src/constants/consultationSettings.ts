import { OutputLevel } from "@/types/gpscribe";

export const OUTPUT_LEVELS: OutputLevel[] = [
  { value: 1, label: "Code", description: "GP shorthand only (e.g., 'URTI, 2/7, safety-netted')" },
  { value: 2, label: "Brief", description: "Concise summary with key points" },
  { value: 3, label: "Standard", description: "Complete clinical note" },
  { value: 4, label: "Detailed", description: "Comprehensive with examination findings" },
  { value: 5, label: "Full", description: "Complete with patient quotes and context" }
];

export const DEFAULT_SETTINGS = {
  outputLevel: 3,
  showSnomedCodes: true,
  formatForEmis: true,
  formatForSystmOne: false,
  autoGuidance: true,
  autoSpeak: true,
  tickerEnabled: false,
  showTranscriptTimestamps: true
};
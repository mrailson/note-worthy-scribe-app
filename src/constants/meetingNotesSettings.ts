export interface MeetingDetailLevel {
  value: number;
  label: string;
  description: string;
}

export const MEETING_DETAIL_LEVELS: MeetingDetailLevel[] = [
  { value: 1, label: "Brief", description: "Key decisions and actions only" },
  { value: 2, label: "Summary", description: "Concise summary with main points" },
  { value: 3, label: "Standard", description: "Complete meeting notes" },
  { value: 4, label: "Detailed", description: "Comprehensive with full context" },
  { value: 5, label: "Full", description: "Complete with quotes and timestamps" }
];

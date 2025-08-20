export interface MeetingData {
  id?: string;
  title: string;
  duration: string;
  wordCount: number;
  transcript: string;
  speakerCount: number;
  startTime: string;
  practiceName?: string;
  practiceId?: string;
  meetingFormat?: string;
  generatedNotes?: string;
  mixedAudioBlob?: Blob;
  leftAudioBlob?: Blob;
  rightAudioBlob?: Blob;
  startedBy?: string;
  needsAudioBackup?: boolean;
  audioBackupBlob?: Blob | null;
}

export interface MeetingSettingsState {
  title: string;
  description: string;
  meetingType: string;
  meetingStyle: string;
  attendees: string;
  agenda: string;
  date?: string;
  startTime?: string;
  format?: 'face-to-face' | 'online' | '' | undefined;
  location?: string;
}

export interface SummaryContent {
  attendees: string;
  agenda: string;
  keyPoints: string;
  decisions: string;
  actionItems: string;
  nextSteps: string;
  additionalNotes: string;
}

export interface AudioBackupInfo {
  file_path: string;
  file_size: number;
  meeting_id: string;
}

export interface CleanProgress {
  done: number;
  total: number;
}
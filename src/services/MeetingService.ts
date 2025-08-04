import { supabase } from '@/integrations/supabase/client';
import { TranscriptData } from './TranscriptionService';

export interface MeetingData {
  id?: string;
  title: string;
  description?: string;
  meetingType: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  transcript: string;
  wordCount: number;
  speakerCount: number;
  attendees?: string;
  agenda?: string;
  location?: string;
  format?: string;
}

export interface MeetingServiceCallbacks {
  onMeetingSaved?: (meetingId: string) => void;
  onError?: (error: string) => void;
}

export class MeetingService {
  private callbacks: MeetingServiceCallbacks;
  private currentMeetingId: string | null = null;
  private transcriptSegments: TranscriptData[] = [];

  constructor(callbacks: MeetingServiceCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async createMeeting(meetingData: Omit<MeetingData, 'id'>): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: meetingData.title,
          description: meetingData.description,
          meeting_type: meetingData.meetingType,
          start_time: meetingData.startTime,
          end_time: meetingData.endTime,
          duration_minutes: Math.round(meetingData.duration / 60),
          status: meetingData.status,
          attendees: meetingData.attendees,
          agenda: meetingData.agenda,
          location: meetingData.location,
          format: meetingData.format
        })
        .select('id')
        .single();

      if (error) throw error;

      this.currentMeetingId = data.id;
      this.callbacks.onMeetingSaved?.(data.id);
      
      return data.id;

    } catch (error) {
      this.callbacks.onError?.(`Failed to create meeting: ${error}`);
      throw error;
    }
  }

  async updateMeeting(meetingId: string, updates: Partial<MeetingData>): Promise<void> {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          title: updates.title,
          description: updates.description,
          meeting_type: updates.meetingType,
          end_time: updates.endTime,
          duration_minutes: updates.duration ? Math.round(updates.duration / 60) : undefined,
          status: updates.status,
          attendees: updates.attendees,
          agenda: updates.agenda,
          location: updates.location,
          format: updates.format
        })
        .eq('id', meetingId);

      if (error) throw error;

    } catch (error) {
      this.callbacks.onError?.(`Failed to update meeting: ${error}`);
      throw error;
    }
  }

  async addTranscriptSegment(transcriptData: TranscriptData): Promise<void> {
    if (!this.currentMeetingId) {
      console.warn('No active meeting to add transcript to');
      return;
    }

    try {
      // Store the segment locally
      this.transcriptSegments.push(transcriptData);

      // Only save final transcripts to database
      if (transcriptData.isFinal) {
        const { error } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: this.currentMeetingId,
            speaker: transcriptData.speaker,
            content: transcriptData.text,
            confidence: transcriptData.confidence,
            timestamp_seconds: this.getTimestampInSeconds(transcriptData.timestamp),
            is_final: transcriptData.isFinal
          });

        if (error) throw error;
      }

    } catch (error) {
      this.callbacks.onError?.(`Failed to save transcript: ${error}`);
    }
  }

  async saveMeetingAudio(meetingId: string, audioBlob: Blob): Promise<string | null> {
    try {
      const fileName = `${meetingId}_audio_${Date.now()}.webm`;
      const filePath = `${meetingId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('meeting-audio-backups')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      // Update meeting with audio backup path
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          audio_backup_path: filePath,
          audio_backup_created_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (updateError) throw updateError;

      return filePath;

    } catch (error) {
      this.callbacks.onError?.(`Failed to save meeting audio: ${error}`);
      return null;
    }
  }

  async loadMeeting(meetingId: string): Promise<MeetingData | null> {
    try {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;

      // Load transcripts
      const { data: transcripts, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_seconds', { ascending: true });

      if (transcriptError) throw transcriptError;

      const fullTranscript = transcripts?.map(t => t.content).join('\n') || '';
      const wordCount = fullTranscript.split(' ').filter(word => word.length > 0).length;

      return {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        meetingType: meeting.meeting_type,
        startTime: meeting.start_time,
        endTime: meeting.end_time,
        duration: (meeting.duration_minutes || 0) * 60,
        status: meeting.status as 'scheduled' | 'in-progress' | 'completed' | 'cancelled',
        transcript: fullTranscript,
        wordCount,
        speakerCount: this.calculateSpeakerCount(transcripts || []),
        attendees: (meeting as any).attendees || '',
        agenda: (meeting as any).agenda || '',
        location: (meeting as any).location || '',
        format: (meeting as any).format || ''
      };

    } catch (error) {
      this.callbacks.onError?.(`Failed to load meeting: ${error}`);
      return null;
    }
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      // Delete transcripts first
      const { error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', meetingId);

      if (transcriptError) throw transcriptError;

      // Delete meeting
      const { error: meetingError } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (meetingError) throw meetingError;

    } catch (error) {
      this.callbacks.onError?.(`Failed to delete meeting: ${error}`);
      throw error;
    }
  }

  // Auto-save functionality
  autoSaveToLocalStorage(meetingData: Partial<MeetingData>): void {
    try {
      const autoSaveData = {
        ...meetingData,
        lastSaved: Date.now()
      };
      localStorage.setItem('autoSavedMeeting', JSON.stringify(autoSaveData));
    } catch (error) {
      console.warn('Failed to auto-save to localStorage:', error);
    }
  }

  loadAutoSavedMeeting(): Partial<MeetingData> | null {
    try {
      const saved = localStorage.getItem('autoSavedMeeting');
      if (!saved) return null;

      const data = JSON.parse(saved);
      // Check if auto-save is recent (within 24 hours)
      if (Date.now() - data.lastSaved > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('autoSavedMeeting');
        return null;
      }

      return data;
    } catch (error) {
      console.warn('Failed to load auto-saved meeting:', error);
      return null;
    }
  }

  clearAutoSavedMeeting(): void {
    localStorage.removeItem('autoSavedMeeting');
  }

  // Helper methods
  private getTimestampInSeconds(timestamp: string): number {
    return Math.floor(new Date(timestamp).getTime() / 1000);
  }

  private calculateSpeakerCount(transcripts: any[]): number {
    const speakers = new Set(transcripts.map(t => t.speaker));
    return speakers.size;
  }

  getCurrentMeetingId(): string | null {
    return this.currentMeetingId;
  }

  setCurrentMeetingId(meetingId: string | null): void {
    this.currentMeetingId = meetingId;
  }

  getTranscriptSegments(): TranscriptData[] {
    return [...this.transcriptSegments];
  }

  clearTranscriptSegments(): void {
    this.transcriptSegments = [];
  }
}
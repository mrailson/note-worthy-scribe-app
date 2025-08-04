import React from 'react';
import { EnhancedMeetingRecorder } from './EnhancedMeetingRecorder';

interface MeetingRecorderContainerProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const MeetingRecorderContainer = ({
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}: MeetingRecorderContainerProps) => {
  return (
    <EnhancedMeetingRecorder
      initialSettings={initialSettings}
      onTranscriptUpdate={onTranscriptUpdate}
      onDurationUpdate={onDurationUpdate}
      onWordCountUpdate={onWordCountUpdate}
    />
  );
};
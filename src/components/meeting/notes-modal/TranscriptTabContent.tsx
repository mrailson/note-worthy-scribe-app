import React from 'react';
import { EnhancedTranscriptionPanel } from "@/components/meeting/EnhancedTranscriptionPanel";
import { PaginatedTranscriptViewer } from "@/components/standalone/PaginatedTranscriptViewer";
import { BackupBadge } from "@/components/offline/BackupBadge";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  duration?: string;
}

interface TranscriptTabContentProps {
  meetingId: string;
  transcript: string;
  isLargeTranscript: boolean;
  meeting: Meeting | null;
  onTranscriptChange: (newTranscript: string) => void;
  onShowContextDialog: () => void;
}

export const TranscriptTabContent: React.FC<TranscriptTabContentProps> = ({
  meetingId,
  transcript,
  isLargeTranscript,
  meeting,
  onTranscriptChange,
  onShowContextDialog,
}) => {
  return (
    <div className="flex-1 overflow-hidden mt-0 bg-white h-full">
      {meetingId && (
        <div className="px-6 pt-4 pb-0">
          <BackupBadge meetingId={meetingId} />
        </div>
      )}
      {isLargeTranscript ? (
        <div className="flex flex-col h-full p-6">
          <PaginatedTranscriptViewer
            transcript={transcript}
            pageSize={5000}
            meetingContext={meeting}
            onAddContext={onShowContextDialog}
          />
        </div>
      ) : (
        <EnhancedTranscriptionPanel
          meetingId={meetingId}
          transcript={transcript || ''}
          onTranscriptChange={onTranscriptChange}
          meetingContext={meeting}
        />
      )}
    </div>
  );
};

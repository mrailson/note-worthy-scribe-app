import React from 'react';
import { EnhancedTranscriptionPanel } from "@/components/meeting/EnhancedTranscriptionPanel";
import { PaginatedTranscriptViewer } from "@/components/standalone/PaginatedTranscriptViewer";
import { SpeakerLabelledTranscript, hasSpeakerLabels } from "@/components/meeting/SpeakerLabelledTranscript";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const showSpeakerLabels = hasSpeakerLabels(transcript);

  return (
    <div className="flex-1 overflow-hidden mt-0 bg-white h-full">
      {showSpeakerLabels ? (
        <ScrollArea className="h-full p-6">
          <SpeakerLabelledTranscript transcript={transcript} />
        </ScrollArea>
      ) : isLargeTranscript ? (
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

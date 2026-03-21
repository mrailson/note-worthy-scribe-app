import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMeetingSetup } from './MeetingSetupContext';
import { ContextStatusPill } from './ContextStatusPill';

interface RecordingCompleteScreenProps {
  formatDuration: (seconds: number) => string;
  onStartNewMeeting: () => void;
}

export const RecordingCompleteScreen: React.FC<RecordingCompleteScreenProps> = ({
  formatDuration,
  onStartNewMeeting,
}) => {
  const {
    presentCount, apologiesCount, agendaItems, recordingDuration,
  } = useMeetingSetup();

  return (
    <div className="animate-fade-in text-center py-10">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-extrabold text-foreground mb-2">Recording Complete</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Transcription starting — your meeting context will be applied to the session report
      </p>

      {/* Final context summary */}
      <Card className="inline-flex gap-2.5 px-6 py-4 shadow-sm">
        <ContextStatusPill icon="⏱" label="Duration" color="#94A3B8" value={formatDuration(recordingDuration)} />
        <ContextStatusPill icon="👥" label="Present" color="#10B981" value={presentCount.toString()} />
        {apologiesCount > 0 && (
          <ContextStatusPill icon="📨" label="Apologies" color="#F59E0B" value={apologiesCount.toString()} />
        )}
        <ContextStatusPill icon="📋" label="Agenda" color="#3B82F6" value={`${agendaItems.length} items`} />
      </Card>

      <div className="mt-6">
        <Button
          variant="outline"
          onClick={onStartNewMeeting}
          className="text-xs font-semibold"
        >
          ← Start New Meeting
        </Button>
      </div>
    </div>
  );
};

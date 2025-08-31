import React from 'react';
import { MeetingRecorderV2 } from '@/components/meeting-recorder-v2/MeetingRecorderV2';

const MeetingRecorderV2Page = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground">Meeting Recorder V2</h1>
            <span className="px-2 py-1 text-xs font-medium bg-accent/20 text-accent-foreground rounded-md">
              Refactored
            </span>
          </div>
          <p className="text-muted-foreground">
            Clean, modular architecture with the same powerful features
          </p>
        </div>
        <MeetingRecorderV2
          onTranscriptUpdate={() => {}}
          onDurationUpdate={() => {}}
          onWordCountUpdate={() => {}}
        />
      </div>
    </div>
  );
};

export default MeetingRecorderV2Page;
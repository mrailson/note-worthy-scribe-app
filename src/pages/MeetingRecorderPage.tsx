import React, { useState } from 'react';
import { Header } from '@/components/Header';
import MeetingRecorder from '@/components/MeetingRecorder';
import { MeetingSettings } from '@/components/MeetingSettings';

const MeetingRecorderPage: React.FC = () => {
  const [meetingSettings, setMeetingSettings] = useState<any>(null);

  const handleSettingsChange = (settings: any) => {
    console.log('Meeting settings updated:', settings);
    setMeetingSettings(settings);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-6 space-y-6">
        <MeetingSettings 
          onSettingsChange={handleSettingsChange}
        />
        
        {meetingSettings && (
          <MeetingRecorder 
            initialSettings={{
              title: meetingSettings.title,
              description: meetingSettings.description,
              meetingType: meetingSettings.meetingType,
              attendees: meetingSettings.attendees,
              practiceId: meetingSettings.practiceId,
              meetingFormat: meetingSettings.format || 'teams',
              transcriberService: meetingSettings.transcriberService,
              transcriberThresholds: meetingSettings.transcriberThresholds
            }}
          />
        )}
      </main>
    </div>
  );
};

export default MeetingRecorderPage;
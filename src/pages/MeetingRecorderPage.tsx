import React from 'react';
import { Header } from '@/components/Header';
import MeetingRecorder from '@/components/MeetingRecorder';

const MeetingRecorderPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-6">
        <MeetingRecorder />
      </main>
    </div>
  );
};

export default MeetingRecorderPage;
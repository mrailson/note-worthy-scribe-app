import React from 'react';
import { Header } from '@/components/Header';
import { CompleteMeetingRecorder } from '@/components/CompleteMeetingRecorder';

const MeetingRecorderMVP = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <CompleteMeetingRecorder />
      </main>
    </div>
  );
};

export default MeetingRecorderMVP;
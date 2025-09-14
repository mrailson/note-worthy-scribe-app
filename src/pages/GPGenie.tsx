import React from 'react';
import { Header } from '@/components/Header';
import GPGenieVoiceAgent from '@/components/GPGenieVoiceAgent';

const GPGenie = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <GPGenieVoiceAgent initialTab="gp-genie" />
      </main>
    </div>
  );
};

export default GPGenie;
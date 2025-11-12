import React from 'react';
import { SEO } from '@/components/SEO';
import { Header } from '@/components/Header';
import GPGenieVoiceAgent from '@/components/GPGenieVoiceAgent';

const GPGenie = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="GPGenie | AI Voice Assistant for GP Practices | NoteWell AI"
        description="Multilingual voice translation service for GP consultations. Real-time patient communication support for over 100 languages, designed for NHS primary care."
        canonical="https://www.gpnotewell.co.uk/gp-genie"
        keywords="medical translation, patient communication, multilingual GP tool, NHS translation service, consultation interpreter"
      />
      <Header />
      <main className="container mx-auto px-4 py-6">
        <GPGenieVoiceAgent initialTab="gp-genie" />
      </main>
    </div>
  );
};

export default GPGenie;
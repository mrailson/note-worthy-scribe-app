import React from 'react';
import { SEO } from '@/components/SEO';
import { Header } from '@/components/Header';
import GPGenieVoiceAgent from '@/components/GPGenieVoiceAgent';
import { AlertTriangle } from 'lucide-react';

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
        <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 px-4 py-3 mb-6 rounded">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1">Proof of Concept Test Service Only</p>
              <p>
                <strong>GP Genie is NOT approved for real-world clinical use.</strong> This is a proof of concept demonstration service for testing and evaluation purposes only. 
                Do not use this service for actual patient care, clinical decision-making, or any real-world healthcare scenarios.
              </p>
            </div>
          </div>
        </div>
        <GPGenieVoiceAgent initialTab="gp-genie" />
      </main>
    </div>
  );
};

export default GPGenie;
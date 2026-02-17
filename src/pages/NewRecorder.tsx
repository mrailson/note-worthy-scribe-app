import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEO } from '@/components/SEO';
import { PendingBackupsList } from '@/components/offline/PendingBackupsList';
import { RecorderInterface } from '@/components/standalone/RecorderInterface';

const NewRecorder = () => {
  return (
    <>
      <SEO 
        title="Standalone Recorder - NHS Meeting Magic | NoteWell AI"
        description="Record and transcribe meetings with NHS terminology auto-cleaning. Standalone recording and transcription service for healthcare professionals."
        canonical="https://www.gpnotewell.co.uk/new-recorder"
        keywords="meeting recorder, NHS transcription, medical recording, healthcare documentation, meeting transcription"
      />
      <Helmet>
        <title>New Recorder - NHS Meeting Magic</title>
        <meta name="description" content="Standalone recording and transcription service with NHS auto-cleaning" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Standalone Recorder
              </h1>
              <p className="text-muted-foreground">
                Record and transcribe with NHS terminology auto-cleaning
              </p>
            </div>
            
            <RecorderInterface />
            
            {/* Saved Backups (only visible when pending backups exist) */}
            <div className="mt-6">
              <PendingBackupsList />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewRecorder;
import React from 'react';
import { SEO } from '@/components/SEO';
import NoteWellRecorderMobile from '@/components/recorder/NoteWellRecorderMobile';

export default function NewRecorderPage() {
  return (
    <>
      <SEO 
        title="Standalone Recorder - NHS Meeting Magic | NoteWell AI"
        description="Record and transcribe meetings with NHS terminology auto-cleaning. Standalone recording and transcription service for healthcare professionals."
        canonical="https://www.gpnotewell.co.uk/new-recorder"
        keywords="meeting recorder, NHS transcription, medical recording, healthcare documentation, meeting transcription"
      />
      <NoteWellRecorderMobile />
    </>
  );
}

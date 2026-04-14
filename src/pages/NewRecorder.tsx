import React from 'react';
import { Link } from 'react-router-dom';
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
      <div className="relative">
        <NoteWellRecorderMobile />

        <div className="pointer-events-none fixed bottom-3 left-1/2 z-20 w-full max-w-xs -translate-x-1/2 px-4 pb-[env(safe-area-inset-bottom)]">
          <details className="pointer-events-auto mx-auto w-fit rounded-full border border-border/70 bg-background/90 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            <summary className="cursor-pointer list-none px-3 py-1.5 text-center select-none">
              Need help?
            </summary>
            <div className="border-t border-border/60 px-3 py-2 text-center">
              <Link to="/recovery-tool" className="font-medium text-primary underline underline-offset-2">
                Open recovery tool
              </Link>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

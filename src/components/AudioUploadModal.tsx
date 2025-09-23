import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AudioImport } from '@/components/gpscribe/AudioImport';

interface AudioUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  open,
  onOpenChange
}) => {
  const handleTranscriptReady = (transcript: string) => {
    console.log('Transcript ready:', transcript);
    // Show success message but don't auto-close modal
    // Let user decide when to close
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload & Transcribe Audio</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <AudioImport 
            onTranscriptReady={handleTranscriptReady}
            disabled={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
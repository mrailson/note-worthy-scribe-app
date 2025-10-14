import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AudioImport } from '@/components/gpscribe/AudioImport';
import { showToast } from '@/utils/toastWrapper';

interface AudioUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  open,
  onOpenChange
}) => {
  const [hasError, setHasError] = useState(false);

  const handleTranscriptReady = (transcript: string) => {
    try {
      console.log('Transcript ready:', transcript);
      showToast.success('Transcription completed successfully!', { section: 'ai4gp' });
      // Show success message but don't auto-close modal
      // Let user decide when to close
    } catch (error) {
      console.error('Error handling transcript:', error);
      showToast.error('Error processing transcript', { section: 'ai4gp' });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    try {
      if (!newOpen) {
        setHasError(false); // Reset error state when closing
      }
      onOpenChange(newOpen);
    } catch (error) {
      console.error('Error changing modal state:', error);
    }
  };

  if (hasError) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audio Upload Error</DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 bg-destructive/10 rounded-lg">
            <p className="text-sm text-destructive">
              An error occurred while loading the audio upload component. Please try closing and reopening the modal.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
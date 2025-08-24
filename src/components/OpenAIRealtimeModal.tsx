import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, X } from 'lucide-react';
import { OpenAIRealtimeTranscription } from './OpenAIRealtimeTranscription';

interface OpenAIRealtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
}

export const OpenAIRealtimeModal: React.FC<OpenAIRealtimeModalProps> = ({
  isOpen,
  onClose,
  onTranscriptionComplete
}) => {
  const [accumulatedText, setAccumulatedText] = useState('');

  const handleTranscription = (text: string, isPartial?: boolean) => {
    // For partial results, we could show them in real-time if needed
    console.log('Transcription:', { text, isPartial });
  };

  const handleFinalTranscription = (text: string) => {
    setAccumulatedText(text);
  };

  const handleInsertText = () => {
    if (accumulatedText.trim()) {
      onTranscriptionComplete(accumulatedText.trim());
      setAccumulatedText('');
      onClose();
    }
  };

  const handleClose = () => {
    setAccumulatedText('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                OpenAI Realtime Transcription
              </DialogTitle>
              <DialogDescription>
                Advanced real-time speech-to-text with streaming partial results and medical bias support
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <OpenAIRealtimeTranscription
            onTranscription={handleTranscription}
            onFinalTranscription={handleFinalTranscription}
            autoStart={false}
          />
        </div>

        {accumulatedText && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Ready to insert {accumulatedText.split(' ').length} words
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAccumulatedText('')}
              >
                Clear
              </Button>
              <Button
                onClick={handleInsertText}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                Insert Text
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
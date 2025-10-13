import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Mic, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIEditLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLetter: string;
  onRegenerateWithAI: (instructions: string) => Promise<void>;
  letterType: 'acknowledgement' | 'outcome';
  isRegenerating: boolean;
}

export const AIEditLetterDialog: React.FC<AIEditLetterDialogProps> = ({
  open,
  onOpenChange,
  currentLetter,
  onRegenerateWithAI,
  letterType,
  isRegenerating
}) => {
  const [instructions, setInstructions] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      toast.success('Recording stopped, transcribing...');
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // Convert audio blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          toast.error('Failed to process audio');
          return;
        }

        // Call Supabase edge function for transcription
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        if (data?.text) {
          setInstructions(prev => prev ? `${prev}\n${data.text}` : data.text);
          toast.success('Transcription complete');
        }
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Failed to transcribe audio');
    }
  };

  const handleSubmit = async () => {
    if (!instructions.trim()) {
      toast.error('Please provide instructions for the AI');
      return;
    }

    try {
      await onRegenerateWithAI(instructions);
      setInstructions('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error regenerating letter:', error);
      toast.error('Failed to regenerate letter');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Edit {letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} Letter
          </DialogTitle>
          <DialogDescription>
            Provide instructions via text or voice to regenerate the letter with AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Instructions for AI</label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="E.g., 'Make the tone more empathetic and add a section about our commitment to improvement'"
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isRegenerating}
              className={isRecording ? 'bg-red-50 border-red-300' : ''}
            >
              <Mic className={`h-4 w-4 mr-2 ${isRecording ? 'text-red-600 animate-pulse' : ''}`} />
              {isRecording ? 'Stop Recording' : 'Voice Input'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {isRecording ? 'Recording... Click to stop' : 'Click to record your instructions'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setInstructions('');
                onOpenChange(false);
              }}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!instructions.trim() || isRegenerating}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Regenerate Letter
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

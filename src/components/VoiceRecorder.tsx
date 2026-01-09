import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { showToast } from "@/utils/toastWrapper";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export const VoiceRecorder = ({ onTranscription, disabled }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Reset chunks
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      showToast.success("Recording started. Speak now!", { section: 'gpscribe' });
    } catch (error) {
      console.error('Error starting recording:', error);
      showToast.error("Failed to access microphone", { section: 'gpscribe' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        // Send to speech-to-text edge function
        const { data, error } = await supabase.functions.invoke('speech-to-text', {
          body: {
            audio: base64Audio,
            language: 'en',
            temperature: 0.0
          }
        });

        if (error) {
          console.error('Transcription error:', error);
          showToast.error("Failed to transcribe audio", { section: 'gpscribe' });
          return;
        }

        const text = data.text?.trim();
        if (text && text.length > 0) {
          onTranscription(text);
          showToast.success("Voice transcribed successfully!", { section: 'gpscribe' });
        } else {
          showToast.warning("No speech detected. Please try again.", { section: 'gpscribe' });
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio:', error);
      showToast.error("Failed to process audio", { section: 'gpscribe' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        onClick={handleToggleRecording}
        disabled={disabled || isProcessing}
        className="flex items-center gap-2"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {isProcessing ? (
          "Processing..."
        ) : isRecording ? (
          "Stop Recording"
        ) : (
          "Voice Input"
        )}
      </Button>
      
      {isRecording && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          Recording...
        </div>
      )}
    </div>
  );
};
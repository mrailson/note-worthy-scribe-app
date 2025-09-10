import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AIVoiceButtonProps {
  onAIReply: (generatedReply: string) => void;
  incomingEmailText: string;
  detectedLanguage: string;
  disabled?: boolean;
}

interface PracticeDetails {
  practice_name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface UserProfile {
  full_name?: string;
  title?: string;
  role?: string;
}

export const AIVoiceButton = ({ onAIReply, incomingEmailText, detectedLanguage, disabled }: AIVoiceButtonProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, title, role')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      }

      // Fetch user's practice details
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (userRoles?.practice_id) {
        const { data: practice } = await supabase
          .from('practice_details')
          .select('practice_name, address, phone, email')
          .eq('id', userRoles.practice_id)
          .single();

        if (practice) {
          setPracticeDetails(practice);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started - speak your instructions for the AI letter');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        // Transcribe audio
        const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
          body: { audio: base64Audio }
        });

        if (transcriptionError) throw transcriptionError;

        const voiceInput = transcriptionData.text;
        
        // Generate AI letter based on voice input
        const { data: replyData, error: replyError } = await supabase.functions.invoke('generate-reply', {
          body: {
            emailText: incomingEmailText,
            voiceInput: voiceInput,
            contextNotes: `Patient inquiry translated from ${detectedLanguage}`,
            responseGuidance: `Generate a professional NHS GP practice response letter based on the voice input: "${voiceInput}". Include appropriate medical practice signature with practice details.`,
            tone: 'professional',
            replyLength: 4,
            mode: 'generate',
            includeSignature: true
          }
        });

        if (replyError) throw replyError;

        // Create professional signature using real practice details
        const doctorName = userProfile?.full_name || '[Doctor Name]';
        const doctorTitle = userProfile?.title || 'Dr.';
        const doctorRole = userProfile?.role || 'GP';
        const practiceName = practiceDetails?.practice_name || 'NHS GP Practice';
        const practiceAddress = practiceDetails?.address || '[Practice Address]';
        const practicePhone = practiceDetails?.phone || '[Practice Phone]';
        const practiceEmail = practiceDetails?.email || '[Practice Email]';

        const signatureText = `

Kind regards,

${doctorTitle} ${doctorName}
${doctorRole}
${practiceName}
${practiceAddress}
Tel: ${practicePhone}
Email: ${practiceEmail}

This email is confidential and may contain privileged information. If you are not the intended recipient, please notify the sender immediately and delete this email.`;

        const fullReply = replyData.generatedReply + signatureText;
        onAIReply(fullReply);
        toast.success('AI letter generated from your voice instructions');
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('AI voice processing error:', error);
      toast.error('Failed to generate AI letter from voice');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className="p-2"
      title={isRecording ? "Stop recording and generate AI letter" : "AI Voice Letter Generator - Click to record voice instructions"}
    >
      {isProcessing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Zap className={`w-4 h-4 ${isRecording ? 'text-red-500 animate-pulse' : ''}`} />
      )}
    </Button>
  );
};
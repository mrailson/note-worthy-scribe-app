import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { validateVoiceInput, validateGeneratedContent, createSafeMedicalPrompt } from "@/utils/medicalSafety";

interface AIVoiceButtonProps {
  onAIReply: (generatedReply: string) => void;
  incomingEmailText: string;
  detectedLanguage: string;
  disabled?: boolean;
  onSafetyAlert?: (alert: string) => void;
}

interface PracticeDetails {
  practice_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  letter_signature?: string;
}

export const AIVoiceButton = ({ onAIReply, incomingEmailText, detectedLanguage, disabled, onSafetyAlert }: AIVoiceButtonProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { profile } = useUserProfile();

  useEffect(() => {
    fetchPracticeDetails();
  }, []);

  const fetchPracticeDetails = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          .select('practice_name, address, phone, email, letter_signature')
          .eq('id', userRoles.practice_id)
          .single();

        if (practice) {
          setPracticeDetails(practice);
        }
      }
    } catch (error) {
      console.error('Error fetching practice details:', error);
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
        
        // 🚨 CRITICAL MEDICAL SAFETY CHECK - Validate voice input
        const voiceValidation = validateVoiceInput(voiceInput);
        
        if (voiceValidation.riskLevel === 'high') {
          const alertMessage = `🚨 MEDICAL SAFETY ALERT: ${voiceValidation.recommendation}`;
          toast.error(alertMessage);
          onSafetyAlert?.(alertMessage);
          throw new Error('Medical safety validation failed - high risk content detected');
        }
        
        if (voiceValidation.riskLevel === 'medium') {
          toast.warning(`⚠️ Medical terms detected: ${voiceValidation.recommendation}`);
        }
        
        // Create medical safety compliant prompt
        const safePrompt = createSafeMedicalPrompt(
          `Generate a professional NHS GP practice administrative response based on the voice input. Focus ONLY on administrative matters - no medical information should be created.`,
          voiceInput
        );
        
        // Generate AI letter based on voice input with safety guardrails
        const { data: replyData, error: replyError } = await supabase.functions.invoke('generate-reply', {
          body: {
            emailText: incomingEmailText,
            voiceInput: voiceInput,
            contextNotes: `Administrative inquiry translated from ${detectedLanguage}. SAFETY: Only generate administrative responses.`,
            responseGuidance: safePrompt,
            tone: 'professional',
            replyLength: 4,
            mode: 'generate',
            includeSignature: true
          }
        });

        if (replyError) throw replyError;

        // 🚨 CRITICAL MEDICAL SAFETY CHECK - Validate generated content
        const contentValidation = validateGeneratedContent(replyData.generatedReply, voiceInput);
        
        if (contentValidation.riskLevel === 'high') {
          const alertMessage = `🚨 CRITICAL: AI fabricated medical information! ${contentValidation.recommendation}`;
          toast.error(alertMessage);
          onSafetyAlert?.(alertMessage);
          throw new Error('Medical safety validation failed - AI generated unsafe medical content');
        }
        
        if (contentValidation.riskLevel === 'medium') {
          toast.warning(`⚠️ Medical content warning: ${contentValidation.recommendation}`);
        }

        // Create professional signature using real user and practice details
        const doctorName = profile?.full_name || 'Doctor';
        const doctorTitle = profile?.title || 'Dr.';
        const practiceName = practiceDetails?.practice_name || 'NHS GP Practice';
        const practiceAddress = practiceDetails?.address || '[Practice Address]';
        const practicePhone = practiceDetails?.phone || '[Practice Phone]';
        const practiceEmail = practiceDetails?.email || '[Practice Email]';

        // Use existing letter signature if available, otherwise create one
        let signatureText;
        if (practiceDetails?.letter_signature) {
          // Remove HTML tags from the letter signature and format it
          signatureText = `\n\n${practiceDetails.letter_signature.replace(/<[^>]*>/g, '')}\n${practiceName}\n${practiceAddress}\nTel: ${practicePhone}\nEmail: ${practiceEmail}\n\nThis email is confidential and may contain privileged information. If you are not the intended recipient, please notify the sender immediately and delete this email.`;
        } else {
          signatureText = `

Kind regards,

${doctorTitle} ${doctorName}
${practiceName}
${practiceAddress}
Tel: ${practicePhone}
Email: ${practiceEmail}

This email is confidential and may contain privileged information. If you are not the intended recipient, please notify the sender immediately and delete this email.`;
        }

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
      title={isRecording ? "Stop recording and generate AI letter" : "AI Voice Letter Generator (Medical Safety Protected) - Click to record voice instructions"}
    >
      {isProcessing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Zap className={`w-4 h-4 ${isRecording ? 'text-red-500 animate-pulse' : ''}`} />
      )}
    </Button>
  );
};
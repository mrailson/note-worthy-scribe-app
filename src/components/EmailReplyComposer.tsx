import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Edit, 
  Bot, 
  Languages, 
  Loader2,
  FileText,
  Shield
} from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import { AIVoiceButton } from './AIVoiceButton';
import { MedicalSafetyAlert } from './MedicalSafetyAlert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserProfile } from '@/hooks/useUserProfile';
import { validateGeneratedContent, createSafeMedicalPrompt, MedicalSafetyCheck } from '@/utils/medicalSafety';

interface EmailTranslation {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

interface EmailReply {
  englishText: string;
  translatedText: string;
  targetLanguage: string;
}

interface EmailReplyComposerProps {
  incomingEmail: EmailTranslation;
  onReplyGenerated: (reply: EmailReply) => void;
}

interface PracticeDetails {
  practice_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  letter_signature?: string;
}

export const EmailReplyComposer = ({ incomingEmail, onReplyGenerated }: EmailReplyComposerProps) => {
  const [replyMode, setReplyMode] = useState<'manual' | 'ai'>('manual');
  const [englishReply, setEnglishReply] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [responseGuidance, setResponseGuidance] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);
  const [safetyCheck, setSafetyCheck] = useState<MedicalSafetyCheck | null>(null);
  const [safetyAlert, setSafetyAlert] = useState<string>('');
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

  const generateAIReply = async () => {
    setIsGenerating(true);
    setSafetyCheck(null);
    setSafetyAlert('');
    
    try {
      // Create medical safety compliant prompt
      const safePrompt = createSafeMedicalPrompt(
        responseGuidance || 'Generate a professional NHS GP practice administrative response. Focus ONLY on administrative matters.'
      );
      
      const { data, error } = await supabase.functions.invoke('generate-reply', {
        body: {
          emailText: incomingEmail.translatedText,
          contextNotes: `${contextNotes}. SAFETY: Only generate administrative responses - no medical information.`,
          responseGuidance: safePrompt,
          tone: 'professional',
          replyLength: 3,
          mode: 'generate'
        }
      });

      if (error) throw error;

      // 🚨 CRITICAL MEDICAL SAFETY CHECK - Validate generated content
      const contentValidation = validateGeneratedContent(data.generatedReply, incomingEmail.translatedText);
      setSafetyCheck(contentValidation);
      
      if (contentValidation.riskLevel === 'high') {
        const alertMessage = `🚨 CRITICAL: AI generated unsafe medical content! ${contentValidation.recommendation}`;
        toast.error(alertMessage);
        setSafetyAlert(alertMessage);
        throw new Error('Medical safety validation failed - unsafe content detected');
      }
      
      if (contentValidation.riskLevel === 'medium') {
        toast.warning(`⚠️ Medical content detected: ${contentValidation.recommendation}`);
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

      setEnglishReply(data.generatedReply + signatureText);
      toast.success('AI reply generated successfully');
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate AI reply');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVoiceTranscription = (text: string) => {
    if (englishReply) {
      setEnglishReply(englishReply + ' ' + text);
    } else {
      setEnglishReply(text);
    }
  };

  const handleAIVoiceReply = (generatedReply: string) => {
    setEnglishReply(generatedReply);
    // Validate the AI voice generated content
    const validation = validateGeneratedContent(generatedReply);
    setSafetyCheck(validation);
  };

  const handleSafetyAlert = (alert: string) => {
    setSafetyAlert(alert);
  };

  const translateReply = async () => {
    if (!englishReply.trim()) {
      toast.error('Please enter or generate a reply first');
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text-simple', {
        body: {
          text: englishReply,
          targetLanguage: incomingEmail.detectedLanguage
        }
      });

      if (error) throw error;

      const reply: EmailReply = {
        englishText: englishReply,
        translatedText: data.translatedText,
        targetLanguage: incomingEmail.detectedLanguage
      };

      onReplyGenerated(reply);
      toast.success('Reply translated successfully');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Failed to translate reply');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Medical Safety Alerts */}
      {safetyAlert && (
        <Alert variant="destructive">
          <Shield className="w-4 h-4" />
          <AlertDescription>{safetyAlert}</AlertDescription>
        </Alert>
      )}
      
      {safetyCheck && (
        <MedicalSafetyAlert 
          safetyCheck={safetyCheck} 
          context="AI Generated Content" 
        />
      )}

      <Alert>
        <FileText className="w-4 h-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Original Email ({incomingEmail.detectedLanguage}):</strong></p>
            <p className="text-sm bg-muted p-2 rounded">{incomingEmail.originalText}</p>
            <p><strong>English Translation:</strong></p>
            <p className="text-sm bg-muted p-2 rounded">{incomingEmail.translatedText}</p>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compose Reply</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={replyMode === 'manual' ? 'default' : 'outline'}
              onClick={() => setReplyMode('manual')}
              size="sm"
            >
              <Edit className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
            <Button
              variant={replyMode === 'ai' ? 'default' : 'outline'}
              onClick={() => setReplyMode('ai')}
              size="sm"
            >
              <Bot className="w-4 h-4 mr-2" />
              AI Assistance
            </Button>
          </div>

          {replyMode === 'ai' && (
            <div className="space-y-3 p-4 border rounded">
              <div>
                <label className="text-sm font-medium">Context Notes (Optional)</label>
                <Textarea
                  placeholder="Add any relevant context about the patient or situation..."
                  value={contextNotes}
                  onChange={(e) => setContextNotes(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Response Guidance (Optional)</label>
                <Textarea
                  placeholder="Specify any particular approach or information to include..."
                  value={responseGuidance}
                  onChange={(e) => setResponseGuidance(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <Button onClick={generateAIReply} disabled={isGenerating} size="sm">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4 mr-2" />
                )}
                Generate AI Reply
              </Button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">English Reply</label>
              <div className="flex gap-2">
                <VoiceRecorder onTranscription={handleVoiceTranscription} />
                <AIVoiceButton 
                  onAIReply={handleAIVoiceReply}
                  incomingEmailText={incomingEmail.translatedText}
                  detectedLanguage={incomingEmail.detectedLanguage}
                  onSafetyAlert={handleSafetyAlert}
                />
              </div>
            </div>
            <Textarea
              placeholder="Type your reply in English or use voice input..."
              value={englishReply}
              onChange={(e) => setEnglishReply(e.target.value)}
              rows={6}
            />
          </div>

          <Button onClick={translateReply} disabled={isTranslating || !englishReply.trim()}>
            {isTranslating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Languages className="w-4 h-4 mr-2" />
            )}
            Translate to {incomingEmail.detectedLanguage}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Languages,
  Loader2,
  FileText,
  Mic,
  RotateCcw,
  TestTube,
  Download
} from 'lucide-react';
import { EmailReplyComposer } from './EmailReplyComposer';
import { EmailTranslationQuality } from './EmailTranslationQuality';
import { ImageTranslationCard } from './ImageTranslationCard';
import { TEST_PATIENT_REQUESTS } from '@/constants/testPatients';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { downloadEmailTranslationProof } from '@/utils/emailTranslationWordExport';

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

interface QualityAssessment {
  forwardAccuracy: number;
  reverseAccuracy: number;
  medicalTermsPreserved: boolean;
  culturalAppropriateness: number;
  overallSafety: 'safe' | 'warning' | 'unsafe';
  issues: string[];
  recommendation: string;
}

interface EmailHandlerProps {
  resetTrigger?: number;
}

export const EmailHandler = ({ resetTrigger }: EmailHandlerProps = {}) => {
  const [activeTab, setActiveTab] = useState('receive');
  const [incomingEmail, setIncomingEmail] = useState('');
  const [selectedTestPatient, setSelectedTestPatient] = useState<string>('');
  const [emailTranslation, setEmailTranslation] = useState<EmailTranslation | null>(null);
  const [emailReply, setEmailReply] = useState<EmailReply | null>(null);
  const [qualityAssessment, setQualityAssessment] = useState<QualityAssessment | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDownloadingProof, setIsDownloadingProof] = useState(false);

  const getLanguageName = (code: string): string => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };

  const translateIncomingEmail = async () => {
    if (!incomingEmail.trim()) {
      showToast.error('Please enter the email content', { section: 'translation' });
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text-simple', {
        body: {
          text: incomingEmail,
          targetLanguage: 'en',
          detectLanguage: true
        }
      });

      if (error) throw error;

      setEmailTranslation({
        originalText: incomingEmail,
        translatedText: data.translatedText,
        detectedLanguage: data.detectedLanguage,
        confidence: data.confidence || 85
      });

      showToast.success('Email translated successfully', { section: 'translation' });
      setActiveTab('compose');
    } catch (error) {
      console.error('Translation error:', error);
      showToast.error('Failed to translate email', { section: 'translation' });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleReplyGenerated = (reply: EmailReply) => {
    setEmailReply(reply);
    setActiveTab('quality');
  };

  const assessTranslationQuality = async () => {
    if (!emailReply || !emailTranslation) {
      showToast.error('Missing required data for quality assessment', { section: 'translation' });
      return;
    }

    setIsAssessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-translation-quality', {
        body: {
          originalEmail: emailTranslation.originalText,
          translatedEmail: emailTranslation.translatedText,
          englishReply: emailReply.englishText,
          translatedReply: emailReply.translatedText,
          sourceLanguage: emailTranslation.detectedLanguage,
          targetLanguage: emailReply.targetLanguage
        }
      });

      if (error) throw error;

      setQualityAssessment(data);
      showToast.success('Quality assessment completed', { section: 'translation' });
    } catch (error) {
      console.error('Quality assessment error:', error);
      showToast.error('Failed to assess translation quality', { section: 'translation' });
    } finally {
      setIsAssessing(false);
    }
  };

  // Function to convert content to styled HTML for email
  const convertContentToStyledHTML = (text: string): string => {
    const emailCSS = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background-color: #ffffff;
          margin: 0;
          padding: 20px;
        }
        .message-container {
          max-width: 700px;
          margin: 0 auto;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        h1, h2, h3, h4 { color: #2563eb; font-weight: 600; margin-bottom: 1rem; }
        p { margin-bottom: 0.75rem; line-height: 1.6; }
        strong { font-weight: 600; color: #1f2937; }
        .signature {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          color: #6b7280;
          font-size: 0.875rem;
        }
      </style>
    `;
    
    
    return `${emailCSS}<div class="message-container">${text.replace(/\n/g, '<br>')}<div class="signature">Generated by Notewell AI GP Translation Service</div></div>`;
  };

  // Save this email translation session to the shared Translation History
  const saveEmailSessionToHistory = async () => {
    try {
      if (!emailReply || !qualityAssessment || !emailTranslation) return;

      const now = new Date();
      const makeId = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2));

      const translationsPayload = [
        {
          id: makeId(),
          speaker: 'patient' as const,
          originalText: emailTranslation.originalText,
          translatedText: emailTranslation.translatedText,
          originalLanguage: emailTranslation.detectedLanguage || 'unknown',
          targetLanguage: 'en',
          timestamp: now,
          accuracy: Math.round(qualityAssessment.forwardAccuracy || 90),
          confidence: Math.round(qualityAssessment.culturalAppropriateness || 90),
          safetyFlag: qualityAssessment.overallSafety,
        },
        {
          id: makeId(),
          speaker: 'gp' as const,
          originalText: emailReply.englishText,
          translatedText: emailReply.translatedText,
          originalLanguage: 'en',
          targetLanguage: emailReply.targetLanguage,
          timestamp: now,
          accuracy: Math.round(qualityAssessment.reverseAccuracy || 90),
          confidence: Math.round(qualityAssessment.culturalAppropriateness || 90),
          safetyFlag: qualityAssessment.overallSafety,
        },
      ];

      const scoresPayload = [
        {
          accuracy: Math.round(((qualityAssessment.forwardAccuracy || 90) + (qualityAssessment.reverseAccuracy || 90)) / 2),
          confidence: Math.round(qualityAssessment.culturalAppropriateness || 90),
          safetyFlag: qualityAssessment.overallSafety,
          medicalTermsDetected: [] as string[],
        },
      ];

      const { error } = await supabase.functions.invoke('save-translation-session', {
        body: {
          translations: translationsPayload,
          translationScores: scoresPayload,
          sessionStart: now.toISOString(),
          sessionEnd: now.toISOString(),
          isActive: false,
          sessionMetadata: {
            translationType: 'Email Translation' // Specify email translation type
          }
        },
      });

      if (error) throw error;
      showToast.success('Saved to Translation History', { section: 'translation' });
    } catch (err: any) {
      console.error('Failed to save translation history session:', err);
      showToast.error('Failed to save to Translation History', { section: 'translation' });
    }
  };

  const handleSendEmail = async () => {
    if (!emailReply || !qualityAssessment || !emailTranslation) {
      showToast.error('Complete quality assessment before sending', { section: 'translation' });
      return;
    }

    if (qualityAssessment.overallSafety === 'unsafe') {
      showToast.error('Cannot send email - quality assessment flagged as unsafe', { section: 'translation' });
      return;
    }

    setIsSending(true);
    setIsDownloadingProof(true);
    
    try {
      // First download the proof document
      await downloadEmailTranslationProof(emailTranslation, emailReply, qualityAssessment);
      showToast.success('Translation proof document downloaded successfully', { section: 'translation' });
      setIsDownloadingProof(false);

      // Save to Translation History so it appears in the sidebar/history tab
      await saveEmailSessionToHistory();

      // Then send the email
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || 'patient@example.com';

      const emailData = {
        to_email: userEmail,
        subject: 'Response from NHS GP Practice',
        message: convertContentToStyledHTML(emailReply.translatedText),
        template_type: 'ai_generated_content',
        from_name: 'Notewell AI GP Translation Service',
        reply_to: 'noreply@gp-tools.nhs.uk'
      };

      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      showToast.success(`Email sent successfully to ${userEmail}`, { section: 'translation' });
      
      // Reset form
      setIncomingEmail('');
      setEmailTranslation(null);
      setEmailReply(null);
      setQualityAssessment(null);
      setActiveTab('receive');
    } catch (error) {
      console.error('Send email error:', error);
      if (error.message?.includes('download')) {
        showToast.error('Failed to download proof document', { section: 'translation' });
        setIsDownloadingProof(false);
      } else {
        showToast.error('Failed to send email', { section: 'translation' });
      }
    } finally {
      setIsSending(false);
      setIsDownloadingProof(false);
    }
  };

  const handleDownloadProof = async () => {
    if (!emailReply || !qualityAssessment || !emailTranslation) {
      showToast.error('Complete quality assessment before downloading', { section: 'translation' });
      return;
    }

    setIsDownloadingProof(true);
    try {
      await downloadEmailTranslationProof(emailTranslation, emailReply, qualityAssessment);
      showToast.success('Translation proof document downloaded successfully', { section: 'translation' });

      // Also save this interaction to Translation History
      await saveEmailSessionToHistory();
    } catch (error) {
      console.error('Download proof document error:', error);
      showToast.error('Failed to download proof document', { section: 'translation' });
    } finally {
      setIsDownloadingProof(false);
    }
  };

  const loadTestPatient = (patientId: string) => {
    const patient = TEST_PATIENT_REQUESTS.find(p => p.id === patientId);
    if (patient) {
      setIncomingEmail(patient.request);
      setSelectedTestPatient(patientId);
      showToast.success(`Loaded test request from ${patient.name} (${patient.language})`, { section: 'translation' });
    }
  };

  const resetForm = () => {
    setIncomingEmail('');
    setSelectedTestPatient('');
    setEmailTranslation(null);
    setEmailReply(null);
    setQualityAssessment(null);
    setActiveTab('receive');
    showToast.success('Email translation cleared', { section: 'translation' });
  };

  // Handle external reset trigger
  React.useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      resetForm();
    }
  }, [resetTrigger]);

  const getQualityBadge = (quality: QualityAssessment) => {
    const { overallSafety } = quality;
    
    if (overallSafety === 'safe') {
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Safe to Send</Badge>;
    } else if (overallSafety === 'warning') {
      return <Badge variant="secondary" className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Review Recommended</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Manual Review Required</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Foreign Language Email Handler
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedTestPatient} onValueChange={loadTestPatient}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Load test patient request..." />
                </SelectTrigger>
                <SelectContent>
                  {TEST_PATIENT_REQUESTS.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      <div className="flex items-center gap-2">
                        <TestTube className="w-4 h-4" />
                        {patient.name} ({patient.language})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="flex items-center gap-2"
                title="Clear all and start again"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="receive">Receive & Translate</TabsTrigger>
              <TabsTrigger value="compose" disabled={!emailTranslation}>Compose Reply</TabsTrigger>
              <TabsTrigger value="quality" disabled={!emailReply}>Quality Check</TabsTrigger>
              <TabsTrigger value="send" disabled={!qualityAssessment}>Send</TabsTrigger>
            </TabsList>

            <TabsContent value="receive" className="space-y-4">
              <div>
                <label className="text-sm font-medium">Foreign Language Email Content</label>
              </div>
              <div>
                <Textarea
                  placeholder="Paste the foreign language email content here or use the test patient dropdown above..."
                  value={incomingEmail}
                  onChange={(e) => setIncomingEmail(e.target.value)}
                  rows={8}
                  className="mt-2"
                />
              </div>
              
              <Button onClick={translateIncomingEmail} disabled={isTranslating}>
                {isTranslating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Languages className="w-4 h-4 mr-2" />
                )}
                Translate to English
              </Button>

              {emailTranslation && (
                <Alert>
                  <Languages className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Detected Language:</strong> {getLanguageName(emailTranslation.detectedLanguage)}</p>
                      <p><strong>Confidence:</strong> {emailTranslation.confidence}%</p>
                      <div className="mt-3 p-3 bg-muted rounded">
                        <p className="text-sm font-medium">English Translation:</p>
                        <p className="mt-1">{emailTranslation.translatedText}</p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="compose">
              {emailTranslation && (
                <EmailReplyComposer
                  incomingEmail={emailTranslation}
                  onReplyGenerated={handleReplyGenerated}
                  testReply={selectedTestPatient ? TEST_PATIENT_REQUESTS.find(p => p.id === selectedTestPatient)?.englishReply : undefined}
                />
              )}
            </TabsContent>

            <TabsContent value="quality">
              {emailReply && (
                <EmailTranslationQuality
                  emailReply={emailReply}
                  originalEmail={emailTranslation!}
                  qualityAssessment={qualityAssessment}
                  onAssessmentComplete={setQualityAssessment}
                  onStartAssessment={assessTranslationQuality}
                  isAssessing={isAssessing}
                  onProceedToSend={() => setActiveTab('send')}
                />
              )}
            </TabsContent>

            <TabsContent value="send" className="space-y-4">
              {qualityAssessment && emailReply && (
                <div className="space-y-4">
                  <Alert>
                    <FileText className="w-4 h-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Quality Assessment:</span>
                          {getQualityBadge(qualityAssessment)}
                        </div>
                        <p>{qualityAssessment.recommendation}</p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="p-4 border rounded">
                    <h4 className="font-medium mb-2">Final Email Content ({getLanguageName(emailReply.targetLanguage)}):</h4>
                    <div className="text-sm bg-muted p-4 rounded space-y-2">
                      {emailReply.translatedText.replace(/\*\*(.*?)\*\*/g, '$1').split('\n').map((paragraph, index) => (
                        paragraph.trim() ? (
                          <p key={index} className="leading-relaxed">{paragraph}</p>
                        ) : (
                          <div key={index} className="h-2" />
                        )
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendEmail}
                      disabled={isSending || qualityAssessment.overallSafety === 'unsafe'}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isDownloadingProof ? 'Downloading Proof...' : 'Sending Email...'}
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send eMail and download Translation Audit Evidence
                        </>
                      )}
                    </Button>
                    
                    {qualityAssessment.overallSafety === 'warning' && (
                      <Alert className="flex-1">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-sm">
                          Review recommended before sending. Please verify key medical information.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <ImageTranslationCard resetTrigger={resetTrigger} />
    </div>
  );
};
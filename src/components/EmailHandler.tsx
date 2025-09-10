import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  RotateCcw
} from 'lucide-react';
import { EmailReplyComposer } from './EmailReplyComposer';
import { EmailTranslationQuality } from './EmailTranslationQuality';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export const EmailHandler = () => {
  const [activeTab, setActiveTab] = useState('receive');
  const [incomingEmail, setIncomingEmail] = useState('');
  const [emailTranslation, setEmailTranslation] = useState<EmailTranslation | null>(null);
  const [emailReply, setEmailReply] = useState<EmailReply | null>(null);
  const [qualityAssessment, setQualityAssessment] = useState<QualityAssessment | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const translateIncomingEmail = async () => {
    if (!incomingEmail.trim()) {
      toast.error('Please enter the email content');
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

      toast.success('Email translated successfully');
      setActiveTab('compose');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Failed to translate email');
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
      toast.error('Missing required data for quality assessment');
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
      toast.success('Quality assessment completed');
    } catch (error) {
      console.error('Quality assessment error:', error);
      toast.error('Failed to assess translation quality');
    } finally {
      setIsAssessing(false);
    }
  };

  const sendEmail = async () => {
    if (!emailReply || !qualityAssessment) {
      toast.error('Complete quality assessment before sending');
      return;
    }

    if (qualityAssessment.overallSafety === 'unsafe') {
      toast.error('Cannot send email - quality assessment flagged as unsafe');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-translation-email', {
        body: {
          to: 'patient@example.com', // This would come from form data
          subject: 'Response from NHS GP Practice',
          translatedText: emailReply.translatedText,
          originalText: emailReply.englishText,
          isPatientEmail: true,
          qualityMetadata: qualityAssessment
        }
      });

      if (error) throw error;

      toast.success('Email sent successfully');
      
      // Reset form
      setIncomingEmail('');
      setEmailTranslation(null);
      setEmailReply(null);
      setQualityAssessment(null);
      setActiveTab('receive');
    } catch (error) {
      console.error('Send email error:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setIncomingEmail('');
    setEmailTranslation(null);
    setEmailReply(null);
    setQualityAssessment(null);
    setActiveTab('receive');
    toast.success('Form reset successfully');
  };

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
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Foreign Language Email Handler
          </CardTitle>
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Foreign Language Email Content</label>
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
              <div>
                <Textarea
                  placeholder="Paste the foreign language email content here..."
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
                      <p><strong>Detected Language:</strong> {emailTranslation.detectedLanguage}</p>
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
                    <h4 className="font-medium mb-2">Final Email Content ({emailReply.targetLanguage}):</h4>
                    <p className="text-sm bg-muted p-3 rounded">{emailReply.translatedText}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={sendEmail}
                      disabled={isSending || qualityAssessment.overallSafety === 'unsafe'}
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Email
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
    </div>
  );
};
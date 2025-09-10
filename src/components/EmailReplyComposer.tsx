import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Edit, 
  Bot, 
  Languages, 
  Loader2,
  FileText
} from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
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

interface EmailReplyComposerProps {
  incomingEmail: EmailTranslation;
  onReplyGenerated: (reply: EmailReply) => void;
}

export const EmailReplyComposer = ({ incomingEmail, onReplyGenerated }: EmailReplyComposerProps) => {
  const [replyMode, setReplyMode] = useState<'manual' | 'ai'>('manual');
  const [englishReply, setEnglishReply] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [responseGuidance, setResponseGuidance] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const generateAIReply = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-reply', {
        body: {
          emailText: incomingEmail.translatedText,
          contextNotes,
          responseGuidance,
          tone: 'professional',
          replyLength: 3,
          mode: 'generate'
        }
      });

      if (error) throw error;

      setEnglishReply(data.generatedReply);
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
              <VoiceRecorder onTranscription={handleVoiceTranscription} />
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
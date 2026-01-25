import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PatientViewPhrases } from '@/constants/patientViewTranslations';
import { TranslationMessage } from '@/hooks/useReceptionTranslation';

interface PatientEmailChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: TranslationMessage[];
  phrases: Required<PatientViewPhrases>;
  languageName: string;
}

export const PatientEmailChatModal: React.FC<PatientEmailChatModalProps> = ({
  isOpen,
  onClose,
  messages,
  phrases,
  languageName,
}) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatChatContent = (): string => {
    const lines: string[] = [
      `Translation Chat - ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      `Language: ${languageName}`,
      '',
      '---',
      ''
    ];

    messages.forEach((msg) => {
      const speaker = msg.speaker === 'staff' ? 'Reception' : 'You';
      const time = new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      lines.push(`[${time}] ${speaker}:`);
      lines.push(msg.speaker === 'staff' ? msg.translatedText : msg.originalText);
      if (msg.speaker === 'patient') {
        lines.push(`(English: ${msg.translatedText})`);
      }
      lines.push('');
    });

    return lines.join('\n');
  };

  const handleSend = async () => {
    if (!isValidEmail(email)) {
      return;
    }

    setIsSending(true);
    setStatus('idle');

    try {
      const chatContent = formatChatContent();
      
      const { error } = await supabase.functions.invoke('send-chat-email', {
        body: {
          recipientEmails: [email],
          subject: `Translation Chat - ${new Date().toLocaleDateString('en-GB')}`,
          chatContent,
          senderName: 'Translation Service',
        },
      });

      if (error) throw error;

      setStatus('success');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Error sending email:', error);
      setStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setStatus('idle');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {phrases.emailChat}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {phrases.emailChatDescription}
          </p>

          <div className="space-y-2">
            <Label htmlFor="patient-email">{phrases.yourEmail}</Label>
            <Input
              id="patient-email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
          </div>

          {status === 'success' && (
            <p className="text-sm text-green-600 font-medium">
              ✓ {phrases.emailSent}
            </p>
          )}

          {status === 'error' && (
            <p className="text-sm text-destructive font-medium">
              {phrases.emailError}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            {phrases.cancel}
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !isValidEmail(email)}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {phrases.sending}
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                {phrases.sendCopy}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Printer, Mail, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TranslationMessage } from '@/hooks/useReceptionTranslation';
import {
  generatePatientHandoutDocx,
  generatePatientHandoutHTML,
  generatePatientHandoutSMS,
  PatientSummaryData,
} from '@/utils/generatePatientHandoutDocx';
import { downloadFile } from '@/utils/downloadFile';
import { useSendSMS } from '@/hooks/useSendSMS';
import { showToast } from '@/utils/toastWrapper';

interface PatientHandoutActionsProps {
  messages: Array<TranslationMessage | Record<string, unknown>>;
  patientLanguage: string;
  patientLanguageName: string;
  practiceName: string;
  practiceAddress?: string;
  sessionStart?: Date;
  sessionEnd?: Date;
  /** Compact mode for history cards */
  compact?: boolean;
}

const pickText = (message: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = message?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const PatientHandoutActions: React.FC<PatientHandoutActionsProps> = ({
  messages,
  patientLanguage,
  patientLanguageName,
  practiceName,
  practiceAddress,
  sessionStart,
  sessionEnd,
  compact = false,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryData, setSummaryData] = useState<PatientSummaryData | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { sendSMS, isSending: isSendingSMS } = useSendSMS();

  const generateSummary = useCallback(async (): Promise<PatientSummaryData | null> => {
    if (summaryData) return summaryData;
    if (messages.length === 0) {
      showToast.error('No messages to summarise');
      return null;
    }

    setIsGenerating(true);
    try {
      const conversationEntries = messages
        .map((message) => {
          const m = message as Record<string, unknown>;
          const speaker = m.speaker === 'staff' ? 'staff' : 'patient';
          const originalText = pickText(m, ['originalText', 'original_text', 'englishText', 'text']);
          const translatedText = pickText(m, ['translatedText', 'translated_text', 'patientText']);

          const englishText = speaker === 'staff'
            ? (originalText || translatedText)
            : (translatedText || originalText);
          const patientLangText = speaker === 'staff'
            ? translatedText
            : (originalText || translatedText);

          if (!englishText && !patientLangText) return null;

          const speakerLabel = speaker === 'staff'
            ? 'Staff (English)'
            : `Patient (${patientLanguageName || patientLanguage})`;

          return `[${speakerLabel}]\nEnglish: ${englishText}${patientLangText ? `\n${patientLanguageName || patientLanguage}: ${patientLangText}` : ''}`;
        })
        .filter((entry): entry is string => Boolean(entry));

      if (conversationEntries.length === 0) {
        showToast.error('No valid message content to summarise');
        return null;
      }

      const conversationText = conversationEntries.join('\n\n');

      const { data, error } = await supabase.functions.invoke('generate-patient-translation-summary', {
        body: { conversationText, patientLanguage, patientLanguageName },
      });

      if (error) {
        console.error('Summary generation error:', error);
        showToast.error('Failed to generate patient summary');
        return null;
      }

      const result: PatientSummaryData = {
        summary: data.summary || '',
        keyPoints: data.keyPoints || [],
        actions: data.actions || [],
        summaryEnglish: data.summaryEnglish || '',
        keyPointsEnglish: data.keyPointsEnglish || [],
        actionsEnglish: data.actionsEnglish || [],
      };

      setSummaryData(result);
      return result;
    } catch (err) {
      console.error('Summary generation error:', err);
      showToast.error('Failed to generate patient summary');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [messages, patientLanguage, patientLanguageName, summaryData]);

  const sessionDate = sessionStart || new Date();

  const handleDownload = async () => {
    const data = await generateSummary();
    if (!data) return;

    try {
      const blob = await generatePatientHandoutDocx({
        summaryData: data,
        patientLanguage,
        patientLanguageName,
        sessionDate,
        practiceName,
        practiceAddress,
      });
      const url = URL.createObjectURL(blob);
      const dateStr = sessionDate.toISOString().split('T')[0];
      downloadFile(url, `Patient_Summary_${patientLanguageName}_${dateStr}.docx`);
      URL.revokeObjectURL(url);
      showToast.success('Patient summary downloaded');
    } catch (err) {
      console.error('DOCX generation error:', err);
      showToast.error('Failed to generate document');
    }
  };

  const handlePrint = async () => {
    const data = await generateSummary();
    if (!data) return;

    const html = generatePatientHandoutHTML(
      data, patientLanguage, patientLanguageName, sessionDate, practiceName, practiceAddress,
    );
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleEmailOpen = async () => {
    const data = await generateSummary();
    if (!data) return;
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) {
      showToast.error('Please enter an email address');
      return;
    }
    if (!summaryData) return;

    setIsSendingEmail(true);
    try {
      // Generate DOCX blob for attachment
      const blob = await generatePatientHandoutDocx({
        summaryData,
        patientLanguage,
        patientLanguageName,
        sessionDate,
        practiceName,
        practiceAddress,
      });

      // Convert to base64
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Generate HTML for email body
      const htmlContent = generatePatientHandoutHTML(
        summaryData, patientLanguage, patientLanguageName, sessionDate, practiceName, practiceAddress,
      );

      const dateStr = sessionDate.toISOString().split('T')[0];

      const { error } = await supabase.functions.invoke('send-meeting-email-resend', {
        body: {
          to_email: emailAddress.trim(),
          subject: `Visit Summary - ${practiceName} - ${dateStr}`,
          html_content: htmlContent,
          from_name: 'Notewell AI',
          word_attachment: {
            content: base64,
            filename: `Patient_Summary_${patientLanguageName}_${dateStr}.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        },
      });

      if (error) {
        showToast.error('Failed to send email');
        return;
      }

      showToast.success('Patient summary emailed successfully');
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (err) {
      console.error('Email send error:', err);
      showToast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSMSOpen = async () => {
    const data = await generateSummary();
    if (!data) return;
    setShowSMSModal(true);
  };

  const handleSendSMS = async () => {
    if (!phoneNumber.trim() || !summaryData) return;

    const smsText = generatePatientHandoutSMS(summaryData, patientLanguageName, practiceName);
    const result = await sendSMS({ phoneNumber: phoneNumber.trim(), message: smsText });

    if (result.success) {
      setShowSMSModal(false);
      setPhoneNumber('');
    }
  };

  const smsPreview = summaryData
    ? generatePatientHandoutSMS(summaryData, patientLanguageName, practiceName)
    : '';

  const buttonSize = compact ? 'icon' : 'default';
  const buttonClass = compact ? 'h-8 w-8' : 'flex-1 gap-2';

  return (
    <>
      <div className={compact ? 'flex items-center gap-1' : 'grid grid-cols-2 gap-2'}>
        <Button
          variant="outline"
          size={buttonSize}
          className={buttonClass}
          disabled={isGenerating || messages.length === 0}
          onClick={handleDownload}
          title="Download patient summary"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {!compact && 'Download'}
        </Button>
        <Button
          variant="outline"
          size={buttonSize}
          className={buttonClass}
          disabled={isGenerating || messages.length === 0}
          onClick={handlePrint}
          title="Print patient summary"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          {!compact && 'Print'}
        </Button>
        <Button
          variant="outline"
          size={buttonSize}
          className={buttonClass}
          disabled={isGenerating || messages.length === 0}
          onClick={handleEmailOpen}
          title="Email patient summary"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {!compact && 'Email'}
        </Button>
        <Button
          variant="outline"
          size={buttonSize}
          className={buttonClass}
          disabled={isGenerating || messages.length === 0}
          onClick={handleSMSOpen}
          title="SMS patient summary"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          {!compact && 'SMS'}
        </Button>
      </div>

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Email Patient Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="patient-email">Patient email address</Label>
              <Input
                id="patient-email"
                type="email"
                placeholder="patient@example.com"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The summary will be sent as an email with a Word document attached, in {patientLanguageName} and English.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={isSendingEmail || !emailAddress.trim()} className="gap-2">
              {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Modal */}
      <Dialog open={showSMSModal} onOpenChange={setShowSMSModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>SMS Patient Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="patient-phone">Patient mobile number</Label>
              <Input
                id="patient-phone"
                type="tel"
                placeholder="07700 900000"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendSMS()}
              />
            </div>
            {smsPreview && (
              <div>
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <Textarea
                  readOnly
                  value={smsPreview}
                  className="text-xs h-32 resize-none bg-muted/50"
                />
                <p className="text-[0.65rem] text-muted-foreground mt-1">
                  {smsPreview.length} characters
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSMSModal(false)}>Cancel</Button>
            <Button onClick={handleSendSMS} disabled={isSendingSMS || !phoneNumber.trim()} className="gap-2">
              {isSendingSMS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

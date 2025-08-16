import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EmailCompositionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContent: string;
  defaultSubject?: string;
}

export const EmailCompositionModal: React.FC<EmailCompositionModalProps> = ({
  isOpen,
  onOpenChange,
  defaultContent,
  defaultSubject = "Medical Consultation Information"
}) => {
  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    subject: defaultSubject,
    message: defaultContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  });
  const [isSending, setIsSending] = useState(false);

  const handleSendEmail = async () => {
    if (!emailData.to.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }

    if (!emailData.message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: {
          to_email: emailData.to,
          cc_email: emailData.cc || null,
          subject: emailData.subject,
          message: emailData.message,
          from_name: "Medical Practice Central Mail Service"
        }
      });

      if (error) throw error;

      toast.success("Email sent successfully via central mail service");
      onOpenChange(false);
      
      // Reset form
      setEmailData({
        to: '',
        cc: '',
        subject: defaultSubject,
        message: defaultContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Compose Email to Patient
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Service Notice */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Central Mail Service</h4>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  This email will be sent via the practice's central mail service, not your personal NHS email account. 
                  All correspondence is logged and managed centrally for patient safety and compliance.
                </p>
              </div>
            </div>
          </div>

          {/* Email Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="to">To (Patient Email) *</Label>
              <Input
                id="to"
                type="email"
                placeholder="patient@example.com"
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cc">CC (Optional)</Label>
              <Input
                id="cc"
                type="email"
                placeholder="family@example.com"
                value={emailData.cc}
                onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={emailData.subject}
              onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Medical Consultation Information"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={emailData.message}
              onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Enter your message here..."
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The content has been automatically formatted. You can edit it before sending.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Secure Central Service
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={isSending || !emailData.to.trim()}
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Email
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
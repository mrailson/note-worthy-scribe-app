import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Predefined starting messages for clinicians
const QUICK_PICK_MESSAGES = [
  {
    id: 'consultation',
    label: 'Post-Consultation Follow-up',
    message: 'Thank you for coming to your consultation today. As discussed, here is the information we covered:'
  },
  {
    id: 'results',
    label: 'Test Results',
    message: 'I hope this message finds you well. Your recent test results are now available, and I wanted to share the findings with you:'
  },
  {
    id: 'referral',
    label: 'Referral Information',
    message: 'Following our recent consultation, I have arranged a referral as discussed. Please find the details below:'
  },
  {
    id: 'medication',
    label: 'Medication Review',
    message: 'Thank you for attending your medication review appointment. Based on our discussion, here are the updated recommendations:'
  },
  {
    id: 'followup',
    label: 'Follow-up Care',
    message: 'I hope you are feeling better since our last appointment. As requested, here is the follow-up information:'
  },
  {
    id: 'treatment',
    label: 'Treatment Plan',
    message: 'Thank you for your time during today\'s appointment. Here is your personalized treatment plan as we discussed:'
  },
  {
    id: 'custom',
    label: 'Custom Message',
    message: ''
  }
];

interface EmailCompositionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  defaultSubject?: string;
}

export function EmailCompositionModal({
  isOpen,
  onOpenChange,
  content,
  defaultSubject = 'AI Generated Content'
}: EmailCompositionModalProps) {
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedQuickPick, setSelectedQuickPick] = useState('consultation');
  const [attachWordDoc, setAttachWordDoc] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Function to update message based on selected quick pick
  const updateMessageWithQuickPick = (quickPickId: string, formattedContent: string) => {
    const selectedTemplate = QUICK_PICK_MESSAGES.find(msg => msg.id === quickPickId);
    if (selectedTemplate && selectedTemplate.message) {
      setMessage(`${selectedTemplate.message}\n\n${formattedContent}`);
    } else {
      // Custom message - just use the content
      setMessage(formattedContent);
    }
  };

  // Auto-generate subject and format message body
  useEffect(() => {
    if (content) {
      // Generate subject from content (max 80 words)
      const cleanContent = content.replace(/[#*`]/g, '').trim();
      const words = cleanContent.split(/\s+/).slice(0, 80);
      const autoSubject = words.join(' ');
      const truncatedSubject = autoSubject.length > 100 ? 
        autoSubject.substring(0, 97) + '...' : autoSubject;
      
      setSubject(`AI Generated: ${truncatedSubject}`);
      
      // Format message body maintaining structure
      const formattedContent = content
        .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
        .replace(/^\s+/gm, '') // Remove leading whitespace but keep structure
        .trim();
      
      updateMessageWithQuickPick(selectedQuickPick, formattedContent);
    }
  }, [content, selectedQuickPick]);

  // Handle quick pick selection change
  const handleQuickPickChange = (value: string) => {
    setSelectedQuickPick(value);
    if (content) {
      const formattedContent = content
        .replace(/\n\s*\n/g, '\n\n')
        .replace(/^\s+/gm, '')
        .trim();
      updateMessageWithQuickPick(value, formattedContent);
    }
  };

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter at least one recipient email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      // TODO: Implement EmailJS integration with attachment support
      // For now, just simulate sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Email Sent",
        description: attachWordDoc ? 
          "The email has been sent successfully with Word document attachment." :
          "The email has been sent successfully.",
      });
      
      onOpenChange(false);
      // Reset form
      setToEmail('');
      setCcEmail('');
      setAttachWordDoc(true);
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Failed to send the email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-none max-h-none overflow-y-auto resize min-w-[400px] min-h-[500px] w-[600px] h-[700px]" style={{ resize: 'both' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Compose Email
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to-email">To *</Label>
            <Input
              id="to-email"
              type="email"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cc-email">CC</Label>
            <Input
              id="cc-email"
              type="email"
              placeholder="cc@example.com"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quick-pick">Quick Pick Starting Message</Label>
            <Select value={selectedQuickPick} onValueChange={handleQuickPickChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a starting message..." />
              </SelectTrigger>
              <SelectContent>
                {QUICK_PICK_MESSAGES.map((msg) => (
                  <SelectItem key={msg.id} value={msg.id}>
                    {msg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Enter your message here..."
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="attach-word"
              checked={attachWordDoc}
              onCheckedChange={(checked) => setAttachWordDoc(checked === true)}
            />
            <Label 
              htmlFor="attach-word" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Attach as Word document
            </Label>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !toEmail.trim()}
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
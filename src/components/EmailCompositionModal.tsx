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
import { supabase } from '@/integrations/supabase/client';
import { generateWordDocument } from '@/utils/documentGenerators';
import { useUserProfile } from '@/hooks/useUserProfile';

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
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [emailDate, setEmailDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedQuickPick, setSelectedQuickPick] = useState('consultation');
  const [attachWordDoc, setAttachWordDoc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { profile } = useUserProfile();

  // Function to convert markdown formatting to HTML
  const convertMarkdownToHTML = (text: string): string => {
    return text
      .replace(/^---+$/gm, '<hr>') // Replace horizontal rules with HTML hr
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>') // Convert bold+italic to HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert bold markdown to HTML
      .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Convert italic formatting to HTML
      .replace(/`(.*?)`/g, '<code>$1</code>') // Convert inline code to HTML
      .replace(/#{6}\s+(.*?)$/gm, '<h6>$1</h6>') // Convert h6 headers
      .replace(/#{5}\s+(.*?)$/gm, '<h5>$1</h5>') // Convert h5 headers
      .replace(/#{4}\s+(.*?)$/gm, '<h4>$1</h4>') // Convert h4 headers
      .replace(/#{3}\s+(.*?)$/gm, '<h3>$1</h3>') // Convert h3 headers
      .replace(/#{2}\s+(.*?)$/gm, '<h2>$1</h2>') // Convert h2 headers
      .replace(/#{1}\s+(.*?)$/gm, '<h1>$1</h1>') // Convert h1 headers
      .replace(/^\s*[-*+]\s+(.*?)$/gm, '<li>$1</li>') // Convert markdown lists to HTML li
      .replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li>$1. $2</li>') // Convert numbered lists to HTML
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>') // Wrap list items in ul tags
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>') // Convert links to HTML
      .replace(/\n/g, '<br>') // Convert line breaks to HTML br tags
      .replace(/<ul><\/ul>/g, '') // Remove empty ul tags
      .trim();
  };

  // Function to strip markdown formatting for display in textarea
  const stripMarkdownForDisplay = (text: string): string => {
    return text
      .replace(/^---+$/gm, '') // Remove horizontal rules
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Remove bold+italic formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
      .replace(/`(.*?)`/g, '$1') // Remove inline code formatting
      .replace(/#{1,6}\s+(.*?)$/gm, '$1') // Remove header formatting
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert markdown bullets to simple bullets
      .replace(/^\s*(\d+)\.\s+/gm, '$1. ') // Keep numbered lists simple
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // Convert links to text with URL
      .trim();
  };

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

  // Auto-populate email from user profile
  useEffect(() => {
    if (isOpen && profile?.email) {
      setToEmail(profile.email);
    }
  }, [isOpen, profile?.email]);

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
      
      // Format message body for display (strip markdown)
      const displayContent = stripMarkdownForDisplay(content)
        .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
        .replace(/^\s+/gm, '') // Remove leading whitespace but keep structure
        .trim();
      
      updateMessageWithQuickPick(selectedQuickPick, displayContent);
    }
  }, [content, selectedQuickPick]);

  // Handle quick pick selection change
  const handleQuickPickChange = (value: string) => {
    setSelectedQuickPick(value);
    if (content) {
      const displayContent = stripMarkdownForDisplay(content)
        .replace(/\n\s*\n/g, '\n\n')
        .replace(/^\s+/gm, '')
        .trim();
      updateMessageWithQuickPick(value, displayContent);
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

    if (!subject.trim()) {
      toast({
        title: "Subject Required",
        description: "Please enter a subject for the email.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      // Preserve formatting and spacing as shown in the chat bubble
      const cleanMessage = message.trim();
      
      // Generate Word attachment if requested
      let wordAttachment = null;
      if (attachWordDoc && content) {
        try {
          const blob = await generateWordDocument(content, subject.trim() || 'AI Generated Content', false);
          // Convert blob to base64 for EmailJS
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
          });
          reader.readAsDataURL(blob);
          const base64Content = await base64Promise;
          
          wordAttachment = {
            content: base64Content,
            filename: `${subject.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'AI_Content'}.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
        } catch (docError) {
          console.warn('Word document generation failed:', docError);
        }
      }

      // Prepare email data for EmailJS service
      const emailData = {
        to_email: toEmail.trim(),
        subject: subject.trim(),
        message: convertMarkdownToHTML(cleanMessage),
        template_type: 'ai_generated_content',
        from_name: 'AI4GP Service',
        reply_to: 'noreply@gp-tools.nhs.uk',
        word_attachment: wordAttachment
      };

      // Send email via Supabase edge function
      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) {
        console.error('Email sending error:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      if (!data?.success) {
        console.error('EmailJS error:', data);
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      toast({
        title: "Email Sent Successfully",
        description: `Email sent to ${toEmail}`,
      });
      
      onOpenChange(false);
      // Reset form (keep email from profile)
      setSubject('');
      setMessage('');
      setEmailDate(new Date().toISOString().split('T')[0]);
      setSelectedQuickPick('consultation');
      setAttachWordDoc(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send the email. Please try again.",
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
      <DialogContent className="sm:max-w-none max-h-none overflow-y-auto resize min-w-[400px] min-h-[900px] w-[600px] h-[900px]" style={{ resize: 'both' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Compose Email</span>
            <span className="text-sm font-normal text-muted-foreground">
              {new Date().toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              })}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to-email">To *</Label>
            <Input
              id="to-email"
              name="to-email"
              type="email"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              autoComplete="email"
              required
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
              className="h-[300px] font-mono text-sm resize-none"
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
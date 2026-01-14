import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { isLetterFormat } from '@/utils/letterParser';
import { formatLetterForEmail, convertToEmailSafeHTML } from '@/utils/formatLetterForEmail';

export function useAutoEmail() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { profile } = useUserProfile();

  const sendEmailAutomatically = async (content: string, defaultSubject?: string) => {
    if (!profile?.email) {
      toast({
        title: "Email Not Available",
        description: "Unable to send email - no email address found in your profile.",
        variant: "destructive"
      });
      return false;
    }

    setIsSending(true);
    try {
      // Auto-generate subject from content
      const cleanContent = content.replace(/[#*`]/g, '').trim();
      const words = cleanContent.split(/\s+/).slice(0, 15);
      const autoSubject = words.join(' ');
      const subject = defaultSubject || `AI Generated: ${autoSubject.length > 80 ? autoSubject.substring(0, 77) + '...' : autoSubject}`;
      
      // Format message with consultation intro
      const message = `Thank you for using our AI consultation service. Here is the information generated for you:\n\n${content}`;
      
      // Detect if content is a letter format
      const isLetter = isLetterFormat(content);
      
      // Generate Word attachment
      let wordAttachment = null;
      try {
        if (isLetter) {
          // Use NHS letter document generator for letters
          const { generateNHSLetterBlob } = await import('@/utils/nhsLetterExport');
          
          // Basic options without practice details (these would need to come from practice_details table)
          const options = {
            content: content,
            filename: subject,
            clinicianName: profile.full_name || undefined,
          };
          
          const blob = await generateNHSLetterBlob(options);
          
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
            filename: `${subject.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
        } else {
          // Use standard NHS-styled document for non-letters
          const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
          const { parseContentToDocxElements, stripTranscriptSection } = await import('@/utils/generateMeetingNotesDocx');
          const { buildNHSStyles, buildNumbering, NHS_COLORS, FONTS } = await import('@/utils/wordTheme');
          
          // Strip transcript sections
          const cleanedContent = stripTranscriptSection(content);
          
          // Clean the title
          const cleanTitle = subject.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
          
          // Build document children
          const children: any[] = [];
          
          // Title
          children.push(
            new Paragraph({
              children: [new TextRun({
                text: cleanTitle,
                bold: true,
                size: FONTS.size.title,
                color: NHS_COLORS.headingBlue,
                font: FONTS.default,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
            })
          );
          
          // Parse and add content
          const contentElements = await parseContentToDocxElements(cleanedContent);
          children.push(...contentElements);
          
          // Footer
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-GB');
          const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          
          children.push(
            new Paragraph({
              children: [new TextRun({
                text: `Generated on ${dateStr} ${timeStr}`,
                italics: true,
                size: FONTS.size.footer,
                color: NHS_COLORS.textLightGrey,
                font: FONTS.default,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 480 },
            })
          );
          
          // Create document with NHS theme
          const styles = buildNHSStyles();
          const numbering = buildNumbering();
          
          const doc = new Document({
            styles: styles,
            numbering: numbering,
            sections: [{
              children,
            }],
          });
          
          const blob = await Packer.toBlob(doc);
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
            filename: `${subject.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
        }
      } catch (docError) {
        console.warn('Word document generation failed:', docError);
      }

      // Convert content to email-safe HTML
      // Use letter formatter for letters, generic formatter for other content
      const emailHtml = isLetter 
        ? formatLetterForEmail(message)
        : convertToEmailSafeHTML(message);

      // Prepare email data for EmailJS service
      const emailData = {
        to_email: profile.email,
        subject,
        message: emailHtml,
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
        description: `AI-generated content has been sent to ${profile.email}`,
      });
      
      return true;
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send the email. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return { sendEmailAutomatically, isSending };
}

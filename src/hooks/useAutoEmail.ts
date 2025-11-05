import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateMeetingNotesDocx } from '@/utils/generateMeetingNotesDocx';
import { useUserProfile } from '@/hooks/useUserProfile';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';

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
      
      // Generate Word attachment using the same NHS-styled function as Standard Minutes tab
      let wordAttachment = null;
      try {
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
      } catch (docError) {
        console.warn('Word document generation failed:', docError);
      }

      // Prepare email data for EmailJS service
      const emailData = {
        to_email: profile.email,
        subject,
        message: convertContentToStyledHTML(message),
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

  // Function to strip duplicate meeting details blocks from content
  const stripDuplicateBlocks = (content: string): string => {
    if (!content) return content;
    
    let cleaned = content;
    
    // Remove markdown-style duplicate blocks
    cleaned = cleaned
      // Remove standalone "MEETING NOTES" heading (markdown)
      .replace(/^#\s*MEETING\s*NOTES\s*$/gim, '')
      // Remove standalone "MEETING DETAILS" heading (markdown)
      .replace(/^#{1,2}\s*MEETING\s*DETAILS\s*$/gim, '')
      // Remove "Meeting Title:" lines
      .replace(/^\*?\*?Meeting\s*Title:\*?\*?.*$/gim, '')
      // Remove "Date:" lines
      .replace(/^\*?\*?Date:\*?\*?.*$/gim, '')
      // Remove "Time:" lines
      .replace(/^\*?\*?Time:\*?\*?.*$/gim, '');
    
    // Clean up excessive whitespace left behind
    cleaned = cleaned
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
    
    return cleaned;
  };

  // Function to convert content to styled HTML for email (matching on-screen appearance)
  const convertContentToStyledHTML = (text: string): string => {
    // Strip duplicate blocks before rendering
    const cleanedText = stripDuplicateBlocks(text);
    
    // Use the same renderer as the on-screen display
    const renderedHTML = renderNHSMarkdown(cleanedText, { enableNHSStyling: false, isUserMessage: false });
    
    // Add email-specific CSS styling to match the on-screen appearance
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
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
        }
        h1 {
          color: #2563eb;
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 1rem;
          margin-top: 1.5rem;
        }
        h2 {
          color: #2563eb;
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          margin-top: 1.25rem;
        }
        h3 {
          color: #2563eb;
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          margin-top: 1rem;
        }
        h4 {
          color: #2563eb;
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          margin-top: 0.75rem;
        }
        p {
          margin-bottom: 0.75rem;
          line-height: 1.6;
          color: inherit;
        }
        strong {
          font-weight: 600;
          color: #1f2937;
        }
        em {
          font-style: italic;
        }
        .ai4gp-caution {
          background-color: #fefce8;
          border-left: 4px solid #eab308;
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 0 8px 8px 0;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .ai4gp-caution-title {
          color: #92400e;
          font-weight: bold;
          font-size: 1.125rem;
          display: block;
          margin-bottom: 0.5rem;
          background-color: #fef3c7;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        div[class*="bg-primary/20"] {
          background-color: #eff6ff;
          border-left: 4px solid #2563eb;
          padding: 0.75rem;
          margin: 1rem 0;
          border-radius: 0 8px 8px 0;
        }
        div[class*="bg-primary/20"] strong {
          color: #1e40af;
          font-weight: bold;
          font-size: 1.125rem;
          display: block;
          margin-bottom: 0.5rem;
          padding: 0.5rem;
        }
        a {
          color: #2563eb;
          text-decoration: underline;
        }
        a:hover {
          color: #1d4ed8;
        }
        .signature {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          color: #6b7280;
          font-size: 0.875rem;
        }
      </style>
    `;
    
    return `${emailCSS}<div class="message-container">${renderedHTML}</div>`;
  };

  return { sendEmailAutomatically, isSending };
}
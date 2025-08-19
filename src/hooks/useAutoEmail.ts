import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateWordDocument } from '@/utils/documentGenerators';
import { useUserProfile } from '@/hooks/useUserProfile';

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
      
      // Generate Word attachment
      let wordAttachment = null;
      try {
        const blob = await generateWordDocument(content, subject, false);
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
        message: convertMarkdownToHTML(message),
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

  return { sendEmailAutomatically, isSending };
}
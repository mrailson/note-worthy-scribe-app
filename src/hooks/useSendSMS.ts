import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SMSSendRequest, SMSSendResponse } from '@/types/sms';

export function useSendSMS() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic UK phone validation
    const cleaned = phone.replace(/[^\d+]/g, '');
    return /^(\+44|0)7\d{9}$/.test(cleaned) || /^\+447\d{9}$/.test(cleaned);
  };

  const sendSMS = async ({ phoneNumber, message, consultationId }: SMSSendRequest): Promise<SMSSendResponse> => {
    if (!validatePhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid UK mobile number (07xxx or +447xxx)",
        variant: "destructive",
      });
      return { success: false, error: "Invalid phone number format" };
    }

    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return { success: false, error: "Message is required" };
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-notify', {
        body: { phoneNumber, message, consultationId },
      });

      if (error) {
        console.error('SMS send error:', error);
        toast({
          title: "Failed to send SMS",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      if (!data.success) {
        toast({
          title: "Failed to send SMS",
          description: data.error || "An unexpected error occurred",
          variant: "destructive",
        });
        return { success: false, error: data.error };
      }

      toast({
        title: "SMS sent",
        description: "The text message has been sent successfully",
      });

      return { success: true, notifyReference: data.notifyReference };

    } catch (error: any) {
      console.error('SMS send error:', error);
      toast({
        title: "Failed to send SMS",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendSMS,
    isSending,
    validatePhoneNumber,
  };
}

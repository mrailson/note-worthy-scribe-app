import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  letterContent: string;
  patientName: string;
  referenceNumber: string;
  senderName: string;
  letterType: 'acknowledgement' | 'outcome';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailJsPublicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const emailJsServiceId = Deno.env.get('EMAILJS_SERVICE_ID');
    const emailJsTemplateId = Deno.env.get('EMAILJS_TEMPLATE_ID');

    if (!emailJsPublicKey || !emailJsServiceId || !emailJsTemplateId) {
      console.error('Missing EmailJS credentials');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured. Please contact your administrator.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const {
      to,
      cc = [],
      bcc = [],
      subject,
      letterContent,
      patientName,
      referenceNumber,
      senderName,
      letterType
    }: EmailRequest = await req.json();

    console.log('Sending email:', { to, cc, bcc, subject, letterType });

    // Validate recipients
    if (!to || to.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No recipients specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare email data for EmailJS
    const emailData = {
      service_id: emailJsServiceId,
      template_id: emailJsTemplateId,
      user_id: emailJsPublicKey,
      template_params: {
        to_email: to.join(', '),
        cc_email: cc.join(', '),
        bcc_email: bcc.join(', '),
        subject: subject,
        letter_content: letterContent,
        patient_name: patientName,
        reference_number: referenceNumber,
        sender_name: senderName,
        letter_type: letterType
      }
    };

    // Send email via EmailJS
    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('EmailJS error:', errorText);
      throw new Error(`EmailJS failed: ${errorText}`);
    }

    console.log('Email sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-complaint-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

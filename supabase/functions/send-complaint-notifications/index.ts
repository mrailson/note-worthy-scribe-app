import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  complaintId: string;
  involvedParties: Array<{
    staffName: string;
    staffEmail: string;
    staffRole: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaintId, involvedParties }: EmailRequest = await req.json();
    
    if (!complaintId || !involvedParties?.length) {
      throw new Error('Complaint ID and involved parties are required');
    }

    console.log('Processing request for complaint:', complaintId, 'with', involvedParties.length, 'parties');

    // Initialize Supabase clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use the caller's auth context for DB writes so triggers (auth.uid()) get a value
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Fetch complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      throw new Error('Complaint not found');
    }

    console.log('Found complaint:', complaint.reference_number);

    // Fetch practice details separately if practice_id exists
    let practiceDetails = null;
    if (complaint.practice_id) {
      const { data: practice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email')
        .eq('id', complaint.practice_id)
        .single();
      practiceDetails = practice;
      console.log('Found practice details:', practiceDetails?.practice_name);
    }

    // Fetch acknowledgement letter if it exists
    const { data: acknowledgement } = await supabase
      .from('complaint_acknowledgements')
      .select('acknowledgement_text, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (acknowledgement) {
      console.log('Found acknowledgement letter for complaint');
    }

    // Insert involved parties and get their access tokens
    const involvedPartiesData = [];
    
    for (const party of involvedParties) {
      const { data: insertedParty, error: insertError } = await supabase
        .from('complaint_involved_parties')
        .insert({
          complaint_id: complaintId,
          staff_name: party.staffName,
          staff_email: party.staffEmail,
          staff_role: party.staffRole,
          response_requested_at: new Date().toISOString(),
          // Explicitly ensure response_submitted_at is NULL
          response_submitted_at: null,
          response_text: null
        })
        .select('access_token')
        .single();

      if (insertError) {
        console.error('Error inserting involved party:', insertError);
        continue;
      }

      involvedPartiesData.push({
        ...party,
        accessToken: insertedParty.access_token,
      });
    }

    console.log('Created', involvedPartiesData.length, 'involved party records');

    // Send emails using EmailJS service
    const emailJsServiceId = Deno.env.get('EMAILJS_SERVICE_ID');
    const emailJsTemplateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
    const emailJsPublicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const emailJsPrivateKey = Deno.env.get('EMAILJS_PRIVATE_KEY');

    console.log('EmailJS Config:', {
      serviceId: emailJsServiceId ? 'Set' : 'Missing',
      templateId: emailJsTemplateId ? 'Set' : 'Missing',
      publicKey: emailJsPublicKey ? 'Set' : 'Missing',
      privateKey: emailJsPrivateKey ? 'Set' : 'Missing'
    });

    if (!emailJsServiceId || !emailJsTemplateId || !emailJsPublicKey || !emailJsPrivateKey) {
      throw new Error('EmailJS configuration not complete - missing required secrets');
    }

    const baseUrl = 'https://notewell.dialai.co.uk';
    
    const emailResults = [];

    for (const party of involvedPartiesData) {
      // Use path-based URL format for better deliverability
      const responseUrl = `${baseUrl}/complaint-response/${party.accessToken}`;
      
      console.log('Sending email to:', party.staffEmail, 'with response URL:', responseUrl);
      
      // Create the professional HTML email content
      const messageContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #1f2937; margin: 0; font-size: 24px;">Complaint Input Request</h1>
    <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 16px;">${practiceDetails?.practice_name || 'Medical Practice'}</p>
  </div>

  <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Dear <strong>${party.staffName}</strong>,</p>
  
  <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-bottom: 25px;">
    You have been requested to provide input for the following complaint investigation:
  </p>

  <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0;">
    <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">📋 Complaint Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 35%;">Reference:</td>
        <td style="padding: 8px 0; color: #1f2937; font-family: monospace; background-color: #fef3c7; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${complaint.reference_number}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Title:</td>
        <td style="padding: 8px 0; color: #1f2937;">${complaint.complaint_title}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Patient:</td>
        <td style="padding: 8px 0; color: #1f2937;">${complaint.patient_name}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Incident Date:</td>
        <td style="padding: 8px 0; color: #1f2937;">${new Date(complaint.incident_date).toLocaleDateString('en-GB')}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Your Role:</td>
        <td style="padding: 8px 0; color: #1f2937; background-color: #dbeafe; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${party.staffRole}</td>
      </tr>
    </table>
  </div>

  <div style="background-color: #fef9e7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0;">
    <h2 style="color: #92400e; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">📝 Complaint Description</h2>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #fbbf24;">
      <p style="color: #374151; line-height: 1.6; margin: 0; white-space: pre-wrap;">${complaint.complaint_description}</p>
    </div>
  </div>

  ${acknowledgement ? `
  <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0;">
    <h2 style="color: #065f46; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">✅ Acknowledgement Sent to Patient</h2>
    <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0;">
      <strong>Sent:</strong> ${new Date(acknowledgement.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </p>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #86efac; max-height: 300px; overflow-y: auto;">
      ${acknowledgement.acknowledgement_text}
    </div>
    <p style="color: #059669; font-size: 13px; margin: 10px 0 0 0; font-style: italic;">
      ℹ️ This acknowledgement letter has been sent to the patient. Your response should build upon this communication.
    </p>
  </div>
  ` : ''}

  <div style="text-align: center; margin: 30px 0;">
    <a href="${responseUrl}" 
       style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
      🔗 Provide Your Response
    </a>
    <p style="color: #6b7280; font-size: 13px; margin-top: 15px; word-break: break-all;">
      Or copy this link: ${responseUrl}
    </p>
    <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-top: 15px; text-align: center;">
      <p style="color: #374151; font-size: 13px; margin: 0 0 5px 0;">Your one-time access code:</p>
      <p style="color: #1f2937; font-size: 16px; font-family: monospace; font-weight: bold; margin: 0; background-color: #fef3c7; padding: 8px; border-radius: 3px; display: inline-block;">${party.accessToken}</p>
      <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0; font-style: italic;">Use this code if the link doesn't work</p>
    </div>
  </div>

  <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0;">
    <h3 style="color: #dc2626; font-size: 16px; margin: 0 0 10px 0; font-weight: bold;">⚠️ Important Information</h3>
    <ul style="color: #374151; line-height: 1.5; margin: 0; padding-left: 20px;">
      <li>Please review the complaint details carefully</li>
      <li><strong>Response deadline: 5 working days</strong></li>
      <li>Your response will be used as part of the investigation process</li>
      <li>All information will be handled confidentially</li>
    </ul>
  </div>

  <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 40px; text-align: center;">
    <p style="color: #6b7280; font-size: 14px; margin: 0;">
      This email was sent from <strong>${practiceDetails?.practice_name || 'Medical Practice'}</strong> complaint management system.
    </p>
    <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
      <strong>Best regards,</strong><br>
      ${practiceDetails?.practice_name || 'Medical Practice'} Complaints Team
    </p>
  </div>
</div>`;

      const emailData = {
        service_id: emailJsServiceId,
        template_id: emailJsTemplateId,
        user_id: emailJsPublicKey,
        accessToken: emailJsPrivateKey,
        template_params: {
          to_email: party.staffEmail,
          subject: `Complaint Input Request - ${complaint.reference_number}`,
          message: messageContent,
          // Explicit params for templates – use any of these in EmailJS
          response_url: responseUrl,
          safe_link: responseUrl,
          safe_link_plain: responseUrl,
          safe_link_html: `<a href="${responseUrl}">Provide Your Response</a>`,
          reference_number: complaint.reference_number,
          staff_name: party.staffName,
          practice_name: practiceDetails?.practice_name || 'Medical Practice',
        },
      };

      console.log('Email data being sent to EmailJS:');
      console.log('- Service ID:', emailJsServiceId);
      console.log('- Template ID:', emailJsTemplateId);
      console.log('- To Email:', party.staffEmail);
      console.log('- Subject:', emailData.template_params.subject);
      console.log('- Response URL:', responseUrl);
      console.log('- Message Length:', emailData.template_params.message.length);
      console.log('- Message Preview:', emailData.template_params.message.substring(0, 100) + '...');

      try {
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        const responseText = await emailResponse.text();
        console.log('EmailJS Response Status:', emailResponse.status);
        console.log('EmailJS Response Body:', responseText);
        console.log('EmailJS Response Headers:', Object.fromEntries(emailResponse.headers.entries()));

        if (emailResponse.ok) {
          console.log('✅ Email sent successfully to:', party.staffEmail);
          emailResults.push({ email: party.staffEmail, status: 'sent', responseUrl });
        } else {
          console.log('❌ Email failed to send to:', party.staffEmail);
          emailResults.push({ email: party.staffEmail, status: 'failed', error: responseText });
        }
      } catch (emailError) {
        console.error('Email sending error for', party.staffEmail, ':', emailError);
        emailResults.push({ email: party.staffEmail, status: 'failed', error: emailError.message });
      }
    }

    console.log('Final email results:', emailResults);

    return new Response(JSON.stringify({ 
      success: true,
      emailResults,
      message: 'Notifications sent to involved parties'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-complaint-notifications function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to send notifications' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
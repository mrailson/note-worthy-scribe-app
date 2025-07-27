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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://91f61816-7ac8-43e0-a21d-31572f57dcab.lovableproject.com';
    
    const emailResults = [];

    for (const party of involvedPartiesData) {
      const responseUrl = `${baseUrl}/complaint-response/${party.accessToken}`;
      
      console.log('Sending email to:', party.staffEmail, 'with response URL:', responseUrl);
      
      const emailData = {
        service_id: emailJsServiceId,
        template_id: emailJsTemplateId,
        user_id: emailJsPublicKey,
        accessToken: emailJsPrivateKey,
        template_params: {
          to_email: party.staffEmail,
          to_name: party.staffName,
          staff_role: party.staffRole,
          complaint_reference: complaint.reference_number,
          complaint_title: complaint.complaint_title,
          complaint_description: complaint.complaint_description,
          patient_name: complaint.patient_name,
          incident_date: new Date(complaint.incident_date).toLocaleDateString('en-GB'),
          practice_name: practiceDetails?.practice_name || 'Medical Practice',
          response_url: responseUrl,
          from_name: practiceDetails?.practice_name || 'Medical Practice',
          reply_to: practiceDetails?.email || 'noreply@practice.nhs.uk',
        },
      };

      console.log('Email template params:', emailData.template_params);

      try {
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        const responseText = await emailResponse.text();
        console.log('EmailJS Response:', emailResponse.status, responseText);

        if (emailResponse.ok) {
          emailResults.push({ email: party.staffEmail, status: 'sent', responseUrl });
        } else {
          emailResults.push({ email: party.staffEmail, status: 'failed', error: responseText });
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
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
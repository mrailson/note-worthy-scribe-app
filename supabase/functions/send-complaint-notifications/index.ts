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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        practice_details!inner(practice_name, address, phone, email)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      throw new Error('Complaint not found');
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

    // Send emails using EmailJS service
    const emailJsServiceId = Deno.env.get('EMAILJS_SERVICE_ID');
    const emailJsTemplateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
    const emailJsPublicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const emailJsPrivateKey = Deno.env.get('EMAILJS_PRIVATE_KEY');

    if (!emailJsServiceId || !emailJsTemplateId || !emailJsPublicKey || !emailJsPrivateKey) {
      throw new Error('EmailJS configuration not complete');
    }

    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('//', '//').replace('.supabase.co', '.supabase.co') || 'https://dphcnbricafkbtizkoal.supabase.co';
    
    const emailResults = [];

    for (const party of involvedPartiesData) {
      const responseUrl = `${baseUrl.replace('.supabase.co', '.lovableproject.com')}/complaint-response/${party.accessToken}`;
      
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
          incident_date: complaint.incident_date,
          practice_name: complaint.practice_details.practice_name,
          response_url: responseUrl,
          from_name: complaint.practice_details.practice_name,
          reply_to: complaint.practice_details.email || 'noreply@practice.nhs.uk',
        },
      };

      try {
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        if (emailResponse.ok) {
          emailResults.push({ email: party.staffEmail, status: 'sent', responseUrl });
        } else {
          const errorText = await emailResponse.text();
          emailResults.push({ email: party.staffEmail, status: 'failed', error: errorText });
        }
      } catch (emailError) {
        emailResults.push({ email: party.staffEmail, status: 'failed', error: emailError.message });
      }
    }

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
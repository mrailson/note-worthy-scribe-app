import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Fetch practice details separately if practice_id exists
    let practiceDetails = null;
    if (complaint.practice_id) {
      const { data: practice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email')
        .eq('id', complaint.practice_id)
        .single();
      practiceDetails = practice;
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

    // Send emails using Resend
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://91f61816-7ac8-43e0-a21d-31572f57dcab.lovableproject.com';
    const emailResults = [];

    for (const party of involvedPartiesData) {
      const responseUrl = `${baseUrl}/complaint-response/${party.accessToken}`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Complaint Input Request - ${complaint.reference_number}
          </h2>
          
          <p>Dear ${party.staffName},</p>
          
          <p>You have been requested to provide input for the following complaint investigation:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">Complaint Details</h3>
            <p><strong>Reference:</strong> ${complaint.reference_number}</p>
            <p><strong>Title:</strong> ${complaint.complaint_title}</p>
            <p><strong>Patient:</strong> ${complaint.patient_name}</p>
            <p><strong>Incident Date:</strong> ${new Date(complaint.incident_date).toLocaleDateString('en-GB')}</p>
            <p><strong>Your Role:</strong> ${party.staffRole}</p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">Complaint Description</h3>
            <p style="white-space: pre-wrap;">${complaint.complaint_description}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${responseUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Provide Your Response
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #6b7280;">
              <strong>Important:</strong> Please review the complaint details carefully and provide your input within 5 working days. 
              Your response will be used as part of the investigation process.
            </p>
            <p style="font-size: 12px; color: #9ca3af;">
              This email was sent from ${practiceDetails?.practice_name || 'Medical Practice'} complaint management system.
            </p>
          </div>
        </div>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: `${practiceDetails?.practice_name || 'Medical Practice'} <complaints@resend.dev>`,
          to: [party.staffEmail],
          subject: `Complaint Input Request - ${complaint.reference_number}`,
          html: emailHtml,
        });

        console.log('Email sent successfully to:', party.staffEmail, emailResponse);
        emailResults.push({ 
          email: party.staffEmail, 
          status: 'sent', 
          responseUrl,
          emailId: emailResponse.data?.id 
        });
        
      } catch (emailError) {
        console.error('Email sending failed for:', party.staffEmail, emailError);
        emailResults.push({ 
          email: party.staffEmail, 
          status: 'failed', 
          error: emailError.message 
        });
      }
    }

    console.log('Email sending completed. Results:', emailResults);

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
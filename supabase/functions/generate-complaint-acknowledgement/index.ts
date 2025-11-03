import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { complaintId } = await req.json();
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

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

    console.log('Complaint data:', {
      id: complaint.id,
      practice_id: complaint.practice_id,
      patient_name: complaint.patient_name
    });

    // Get practice details - prioritize user profile first
    let practiceDetails = null;
    let signatureDetails = null;
    
    console.log('Fetching practice details from user profile first');
    
    // First, try to get practice details from user roles (user profile)
    const { data: userPractice, error: userPracticeError } = await supabase
      .from('user_roles')
      .select(`
        practice_id,
        practice_details!inner (
          id,
          practice_name,
          address,
          phone,
          email,
          logo_url,
          practice_logo_url,
          footer_text,
          website,
          show_page_numbers
        )
      `)
      .eq('user_id', complaint.created_by)
      .not('practice_id', 'is', null)
      .limit(1)
      .single();
    
    console.log('User practice query result:', { userPractice, userPracticeError });
    
    if (userPractice && userPractice.practice_details) {
      practiceDetails = userPractice.practice_details;
      console.log('Retrieved practice details from user profile:', practiceDetails);
    } else if (complaint.practice_id) {
      console.log('Fallback: Fetching practice details for complaint practice_id:', complaint.practice_id);
      const { data: practice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers')
        .eq('id', complaint.practice_id)
        .single();
      practiceDetails = practice;
      console.log('Retrieved practice details from complaint:', practiceDetails);
    } else {
      console.log('Final fallback: fetching practice details directly by practice name');
      const { data: directPractice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers, updated_at')
        .eq('practice_name', 'Oak Lane Medical Practice')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (directPractice) {
        practiceDetails = directPractice;
        console.log('Retrieved practice details directly (latest):', {
          practice_name: practiceDetails.practice_name,
          logo_url: practiceDetails.logo_url,
          practice_logo_url: practiceDetails.practice_logo_url,
          updated_at: practiceDetails.updated_at
        });
      } else {
        console.log('No practice details found by name');
      }
    }

    // Get signature details for the user who created the complaint
    console.log('Fetching signature details for user:', complaint.created_by);
    const { data: signature } = await supabase
      .from('complaint_signatures')
      .select('*')
      .eq('user_id', complaint.created_by)
      .eq('use_for_acknowledgements', true)
      .single();
    signatureDetails = signature;
    console.log('Retrieved signature details:', signatureDetails);

    const systemPrompt = `You are a professional NHS complaints officer writing acknowledgement letters. Generate a formal acknowledgement letter for a patient complaint that:

1. Acknowledges receipt of the complaint
2. Provides the complaint reference number
3. Summarizes the key points of the complaint
4. Explains the NHS complaints process
5. Sets expectations for timelines (20 working days)
6. Provides contact information for queries
7. Is empathetic and professional

IMPORTANT FORMATTING REQUIREMENTS:
- Start with the practice logo/letterhead (if provided via logo URL)
- Include the date in format "DD Month YYYY"
- Follow with "PRIVATE & CONFIDENTIAL" in red text
- Then include the patient's address details
- Format as a clean, professional NHS letter
- End with signature block that includes:
  * "Yours sincerely,"
  * Two blank lines
  * The signatory's name
  * The signatory's job title
  * Practice name
  * Full practice address on separate lines
- NEVER include personal email addresses or phone numbers in contact details
- Only use practice-wide email and phone numbers
- Include practice contact details naturally in the signature area

Format as a formal letter with NHS styling matching standard outcome letter formatting.`;

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const userPrompt = `Generate an acknowledgement letter for this complaint:

Reference: ${complaint.reference_number}
Patient: ${complaint.patient_name}
Patient Address: ${complaint.patient_address || 'Not provided'}
Complaint Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Category: ${complaint.category}
Incident Date: ${complaint.incident_date}
Location/Service: ${complaint.location_service || 'Not specified'}
Date: ${currentDate}

Signature Details:
${signatureDetails ? `
Name: ${signatureDetails.name}
Title: ${signatureDetails.job_title}
Qualifications: ${signatureDetails.qualifications || ''}
Signature Text: ${signatureDetails.signature_text || ''}
` : ''}

Practice Details:
${practiceDetails ? `
Practice Name: ${practiceDetails.practice_name}
Address: ${practiceDetails.address || ''}
Phone: ${practiceDetails.phone || ''}
Email: ${practiceDetails.email || ''}
Website: ${practiceDetails.website || ''}
Footer Text: ${practiceDetails.footer_text || ''}
Show Page Numbers: ${practiceDetails.show_page_numbers ? 'Yes' : 'No'}
` : ''}

Generate a professional acknowledgement letter addressing the specific concerns raised. Include the date at the top of the letter as "${currentDate}". 

IMPORTANT SIGNATURE FORMATTING:
- If patient address is provided, include it in the letter header after "Private & Confidential"
- End the letter with a complete signature block that includes:
  1. "Yours sincerely,"
  2. Two blank lines
  3. ${signatureDetails?.name || '[Signatory Name]'}
  4. ${signatureDetails?.job_title || 'Practice Manager'}
  5. ${practiceDetails?.practice_name || '[Practice Name]'}
  6. ${practiceDetails?.address || '[Practice Address]'} (format address on separate lines)

CRITICAL CONTACT INFORMATION RULES:
- Never include personal email addresses or direct contact details in the signature
- You MUST use the EXACT practice contact details provided above
- ${practiceDetails?.email ? `The practice email is: ${practiceDetails.email} - include this EXACT email address in the letter` : 'Include a generic practice email'}
- ${practiceDetails?.phone ? `The practice phone number is: ${practiceDetails.phone} - include this EXACT phone number in the letter` : 'Indicate phone number is available upon request'}
- DO NOT use placeholders like "[Practice Phone Number]" or "[Practice Email Address]"
- Use the ACTUAL values provided in the Practice Details section above`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    let acknowledgementLetter = data.choices[0].message.content;
    
    // Add practice logo URL to the letter content as HTML comment for Word export
    console.log('Checking for logo URLs:', {
      logo_url: practiceDetails?.logo_url,
      practice_logo_url: practiceDetails?.practice_logo_url
    });
    
    if (practiceDetails?.logo_url || practiceDetails?.practice_logo_url) {
      const logoUrl = practiceDetails.practice_logo_url || practiceDetails.logo_url;
      console.log('Adding logo URL to letter:', logoUrl);
      acknowledgementLetter = `<!-- logo_url: ${logoUrl} -->\n${acknowledgementLetter}`;
    } else {
      console.log('No logo URLs found in practice details');
    }
    
    // Get the authenticated user from the request headers
    const authHeader = req.headers.get('authorization');
    let currentUser: { id: string } | null = null;
    let token: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        token = authHeader.replace('Bearer ', '');
        const { data } = await supabase.auth.getUser(token);
        currentUser = data.user ? { id: data.user.id } : null;
      } catch (error) {
        console.log('Could not get user from token:', (error as Error).message);
      }
    }

    // Create a Supabase client that carries the user's JWT so DB triggers see auth.uid()
    const supabaseAuthed = token
      ? createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        )
      : supabase;

    if (!currentUser?.id) {
      return new Response(JSON.stringify({
        error: 'Unauthenticated request',
        details: 'No user token provided in Authorization header'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store the acknowledgement in the database (use authed client so triggers log with user context)
    const { error: insertError } = await supabaseAuthed
      .from('complaint_acknowledgements')
      .insert({
        complaint_id: complaintId,
        acknowledgement_letter: acknowledgementLetter,
        sent_by: currentUser.id,
      });

    if (insertError) {
      console.error('Database insertion error:', insertError);
      console.error('Insert error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
      throw new Error(`Failed to store acknowledgement: ${insertError.message}`);
    }

    // Update complaint status to "under_review" after acknowledgement is generated
    const { error: statusError } = await supabaseAuthed
      .from('complaints')
      .update({ 
        status: 'under_review',
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', complaintId);

    if (statusError) {
      console.error('Failed to update complaint status:', statusError);
      console.error('Status update error details:', {
        message: statusError.message,
        details: statusError.details,
        hint: statusError.hint,
        code: statusError.code
      });
      // This is critical - throw error so frontend knows status update failed
      throw new Error(`Failed to update complaint status: ${statusError.message}`);
    }
    
    console.log('✅ Successfully updated complaint status to under_review');

    return new Response(JSON.stringify({ 
      acknowledgementLetter,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-complaint-acknowledgement function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate acknowledgement letter' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
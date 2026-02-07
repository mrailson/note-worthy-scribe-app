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

    // Get practice details - priority-based lookup matching My Profile settings
    let practiceDetails = null;
    let signatureDetails = null;
    let signatoryName = null;
    let signatoryTitle = null;
    
    console.log('Fetching practice details for user:', complaint.created_by);
    
    // Fetch user profile (title, role, full_name, letter_signature) from My Profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('title, full_name, role, letter_signature')
      .eq('user_id', complaint.created_by)
      .maybeSingle();
    
    console.log('User profile data:', { 
      title: userProfile?.title, 
      full_name: userProfile?.full_name, 
      role: userProfile?.role,
      has_letter_signature: !!userProfile?.letter_signature 
    });
    
    // PRIORITY 1: Get practice details by user_id (user's own practice settings from My Profile)
    const { data: userPracticeDetails, error: userPracticeError } = await supabase
      .from('practice_details')
      .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers')
      .eq('user_id', complaint.created_by)
      .not('practice_name', 'is', null)
      .neq('practice_name', '')
      .neq('practice_name', 'Default Practice')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    console.log('User practice_details query result:', { userPracticeDetails, error: userPracticeError?.message });
    
    if (userPracticeDetails) {
      practiceDetails = userPracticeDetails;
      console.log('✅ Using user-specific practice_details (highest priority):', practiceDetails.practice_name);
    } else {
      // PRIORITY 2: Fallback via user_roles → gp_practices
      console.log('Fallback: Checking user_roles for practice assignment');
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', complaint.created_by)
        .not('practice_id', 'is', null)
        .limit(1)
        .maybeSingle();
      
      const practiceId = userRole?.practice_id || complaint.practice_id;
      
      if (practiceId) {
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('id, name, address, phone, email, website')
          .eq('id', practiceId)
          .maybeSingle();
        
        if (gpPractice) {
          practiceDetails = {
            practice_name: gpPractice.name,
            address: gpPractice.address,
            phone: gpPractice.phone,
            email: gpPractice.email,
            logo_url: null,
            practice_logo_url: null,
            footer_text: null,
            website: gpPractice.website,
            show_page_numbers: false
          };
          console.log('✅ Retrieved practice from gp_practices via user_roles:', practiceDetails.practice_name);
        }
      }
    }
    
    // PRIORITY 3: Final fallback from complaint's practice_id
    if (!practiceDetails && complaint.practice_id) {
      console.log('Final fallback: Getting practice from complaint.practice_id');
      const { data: complaintPractice } = await supabase
        .from('gp_practices')
        .select('id, name, address, phone, email, website')
        .eq('id', complaint.practice_id)
        .maybeSingle();
      
      if (complaintPractice) {
        practiceDetails = {
          practice_name: complaintPractice.name,
          address: complaintPractice.address,
          phone: complaintPractice.phone,
          email: complaintPractice.email,
          logo_url: null,
          practice_logo_url: null,
          footer_text: null,
          website: complaintPractice.website,
          show_page_numbers: false
        };
        console.log('✅ Retrieved practice from complaint practice_id:', practiceDetails.practice_name);
      }
    }

    if (!practiceDetails) {
      console.log('❌ No practice details found for complaint:', complaintId);
    }

    // Get signature details for the user who created the complaint
    console.log('Fetching signature details for user:', complaint.created_by);
    const { data: signature } = await supabase
      .from('complaint_signatures')
      .select('*')
      .eq('user_id', complaint.created_by)
      .eq('use_for_acknowledgements', true)
      .maybeSingle();
    signatureDetails = signature;
    console.log('Retrieved signature details:', signatureDetails);
    
    // If no dedicated complaint signature, build from profile + auth data
    if (!signatureDetails) {
      console.log('No signature found, building from profile and auth data');
      const { data: authUser } = await supabase.auth.admin.getUserById(complaint.created_by);
      
      if (authUser?.user) {
        const baseName = userProfile?.full_name || authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'Complaints Manager';
        // Prepend title if available (e.g., "Dr Hussain Gandhi")
        signatoryName = userProfile?.title ? `${userProfile.title} ${baseName}` : baseName;
        
        // Determine role: prefer profile.role from My Profile, then user_roles
        if (userProfile?.role) {
          signatoryTitle = userProfile.role;
          console.log('Using role from My Profile:', signatoryTitle);
        } else {
          const { data: userRoleData } = await supabase
            .from('user_roles')
            .select('role, practice_role')
            .eq('user_id', complaint.created_by)
            .maybeSingle();
          
          if (userRoleData?.practice_role) {
            signatoryTitle = userRoleData.practice_role;
          } else if (userRoleData?.role === 'practice_manager') {
            signatoryTitle = 'Practice Manager';
          } else if (userRoleData?.role === 'practice_user' || userRoleData?.role === 'gp' || userRoleData?.role === 'clinical') {
            signatoryTitle = 'GP Partner';
          } else {
            signatoryTitle = 'GP Partner';
          }
        }
        
        // Use letter_signature from My Profile if available
        const letterSignatureText = userProfile?.letter_signature || null;
        
        signatureDetails = {
          name: signatoryName,
          job_title: signatoryTitle,
          qualifications: null,
          signature_text: letterSignatureText,
          email: practiceDetails?.email || null
        };
        console.log('Built signature from profile:', { name: signatoryName, title: signatoryTitle, hasLetterSignature: !!letterSignatureText });
      }
    }

    const systemPrompt = `You are a professional NHS complaints officer writing acknowledgement letters. Generate a formal acknowledgement letter for a patient complaint that:

1. Acknowledges receipt of the complaint
2. Provides the complaint reference number
3. Summarizes the key points of the complaint
4. Explains the NHS complaints process
5. Sets expectations for timelines (20 working days)
6. Provides contact information for queries
7. Is empathetic and professional

CRITICAL LANGUAGE REQUIREMENT - BRITISH ENGLISH ONLY:
- MUST use British English spelling throughout
- Common examples to ALWAYS use British spelling:
  * "organisation" NOT "organization"
  * "centre" NOT "center"
  * "recognise" NOT "recognize"
  * "apologise" NOT "apologize"
  * "realise" NOT "realize"
  * "behaviour" NOT "behavior"
  * "honour" NOT "honor"
  * "favour" NOT "favor"
  * "colour" NOT "color"
  * "programme" NOT "program" (except computer programs)
  * "licence" (noun) NOT "license" (noun)
  * "practise" (verb) NOT "practice" (verb)
- Follow UK business conventions and date formats
- Double-check every word ending in -ize/-ise, -or/-our, -er/-re

IMPORTANT FORMATTING REQUIREMENTS:
- Do NOT include any practice header, letterhead text, or "*Letterhead/Logo Here*" at the start of the letter. The logo is handled separately by the application.
- Start directly with the date in format "DD Month YYYY"
- Follow with "PRIVATE & CONFIDENTIAL"
- Then include the patient's address details
- Format as a clean, professional NHS letter
- Include EXACTLY ONE signature block. Do not repeat the signatory name, practice name, or address anywhere else in the letter.
- The signature block should contain:
  * "Yours sincerely,"
  * Two blank lines
  * The signatory's name
  * The signatory's job title
  * Practice name
- Do NOT include the practice address in the signature block — it should only appear ONCE in the letter header
- NEVER include personal email addresses or phone numbers in contact details
- Only use practice-wide email and phone numbers
- Include practice phone and email as plain text within the body of the letter where you mention how to contact the practice. Do NOT place them in the signature block.

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
` : `
Name: ${signatoryName || 'Complaints Manager'}
Title: ${signatoryTitle || 'Practice Manager'}
`}

Practice Details:
${practiceDetails ? `
Practice Name: ${practiceDetails.practice_name}
Address: ${practiceDetails.address || ''}
Phone: ${practiceDetails.phone || ''}
Email: ${practiceDetails.email || ''}
Website: ${practiceDetails.website || ''}
` : 'No practice details available'}

Generate a professional acknowledgement letter addressing the specific concerns raised. Include the date at the top of the letter as "${currentDate}". 

IMPORTANT SIGNATURE FORMATTING:
- If patient address is provided, include it in the letter header after "Private & Confidential"
- The letter must contain EXACTLY ONE "Yours sincerely" signature block. Do not repeat the signatory name, practice details, or address after the signature.
- End the letter with a signature block that includes:
  1. "Yours sincerely,"
  2. Two blank lines
  3. ${signatureDetails?.name || signatoryName || 'Complaints Manager'} (ONLY ONCE - do not repeat the name)
  4. ${signatureDetails?.job_title || signatoryTitle || 'Practice Manager'}
  5. ${practiceDetails?.practice_name || 'The Practice'}
- Do NOT include the practice address in the signature block

CRITICAL CONTACT INFORMATION RULES:
- Never include personal email addresses or direct contact details in the signature
- You MUST use the EXACT practice contact details provided above
- ${practiceDetails?.email ? `The practice email is: ${practiceDetails.email} - include this EXACT email address in the body of the letter` : 'Include a generic practice email'}
- ${practiceDetails?.phone ? `The practice phone number is: ${practiceDetails.phone} - include this EXACT phone number in the body of the letter` : 'Indicate phone number is available upon request'}
- DO NOT use placeholders like "[Practice Phone Number]" or "[Practice Email Address]" or "[Signatory Name]" or "[Practice Name]"
- Use the ACTUAL values provided in the Signature Details and Practice Details sections above
- Include contact details as plain text in the letter body, NOT as bold-labelled lines in the signature`;

    console.log('Making OpenAI API request...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout
    
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('OpenAI API request timed out');
        throw new Error('Request to OpenAI timed out. Please try again.');
      }
      console.error('OpenAI API fetch error:', fetchError);
      throw new Error(`Failed to connect to OpenAI: ${fetchError.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error?.message || 'OpenAI API error');
      } catch {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    let acknowledgementLetter = data.choices[0].message.content
      .replace(/```[\s\S]*?$/g, '') // Remove markdown code blocks at the end
      .replace(/```/g, '') // Remove any stray backticks
      .trim();
    
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
        sent_at: null, // Explicitly set to null - should only be set when manually marked as sent
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
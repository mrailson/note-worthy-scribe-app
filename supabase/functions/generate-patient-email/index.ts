import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatientEmailRequest {
  transcript: string;
  consultationType?: string;
}

interface GPProfile {
  full_name: string;
  email: string;
}

interface PracticeDetails {
  practice_name: string;
  email: string;
  phone: string;
  address: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, consultationType = "General Consultation" }: PatientEmailRequest = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the current user from the session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('User not authenticated');
    }

    // Get GP profile details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();

    // Get practice details
    const { data: practiceDetails, error: practiceError } = await supabase
      .from('practice_details')
      .select('practice_name, email, phone, address')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    console.log('Profile:', profile);
    console.log('Practice Details:', practiceDetails);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found');
    }

    // Create a comprehensive prompt for the patient email
    const prompt = `You are a GP creating a patient summary email. Based on the consultation transcript below, create ONLY the email body content (do not include subject line, signature, or contact details as these will be added separately).

Create a well-formatted email body that includes:
1. A warm, professional greeting to "Dear Patient"
2. A clear summary of the consultation in simple, non-medical language
3. What was discussed and any findings
4. The agreed treatment plan or next steps
5. Any follow-up instructions or when to contact the practice
6. A simple closing like "I hope this helps clarify our discussion today."

The email should be:
- Written in clear, patient-friendly language
- Professional but warm in tone
- Do NOT include any placeholder names, signatures, or contact details
- Do NOT include "Kind regards" or signature sections
- End with a simple statement like "I hope this summary is helpful"

Consultation Transcript:
${transcript}

Please provide only the email body content without any signatures or contact information.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful GP assistant that creates clear, professional patient communication emails.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedContent = openaiData.choices[0]?.message?.content || '';

    // Format the complete email with GP and practice details
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Clean up any residual signature content from AI response
    let cleanedContent = generatedContent
      .replace(/Kind regards,[\s\S]*$/i, '') // Remove any "Kind regards" and everything after
      .replace(/Best regards,[\s\S]*$/i, '') // Remove any "Best regards" and everything after
      .replace(/Sincerely,[\s\S]*$/i, '') // Remove any "Sincerely" and everything after
      .replace(/\[Your Name\]/g, '') // Remove placeholder names
      .replace(/\[Your Position\]/g, '') // Remove placeholder positions
      .replace(/Mrs\. Johnson|Mr\. Smith|Dear [A-Z][a-z]+ [A-Z][a-z]+/g, 'Dear Patient') // Replace specific names with "Dear Patient"
      .trim();

    const emailContent = `Subject: Your Recent Consultation - ${consultationType}

${cleanedContent}

If you have any questions or concerns, please don't hesitate to contact our practice.

Kind regards,

${profile?.full_name || 'Dr. [Name]'}
${practiceDetails?.practice_name || '[Practice Name]'}

Practice Contact Details:
📧 Email: ${practiceDetails?.email || '[practice@email.com]'}
📞 Phone: ${practiceDetails?.phone || '[Practice Phone]'}
🏥 Address: ${practiceDetails?.address || '[Practice Address]'}

This email was generated on ${currentDate}

---
Please note: This email contains confidential medical information. If you have received this email in error, please contact our practice immediately and delete this message.`;

    return new Response(
      JSON.stringify({ 
        emailContent,
        success: true 
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error generating patient email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
        status: 500,
      }
    );
  }
});
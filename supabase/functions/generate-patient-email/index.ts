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
  console.log('🚀 Generate patient email function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Parsing request body...');
    const { transcript, consultationType = "General Consultation" }: PatientEmailRequest = await req.json();
    console.log('✅ Request parsed:', { transcriptLength: transcript?.length, consultationType });

    console.log('🔐 Checking authorization header...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      throw new Error('No authorization header provided');
    }
    console.log('✅ Authorization header found:', authHeader.substring(0, 20) + '...');

    console.log('🔧 Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Set the auth session manually from the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('👤 Getting current user...');
    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      console.error('❌ User:', user);
      throw new Error('User not authenticated');
    }
    console.log('✅ User authenticated:', user.id);

    console.log('📋 Getting GP profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();
    
    console.log('Profile result:', { profile, profileError });

    console.log('🏥 Getting practice details...');
    const { data: practiceDetails, error: practiceError } = await supabase
      .from('practice_details')
      .select('practice_name, email, phone, address')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    console.log('Practice details result:', { practiceDetails, practiceError });

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }
    console.log('✅ OpenAI API key found');

    // Create a comprehensive prompt for the patient email
    const prompt = `You are a GP creating a patient summary email. Based on the consultation transcript below, create ONLY the main email body content.

Do NOT include:
- Subject lines
- Greetings like "Dear Patient" or "Dear Mrs/Mr [Name]" 
- Any signatures or closing statements
- Contact details

CRITICAL - NEVER start with these clichéd phrases:
- "I hope you are well" / "I hope this finds you well" / "I hope this email finds you well"
- "I trust this email finds you well" / "I trust you are well"
- "Thank you for attending" / "Thank you for coming in today"
- "It was a pleasure to see you" / "It was lovely to meet you"
- "Following our consultation today..." (too generic)
- Any variation of the above

INSTEAD, start DIRECTLY with specific consultation content:
- "During your consultation, we discussed..."
- "Your [blood pressure/symptoms/results] showed..."
- "We reviewed your [condition/medication/health concern]..."
- "Based on our discussion about [specific topic]..."
- Jump straight into the relevant findings or summary

Write in clear, patient-friendly language and include:
1. A summary of what was discussed during the consultation
2. Any findings or diagnoses in simple terms
3. The agreed treatment plan or recommendations
4. Any follow-up instructions
5. When to contact the practice if needed

Keep the tone professional but warm and reassuring.

Consultation Transcript:
${transcript}

Provide only the main body content without any headers, greetings, or signatures.`;

    console.log('🤖 Calling OpenAI API...');
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
      console.error('❌ OpenAI API error:', openaiResponse.status, openaiResponse.statusText);
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ OpenAI response received');
    const generatedContent = openaiData.choices[0]?.message?.content || '';

    // Format the complete email with GP and practice details
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Clean up any residual content from AI response - remove clichéd openings
    let cleanedContent = generatedContent
      .replace(/^Subject:.*$/gm, '') // Remove any subject lines
      .replace(/^Dear (Patient|Mrs\.?|Mr\.?|Ms\.?).*$/gm, '') // Remove any greetings
      .replace(/Kind regards,[\s\S]*$/i, '') // Remove any "Kind regards" and everything after
      .replace(/Best regards,[\s\S]*$/i, '') // Remove any "Best regards" and everything after
      .replace(/Sincerely,[\s\S]*$/i, '') // Remove any "Sincerely" and everything after
      .replace(/\[Your Name\]/g, '') // Remove placeholder names
      .replace(/\[Your Position\]/g, '') // Remove placeholder positions
      // Remove clichéd opening statements
      .replace(/^I hope (you are well|this finds you|this email finds you|all is well).*?\./gi, '')
      .replace(/^I trust (this email finds you|you are).*?\./gi, '')
      .replace(/^Thank you for (attending|coming in|your visit).*?\./gi, '')
      .replace(/^It was (a pleasure|lovely|great) to (see|meet).*?\./gi, '')
      .replace(/^Following (our|your) (recent )?consultation.*?\./gi, '')
      .replace(/^[\s\n]*/, '') // Remove leading whitespace/newlines
      .trim();

    const emailContent = `Subject: Your Recent Consultation - ${consultationType}

Dear Patient,

${cleanedContent}

If you have any questions or concerns, please don't hesitate to contact our practice.

Kind regards,

${profile?.full_name || 'Dr. [Name]'}
${practiceDetails?.practice_name || '[Practice Name]'}

Practice Contact Details:
Email: ${practiceDetails?.email || '[practice@email.com]'}
Phone: ${practiceDetails?.phone || '[Practice Phone]'}
Address: ${practiceDetails?.address || '[Practice Address]'}

This email was generated on ${currentDate}

---
Please note: This email contains confidential medical information. If you have received this email in error, please contact our practice immediately and delete this message.`;

    console.log('✅ Email content generated, length:', emailContent.length);
    
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
    console.error('❌ Error generating patient email:', error);
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslationRequest {
  content: {
    title: string;
    subtitle: string;
    sessionInfo: string;
    patientInfo: string;
    translationLogHeader: string;
    speakerLabels: {
      gp: string;
      patient: string;
    };
  };
  targetLanguage: string;
  practiceInfo: {
    name: string;
    address: string;
    phone?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting patient document translation...');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { content, targetLanguage, practiceInfo }: TranslationRequest = await req.json();
    
    console.log(`Translating patient document to: ${targetLanguage}`);

    // Prepare the translation prompt
    const translationPrompt = `You are translating a medical translation service document for a patient. Translate the following content accurately to ${targetLanguage}, maintaining medical terminology appropriateness for patients while keeping it understandable.

IMPORTANT: Return ONLY a JSON object with the translated content. Do not include any other text, explanations, or markdown formatting.

Content to translate:
${JSON.stringify(content)}

Practice Information to translate:
${JSON.stringify(practiceInfo)}

Return format:
{
  "title": "translated title",
  "subtitle": "translated subtitle", 
  "sessionInfo": "translated session info header",
  "patientInfo": "translated patient info header",
  "translationLogHeader": "translated translation log header",
  "speakerLabels": {
    "gp": "translated GP label",
    "patient": "translated Patient label"
  },
  "practiceInfo": {
    "name": "practice name (keep original)",
    "address": "translated address labels but keep actual address",
    "phone": "translated phone label but keep actual number"
  },
  "generalLabels": {
    "reportGenerated": "translated 'Report Generated' label",
    "sessionDate": "translated 'Session Date' label",
    "sessionStart": "translated 'Session Start' label", 
    "sessionEnd": "translated 'Session End' label",
    "duration": "translated 'Duration' label",
    "patientLanguage": "translated 'Patient Language' label",
    "totalTranslations": "translated 'Total Translations' label",
    "time": "translated 'Time' column header",
    "speaker": "translated 'Speaker' column header",
    "originalText": "translated 'Original Text' column header",
    "translation": "translated 'Translation' column header"
  }
}`;

    console.log('Sending translation request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are a medical translation assistant. Translate document headers and labels accurately while maintaining medical appropriateness for patient understanding. Always respond with valid JSON only.' 
          },
          { role: 'user', content: translationPrompt }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No translation received from OpenAI');
    }

    const translatedContent = data.choices[0].message.content;
    console.log('Raw translation content:', translatedContent);

    // Parse the JSON response
    let parsedTranslation;
    try {
      parsedTranslation = JSON.parse(translatedContent);
    } catch (parseError) {
      console.error('Failed to parse translation JSON:', parseError);
      console.error('Raw content:', translatedContent);
      throw new Error('Invalid JSON response from translation service');
    }

    console.log('Successfully translated patient document');

    return new Response(JSON.stringify({ 
      success: true, 
      translatedContent: parsedTranslation 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in translate-patient-document function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
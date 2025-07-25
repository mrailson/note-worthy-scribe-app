import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComplaintData {
  patient_name?: string;
  patient_dob?: string;
  patient_contact_phone?: string;
  patient_contact_email?: string;
  patient_address?: string;
  incident_date?: string;
  complaint_title?: string;
  complaint_description?: string;
  category?: string;
  location_service?: string;
  staff_mentioned?: string[];
  priority?: string;
  consent_given?: boolean;
  complaint_on_behalf?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const textContent = formData.get('textContent') as string;

    let extractedText = '';

    if (file) {
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      
      console.log(`Processing file: ${file.name}, type: ${fileType}`);

      if (fileType.includes('image/') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
        // Handle image files with OCR using OpenAI Vision
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        const imageAnalysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-2025-04-14',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Please extract all text content from this image. This appears to be a medical complaint or correspondence. Extract all visible text accurately.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${fileType};base64,${base64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 2000
          }),
        });

        if (!imageAnalysisResponse.ok) {
          throw new Error('Failed to process image with OCR');
        }

        const imageData = await imageAnalysisResponse.json();
        extractedText = imageData.choices[0].message.content;
        
      } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
        // Handle PDF files
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // For PDF processing, we'll use a simpler approach by sending to OpenAI
        // In a production environment, you might want to use a dedicated PDF parsing library
        const base64 = btoa(String.fromCharCode(...uint8Array));
        
        // Since OpenAI doesn't directly support PDF, we'll extract text another way
        // For now, we'll ask the user to copy/paste the PDF content
        throw new Error('PDF processing requires a dedicated PDF parser. Please copy and paste the text content instead.');
        
      } else if (fileType.includes('msword') || fileType.includes('wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Handle Word documents
        const arrayBuffer = await file.arrayBuffer();
        
        // We'll need to implement mammoth.js processing here
        // For now, throwing an error to indicate feature needs implementation
        throw new Error('Word document processing requires mammoth.js integration. Please copy and paste the text content instead.');
        
      } else if (fileType.includes('text/') || fileName.endsWith('.txt') || fileName.endsWith('.eml')) {
        // Handle text files and emails
        extractedText = await file.text();
      } else {
        throw new Error(`Unsupported file type: ${fileType}. Please use PDF, Word, image, or text files.`);
      }
    } else if (textContent) {
      extractedText = textContent;
    } else {
      throw new Error('No file or text content provided');
    }

    console.log('Extracted text length:', extractedText.length);

    // Use AI to extract structured complaint data
    const systemPrompt = `You are an expert NHS complaints processor. Extract structured complaint information from the provided text and return it as a JSON object.

Return ONLY a valid JSON object with these fields (use null for missing information):
{
  "patient_name": "Full name of the patient",
  "patient_dob": "Date of birth in YYYY-MM-DD format",
  "patient_contact_phone": "Phone number",
  "patient_contact_email": "Email address", 
  "patient_address": "Full address",
  "incident_date": "Date of incident in YYYY-MM-DD format",
  "complaint_title": "Brief title summarizing the complaint",
  "complaint_description": "Detailed description of the complaint",
  "category": "One of: clinical_care, staff_attitude, appointment_system, communication, facilities, billing, waiting_times, medication, referrals, other",
  "location_service": "Location or service where incident occurred",
  "staff_mentioned": ["Array", "of", "staff", "names", "mentioned"],
  "priority": "One of: low, medium, high, urgent",
  "consent_given": true/false if mentioned,
  "complaint_on_behalf": true/false if complaint is made on behalf of someone else
}

Important:
- Extract dates carefully and convert to YYYY-MM-DD format
- If text appears to be an email, extract the complaint content from the body
- Infer priority based on severity of the complaint
- Identify the most appropriate category based on the complaint content
- Return valid JSON only, no additional text or explanation`;

    const userPrompt = `Extract complaint information from this text:\n\n${extractedText}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('AI Response:', aiResponse);

    // Parse the JSON response
    let complaintData: ComplaintData;
    try {
      complaintData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('AI Response was:', aiResponse);
      throw new Error('Failed to parse AI response as JSON');
    }

    return new Response(JSON.stringify({ 
      success: true,
      extractedText: extractedText.substring(0, 1000), // First 1000 chars for reference
      complaintData,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in import-complaint-data function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      details: 'Failed to import and process complaint data' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
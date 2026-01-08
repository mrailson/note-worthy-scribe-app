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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = await req.formData();
    
    // Log what we received for debugging
    console.log('FormData entries:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value instanceof File ? `File(${value.name})` : value);
    }
    
    const files = formData.getAll('files') as File[];
    const file = formData.get('file') as File; // Also check for single file (backwards compatibility)
    const textContent = formData.get('textContent') as string;

    let extractedText = '';

    // Handle both single file and multiple files
    const filesToProcess = files.length > 0 ? files : (file ? [file] : []);

    if (filesToProcess.length > 0) {
      console.log(`Processing ${filesToProcess.length} file(s)`);
      
      const textParts: string[] = [];
      
      for (const fileItem of filesToProcess) {
        const fileType = fileItem.type;
        const fileName = fileItem.name.toLowerCase();
        
        console.log(`Processing file: ${fileItem.name}, type: ${fileType}`);
        let fileText = '';

        if (fileType.includes('image/') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
          // Handle image files with OCR using OpenAI Vision
          const arrayBuffer = await fileItem.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          
          // Convert to base64 in chunks to avoid stack overflow
          let base64 = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            base64 += String.fromCharCode.apply(null, Array.from(chunk));
          }
          base64 = btoa(base64);
          
          const imageAnalysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
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
            throw new Error(`Failed to process image ${fileItem.name} with OCR`);
          }

          const imageData = await imageAnalysisResponse.json();
          fileText = imageData.choices[0].message.content;
          
        } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
          // Handle PDF files with OCR using OpenAI Vision
          console.log(`Processing PDF file: ${fileItem.name}, size: ${fileItem.size} bytes`);
          const arrayBuffer = await fileItem.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          
          // Convert to base64 in chunks to avoid stack overflow
          let base64 = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            base64 += String.fromCharCode.apply(null, Array.from(chunk));
          }
          base64 = btoa(base64);
          
          console.log(`PDF base64 length: ${base64.length}`);
          
          // Use OpenAI Vision with file input for PDF
          const pdfAnalysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
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
                      text: 'Please extract all text content from this PDF document. This appears to be a medical complaint or correspondence. Extract all visible text accurately, maintaining paragraph structure. Include all patient details, dates, and complaint information.'
                    },
                    {
                      type: 'file',
                      file: {
                        filename: fileItem.name,
                        file_data: `data:application/pdf;base64,${base64}`
                      }
                    }
                  ]
                }
              ],
              max_tokens: 4000
            }),
          });

          if (!pdfAnalysisResponse.ok) {
            const errorData = await pdfAnalysisResponse.json();
            console.error('PDF OCR error:', JSON.stringify(errorData));
            throw new Error(`Failed to extract text from PDF: ${fileItem.name}. ${errorData.error?.message || 'Unknown error'}`);
          }

          const pdfData = await pdfAnalysisResponse.json();
          fileText = pdfData.choices[0].message.content;
          console.log(`Successfully extracted ${fileText.length} characters from PDF ${fileItem.name}`);
          
        } else if (fileType.includes('msword') || fileType.includes('wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
          // Handle Word documents - try XML extraction first, fall back to OCR if needed
          console.log(`Processing Word file: ${fileItem.name}, size: ${fileItem.size} bytes`);
          const arrayBuffer = await fileItem.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          
          // Try to extract text from DOCX (which is a ZIP with XML files)
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const text = decoder.decode(buffer);
          
          // Look for text within <w:t> tags (Word text elements)
          const wordTextMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          const paragraphMatches = text.match(/>([^<]{3,})</g);
          
          let extractedParts: string[] = [];
          
          if (wordTextMatches && wordTextMatches.length > 0) {
            extractedParts = wordTextMatches.map(match => {
              const textMatch = match.match(/<w:t[^>]*>([^<]+)<\/w:t>/);
              return textMatch ? textMatch[1] : '';
            }).filter(t => t.trim().length > 0);
          } else if (paragraphMatches && paragraphMatches.length > 0) {
            extractedParts = paragraphMatches
              .map(match => match.slice(1, -1).trim())
              .filter(text => {
                return text.length > 2 && 
                       !text.startsWith('<?') && 
                       !text.startsWith('<!') &&
                       !/^[a-z]+:/.test(text) &&
                       !/^(xmlns|mc:|w:|r:)/.test(text);
              });
          }
          
          if (extractedParts.length > 0) {
            fileText = extractedParts
              .join(' ')
              .replace(/\s+/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#\d+;/g, ' ')
              .trim();
            
            console.log(`XML extraction got ${fileText.length} characters from ${fileItem.name}`);
          }
          
          // If XML extraction failed or got very little text, use OCR as fallback
          if (!fileText || fileText.length < 50) {
            console.log(`XML extraction insufficient (${fileText?.length || 0} chars), falling back to OCR for ${fileItem.name}`);
            
            // Convert to base64 for OCR
            let base64 = '';
            const chunkSize = 8192;
            for (let i = 0; i < buffer.length; i += chunkSize) {
              const chunk = buffer.subarray(i, i + chunkSize);
              base64 += String.fromCharCode.apply(null, Array.from(chunk));
            }
            base64 = btoa(base64);
            
            const docAnalysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
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
                        text: 'Please extract all text content from this Word document. This appears to be a medical complaint or correspondence. Extract all visible text accurately.'
                      },
                      {
                        type: 'file',
                        file: {
                          filename: fileItem.name,
                          file_data: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 4000
              }),
            });

            if (!docAnalysisResponse.ok) {
              const errorData = await docAnalysisResponse.json();
              console.error('Word OCR error:', JSON.stringify(errorData));
              throw new Error(`Failed to extract text from Word document: ${fileItem.name}. ${errorData.error?.message || 'Unknown error'}`);
            }

            const docData = await docAnalysisResponse.json();
            fileText = docData.choices[0].message.content;
            console.log(`OCR extracted ${fileText.length} characters from ${fileItem.name}`);
          }
          
        } else if (fileType.includes('text/') || fileName.endsWith('.txt') || fileName.endsWith('.eml')) {
          // Handle text files and emails
          fileText = await fileItem.text();
        } else {
          console.error(`Unsupported file type: ${fileType} for file ${fileItem.name}`);
          throw new Error(`Unsupported file type: ${fileType} for file ${fileItem.name}. Please use PDF, Word, image, or text files.`);
        }
        
        if (fileText) {
          textParts.push(`\n\n--- Content from ${fileItem.name} ---\n${fileText}`);
        }
      }
      
      extractedText = textParts.join('\n');
      
    } else if (textContent) {
      extractedText = textContent;
    } else {
      console.error('No files or text content received. FormData keys:', Array.from(formData.keys()));
      throw new Error('No files or text content provided');
    }

    console.log('Total extracted text length:', extractedText.length);

    // Use AI to extract structured complaint data
    const systemPrompt = `You are an expert NHS complaints processor. Extract structured complaint information from the provided text and return it as a JSON object.

IMPORTANT: The text may contain XML artifacts, formatting noise, or be partially garbled from document conversion. Focus on finding the actual complaint content and patient information. Be flexible and look for patterns rather than exact matches.

Return ONLY a valid JSON object with these fields (use null for missing information):
{
  "patient_name": "Full name of the patient",
  "patient_dob": "Date of birth in YYYY-MM-DD format",
  "patient_contact_phone": "Phone number",
  "patient_contact_email": "Email address", 
  "patient_address": "Full address",
  "incident_date": "Date of incident in YYYY-MM-DD format",
  "complaint_title": "Brief title summarizing the complaint (max 10 words)",
  "complaint_description": "A professional, clinical summary of the complaint in 2-4 sentences. Extract the core concerns without preserving offensive language, emotional outbursts, or inappropriate references. Focus on: what happened, when, what the patient is unhappy about, and what outcome they seek. Write in third person, professional tone (e.g. 'The patient reports...').",
  "category": "One of: Clinical Care & Treatment, Prescriptions, Staff Attitude & Behaviour, Appointments & Access, Communication Issues, Test Results & Follow-Up, Confidentiality & Data, Digital Services, Facilities & Environment, Administration, other",
  "location_service": "Location or service where incident occurred",
  "staff_mentioned": ["Array", "of", "staff", "names", "mentioned"],
  "priority": "One of: low, medium, high, urgent",
  "consent_given": true/false if mentioned,
  "complaint_on_behalf": true/false if complaint is made on behalf of someone else
}

CRITICAL: Category Selection Rules (prioritize by severity - highest to lowest):
1. "Clinical Care & Treatment" - Any medical treatment issues, misdiagnosis, clinical errors, patient safety concerns, adverse medical outcomes
2. "Prescriptions" - Prescription errors, wrong medication, adverse reactions due to medical errors, medication dispensing issues
3. "Test Results & Follow-Up" - Delayed or missed test results, inappropriate follow-up care, test result communication failures
4. "Communication Issues" - Breach of confidentiality, inadequate information sharing, critical communication failures, poor information provision
5. "Staff Attitude & Behaviour" - Unprofessional behavior, discrimination, harassment, rudeness, inappropriate conduct
6. "Appointments & Access" - Missed appointments causing health issues, booking system failures, access to care problems
7. "Confidentiality & Data" - Data breaches, privacy violations, confidentiality concerns
8. "Digital Services" - Online booking issues, digital system failures, technology-related problems
9. "Facilities & Environment" - Unsafe or inadequate medical facilities, cleanliness issues, environment problems
10. "Administration" - Administrative errors, billing issues, record keeping problems
11. "other" - Anything not covered above

If multiple complaint categories apply, ALWAYS select the most serious category from the hierarchy above.

CRITICAL SUMMARISATION RULES for complaint_description:
- NEVER copy offensive language, profanity, or inappropriate references verbatim
- Summarise the complaint professionally in 2-4 sentences maximum
- Focus on factual concerns rather than emotional expression
- Write in third person, clinical tone (e.g., "The patient reports..." or "The complainant states...")
- If the patient mentions specific staff, note that staff were mentioned but do not repeat accusations verbatim
- Extract the core issue: what happened, when, impact on patient, and desired resolution

Important:
- The text may be messy with XML tags, namespaces, or formatting artifacts - ignore these and focus on readable content
- Look for common field markers: "Name:", "Patient:", "Date of Birth:", "DOB:", "Email:", "Phone:", "Tel:", "Address:", etc.
- Extract dates carefully and convert to YYYY-MM-DD format
- If text appears to be an email, extract the complaint content from the body
- Infer priority based on severity of the complaint
- ALWAYS choose the most serious applicable category when multiple issues are present
- Be flexible with formatting - the information might not be perfectly structured
- Return valid JSON only, no additional text or explanation`;

    const userPrompt = `Extract complaint information from this text:\n\n${extractedText}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

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

// --- Handwriting-aware OCR prompt ---
const HANDWRITING_OCR_PROMPT = `You are an expert document transcriber specialising in handwritten NHS complaint letters.

CRITICAL RULES:
1. Transcribe ONLY what you can actually read. Do NOT invent or guess content.
2. For any word you are uncertain about, append [?] immediately after it (e.g. "Thornton[?]")
3. For completely illegible words, write [illegible]
4. NEVER guess dates, NHS numbers, phone numbers, or postcodes. If you cannot read them clearly, write [illegible] instead.
5. Describe the letter structure you see (greeting, body paragraphs, sign-off) but do NOT invent missing sections.
6. Preserve line breaks and paragraph structure as closely as possible.
7. If a section of the letter is obscured, smudged, or cut off, note it as [section illegible] or [text cut off].

After the transcription, add a section:
---CONFIDENCE NOTES---
List any words or sections you were uncertain about, with brief explanations (e.g. "Line 3: name could be 'Thomson' or 'Thornton'").`;

// --- Strict transcription prompt for second pass ---
const STRICT_TRANSCRIPTION_PROMPT = `You are a careful document reader. Transcribe the visible text from this image as accurately as possible.

Rules:
- Only write what you can clearly see
- Use [unclear] for any word you cannot read with confidence
- Use [illegible] for completely unreadable sections
- Do NOT add any interpretation, context, or invented content
- Do NOT guess names, dates, or numbers — mark them [unclear] if not perfectly legible
- Preserve the original structure and line breaks`;

function isImageFile(fileType: string, fileName: string): boolean {
  return fileType.includes('image/') || 
    fileName.endsWith('.jpg') || 
    fileName.endsWith('.jpeg') || 
    fileName.endsWith('.png') ||
    fileName.endsWith('.webp');
}

async function toBase64(fileItem: File): Promise<string> {
  const arrayBuffer = await fileItem.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let base64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    base64 += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(base64);
}

async function ocrImageWithPrompt(
  openaiApiKey: string,
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
          ]
        }
      ],
      max_tokens: 3000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OCR failed: ${err.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Compare key fields between two OCR passes and flag disagreements
function compareOCRPasses(pass1: string, pass2: string): { 
  verification_status: 'verified' | 'partial' | 'unverified';
  disagreements: string[];
} {
  const disagreements: string[] = [];
  
  // Extract potential dates from both
  const datePattern = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g;
  const dates1 = pass1.match(datePattern) || [];
  const dates2 = pass2.match(datePattern) || [];
  if (dates1.join(',') !== dates2.join(',')) {
    disagreements.push('Dates differ between passes');
  }
  
  // Extract potential NHS numbers
  const nhsPattern = /\b\d{3}\s?\d{3}\s?\d{4}\b/g;
  const nhs1 = pass1.match(nhsPattern) || [];
  const nhs2 = pass2.match(nhsPattern) || [];
  if (nhs1.join(',') !== nhs2.join(',')) {
    disagreements.push('NHS numbers differ between passes');
  }
  
  // Extract potential phone numbers
  const phonePattern = /\b(?:0\d{10}|0\d{4}\s?\d{6}|\+44\s?\d{10})\b/g;
  const phones1 = pass1.match(phonePattern) || [];
  const phones2 = pass2.match(phonePattern) || [];
  if (phones1.join(',') !== phones2.join(',')) {
    disagreements.push('Phone numbers differ between passes');
  }
  
  // Check general similarity (word overlap)
  const words1 = new Set(pass1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(pass2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = [...words1].filter(w => words2.has(w));
  const overlap = intersection.length / Math.max(words1.size, words2.size);
  
  if (overlap < 0.5) {
    disagreements.push('Major text content disagreement between passes');
  }

  const verification_status = disagreements.length === 0 ? 'verified' 
    : disagreements.length <= 2 ? 'partial' 
    : 'unverified';
    
  return { verification_status, disagreements };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = await req.formData();
    
    console.log('FormData entries:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value instanceof File ? `File(${value.name})` : value);
    }
    
    const files = formData.getAll('files') as File[];
    const file = formData.get('file') as File;
    const textContent = formData.get('textContent') as string;
    
    // Check if this is an OCR-only request (for image preview step)
    const ocrOnly = formData.get('ocrOnly') === 'true';

    let extractedText = '';
    let isImageImport = false;
    let verificationStatus: 'verified' | 'partial' | 'unverified' | 'not_applicable' = 'not_applicable';
    let confidenceNotes = '';
    let disagreements: string[] = [];

    const filesToProcess = files.length > 0 ? files : (file ? [file] : []);

    if (filesToProcess.length > 0) {
      console.log(`Processing ${filesToProcess.length} file(s)`);
      
      const textParts: string[] = [];
      
      for (const fileItem of filesToProcess) {
        const fileType = fileItem.type;
        const fileName = fileItem.name.toLowerCase();
        
        console.log(`Processing file: ${fileItem.name}, type: ${fileType}`);
        let fileText = '';

        if (isImageFile(fileType, fileName)) {
          // --- HANDWRITING-AWARE DUAL-PASS OCR ---
          isImageImport = true;
          const base64 = await toBase64(fileItem);
          const mimeType = fileType || 'image/jpeg';
          
          console.log('Running handwriting-aware OCR pass 1...');
          const pass1Result = await ocrImageWithPrompt(openaiApiKey, base64, mimeType, HANDWRITING_OCR_PROMPT);
          
          // Extract confidence notes from pass 1
          const confSplit = pass1Result.split('---CONFIDENCE NOTES---');
          const pass1Text = confSplit[0].trim();
          if (confSplit.length > 1) {
            confidenceNotes += confSplit[1].trim() + '\n';
          }
          
          console.log('Running strict transcription pass 2...');
          const pass2Text = await ocrImageWithPrompt(openaiApiKey, base64, mimeType, STRICT_TRANSCRIPTION_PROMPT);
          
          // Compare the two passes
          const comparison = compareOCRPasses(pass1Text, pass2Text);
          verificationStatus = comparison.verification_status;
          disagreements = comparison.disagreements;
          
          console.log(`Dual-pass verification: ${verificationStatus}, disagreements: ${disagreements.length}`);
          
          // Use pass 1 (handwriting-aware) as the primary text
          fileText = pass1Text;
          
        } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
          const base64 = await toBase64(fileItem);
          console.log(`Processing PDF file: ${fileItem.name}, base64 length: ${base64.length}`);
          
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
          console.log(`Processing Word file: ${fileItem.name}, size: ${fileItem.size} bytes`);
          const arrayBuffer = await fileItem.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const text = decoder.decode(buffer);
          
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
          
          if (!fileText || fileText.length < 50) {
            console.log(`XML extraction insufficient, falling back to OCR for ${fileItem.name}`);
            const base64 = await toBase64(fileItem);
            
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

    // If OCR-only mode, return the raw text for user review
    if (ocrOnly) {
      return new Response(JSON.stringify({
        success: true,
        ocrOnly: true,
        extractedText,
        isImageImport,
        verificationStatus,
        confidenceNotes,
        disagreements,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Hallucination-guarded structuring prompt ---
    const systemPrompt = `You are an expert NHS complaints processor. Extract structured complaint information from the provided text and return it as a JSON object.

IMPORTANT: The text may contain XML artifacts, formatting noise, or be partially garbled from document conversion. Focus on finding the actual complaint content and patient information. Be flexible and look for patterns rather than exact matches.

CRITICAL HALLUCINATION PREVENTION RULES:
- If a field value was marked [illegible], [unclear], or [?] in the source text, set that field to null rather than guessing.
- NEVER infer an NHS number, date of birth, or phone number that is not clearly present in the source text.
- If the source text contains [illegible] where a name should be, set patient_name to null — do NOT guess a name.
- If a date is marked [illegible] or [?], set the date field to null.
- For each field you populate, it MUST be directly supported by clearly readable text.

Return ONLY a valid JSON object with these fields (use null for missing or uncertain information):
{
  "patient_name": "Full name of the patient (null if illegible or uncertain)",
  "patient_dob": "Date of birth in YYYY-MM-DD format (null if not clearly present)",
  "patient_contact_phone": "Phone number (null if not clearly readable)",
  "patient_contact_email": "Email address (null if not clearly readable)", 
  "patient_address": "Full address (null if not clearly readable)",
  "incident_date": "Date of incident in YYYY-MM-DD format (null if not clearly present)",
  "complaint_title": "Brief title summarizing the complaint (max 10 words)",
  "complaint_description": "A professional, clinical summary of the complaint in 2-4 sentences. Extract the core concerns without preserving offensive language, emotional outbursts, or inappropriate references. Focus on: what happened, when, what the patient is unhappy about, and what outcome they seek. Write in third person, professional tone (e.g. 'The patient reports...'). If significant portions are illegible, note that in the summary.",
  "category": "One of: Clinical Care & Treatment, Prescriptions, Staff Attitude & Behaviour, Appointments & Access, Communication Issues, Test Results & Follow-Up, Confidentiality & Data, Digital Services, Facilities & Environment, Administration, other",
  "location_service": "Location or service where incident occurred (null if unclear)",
  "staff_mentioned": ["Array", "of", "staff", "names", "mentioned"],
  "priority": "One of: low, medium, high, urgent",
  "consent_given": true/false if mentioned,
  "complaint_on_behalf": true/false if complaint is made on behalf of someone else,
  "low_confidence_fields": ["array of field names where the source text was uncertain, marked with [?], [illegible], or [unclear]"]
}

CRITICAL: Category Selection Rules (prioritize by severity - highest to lowest):
1. "Clinical Care & Treatment" - Any medical treatment issues, misdiagnosis, clinical errors, patient safety concerns
2. "Prescriptions" - Prescription errors, wrong medication, adverse reactions
3. "Test Results & Follow-Up" - Delayed or missed test results
4. "Communication Issues" - Breach of confidentiality, inadequate information sharing
5. "Staff Attitude & Behaviour" - Unprofessional behavior, discrimination, harassment
6. "Appointments & Access" - Missed appointments, booking failures, access problems
7. "Confidentiality & Data" - Data breaches, privacy violations
8. "Digital Services" - Online booking issues, digital system failures
9. "Facilities & Environment" - Unsafe or inadequate facilities
10. "Administration" - Administrative errors, billing issues
11. "other" - Anything not covered above

If multiple categories apply, ALWAYS select the most serious category.

CRITICAL SUMMARISATION RULES for complaint_description:
- NEVER copy offensive language, profanity, or inappropriate references verbatim
- Summarise professionally in 2-4 sentences maximum
- Focus on factual concerns rather than emotional expression
- Write in third person, clinical tone
- If the patient mentions specific staff, note that staff were mentioned but do not repeat accusations verbatim

Important:
- The text may be messy with XML tags, namespaces, or formatting artifacts — ignore these
- Look for common field markers: "Name:", "Patient:", "Date of Birth:", "DOB:", etc.
- Extract dates carefully and convert to YYYY-MM-DD format
- Infer priority based on severity
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
        temperature: 0.1,
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

    let complaintData: ComplaintData & { low_confidence_fields?: string[] };
    try {
      complaintData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('AI Response was:', aiResponse);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Extract low_confidence_fields before returning
    const lowConfidenceFields = complaintData.low_confidence_fields || [];
    delete (complaintData as any).low_confidence_fields;

    return new Response(JSON.stringify({ 
      success: true,
      extractedText: extractedText.substring(0, 1000),
      complaintData,
      isImageImport,
      verificationStatus,
      confidenceNotes,
      lowConfidenceFields,
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

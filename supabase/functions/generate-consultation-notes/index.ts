import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TranscriptEntry = {
  t: string;
  speaker: "Patient" | "Clinician";
  text: string;
};

type GenerateNotesRequest = {
  consultationId: string;
  transcript: TranscriptEntry[];
  consultationType: "face_to_face" | "telephone";
  preferredTemplateId?: string;
  outputMode?: "shorthand" | "standard";
  redactIdentifiers?: boolean;
};

type GenerateNotesResponse = {
  templateId: string;
  confidence: number;
  summaryLine: string;
  shorthand: { S: string; O: string; A: string; P: string };
  standard: { S: string; O: string; A: string; P: string };
  patientCopy: string;
  referral: string;
  review: string;
  classifier: { label: string; score: number };
};

// Template classifiers based on keywords and patterns
const TEMPLATE_CLASSIFIERS = [
  {
    id: "urti",
    name: "General Consultation (URTI)",
    keywords: ["sore throat", "blocked nose", "cough", "cold", "runny nose", "sniffles", "congestion"],
    patterns: /\b(throat|nose|cough|cold|flu|viral|upper respiratory)\b/gi
  },
  {
    id: "uti",
    name: "UTI (Cystitis)",
    keywords: ["dysuria", "frequency", "urgency", "burning", "urine", "bladder"],
    patterns: /\b(dysuria|frequency|urgency|urine|bladder|cystitis|uti)\b/gi
  },
  {
    id: "lbp",
    name: "Musculoskeletal (Back Pain)",
    keywords: ["back pain", "lower back", "lumbar", "sciatica", "spine"],
    patterns: /\b(back pain|lumbar|sciatica|spine|vertebral)\b/gi
  },
  {
    id: "t2dm",
    name: "Long-Term Condition Review (Diabetes)",
    keywords: ["diabetes", "blood sugar", "glucose", "hba1c", "metformin"],
    patterns: /\b(diabetes|diabetic|glucose|hba1c|metformin|insulin)\b/gi
  },
  {
    id: "depression",
    name: "Mental Health (Depression)",
    keywords: ["depression", "anxiety", "mood", "sleep", "mental health"],
    patterns: /\b(depression|anxiety|mood|mental health|sleep|iapt)\b/gi
  }
];

function classifyConsultation(transcript: TranscriptEntry[]): { label: string; score: number; templateId: string } {
  const fullText = transcript.map(entry => entry.text).join(" ").toLowerCase();
  
  let bestMatch = { templateId: "urti", label: "General Consultation (URTI)", score: 0.1 };
  
  for (const template of TEMPLATE_CLASSIFIERS) {
    let score = 0;
    
    // Keyword matching
    for (const keyword of template.keywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        score += 0.2;
      }
    }
    
    // Pattern matching
    const matches = fullText.match(template.patterns) || [];
    score += matches.length * 0.15;
    
    // Boost score if multiple related terms
    if (score > 0.3) score += 0.2;
    
    if (score > bestMatch.score) {
      bestMatch = {
        templateId: template.id,
        label: template.name,
        score: Math.min(score, 0.95) // Cap confidence
      };
    }
  }
  
  return bestMatch;
}

function redactIdentifiers(text: string): string {
  if (!text) return text;
  
  // Redact phone numbers
  text = text.replace(/\b\d{10,11}\b/g, "[PHONE]");
  text = text.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]");
  
  // Redact email addresses
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]");
  
  // Redact NHS numbers (10 digits with optional spaces)
  text = text.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, "[NHS_NUMBER]");
  
  // Redact postcodes
  text = text.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, "[POSTCODE]");
  
  return text;
}

serve(async (req) => {
  console.log('🚀 Generate consultation notes function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData = await req.json();
    console.log('📥 Request received:', { 
      consultationId: requestData.consultationId,
      hasTranscript: !!requestData.transcript,
      transcriptType: typeof requestData.transcript,
      transcriptLength: typeof requestData.transcript === 'string' 
        ? requestData.transcript.length 
        : requestData.transcript?.length,
      consultationType: requestData.consultationType 
    });

    // Validate required fields
    if (!requestData.consultationId) {
      console.error('❌ Missing consultationId');
      return new Response(
        JSON.stringify({ error: 'consultationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!requestData.consultationType) {
      console.error('❌ Missing consultationType');
      return new Response(
        JSON.stringify({ error: 'consultationType is required (face_to_face or telephone)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle both string and array transcript formats
    let transcript: TranscriptEntry[];
    let transcriptText: string;
    
    if (typeof requestData.transcript === 'string') {
      // If transcript is a string, convert it to the expected format
      console.log('📝 Converting string transcript to array format');
      transcriptText = requestData.transcript;
      
      // Parse the transcript into entries (simple split by lines)
      const lines = requestData.transcript.split('\n').filter(line => line.trim());
      transcript = lines.map((line, index) => {
        const speakerMatch = line.match(/^(.*?):\s*(.*)$/);
        if (speakerMatch) {
          const speaker = speakerMatch[1].toLowerCase().includes('patient') ? 'Patient' : 'Clinician';
          return {
            t: `${index}`,
            speaker: speaker as "Patient" | "Clinician",
            text: speakerMatch[2]
          };
        }
        return {
          t: `${index}`,
          speaker: 'Clinician' as "Patient" | "Clinician",
          text: line
        };
      });
    } else if (Array.isArray(requestData.transcript)) {
      // Use the array directly
      transcript = requestData.transcript;
      transcriptText = transcript
        .map(entry => `${entry.speaker}: ${entry.text}`)
        .join('\n');
    } else {
      console.error('❌ Invalid transcript format:', typeof requestData.transcript);
      return new Response(
        JSON.stringify({ error: 'Invalid transcript format - must be string or array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript || transcript.length === 0) {
      console.error('❌ Empty transcript after parsing');
      return new Response(
        JSON.stringify({ error: 'No valid transcript content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcriptText || transcriptText.trim().length < 10) {
      console.error('❌ Transcript too short:', transcriptText?.length);
      return new Response(
        JSON.stringify({ error: 'Transcript is too short to generate meaningful notes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Transcript validated:', { 
      entryCount: transcript.length, 
      textLength: transcriptText.length 
    });

    // Step 1: Classify consultation
    console.log('🔍 Classifying consultation...');
    const classifier = classifyConsultation(transcript);
    console.log('📊 Classification result:', classifier);

    console.log('📝 Transcript length:', transcriptText.length);

    // Step 3: Generate SOAP notes using OpenAI
    console.log('🤖 Generating SOAP notes...');
    const soapPrompt = `
As a UK GP, convert this consultation transcript into structured SOAP notes. 

Consultation Type: ${requestData.consultationType}
Detected Category: ${classifier.label}

Transcript:
${transcriptText}

Please provide both GP shorthand and standard detail versions:

SHORTHAND (GP abbreviations, concise):
S: [Patient symptoms, history - use GP abbreviations like c/o, SOB, CP, etc.]
O: [Examination findings, observations - abbreviated]
A: [Assessment/diagnosis - concise]
P: [Management plan - abbreviated]

STANDARD (Full clinical detail):
S: [Complete subjective information]
O: [Full objective findings]
A: [Detailed assessment]
P: [Comprehensive plan with safety-netting]

Also provide:
SUMMARY_LINE: [One-line summary for SystmOne]
PATIENT_COPY: [Patient-friendly explanation in plain English]
REFERRAL: [Referral guidance if needed, or "Not indicated"]
REVIEW: [Follow-up recommendations and safety-netting]

CLINICAL_ACTIONS: Extract structured clinical actions as:
{
  "medications": [list of prescriptions with doses],
  "investigations": [labs, imaging ordered],
  "followUp": [when to return, what to monitor],
  "redFlags": [warning signs to watch for],
  "other": [any other actions]
}

Format as JSON with keys: shorthand, standard, summaryLine, patientCopy, referral, review, clinicalActions
`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced UK GP generating clinical documentation. Always include appropriate safety-netting advice.'
          },
          {
            role: 'user',
            content: soapPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ OpenAI response received');

    let generatedContent;
    try {
      // Try to parse JSON from OpenAI response
      const content = openaiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON, using fallback structure');
      // Fallback structure
      const content = openaiData.choices[0].message.content;
      generatedContent = {
        shorthand: { S: "Generated content", O: "See transcript", A: "Assessment", P: "Plan" },
        standard: { S: "Generated content", O: "See transcript", A: "Assessment", P: "Plan" },
        summaryLine: `${classifier.label} - consultation completed`,
        patientCopy: "Consultation summary available",
        referral: "Not indicated",
        review: "Follow-up as needed"
      };
    }

    // Step 4: Apply redaction if requested
    if (requestData.redactIdentifiers) {
      console.log('🔒 Applying identifier redaction...');
      generatedContent.patientCopy = redactIdentifiers(generatedContent.patientCopy);
    }

    // Step 5: Build final response
    const response: GenerateNotesResponse = {
      templateId: classifier.templateId,
      confidence: classifier.score,
      summaryLine: generatedContent.summaryLine,
      shorthand: generatedContent.shorthand,
      standard: generatedContent.standard,
      patientCopy: generatedContent.patientCopy,
      referral: generatedContent.referral,
      review: generatedContent.review,
      clinicalActions: generatedContent.clinicalActions || {},
      classifier: {
        label: classifier.label,
        score: classifier.score
      }
    };

    // Step 6: Store in database
    console.log('💾 Saving consultation notes...');
    const { error: saveError } = await supabase
      .from('consultation_notes')
      .upsert({
        id: requestData.consultationId,
        notes: response,
        transcript: requestData.transcript,
        consultation_type: requestData.consultationType,
        template_id: response.templateId,
        confidence_score: response.confidence,
        created_by: req.headers.get('authorization') ? 'authenticated_user' : 'anonymous'
      });

    if (saveError) {
      console.error('❌ Database save error:', saveError);
      // Don't fail the request, just log the error
    } else {
      console.log('✅ Consultation notes saved successfully');
    }

    console.log('🎉 Notes generation completed successfully');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error generating consultation notes:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to generate consultation notes'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
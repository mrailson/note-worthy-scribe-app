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
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header and set the user context
    const authHeader = req.headers.get('authorization');
    let currentUserId = null;
    
    if (authHeader) {
      const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
      currentUserId = user?.id;
    }

    const requestData: GenerateNotesRequest = await req.json();
    console.log('📥 Request data:', { 
      consultationId: requestData.consultationId,
      transcriptLength: requestData.transcript?.length,
      consultationType: requestData.consultationType 
    });

    if (!requestData.transcript || requestData.transcript.length === 0) {
      throw new Error('No transcript provided');
    }

    // Step 1: Classify consultation
    console.log('🔍 Classifying consultation...');
    const classifier = classifyConsultation(requestData.transcript);
    console.log('📊 Classification result:', classifier);

    // Step 2: Build transcript text
    const transcriptText = requestData.transcript
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n');

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

Format as JSON with keys: shorthand, standard, summaryLine, patientCopy, referral, review
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
      classifier: {
        label: classifier.label,
        score: classifier.score
      }
    };

    // Step 6: Store in database
    console.log('💾 Saving consultation notes...');
    const { error: saveError } = await supabaseClient
      .from('consultation_notes')
      .upsert({
        id: requestData.consultationId,
        notes: response,
        transcript: requestData.transcript,
        consultation_type: requestData.consultationType,
        template_id: response.templateId,
        confidence_score: response.confidence,
        created_by: currentUserId
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
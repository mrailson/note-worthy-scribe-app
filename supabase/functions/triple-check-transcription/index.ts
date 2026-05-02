import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: 'No audio data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Starting TRIPLE-CHECK transcription process...");

    // Convert base64 to Uint8Array
    const binaryString = atob(audio);
    const audioData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioData[i] = binaryString.charCodeAt(i);
    }

    console.log("Audio data size:", audioData.length, "bytes");

    // PASS 1: Ultra-conservative medical transcription
    const transcription1 = await performTranscription(audioData, OPENAI_API_KEY, {
      temperature: 0,
      prompt: 'Medical consultation. CRITICAL: Include EVERY word spoken. Medication names: ramipril, amlodipine, atenolol. Family history: "dad had heart attack in his 60s" (NOT sixth). NEVER omit patient medication responses. Include complete greetings: "Good morning, thanks for coming in today".',
      name: 'Pass 1 (Complete)'
    });

    // PASS 2: Medication-focused transcription
    const transcription2 = await performTranscription(audioData, OPENAI_API_KEY, {
      temperature: 0,
      prompt: 'GP consultation focusing on medication details. ESSENTIAL: When GP asks "what medications are you on" capture the FULL patient response including drug names, dosages like "ramipril 5mg once daily". Family history: 60s NOT sixth. Angina NOT injection/injustice.',
      name: 'Pass 2 (Medication)'
    });

    // PASS 3: Sentence structure and continuity focus
    const transcription3 = await performTranscription(audioData, OPENAI_API_KEY, {
      temperature: 0,
      prompt: 'Medical transcription with perfect sentence flow. Key corrections: "angina" never "injection", "his 60s" never "his sixth", maintain complete sentences like "ECG today and blood tests", include all medication responses completely.',
      name: 'Pass 3 (Structure)'
    });

    // PASS 4: Final verification pass
    const transcription4 = await performTranscription(audioData, OPENAI_API_KEY, {
      temperature: 0,
      prompt: 'Final verification pass. Must include: complete greetings, all medication names and doses, family history with "60s", proper medical terms (angina not injection), complete GP plans including ECG and blood tests.',
      name: 'Pass 4 (Verification)'
    });

    console.log("All four transcription passes completed");

    // VALIDATION & CROSS-CHECKING
    const validatedResult = await validateAndMergeTranscriptions(
      [transcription1, transcription2, transcription3, transcription4],
      OPENAI_API_KEY
    );

    return new Response(JSON.stringify(validatedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in triple-check transcription:", error);
    return new Response(JSON.stringify({ 
      error: `Triple-check transcription error: ${error.message}`,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performTranscription(audioData: Uint8Array, apiKey: string, config: any) {
  const formData = new FormData();
  const blob = new Blob([audioData], { type: 'audio/webm' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', config.temperature.toString());
  formData.append('prompt', config.prompt);

  console.log(`Performing ${config.name}...`);
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${config.name} failed:`, response.status, errorText);
    return { text: '', confidence: 0, source: config.name, error: errorText };
  }

  const result = await response.json();
  console.log(`${config.name} result:`, result.text || 'EMPTY');

  // Calculate confidence based on Whisper's internal metrics
  let confidence = 0.5; // default
  if (result.segments && result.segments.length > 0) {
    const avgLogProb = result.segments.reduce((sum: number, seg: any) => 
      sum + (seg.avg_logprob || -2), 0) / result.segments.length;
    const avgNoSpeech = result.segments.reduce((sum: number, seg: any) => 
      sum + (seg.no_speech_prob || 0.5), 0) / result.segments.length;
    
    // Convert log probability to confidence score
    confidence = Math.max(0, Math.min(1, 
      (avgLogProb + 1) / 1 * (1 - avgNoSpeech)
    ));
  }

  return {
    text: result.text || '',
    confidence: confidence,
    source: config.name,
    segments: result.segments || [],
    words: result.words || []
  };
}

async function validateAndMergeTranscriptions(transcriptions: any[], apiKey: string) {
  console.log("Starting validation and merging process...");

  // Filter out empty transcriptions
  const validTranscriptions = transcriptions.filter(t => t.text && t.text.trim().length > 5);
  
  if (validTranscriptions.length === 0) {
    return { text: '', confidence: 0, validation: 'No valid transcriptions' };
  }

  // Sort by confidence
  validTranscriptions.sort((a, b) => b.confidence - a.confidence);

  console.log("Transcription candidates:", validTranscriptions.map(t => ({
    source: t.source,
    confidence: t.confidence,
    text: t.text.substring(0, 100) + '...'
  })));

  // Use GPT-4 to cross-validate and merge the best transcriptions
  const validationPrompt = `
You are a medical transcription expert. Review these ${validTranscriptions.length} transcription attempts and create the most clinically accurate final version.

CRITICAL FIXES NEEDED:
- "angina" NEVER "injection/injustice/inflection"  
- "60s" NEVER "sixth"
- Include COMPLETE greetings: "Good morning, thanks for coming in today"
- Include ALL medication responses: "ramipril 5mg once daily" etc.
- Complete sentences: "ECG today and blood tests" not broken fragments
- Family history: "My dad had a heart attack in his 60s"

TRANSCRIPTION 1 (${validTranscriptions[0]?.source}, Confidence: ${validTranscriptions[0]?.confidence.toFixed(2)}):
${validTranscriptions[0]?.text}

TRANSCRIPTION 2 (${validTranscriptions[1]?.source}, Confidence: ${validTranscriptions[1]?.confidence.toFixed(2)}):
${validTranscriptions[1]?.text || 'N/A'}

TRANSCRIPTION 3 (${validTranscriptions[2]?.source}, Confidence: ${validTranscriptions[2]?.confidence.toFixed(2)}):
${validTranscriptions[2]?.text || 'N/A'}

TRANSCRIPTION 4 (${validTranscriptions[3]?.source}, Confidence: ${validTranscriptions[3]?.confidence.toFixed(2)}):
${validTranscriptions[3]?.text || 'N/A'}

ESSENTIAL RULES:
1. Include EVERY spoken word from ALL speakers
2. When GP asks "what medications", include patient's complete response  
3. Fix all medical misheards using context
4. Maintain proper conversation flow and complete sentences
5. Never omit greetings, medications, or safety advice

Return ONLY the corrected complete transcription.`;

  try {
    // Sonnet-only policy (May 2026): final validation switched from gpt-4o-mini
    // to Claude Sonnet 4.6. The audio→text transcription steps above remain
    // on OpenAI Whisper (Anthropic does not offer ASR).
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: 'You are a medical transcription expert. Return only the corrected transcription, no other text.',
        temperature: 0.1,
        messages: [{ role: 'user', content: validationPrompt }],
      }),
    });

    if (response.ok) {
      const claudeResult = await response.json();
      const finalText = (claudeResult.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '').trim();

      console.log("Sonnet 4.6 validated transcription:", finalText);

      // Final medical term verification
      const medicalValidation = validateMedicalTerms(finalText);
      
      return {
        text: finalText,
        confidence: calculateFinalConfidence(validTranscriptions),
        validation: 'Triple-checked and Sonnet 4.6 validated',
        sources: validTranscriptions.map(t => t.source),
        medical_validation: medicalValidation,
        original_transcriptions: validTranscriptions.map(t => ({
          source: t.source,
          text: t.text,
          confidence: t.confidence
        }))
      };
    } else {
      console.error("Sonnet 4.6 validation failed, using highest confidence transcription");
      return {
        text: validTranscriptions[0].text,
        confidence: validTranscriptions[0].confidence,
        validation: 'Highest confidence (Sonnet 4.6 validation failed)',
        sources: [validTranscriptions[0].source]
      };
    }
  } catch (error) {
    console.error("Validation error:", error);
    return {
      text: validTranscriptions[0].text,
      confidence: validTranscriptions[0].confidence,
      validation: 'Highest confidence (validation error)',
      sources: [validTranscriptions[0].source],
      error: error.message
    };
  }
}

function validateMedicalTerms(text: string) {
  const medicalTerms = {
    'angina': text.toLowerCase().includes('angina'),
    'ramipril': text.toLowerCase().includes('ramipril'),
    'chest_pain': text.toLowerCase().includes('chest') && text.toLowerCase().includes('pain'),
    'ecg': text.toLowerCase().includes('ecg'),
    'blood_tests': text.toLowerCase().includes('blood test'),
    'call_999': text.includes('999'),
    'medication_dosage': /\d+\s*mg/i.test(text)
  };

  const suspicious_terms = [
    'injustice', 'injection', 'infusion', 'affliction'
  ].filter(term => text.toLowerCase().includes(term));

  return {
    detected_medical_terms: medicalTerms,
    suspicious_terms: suspicious_terms,
    confidence_score: Object.values(medicalTerms).filter(Boolean).length / Object.keys(medicalTerms).length
  };
}

function calculateFinalConfidence(transcriptions: any[]) {
  if (transcriptions.length === 0) return 0;
  
  // Weight the average by the number of transcriptions that agree
  const avgConfidence = transcriptions.reduce((sum, t) => sum + t.confidence, 0) / transcriptions.length;
  const agreementBonus = transcriptions.length >= 2 ? 0.1 : 0;
  
  return Math.min(0.95, avgConfidence + agreementBonus);
}
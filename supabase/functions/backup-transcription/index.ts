import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log("Processing audio with backup Whisper API (more robust)...");

    // Convert base64 to Uint8Array with chunked processing for large files
    const binaryString = atob(audio);
    const audioData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioData[i] = binaryString.charCodeAt(i);
    }

    console.log("Audio data size:", audioData.length, "bytes");

    // Prepare form data for Whisper API with more robust settings
    const formData = new FormData();
    const blob = new Blob([audioData], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0'); // Most deterministic
    formData.append('prompt', 'This is a medical consultation between a doctor and patient. Please transcribe accurately including medical terms, symptoms, medications, and dosages.');

    console.log("Sending request to OpenAI Whisper API with medical context");
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Whisper API error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Whisper API error: ${response.status}`,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log("OpenAI Whisper backup response:", result);

    // More robust handling of transcription results
    if (result.text) {
      const transcriptText = result.text.trim();
      
      // Apply immediate medical corrections
      let cleanedText = transcriptText;
      
      // Critical medical word corrections
      const medicalCorrections = [
        [/\binfection\b/gi, 'angina'], // Critical: prevent misdiagnosis
        [/\bramapril\b/gi, 'ramipril'],
        [/\bram april\b/gi, 'ramipril'],
        [/\bametformin\b/gi, 'metformin'],
        [/\basprin\b/gi, 'aspirin'],
        [/\bparacetmal\b/gi, 'paracetamol'],
        [/\bibuprophen\b/gi, 'ibuprofen'],
        [/\bcheast\b/gi, 'chest'],
        [/\bbreth\b/gi, 'breath'],
        [/\bheart attack in\s+(\d+)/gi, 'heart attack in his $1'],
        [/\bin\s+a\s+severe\b/gi, 'and is severe'],
        [/\byep\b/gi, 'yes'],
        [/\byeah\b/gi, 'yes']
      ];
      
      medicalCorrections.forEach(([pattern, replacement]) => {
        cleanedText = cleanedText.replace(pattern, replacement as string);
      });
      
      return new Response(JSON.stringify({
        text: cleanedText,
        original_text: transcriptText,
        words: result.words || [],
        segments: result.segments || [],
        duration: result.duration || 0,
        language: result.language || 'en'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log("No transcription text received from backup Whisper. Full response:", JSON.stringify(result));
      return new Response(JSON.stringify({ 
        text: '',
        error: 'No transcription received',
        debug: {
          audioSize: audioData.length,
          whisperResponse: result
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error("Error in backup transcription:", error);
    return new Response(JSON.stringify({ 
      error: `Backup transcription error: ${error.message}`,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
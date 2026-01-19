import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OTEWELL NHS Governance & Clinical Terms for word boosting
const nhsGovernanceTerms = [
  // OTEWELL Primary Care & Ageing Well
  "Ageing Well", "Frailty", "frailty score", "LD", "Learning Disability",
  "QOF", "DES", "Arden", "EMIS", "SystmOne", "NHFT", "PCN", "PCM",
  // Clinical governance & safety
  "CGA", "CQC", "clinical negligence", "indemnity", "safeguarding",
  "ACP", "DNACPR", "ReSPECT", "coronial", "complaint",
  "clinical negligence scheme", "liability",
  // NHS organisations & roles
  "ARRS", "ICS", "ICB", "HCA", "ANP", "SPLW", "NP", "PA",
  "AccuRx", "Docman", "TeamNet", "eConsult", "NHS",
  // Clinical measurements
  "BP", "blood pressure", "systolic", "diastolic", "pulse",
  "SpO2", "oxygen saturation", "BMI", "weight", "height",
  "eGFR", "HbA1c", "cholesterol", "LDL", "HDL", "NEWS", "NEWS2",
  // Common medications
  "metformin", "gliclazide", "sitagliptin", "empagliflozin", "semaglutide",
  "ramipril", "lisinopril", "amlodipine", "atenolol", "bisoprolol",
  "atorvastatin", "simvastatin", "omeprazole", "lansoprazole",
  "sertraline", "citalopram", "fluoxetine", "mirtazapine", "amitriptyline",
  "gabapentin", "pregabalin", "salbutamol", "Ventolin", "Fostair",
  "warfarin", "apixaban", "rivaroxaban", "edoxaban",
  // Clinical conditions
  "diabetes", "type 2 diabetes", "hypertension", "COPD", "asthma",
  "CKD", "chronic kidney disease", "atrial fibrillation", "AF",
  "dementia", "Alzheimer's", "cognitive impairment", "MCI",
  "depression", "anxiety", "osteoarthritis",
  // Procedures & referrals
  "phlebotomy", "ECG", "spirometry", "24-hour BP", "ABPM",
  "urgent referral", "2WW", "two week wait", "MDT",
  // Administrative
  "fit note", "sick note", "DVLA", "prescription", "repeat prescription",
  "home visit", "telephone consultation", "face to face",
  "annual review", "medication review", "SMR",
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[AssemblyAI-Transcription] OTEWELL mode - Processing request...');

  try {
    const { audio, mimeType, chunkIndex } = await req.json();
    
    if (!audio) {
      return Response.json({ error: 'No audio data provided' }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const assemblyApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyApiKey) {
      console.error('[AssemblyAI-Transcription] API key not found');
      return Response.json({ error: 'AssemblyAI API key not configured' }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`[AssemblyAI-Transcription] Processing chunk ${chunkIndex}, size: ${audio.length} chars`);

    // Decode base64 audio
    const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    console.log(`[AssemblyAI-Transcription] Decoded audio: ${audioBytes.length} bytes, MIME: ${mimeType}`);
    
    // Skip very small audio chunks 
    if (audioBytes.length < 1000) {
      console.log(`[AssemblyAI-Transcription] Skipping tiny chunk: ${audioBytes.length} bytes`);
      return Response.json({ 
        text: '', 
        confidence: 0, 
        chunkIndex,
        note: 'Chunk too small to process' 
      }, { headers: corsHeaders });
    }

    // Create form data for AssemblyAI upload with proper file extension
    const formData = new FormData();
    const fileExtension = mimeType?.includes('wav') ? 'wav' : 'webm';
    const audioBlob = new Blob([audioBytes], { type: mimeType || 'audio/wav' });
    formData.append('audio', audioBlob, `chunk-${chunkIndex}.${fileExtension}`);

    // Upload audio to AssemblyAI
    console.log('[AssemblyAI-Transcription] Uploading to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': assemblyApiKey,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      console.error('[AssemblyAI-Transcription] Upload failed:', uploadError);
      return Response.json({ error: 'Audio upload failed' }, { 
        status: uploadResponse.status, 
        headers: corsHeaders 
      });
    }

    const uploadResult = await uploadResponse.json();
    const audioUrl = uploadResult.upload_url;
    console.log('[AssemblyAI-Transcription] Audio uploaded, URL:', audioUrl);

    // Submit transcription job with OTEWELL configuration
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'en_gb',
        speech_model: 'best',
        
        // OTEWELL: Disable all cleanup for verbatim capture
        punctuate: false,
        format_text: false,
        
        // OTEWELL: Enable speaker diarisation
        speaker_labels: true,
        speakers_expected: 3, // GP, Patient, possible companion
        
        // OTEWELL: Capture everything including profanity
        filter_profanity: false,
        
        // OTEWELL: NHS governance vocabulary boosting
        word_boost: nhsGovernanceTerms,
        boost_param: 'high',
        
        // OTEWELL: Include confidence scores for transparency
        word_confidence: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const transcriptError = await transcriptResponse.text();
      console.error('[AssemblyAI-Transcription] Transcript request failed:', transcriptError);
      return Response.json({ error: 'Transcription request failed' }, { 
        status: transcriptResponse.status, 
        headers: corsHeaders 
      });
    }

    const transcriptJob = await transcriptResponse.json();
    const transcriptId = transcriptJob.id;
    console.log('[AssemblyAI-Transcription] Transcription job created:', transcriptId);

    // Poll for completion (AssemblyAI is async)
    let attempts = 0;
    const maxAttempts = 60; // 1 minute max wait
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyApiKey,
        },
      });

      if (!statusResponse.ok) {
        console.error('[AssemblyAI-Transcription] Status check failed');
        break;
      }

      const result = await statusResponse.json();
      console.log(`[AssemblyAI-Transcription] Status: ${result.status}, attempt ${attempts + 1}`);

      if (result.status === 'completed') {
        console.log('[AssemblyAI-Transcription] OTEWELL transcription completed successfully');
        
        // OTEWELL: Include utterances with speaker labels if available
        const utterances = result.utterances || [];
        const speakerText = utterances.length > 0 
          ? utterances.map((u: { speaker: string; text: string }) => `[Speaker ${u.speaker}]: ${u.text}`).join('\n')
          : result.text || '';
        
        return Response.json({
          text: speakerText,
          confidence: result.confidence || 0.9,
          chunkIndex,
          processingTime: attempts + 1,
          // OTEWELL: Include word-level data for clinical review
          words: result.words || [],
          utterances: utterances,
        }, { headers: corsHeaders });
      }

      if (result.status === 'error') {
        console.error('[AssemblyAI-Transcription] Transcription failed:', result.error);
        return Response.json({ error: `Transcription failed: ${result.error}` }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      attempts++;
    }

    // Timeout
    console.error('[AssemblyAI-Transcription] Transcription timeout');
    return Response.json({ error: 'Transcription timeout' }, { 
      status: 408, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('[AssemblyAI-Transcription] Error:', error);
    return Response.json({ error: 'Internal server error: ' + error.message }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
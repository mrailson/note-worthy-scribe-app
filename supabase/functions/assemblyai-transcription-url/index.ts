import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NHS Governance & Clinical Terms for word boosting
const nhsGovernanceTerms = [
  "Ageing Well", "Frailty", "frailty score", "LD", "Learning Disability",
  "QOF", "DES", "Arden", "EMIS", "SystmOne", "NHFT", "PCN", "PCM",
  "CGA", "CQC", "clinical negligence", "indemnity", "safeguarding",
  "ACP", "DNACPR", "ReSPECT", "coronial", "complaint",
  "ARRS", "ICS", "ICB", "HCA", "ANP", "SPLW", "NP", "PA",
  "AccuRx", "Docman", "TeamNet", "eConsult", "NHS",
  "BP", "blood pressure", "systolic", "diastolic", "pulse",
  "SpO2", "oxygen saturation", "BMI", "eGFR", "HbA1c", "cholesterol",
  "metformin", "gliclazide", "sitagliptin", "empagliflozin", "semaglutide",
  "ramipril", "lisinopril", "amlodipine", "atenolol", "bisoprolol",
  "atorvastatin", "simvastatin", "omeprazole", "lansoprazole",
  "diabetes", "type 2 diabetes", "hypertension", "COPD", "asthma",
  "CKD", "chronic kidney disease", "atrial fibrillation", "AF",
  "dementia", "Alzheimer's", "cognitive impairment",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[AssemblyAI-URL] Processing request with storage URL...');

  try {
    const { storagePath, fileName } = await req.json();
    
    if (!storagePath) {
      return Response.json({ error: 'No storage path provided' }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const assemblyApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyApiKey) {
      console.error('[AssemblyAI-URL] API key not found');
      return Response.json({ error: 'AssemblyAI API key not configured' }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Create Supabase client to get signed URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[AssemblyAI-URL] Getting signed URL for: ${storagePath}`);

    // Get a signed URL for the audio file (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audio-imports')
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[AssemblyAI-URL] Failed to get signed URL:', signedUrlError);
      return Response.json({ error: 'Failed to access audio file' }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const audioUrl = signedUrlData.signedUrl;
    console.log('[AssemblyAI-URL] Got signed URL, submitting to AssemblyAI...');

    // Submit transcription job directly with the URL (no upload needed)
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'en_uk', // British English
        speech_model: 'best',
        punctuate: true,
        format_text: true,
        speaker_labels: true,
        speakers_expected: 4,
        filter_profanity: false,
        word_boost: nhsGovernanceTerms,
        boost_param: 'high',
      }),
    });

    if (!transcriptResponse.ok) {
      const transcriptError = await transcriptResponse.text();
      console.error('[AssemblyAI-URL] Transcript request failed:', transcriptError);
      return Response.json({ error: 'Transcription request failed' }, { 
        status: transcriptResponse.status, 
        headers: corsHeaders 
      });
    }

    const transcriptJob = await transcriptResponse.json();
    const transcriptId = transcriptJob.id;
    console.log('[AssemblyAI-URL] Transcription job created:', transcriptId);

    // Poll for completion (max 5 minutes for large files)
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'Authorization': assemblyApiKey },
      });

      if (!statusResponse.ok) {
        console.error('[AssemblyAI-URL] Status check failed');
        break;
      }

      const result = await statusResponse.json();
      
      if (attempts % 10 === 0) {
        console.log(`[AssemblyAI-URL] Status: ${result.status}, attempt ${attempts + 1}`);
      }

      if (result.status === 'completed') {
        console.log('[AssemblyAI-URL] Transcription completed successfully');
        
        // Format with speaker labels if available
        const utterances = result.utterances || [];
        const speakerText = utterances.length > 0 
          ? utterances.map((u: { speaker: string; text: string }) => `[Speaker ${u.speaker}]: ${u.text}`).join('\n\n')
          : result.text || '';
        
        // Clean up the uploaded file
        await supabase.storage.from('audio-imports').remove([storagePath]);
        console.log('[AssemblyAI-URL] Cleaned up temporary file');
        
        return Response.json({
          text: speakerText,
          confidence: result.confidence || 0.9,
          duration: result.audio_duration,
          fileName,
        }, { headers: corsHeaders });
      }

      if (result.status === 'error') {
        console.error('[AssemblyAI-URL] Transcription failed:', result.error);
        return Response.json({ error: `Transcription failed: ${result.error}` }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      attempts++;
    }

    console.error('[AssemblyAI-URL] Transcription timeout after 5 minutes');
    return Response.json({ error: 'Transcription timeout - file may be too long' }, { 
      status: 408, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('[AssemblyAI-URL] Error:', error);
    return Response.json({ error: 'Internal server error: ' + error.message }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});

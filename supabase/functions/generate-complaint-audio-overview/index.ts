import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { complaintId, voiceProvider = 'elevenlabs', voiceId = 'G17SuINrv2H9FC6nvetn', overrideText } = await req.json();
    
    if (!complaintId) {
      throw new Error('complaintId is required');
    }

    console.log('Generating audio overview for complaint:', complaintId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get comprehensive complaint data (fetch practice separately to avoid FK issues)
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        complaint_outcomes (*),
        complaint_involved_parties (staff_name, staff_role, response_text),
        complaint_notes (note, is_internal)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      console.error('Error loading complaint:', complaintError);
      throw new Error('Unable to load complaint details');
    }

    // Check if complaint has outcome
    if (!complaint.complaint_outcomes || complaint.complaint_outcomes.length === 0) {
      throw new Error('Complaint must have an outcome to generate audio overview');
    }

    const outcome = complaint.complaint_outcomes[0];
    
    // Auto-close complaint if it has an outcome but isn't closed
    if (complaint.status !== 'closed') {
      console.log('Auto-closing complaint with outcome...');
      const { error: closeError } = await supabase
        .from('complaints')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', complaintId);
      
      if (closeError) {
        console.warn('Failed to auto-close complaint:', closeError);
        // Continue anyway - outcome exists
      } else {
        console.log('Complaint auto-closed successfully');
      }
    }
    
    let narrative: string;
    
    // Use overrideText if provided, otherwise generate with AI
    if (overrideText && overrideText.trim()) {
      console.log('Using provided override text for audio generation');
      narrative = overrideText.trim();
    } else {
      console.log('Generating executive summary narrative with Lovable AI...');

      // Generate narrative using Lovable AI
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableApiKey) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      // Gather staff responses
      const staffResponses = (complaint.complaint_involved_parties || [])
        .filter((p: any) => p.response_text)
        .map((p: any) => `${p.staff_name} (${p.staff_role}): ${p.response_text.slice(0, 500)}`)
        .join('\n\n');

      // Gather internal notes
      const internalNotes = (complaint.complaint_notes || [])
        .filter((n: any) => n.is_internal)
        .map((n: any) => n.note.slice(0, 300))
        .join(' ');

      // Resolve practice name
      let practiceName = 'our practice';
      if (complaint.practice_id) {
        const { data: practice, error: practiceError } = await supabase
          .from('gp_practices')
          .select('practice_name')
          .eq('id', complaint.practice_id)
          .maybeSingle();
        if (practiceError) {
          console.warn('Practice lookup error:', practiceError);
        } else if (practice?.practice_name) {
          practiceName = practice.practice_name;
        }
      }
      
      const systemPrompt = `You are an NHS complaints executive briefing specialist. Create a concise, focused spoken summary under 1 minute for practice management.

Guidelines:
- Start with "Complaint number [number] received on the [date in format: 7th November] concerns [brief issue]" - extract ONLY the sequential complaint number by removing ALL prefix letters/digits and leading zeros (e.g., "COMP260007" → "7", "COMP250046" → "46", "COMP260001" → "1"). Never read the full reference code or year digits.
- Use the complaint submitted date for "received on" date
- Format date as: the 7th of November, the 12th of January, the 23rd of December (ordinal day + "of" + full month name, always preceded by "the")
- DO NOT say "Good morning", "Notewell AI Summary", or any preambles
- DO NOT read out the full reference code
- Keep the opening concern description to maximum 5-7 words
- PRIMARILY FOCUS on: key learnings identified, specific actions taken, and ongoing improvements to consider
- Emphasise alignment with NHS best practice and CQC expectations
- Use plain narrative prose without formatting characters (* = # - bullets etc.)
- NO stage directions, sound effects, or script notations
- Target 120-150 words maximum for under 1 minute speaking time
- British English spelling and phrasing throughout
- Structure: Brief particulars with date → Key learnings → Actions taken → Recommended improvements for CQC compliance

CRITICAL - DO NOT HALLUCINATE:
- ONLY use information explicitly provided in the complaint data
- DO NOT invent, embellish, or add specific technical details not mentioned
- DO NOT create fictional actions like "full audits", "system reconfigurations", or specific technical steps unless explicitly stated
- If something is vague in the source, keep it vague in the summary
- Stick strictly to documented facts - no creative interpretation or elaboration`;

      const userPrompt = `Complaint Reference: ${complaint.reference_number}
Complaint Received Date: ${complaint.submitted_at ? new Date(complaint.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : new Date(complaint.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
Patient: ${complaint.patient_name}
Category: ${complaint.category}
Incident Date: ${complaint.incident_date}

Complaint Description:
${complaint.complaint_description.slice(0, 800)}

${staffResponses ? `Staff Responses:\n${staffResponses.slice(0, 1000)}\n\n` : ''}

${internalNotes ? `Investigation Notes:\n${internalNotes.slice(0, 600)}\n\n` : ''}

Outcome: ${outcome.outcome_type}
${outcome.outcome_summary ? `\nOutcome Summary:\n${outcome.outcome_summary.slice(0, 800)}` : ''}

Create an under-1-minute executive audio briefing. 

CRITICAL: Only use the information provided above. Do not invent, embellish, or add details not explicitly stated. If actions are described generally (e.g., "staff trained"), keep them general in your summary - do not add fictional specifics like "full audits conducted" or "system reconfigurations completed".

Start with "Complaint number [number in words] received on the [use the Complaint Received Date above in format like the 7th November] concerns [brief 5-7 word summary of issue]". Then focus primarily on: the key learnings identified from this complaint, the specific actions taken in response (ONLY as documented above), and ongoing improvements the practice should consider in line with NHS best practice and CQC regulatory expectations. Keep it concise and actionable for practice management.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', errorText);
        
        // Handle rate limits and credits
        if (aiResponse.status === 429) {
          throw new Error('Rate limits exceeded, please try again later.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Payment required, please add funds to your Lovable AI workspace.');
        }
        
        throw new Error('Failed to generate narrative');
      }

      const aiData = await aiResponse.json();
      narrative = aiData.choices[0].message.content;
    }
    
    console.log('Generated narrative length:', narrative.length);

    // Convert narrative to audio using ElevenLabs TTS
    console.log(`Converting to audio with ${voiceProvider} TTS, voice: ${voiceId}`);
    
    const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
      body: { 
        text: narrative,
        voiceId: voiceId 
      },
    });

    if (ttsError) {
      console.error('TTS error:', ttsError);
      throw new Error(`Failed to convert to audio: ${ttsError.message}`);
    }

    const { audioContent } = ttsData;

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const fileName = `${complaint.reference_number}-${Date.now()}.mp3`;
    
    console.log('Uploading audio to storage...');
    
    const { error: uploadError } = await supabase.storage
      .from('complaint-audio-overviews')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '0',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('complaint-audio-overviews')
      .getPublicUrl(fileName);

    const rawUrl = urlData.publicUrl;
    const audioUrl = `${rawUrl}?v=${Date.now()}`;

    // Estimate duration (rough: ~150 words per minute, 5 chars per word average)
    const estimatedWords = narrative.length / 5;
    const estimatedDuration = Math.ceil((estimatedWords / 150) * 60); // in seconds

    // Save to database
    console.log('Saving audio overview metadata to database...');

    // Get current user
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Upsert audio overview record
    const { error: dbError } = await supabase
      .from('complaint_audio_overviews')
      .upsert({
        complaint_id: complaintId,
        audio_overview_url: audioUrl,
        audio_overview_text: narrative,
        audio_overview_duration: estimatedDuration,
        created_by: userId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'complaint_id'
      });

    if (dbError) {
      console.error('Database update error:', dbError);
      throw new Error('Failed to save audio overview metadata');
    }

    console.log('Complaint audio overview generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        audioUrl,
        duration: estimatedDuration,
        narrative: narrative.slice(0, 200) + '...' // Preview only
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Generate complaint audio overview error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes('Rate limits') ? 429 : error.message.includes('Payment required') ? 402 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

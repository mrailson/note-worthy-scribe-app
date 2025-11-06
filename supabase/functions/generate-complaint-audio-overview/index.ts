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

    // Get comprehensive complaint data
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

    // Check if complaint is closed and has outcome
    if (complaint.status !== 'closed' || !complaint.complaint_outcomes || complaint.complaint_outcomes.length === 0) {
      throw new Error('Complaint must be closed with an outcome to generate audio overview');
    }

    const outcome = complaint.complaint_outcomes[0];
    
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

      const systemPrompt = `You are an NHS complaints executive briefing specialist. Create a clear, professional 1-2 minute spoken summary for practice partners and management to quickly understand this complaint.

Guidelines:
- Write in a clear, conversational executive briefing tone
- Structure: What happened → Investigation findings → Decision → Key learnings → Management considerations
- Use plain narrative prose without formatting characters (* = # - bullets etc.)
- NO stage directions, sound effects, or script notations
- Target 160-320 words for 1-2 minutes speaking time
- British English spelling and phrasing throughout
- Be factual and balanced, acknowledging both patient concerns and practice perspective
- Highlight specific actions taken and improvements made
- Include relevant compliance or governance points
- Make it digestible - partners need the essence, not every detail`;

      const userPrompt = `Complaint Reference: ${complaint.reference_number}
Patient: ${complaint.patient_name}
Category: ${complaint.category}
Incident Date: ${complaint.incident_date}

Complaint Description:
${complaint.complaint_description.slice(0, 800)}

${staffResponses ? `Staff Responses:\n${staffResponses.slice(0, 1000)}\n\n` : ''}

${internalNotes ? `Investigation Notes:\n${internalNotes.slice(0, 600)}\n\n` : ''}

Outcome: ${outcome.outcome_type}
${outcome.outcome_summary ? `\nOutcome Summary:\n${outcome.outcome_summary.slice(0, 800)}` : ''}

Create a 1-2 minute executive audio briefing of this complaint for practice management. Focus on the key points they need to know: what happened, what we found, what we decided, what we learned, and what they should consider going forward.`;

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

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
    const { meetingId, voiceProvider = 'deepgram', voiceId, overrideText, targetDuration = 2 } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    console.log('Generating audio overview for meeting:', meetingId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get meeting title and start time
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('title, start_time')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('Error loading meeting:', meetingError);
      throw new Error('Unable to load meeting');
    }

    // Format meeting date for the audio script opening
    const meetingDate = meeting.start_time ? new Date(meeting.start_time) : new Date();
    const dayOfWeek = meetingDate.toLocaleDateString('en-GB', { weekday: 'long' });
    const formattedDate = meetingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Get aggregated transcript from chunks (prefer cleaned_text)
    const { data: chunks, error: chunksError } = await supabase
      .from('meeting_transcription_chunks')
      .select('cleaned_text, transcription_text, seq')
      .eq('meeting_id', meetingId)
      .order('seq', { ascending: true });

    if (chunksError) {
      console.warn('No transcription chunks found or error:', chunksError);
    }

    const transcript = (chunks ?? [])
      .map((c: any) => c.cleaned_text || c.transcription_text || '')
      .filter((t: string) => t && t.trim().length > 0)
      .join(' ')
      .slice(0, 10000);

    // Get latest meeting summary for context (optional)
    const { data: summaries } = await supabase
      .from('meeting_summaries')
      .select('summary, updated_at')
      .eq('meeting_id', meetingId)
      .order('updated_at', { ascending: false })
      .limit(1);

    const meetingNotes = summaries?.[0]?.summary || '';
    
    let narrative: string;
    
    // Use overrideText if provided, otherwise generate with AI
    if (overrideText && overrideText.trim()) {
      console.log('Using provided override text for audio generation');
      narrative = overrideText.trim();
    } else {
      if (!transcript && !meetingNotes) {
        throw new Error('No transcript or summary available for this meeting');
      }

      console.log('Generating informal narrative with Lovable AI...');

      // Generate informal narrative using Lovable AI
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableApiKey) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const wordCountTarget = Math.round(targetDuration * 140); // ~140 words per minute for comfortable speaking
      const systemPrompt = `Create a ${targetDuration}-minute spoken overview of this meeting as if you're briefing a GP partner who couldn't attend.

Guidelines:
- Write in a clear, professional conversational tone
- ALWAYS start with: "At this meeting on ${dayOfWeek} the ${formattedDate}..." then continue with the main topics
- Use plain narrative prose without any formatting characters
- NO special characters (* = # - bullets etc.) - they don't read well when spoken
- NO stage directions, sound effects, or script notations
- Summarise key decisions, actions, and outcomes in a straightforward manner
- Target ${wordCountTarget} words for approximately ${targetDuration} minutes speaking time
- British English spelling and phrasing
- Be informative and concise, like a colleague catching up another colleague
- Include specific details about outcomes and next steps when relevant
- ${targetDuration > 2 ? 'Provide more detailed coverage of key topics and discussions' : 'Keep it concise and focused on main points'}`;

      const userPrompt = `Meeting Title: ${meeting.title}

${meetingNotes ? `Meeting Notes:\n${meetingNotes.slice(0, 3000)}\n\n` : ''}
${transcript ? `Meeting Transcript:\n${transcript.slice(0, 4000)}` : ''}

Create an informal ${targetDuration}-minute audio overview of this meeting.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', errorText);
        throw new Error('Failed to generate narrative');
      }

      const aiData = await aiResponse.json();
      narrative = aiData.choices[0].message.content;
    }
    
    console.log('Generated narrative length:', narrative.length);

    // Convert narrative to audio using selected TTS provider
    const ttsFunction = voiceProvider === 'elevenlabs' ? 'elevenlabs-tts' : 'deepgram-tts';
    console.log(`Converting to audio with ${voiceProvider} TTS...`, voiceId ? `voiceId: ${voiceId}` : '');
    
    const ttsBody: any = { text: narrative };
    if (voiceId) {
      ttsBody.voiceId = voiceId;
    }
    
    const { data: ttsData, error: ttsError } = await supabase.functions.invoke(ttsFunction, {
      body: ttsBody,
    });

    if (ttsError) {
      console.error('TTS error:', ttsError);
      throw new Error(`Failed to convert to audio: ${ttsError.message}`);
    }

    const { audioContent, wasTruncated, processedLength } = ttsData;
    
    if (wasTruncated) {
      console.log('Audio was truncated from', narrative.length, 'to', processedLength, 'characters');
    }

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const fileName = `${meetingId}/overview.mp3`;
    
    console.log('Uploading audio to storage...');
    
    const { error: uploadError } = await supabase.storage
      .from('meeting-audio-overviews')
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
      .from('meeting-audio-overviews')
      .getPublicUrl(fileName);

    const rawUrl = urlData.publicUrl;
    const audioUrl = `${rawUrl}?v=${Date.now()}`;

    // Estimate duration (very rough: ~150 words per minute, 5 chars per word average)
    const estimatedWords = narrative.length / 5;
    const estimatedDuration = Math.ceil((estimatedWords / 150) * 60); // in seconds

    // Save to database
    console.log('Saving audio overview metadata to database...');

    // Check if overview record exists to avoid NOT NULL constraint issues on overview
    const { data: existingOverview } = await supabase
      .from('meeting_overviews')
      .select('id')
      .eq('meeting_id', meetingId)
      .maybeSingle();

    let dbError = null as any;

    if (existingOverview?.id) {
      const { error } = await supabase
        .from('meeting_overviews')
        .update({
          audio_overview_url: audioUrl,
          audio_overview_text: narrative,
          audio_overview_duration: estimatedDuration,
          updated_at: new Date().toISOString(),
        })
        .eq('meeting_id', meetingId);
      dbError = error;
    } else {
      const fallbackOverview = (meetingNotes || transcript)?.slice(0, 600) || '';
      const { error } = await supabase
        .from('meeting_overviews')
        .insert({
          meeting_id: meetingId,
          overview: fallbackOverview, // required NOT NULL
          audio_overview_url: audioUrl,
          audio_overview_text: narrative,
          audio_overview_duration: estimatedDuration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      dbError = error;
    }

    if (dbError) {
      console.error('Database update error:', dbError);
      throw new Error('Failed to save audio overview metadata');
    }

    console.log('Audio overview generated successfully');

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
    console.error('Generate audio overview error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

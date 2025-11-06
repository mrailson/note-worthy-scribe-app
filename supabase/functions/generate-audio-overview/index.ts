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
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    console.log('Generating audio overview for meeting:', meetingId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get meeting title
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('title')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('Error loading meeting:', meetingError);
      throw new Error('Unable to load meeting');
    }

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
    
    if (!transcript && !meetingNotes) {
      throw new Error('No transcript or summary available for this meeting');
    }

    console.log('Generating informal narrative with Lovable AI...');

    // Generate informal narrative using Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Create a 2-minute informal spoken overview of this meeting in a news article style.
Write as if you're a journalist summarising the meeting for listeners.

Guidelines:
- Start with: "This meeting focused on..." or similar engaging opening
- Use conversational, natural language suitable for speaking
- Highlight key decisions and actions in storytelling format
- Target 250-300 words for approximately 2 minute speaking time
- No bullet points - full narrative prose only
- British English spelling and phrasing
- Make it engaging and informative, like a news report
- Include specific details about outcomes and next steps`;

    const userPrompt = `Meeting Title: ${meeting.title}

${meetingNotes ? `Meeting Notes:\n${meetingNotes.slice(0, 3000)}\n\n` : ''}
${transcript ? `Meeting Transcript:\n${transcript.slice(0, 4000)}` : ''}

Create an informal 2-minute audio overview of this meeting.`;

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
      throw new Error('Failed to generate narrative');
    }

    const aiData = await aiResponse.json();
    const narrative = aiData.choices[0].message.content;
    
    console.log('Generated narrative length:', narrative.length);

    // Convert narrative to audio using Deepgram TTS
    console.log('Converting to audio with Deepgram TTS...');
    
    const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/deepgram-tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: narrative }),
    });

    if (!ttsResponse.ok) {
      const ttsError = await ttsResponse.text();
      console.error('TTS error:', ttsError);
      throw new Error('Failed to convert to audio');
    }

    const { audioContent, wasTruncated, processedLength } = await ttsResponse.json();
    
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
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('meeting-audio-overviews')
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    // Estimate duration (very rough: ~150 words per minute, 5 chars per word average)
    const estimatedWords = narrative.length / 5;
    const estimatedDuration = Math.ceil((estimatedWords / 150) * 60); // in seconds

    // Save to database
    console.log('Saving audio overview metadata to database...');
    
    const { error: updateError } = await supabase
      .from('meeting_overviews')
      .upsert({
        meeting_id: meetingId,
        audio_overview_url: audioUrl,
        audio_overview_text: narrative,
        audio_overview_duration: estimatedDuration,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'meeting_id'
      });

    if (updateError) {
      console.error('Database update error:', updateError);
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

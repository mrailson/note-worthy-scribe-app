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
    const { meetingId, targetDuration = 120, scriptStyle = 'executive', customDirections } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    console.log('Generating audio script for meeting:', meetingId);
    console.log('Target duration (seconds):', targetDuration);
    console.log('Script style:', scriptStyle);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get meeting title and start time for neutral opening
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
    const day = meetingDate.getDate();
    const ordinalSuffix = (d: number) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
    };
    const month = meetingDate.toLocaleDateString('en-GB', { month: 'long' });
    const year = meetingDate.getFullYear();
    const formattedDate = `${day}${ordinalSuffix(day)} ${month} ${year}`;

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
      .slice(0, 15000); // Increased for longer meetings

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

    console.log('Generating script with Lovable AI...');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const durationMinutes = Math.ceil(targetDuration / 60);
    const wordCountTarget = Math.round(targetDuration * 2.3); // ~2.3 words per second for comfortable speaking

    // Style-specific system prompts
    const stylePrompts: Record<string, string> = {
      executive: `Create a ${durationMinutes}-minute executive summary of this meeting for senior leadership.
        - Strategic overview with high-level decisions and implications
        - Leadership tone with clear, confident delivery
        - Focus on key outcomes, actions, and business impact
        - Professional and authoritative`,
      
      training: `Create a ${durationMinutes}-minute training overview of this meeting.
        - Educational step-by-step explanations
        - Clear examples and instructive tone
        - Break down complex topics into digestible parts
        - Helpful and encouraging tone`,
      
      meeting: `Create a ${durationMinutes}-minute meeting notes summary.
        - Concise key points, decisions, and action items
        - Factual and objective tone
        - Chronological flow of meeting events
        - Clear and direct language`,
      
      podcast: `Create a ${durationMinutes}-minute podcast-style overview of this meeting.
        - Conversational and engaging narrative
        - Storytelling approach with natural flow
        - Build interest and maintain listener engagement
        - Warm and personable tone`,
      
      technical: `Create a ${durationMinutes}-minute technical briefing of this meeting.
        - Precise terminology and technical detail
        - Methodical and thorough coverage
        - Professional and analytical tone
        - Appropriate for technical audiences`,
      
      patient: `Create a ${durationMinutes}-minute patient-friendly overview of this meeting.
        - Clear, jargon-free language
        - Empathetic and accessible tone
        - Easy to understand explanations
        - Supportive and caring delivery`
    };

    const stylePrompt = stylePrompts[scriptStyle] || stylePrompts['executive'];

    // Discussion style has its own comprehensive prompt; others get the shared guidelines
    let systemPrompt: string;
    if (scriptStyle === 'discussion') {
      systemPrompt = stylePrompt;
    } else {
      systemPrompt = `${stylePrompt}

Guidelines:
- Write in a clear, professional conversational tone
- NEVER start with greetings like "Good morning", "Hello", "Welcome", "Hi there", "Greetings" etc.
- ALWAYS start with: "At this meeting on ${dayOfWeek} the ${formattedDate}..." then continue naturally with the content
- Use plain narrative prose without any formatting characters
- NO special characters (* = # - bullets etc.) - they don't read well when spoken
- NO stage directions, sound effects, or script notations
- Target ${wordCountTarget} words for approximately ${durationMinutes} minutes speaking time
- British English spelling and phrasing
- Be informative and engaging
- Include specific details about outcomes and next steps when relevant`;
    }

    if (customDirections) {
      systemPrompt += `\n\nCustom Directions: ${customDirections}`;
    }

    const userPrompt = `Meeting Title: ${meeting.title}

${meetingNotes ? `Meeting Notes:\n${meetingNotes.slice(0, 4000)}\n\n` : ''}
${transcript ? `Meeting Transcript:\n${transcript.slice(0, 8000)}` : ''}

Create a ${durationMinutes}-minute audio script following the ${scriptStyle} style.`;

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
      throw new Error('Failed to generate script');
    }

    const aiData = await aiResponse.json();
    const narrativeText = aiData.choices[0].message.content;
    
    console.log('Generated script length:', narrativeText.length);
    console.log('Target words:', wordCountTarget, 'Actual words:', Math.round(narrativeText.split(' ').length));

    return new Response(
      JSON.stringify({ 
        success: true,
        narrativeText,
        wordCount: narrativeText.split(' ').length,
        targetDuration,
        scriptStyle
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Generate meeting audio script error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

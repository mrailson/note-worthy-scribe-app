import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing meeting minutes generation request...');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    console.log('Fetching transcript for meeting:', meetingId);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get meeting details including context fields
    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        created_at,
        agenda,
        meeting_context,
        meeting_location,
        meeting_format,
        profiles!inner(email, full_name)
      `)
      .eq('id', meetingId)
      .single();

    if (meetingError || !meetingData) {
      throw new Error('Meeting not found');
    }

    // Fetch explicit attendees from meeting_attendees table
    const { data: cardAttendees, error: attendeesError } = await supabase
      .from('meeting_attendees')
      .select(`
        attendee:attendees (
          name,
          organization
        )
      `)
      .eq('meeting_id', meetingId);

    if (attendeesError) {
      console.warn('⚠️ Error fetching meeting_attendees:', attendeesError);
    }

    // Format explicit attendees - always include the logged-in user who ran the meeting
    const loggedUserName = meetingData.profiles.full_name;
    let attendeesList = loggedUserName; // Start with logged user
    
    if (cardAttendees && cardAttendees.length > 0) {
      const formattedAttendees = cardAttendees
        .map((item: any) => {
          const name = item.attendee?.name;
          const org = item.attendee?.organization;
          if (!name) return null;
          return org ? `${name} (${org})` : name;
        })
        .filter(Boolean)
        // Exclude the logged user if they're also in the attendees list to avoid duplication
        .filter((name: string) => !name.toLowerCase().includes(loggedUserName.toLowerCase()));
      
      if (formattedAttendees.length > 0) {
        attendeesList = `${loggedUserName}, ${formattedAttendees.join(', ')}`;
      }
    }

    console.log('👥 Attendees (including logged user):', attendeesList);

    // Get full transcript using the database function
    const { data: transcriptData, error: transcriptError } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    if (transcriptError) {
      console.error('Error fetching transcript:', transcriptError);
      throw new Error('Failed to fetch transcript');
    }

    const fullTranscript = transcriptData?.[0]?.transcript || '';
    
    if (!fullTranscript || fullTranscript.trim().length === 0) {
      throw new Error('No transcript found for this meeting');
    }

    console.log('Transcript length:', fullTranscript.length);

    // Build context information from meeting metadata
    const contextInfo = `**MEETING CONTEXT:**
- Meeting Recorder: ${loggedUserName}
${meetingData.agenda ? `- Agenda: ${meetingData.agenda}\n` : ''}- Attendees: ${attendeesList}
${meetingData.meeting_location ? `- Location: ${meetingData.meeting_location}\n` : ''}${meetingData.meeting_format ? `- Format: ${meetingData.meeting_format}\n` : ''}${meetingData.meeting_context ? `- Additional Context: ${JSON.stringify(meetingData.meeting_context)}\n` : ''}
**IMPORTANT: Use the exact attendee names provided above. Do not use "Facilitator", "Unidentified", or placeholder names. The Meeting Recorder (${loggedUserName}) should always be listed by their actual name.**

`;

    // Generate structured meeting minutes
    const prompt = `Please analyze this meeting transcript and create detailed, professional meeting minutes for an informal partners meeting. Structure the minutes with the following sections:

**MEETING DETAILS:**
- Date: ${new Date(meetingData.created_at).toLocaleDateString('en-GB')}
- Time: ${new Date(meetingData.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(meetingData.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
- Meeting Recorder: ${loggedUserName}
- Attendees: ${attendeesList}
- Meeting Type: Informal Partners Meeting

${contextInfo}
**TRANSCRIPT TO ANALYZE:**
${fullTranscript}

**Please create the meeting minutes with these sections:**

1. **EXECUTIVE SUMMARY** - Brief overview of main topics and outcomes

2. **AGENDA ITEMS DISCUSSED** - Organize into clear topic sections with:
   - Topic heading
   - Key discussion points
   - Concerns raised
   - Decisions made (if any)

3. **OPERATIONAL MATTERS** - Space planning, staffing, technology

4. **FINANCIAL CONSIDERATIONS** - Cost analysis, savings potential, budget impacts

5. **STAFFING & HR MATTERS** - Personnel changes, retirement planning, training needs

6. **RETURN TO WORK & WELLBEING** - IMPORTANT: Capture ALL details about:
   - Phased return to work arrangements (duration, shift patterns, start dates)
   - Reduced hours or modified duties discussed
   - Any specific shift patterns mentioned (e.g. morning-only, avoiding certain shift types)
   - Impact on colleagues or cover arrangements
   - Health and wellbeing check-ins
   - Any adjustments to normal working patterns
   - Include specific details like "2 weeks phased return", "morning shifts only", etc.

7. **STRATEGIC PLANNING** - Long-term considerations and future planning

8. **ACTION ITEMS** - Specific tasks, responsibilities, and deadlines (if mentioned)

9. **NEXT STEPS** - Follow-up actions and future meetings

10. **ADDITIONAL NOTES** - Any other relevant information

Format each section with clear headings, bullet points, and detailed explanations. Include specific quotes where relevant to capture the tone and exact concerns raised. Make it comprehensive but well-organized. PAY SPECIAL ATTENTION to any discussions about returning to work after absence, phased returns, or modified working arrangements - capture ALL specifics mentioned.`;

    console.log('Sending to OpenAI for analysis...');

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an expert meeting secretary who creates detailed, professional meeting minutes. Focus on capturing all key discussion points, concerns, decisions, and strategic considerations in a well-structured format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAiResponse.status} - ${errorText}`);
    }

    const openAiResult = await openAiResponse.json();
    const meetingMinutes = openAiResult.choices[0].message.content;

    console.log('Meeting minutes generated successfully');

    return new Response(JSON.stringify({
      success: true,
      meetingMinutes,
      meetingDetails: {
        title: meetingData.title,
        date: meetingData.created_at,
        startTime: meetingData.start_time,
        endTime: meetingData.end_time,
        organizer: meetingData.profiles.full_name,
        email: meetingData.profiles.email
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-minutes-detailed function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
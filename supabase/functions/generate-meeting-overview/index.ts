import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Function called');

  if (!lovableApiKey) {
    console.error('❌ Lovable AI API key not found');
    return new Response(JSON.stringify({ error: 'Lovable AI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('📝 Parsing request body...');
    const requestBody = await req.json();
    console.log('✅ Request body parsed:', { 
      hasTitle: !!requestBody.meetingTitle, 
      hasNotes: !!requestBody.meetingNotes 
    });

    const { meetingId, transcript, meetingTitle, meetingNotes } = requestBody;

    if (!meetingId) {
      console.log('❌ Meeting ID is required');
      return new Response(JSON.stringify({ error: 'Meeting ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!transcript && !meetingNotes) {
      console.log('❌ No content provided');
      return new Response(JSON.stringify({ error: 'Either transcript or meetingNotes is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let content = meetingNotes || transcript;
    console.log('📄 Content length:', content.length);

    // ── Short-content guard: prevent hallucination on minimal content ──
    const overviewWordCount = content.trim().split(/\s+/).filter(Boolean).length;
    console.log(`📏 Content word count: ${overviewWordCount}`);

    if (overviewWordCount < 100) {
      console.log('⚠️ Ultra-short content (<100 words) — saving factual overview without LLM');
      const minimalOverview = `This recording captured minimal content (${overviewWordCount} words). No substantive meeting topics were identified.\n\n• Recording too short for meaningful summary\n• No decisions or actions identified\n• Consider re-recording if content was expected`;

      const { error: dbError } = await supabase
        .from('meeting_overviews')
        .upsert({ meeting_id: meetingId, overview: minimalOverview }, { onConflict: 'meeting_id' });

      if (dbError) {
        console.error('❌ Database error saving minimal overview:', dbError);
      } else {
        console.log('✅ Minimal overview saved (short content guard)');
      }

      return new Response(JSON.stringify({ overview: minimalOverview, success: true, shortContent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client and fetch meeting context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Add retry logic for race conditions - wait for meeting to exist
    let meeting;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('meeting_format, meeting_location, agenda, title, participants, user_id, practice_id')
        .eq('id', meetingId)
        .maybeSingle();

      if (meetingError) {
        console.error('❌ Database error fetching meeting:', meetingError);
        throw new Error(`Database error: ${meetingError.message}`);
      }

      if (meetingData) {
        meeting = meetingData;
        break;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`⏳ Meeting not found, retrying in 2s (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('❌ Meeting not found after all retries:', meetingId);
        return new Response(JSON.stringify({ 
          error: `Meeting not found with ID: ${meetingId}. Please ensure meeting is created before generating overview.`,
          skipped: true 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Load and apply name corrections to content before AI processing
    let correctionHints = '';
    try {
      // Build filter for user-specific + global + practice-level corrections
      const userId = meeting?.user_id;
      const practiceId = meeting?.practice_id;
      let filterParts = ['is_global.eq.true'];
      if (userId) filterParts.push(`user_id.eq.${userId}`);
      if (practiceId) filterParts.push(`practice_id.eq.${practiceId}`);
      
      const { data: corrections } = await supabase
        .from('medical_term_corrections')
        .select('incorrect_term, correct_term')
        .or(filterParts.join(','))
        .order('usage_count', { ascending: false })
        .limit(100);
      
      if (corrections && corrections.length > 0) {
        // Deduplicate by lowercase incorrect_term
        const seen = new Set<string>();
        const uniqueCorrections = corrections.filter(c => {
          const key = c.incorrect_term.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        
        for (const c of uniqueCorrections) {
          try {
            const regex = new RegExp(
              `\\b${c.incorrect_term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 
              'gi'
            );
            content = content.replace(regex, c.correct_term);
          } catch (regexErr) {
            console.warn(`⚠️ Failed to apply correction "${c.incorrect_term}":`, regexErr);
          }
        }
        console.log(`📋 Applied ${uniqueCorrections.length} term corrections to overview content`);
        
        // Build hints for AI prompt injection
        correctionHints = uniqueCorrections
          .slice(0, 50)
          .map(c => `"${c.incorrect_term}" → "${c.correct_term}"`)
          .join('; ');
      }
    } catch (e) {
      console.warn('⚠️ Could not load corrections (non-fatal)');
    }

    // Build authoritative location context
    let locationContext = '';
    if (meeting?.meeting_format === 'teams') {
      locationContext = 'Location: Online (Microsoft Teams)\n';
    } else if (meeting?.meeting_format === 'hybrid') {
      locationContext = meeting?.meeting_location 
        ? `Location: ${meeting.meeting_location} and Online (Hybrid)\n`
        : 'Location: Hybrid (Online + on-site)\n';
    } else if (meeting?.meeting_format === 'face-to-face' && meeting?.meeting_location) {
      locationContext = `Location: ${meeting.meeting_location}\n`;
    }

    const systemPrompt = `Create a specific executive meeting summary using British English spellings and conventions.

Format:
1. Opening paragraph (2 sentences MAXIMUM, 30-40 words): First sentence states the meeting's primary purpose. Second sentence names the most significant decision or outcome. No more than two sentences — the bullet points carry the detail.
2. Key points (3-5 bullet points): Each must contain a concrete fact — a decision made, an action assigned to a named person, a deadline, or a specific number/metric discussed.

Requirements:
- Use British English spellings (e.g., 'organised', 'realise', 'colour', 'centre')
- Total: 80-120 words maximum
- Opening paragraph on its own line, followed by blank line
- Then each bullet point on separate line with • character
- Each bullet point: one clear, specific statement (10-15 words)
- NEVER use generic phrases like "various topics were discussed", "key issues were raised", or "important matters were covered"
- Every bullet must answer: WHO decided/will do WHAT by WHEN (where known)
- Include specific names, deadlines, figures, and deliverables from the notes
- Professional, direct tone
- NO introductory phrases or filler words

CRITICAL: You MUST include both the opening paragraph AND 3-5 bullet points. A response with only a paragraph and no bullet points is incomplete. The bullet points are the most important part — they are what appears on the meeting history card.

═══ CRITICAL FORMAT REQUIREMENT ═══
Your response MUST contain BOTH of these elements:
1. An opening paragraph (2 sentences maximum)
2. Followed by a blank line
3. Followed by 3-5 bullet points using the • character

A response with ONLY a paragraph and NO bullet points is INCOMPLETE and WRONG.
A response with ONLY bullet points and NO paragraph is also WRONG.
You MUST have BOTH.

Example of CORRECT format:
The meeting addressed X and decided Y. Members also reviewed Z.

• First key decision or action with specific detail
• Second key decision with who and what
• Third outcome or deliverable

Example of WRONG format (paragraph only, no bullets):
The meeting addressed X and decided Y. Members also reviewed Z and discussed various topics including A, B, and C.

If your response does not contain at least three • bullet points, it is wrong. Add them now.
═══ END REQUIREMENT ═══${correctionHints ? `

NAME AND TERM CORRECTIONS (apply these throughout your summary):
The following terms are commonly misheard by speech-to-text. Always use the correct spelling:
${correctionHints}
Also correct any phonetic variations of these terms that you encounter.` : ''}`;


    const userPrompt = `Create a concise executive summary from this meeting titled "${meetingTitle || meeting?.title || 'Meeting'}":

${meeting?.agenda ? `**Agenda:** ${meeting.agenda.substring(0, 500)}\n\n` : ''}${locationContext ? `**MEETING CONTEXT (AUTHORITATIVE):**\n${locationContext}\n**CRITICAL: This location/format is authoritative. Do not contradict it even if the content mentions other locations.**\n\n` : ''}${content.length <= 9000 ? content : content.substring(0, 6000) + '\n\n[... middle section omitted for brevity ...]\n\n' + content.substring(content.length - 3000)}

Format your response exactly like this:
[Brief paragraph describing the meeting purpose, main decision, and who was involved — name at least one specific topic or initiative]

• [Key decision/action/deliverable with WHO and WHAT]
• [Key decision/action/deliverable with WHO and WHAT]
• [Key decision/action/deliverable with WHO and WHAT]
• [Additional points as needed, max 5 total]

Remember: Use • bullet character, put each bullet on its own line, blank line between paragraph and bullets.`;

    console.log('🔧 Using Lovable AI with google/gemini-3-flash-preview');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        max_completion_tokens: 550,
      }),
    });

    console.log('📡 Lovable AI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Lovable AI API error:', errorData);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Insufficient AI credits. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: `Lovable AI API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('✅ Lovable AI response received');
    
    let overview = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('📝 Generated overview:', overview);

    // Validate that bullet points were included
    const hasBullets = overview.includes('•') || overview.includes('- ');

    if (overview && !hasBullets) {
      console.warn('⚠️ Overview generated without bullet points, requesting bullet supplement...');
      try {
        const bulletResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You extract key decisions and actions from meeting summaries. Respond with ONLY 3-5 bullet points using the • character, one per line. Each bullet must name a specific decision, action, or outcome with WHO and WHAT. Use British English. No introduction, no paragraph — bullets only.' },
              { role: 'user', content: `Extract 3-5 key decisions and actions from this meeting summary:\n\n${overview}` }
            ],
            max_completion_tokens: 200,
          }),
        });
        
        if (bulletResponse.ok) {
          const bulletData = await bulletResponse.json();
          const bullets = bulletData.choices?.[0]?.message?.content?.trim() || '';
          if (bullets && bullets.includes('•')) {
            overview = `${overview}\n\n${bullets}`;
            console.log('✅ Bullet points added to overview');
          }
        }
      } catch (bulletError) {
        console.warn('⚠️ Bullet supplement failed, using overview as-is');
      }
    }

    console.log('💾 Saving overview to database...');
    
    // Upsert the overview (insert or update if exists)
    const { error: dbError } = await supabase
      .from('meeting_overviews')
      .upsert({
        meeting_id: meetingId,
        overview: overview
      }, {
        onConflict: 'meeting_id'
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: `Failed to save overview: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Overview saved successfully');

    return new Response(JSON.stringify({ overview, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Function error:', error.message);
    console.error('📚 Error stack:', error.stack);
    return new Response(JSON.stringify({ error: `Function error: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
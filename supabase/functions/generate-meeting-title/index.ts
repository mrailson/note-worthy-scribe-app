import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Patterns that indicate a generic, non-descriptive title
const BANNED_GENERIC_PATTERNS = [
  /^general\s+(meeting|discussion|update)$/i,
  /^team\s+(meeting|discussion|update|call|sync)$/i,
  /^progress\s+(review|update|meeting|discussion)$/i,
  /^(weekly|monthly|daily|regular)\s+(meeting|sync|call|update|check-in)$/i,
  /^catch[\s-]*up$/i,
  /^check[\s-]*in$/i,
  /^overview\s+of\s+progress/i,
  /^meeting\s+notes?$/i,
  /^discussion$/i,
  /^update$/i,
  /^review$/i,
  /^sync$/i,
  /^call$/i,
  /^status\s+update$/i,
  /^project\s+update$/i,
  /^planning\s+meeting$/i,
  /^strategy\s+(meeting|session)$/i,
  /^(new\s+)?meeting(\s+\d+)?$/i,
  /^untitled/i,
];

function isGenericTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 10) return true;
  return BANNED_GENERIC_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Extract key terms from transcript for fallback
function extractKeyTerms(transcript: string): string[] {
  const keywords: string[] = [];
  
  // Look for project names (capitalised phrases)
  const projectMatches = transcript.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g);
  if (projectMatches) {
    const uniqueProjects = [...new Set(projectMatches)]
      .filter(p => p.length > 5 && !['The', 'This', 'That', 'There', 'These', 'Those'].includes(p.split(' ')[0]));
    keywords.push(...uniqueProjects.slice(0, 3));
  }
  
  // Look for common topic indicators
  const topicPatterns = [
    /discussing\s+(?:the\s+)?([a-z\s]{5,30})/gi,
    /about\s+(?:the\s+)?([a-z\s]{5,30})/gi,
    /regarding\s+(?:the\s+)?([a-z\s]{5,30})/gi,
    /focus(?:ing)?\s+on\s+([a-z\s]{5,30})/gi,
  ];
  
  for (const pattern of topicPatterns) {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) keywords.push(match[1].trim());
    }
  }
  
  return [...new Set(keywords)].slice(0, 5);
}

// Generate intelligent fallback title
function generateFallbackTitle(
  currentTitle: string,
  attendees?: string[],
  agenda?: string,
  meetingFormat?: string,
  meetingDate?: string,
  documentNames?: string[]
): string {
  // Try attendee-based title
  if (attendees && attendees.length > 0 && attendees[0] !== 'TBC') {
    const attendeeNames = attendees.slice(0, 2).map(a => {
      // Extract just the name without organisation
      const name = a.split('(')[0].trim();
      // Get surname only if it's a full name
      const parts = name.split(' ');
      return parts.length > 1 ? parts[parts.length - 1] : name;
    });
    if (attendeeNames.length >= 2) {
      return `${attendeeNames.join(' & ')} Discussion`;
    } else if (attendeeNames.length === 1) {
      return `Meeting with ${attendeeNames[0]}`;
    }
  }
  
  // Try agenda-based title
  if (agenda && agenda.trim().length > 10) {
    // Extract first meaningful phrase from agenda
    const firstLine = agenda.split(/[\n\r•\-\*]/)[0].trim();
    if (firstLine.length >= 10 && firstLine.length <= 60) {
      return firstLine.replace(/^[\d\.\)]+\s*/, ''); // Remove leading numbers
    }
  }
  
  // Try document-based title
  if (documentNames && documentNames.length > 0) {
    const docName = documentNames[0]
      .replace(/\.(pdf|docx?|txt|pptx?)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim();
    if (docName.length >= 5 && docName.length <= 50) {
      return `Discussion of ${docName}`;
    }
  }
  
  // Format-based fallback with date
  if (meetingFormat && meetingDate) {
    const formatLabel = {
      'face-to-face': 'In-Person',
      'online': 'Virtual',
      'hybrid': 'Hybrid',
      'phone': 'Phone'
    }[meetingFormat.toLowerCase()] || meetingFormat;
    
    return `${formatLabel} Session - ${meetingDate}`;
  }
  
  // Last resort: keep current title if not completely generic
  if (currentTitle && !isGenericTitle(currentTitle)) {
    return currentTitle;
  }
  
  // Absolute last resort
  return meetingDate ? `Meeting - ${meetingDate}` : currentTitle || 'Meeting Notes';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const { 
      transcript, 
      currentTitle,
      attendees,
      agenda,
      meetingFormat,
      meetingDate,
      documentNames,
      meetingId
    } = await req.json();
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is required');
    }

    console.log('📝 Generating meeting title from transcript length:', transcript.length);
    console.log('📝 Context - Attendees:', attendees?.length || 0, 'Agenda:', agenda?.length || 0, 'Format:', meetingFormat);

    // Sample three slices of the transcript for better topic coverage
    let transcriptExcerpt: string;
    if (transcript.length <= 12000) {
      transcriptExcerpt = transcript;
    } else {
      const first4k = transcript.substring(0, 4000);
      const midPoint = Math.floor(transcript.length / 2);
      const mid3k = transcript.substring(midPoint - 1500, midPoint + 1500);
      const last4k = transcript.substring(transcript.length - 4000);
      transcriptExcerpt = `${first4k}\n\n[... transcript continues ...]\n\n${mid3k}\n\n[... transcript continues ...]\n\n${last4k}`;
    }

    // Load and apply name corrections to transcript excerpt before AI processing
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let correctionHints = '';
    try {
      // Build filter for user-specific + global + practice-level corrections
      let filterParts = ['is_global.eq.true'];
      
      if (meetingId) {
        // Look up user_id and practice_id from the meeting
        const { data: meetingOwner } = await supabase
          .from('meetings')
          .select('user_id, practice_id')
          .eq('id', meetingId)
          .maybeSingle();
        
        if (meetingOwner?.user_id) filterParts.push(`user_id.eq.${meetingOwner.user_id}`);
        if (meetingOwner?.practice_id) filterParts.push(`practice_id.eq.${meetingOwner.practice_id}`);
      }
      
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
            transcriptExcerpt = transcriptExcerpt.replace(regex, c.correct_term);
          } catch (regexErr) {
            console.warn(`⚠️ Failed to apply correction "${c.incorrect_term}":`, regexErr);
          }
        }
        console.log(`📋 Applied ${uniqueCorrections.length} term corrections to title excerpt`);
        
        // Build hints for AI prompt injection
        correctionHints = uniqueCorrections
          .slice(0, 50)
          .map(c => `"${c.incorrect_term}" → "${c.correct_term}"`)
          .join('; ');
      }
    } catch (e) {
      console.warn('⚠️ Could not load corrections for title (non-fatal)');
    }

    // Build context section
    let contextSection = '';
    if (attendees && attendees.length > 0 && attendees[0] !== 'TBC') {
      contextSection += `\nATTENDEES: ${attendees.join(', ')}`;
    }
    if (agenda && agenda.trim()) {
      contextSection += `\nAGENDA: ${agenda.substring(0, 500)}`;
    }
    if (meetingFormat) {
      contextSection += `\nMEETING FORMAT: ${meetingFormat}`;
    }
    if (documentNames && documentNames.length > 0) {
      contextSection += `\nDOCUMENTS DISCUSSED: ${documentNames.join(', ')}`;
    }

    const systemPrompt = `You are a meeting title generator that creates SPECIFIC, MEMORABLE titles.

STEP 1 - Extract from the transcript:
- Identify which topic received the MOST discussion time (not just the first topic mentioned — the longest and most debated topic should dominate the title)
- Any specific decisions made or outcomes
- The type of meeting (planning, review, governance, clinical, etc.)
- Key named entities (projects, systems, programmes, organisations)

IMPORTANT: Weight the title toward whichever topic consumed the most discussion time. If a governance debate took 40 minutes and a clinical update took 5 minutes, the governance topic should lead the title — even if the clinical update was mentioned first.

STEP 2 - Generate a title that:
- Is 4-15 words long
- Contains at least ONE specific element (project name, topic, decision, or initiative)
- Uses Title Case (capitalise major words)
- Uses British English spelling (organise, programme, centre, specialise)

BANNED PHRASES - NEVER use these generic terms alone:
- "General Meeting", "Team Meeting", "Team Discussion"
- "Progress Update", "Status Update", "Project Update"
- "Weekly/Monthly/Daily Meeting"
- "Catch Up", "Check In", "Sync"
- "Review Meeting", "Planning Meeting"
- "New Meeting", "Untitled"

GOOD EXAMPLES:
- "NHS Digital Transformation Programme Steering Group"
- "Winter Pressures Planning and Capacity Review"
- "Safeguarding Governance Quarterly Oversight"
- "Primary Care Network Pharmacy Integration"
- "CQC Improvement Action Plan Progress"
- "Patient Access Improvement Initiative Launch"
- "Mental Health Services Pathway Redesign"
- "Staff Wellbeing and Retention Strategy Workshop"

BAD EXAMPLES (never generate these):
- "Team Meeting"
- "Weekly Update"
- "General Discussion"
- "Progress Review"
- "Planning Session"

If attendees are provided, you may use their team/department context to make the title more specific.
If documents were discussed, reference the main document topic.

Respond with ONLY the title text, no quotes, no explanation.${correctionHints ? `

NAME AND TERM CORRECTIONS (use the correct spellings in your title):
${correctionHints}` : ''}`;

    const userPrompt = `Current title: ${currentTitle}
${contextSection}

TRANSCRIPT EXCERPT:
${transcriptExcerpt}

Generate a SPECIFIC, descriptive title (4-15 words) that clearly identifies what this meeting was about. The title should lead with the topic that received the MOST discussion time in the transcript, not necessarily the first topic mentioned. If there were two equally major topics, include both. Remember: no generic phrases like "Team Meeting" or "Progress Update".`;

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
        max_completion_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:', response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    let generatedTitle = data.choices?.[0]?.message?.content?.trim() || '';

    // Clean up the title
    generatedTitle = generatedTitle
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^title:\s*/i, '') // Remove "Title:" prefix if present
      .replace(/\s+/g, ' ') // Normalise whitespace
      .trim();

    // Validate length (4-15 words)
    const words = generatedTitle.split(/\s+/);
    if (words.length > 15) {
      generatedTitle = words.slice(0, 15).join(' ');
    }

    console.log('🔍 AI generated title:', generatedTitle);
    console.log('🔍 Is generic?', isGenericTitle(generatedTitle));

    // Check if the generated title is too generic or too short
    if (generatedTitle.length < 10 || isGenericTitle(generatedTitle)) {
      console.warn('⚠️ Generated title is too generic, attempting retry with stricter prompt...');
      
      // Try once more with an even stricter prompt
      const retryPrompt = `The title "${generatedTitle}" is too generic. 

Looking at the transcript, identify the MOST SPECIFIC topic discussed. Extract:
1. Any named projects, initiatives, or programmes
2. The core subject matter (e.g., "staffing", "budget", "patient safety", "governance")
3. Any organisations or teams mentioned

Now generate a NEW title that is IMPOSSIBLE to confuse with any other meeting. It MUST contain a specific subject.

Transcript excerpt:
${transcriptExcerpt.substring(0, 3000)}

Generate ONLY the title (4-15 words):`;

      try {
        const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You generate specific meeting titles. Never use generic phrases.' },
              { role: 'user', content: retryPrompt }
            ],
            max_completion_tokens: 100,
          }),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryTitle = retryData.choices?.[0]?.message?.content?.trim()
            .replace(/^["']|["']$/g, '')
            .replace(/^title:\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (retryTitle && retryTitle.length >= 10 && !isGenericTitle(retryTitle)) {
            generatedTitle = retryTitle;
            console.log('✅ Retry produced specific title:', generatedTitle);
          }
        }
      } catch (retryError) {
        console.warn('⚠️ Retry failed:', retryError);
      }
    }

    // Final check - if still generic, use intelligent fallback
    if (generatedTitle.length < 10 || isGenericTitle(generatedTitle)) {
      console.warn('⚠️ Title still generic after retry, using intelligent fallback');
      generatedTitle = generateFallbackTitle(
        currentTitle,
        attendees,
        agenda,
        meetingFormat,
        meetingDate,
        documentNames
      );
      console.log('📋 Fallback title:', generatedTitle);
    }

    console.log('✅ Final title:', generatedTitle);
    console.log('📊 Word count:', generatedTitle.split(/\s+/).length);

    return new Response(
      JSON.stringify({ title: generatedTitle }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error generating meeting title:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        title: null
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

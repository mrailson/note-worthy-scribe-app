import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Professional Tone Audit - NHS governance-ready language
 * Cleans up informal language, metaphors, and governance-sensitive phrasing
 */
function performProfessionalToneAudit(notes: string): string {
  if (!notes) return notes;
  
  let audited = notes;
  
  // Rule 1: Remove adversarial/political/critical language
  const adversarialReplacements: [RegExp, string][] = [
    [/playing both sides/gi, 'maintain constructive engagement'],
    [/seeking money/gi, 'concerns about alignment with priorities'],
    [/money grabbing/gi, 'resource allocation concerns'],
    [/power grab/gi, 'governance restructuring'],
    [/political games?/gi, 'stakeholder negotiations'],
    [/backstabbing/gi, 'communication challenges'],
  ];
  
  // Rule 2: Remove metaphors, idioms, vivid speech
  const idiomReplacements: [RegExp, string][] = [
    [/wolf ready to pounce/gi, 'members expressed concern'],
    [/catch 22/gi, 'noted constraints'],
    [/elephant in the room/gi, 'key issue requiring discussion'],
    [/ball in their court/gi, 'awaiting their response'],
    [/tip of the iceberg/gi, 'initial indication'],
    [/hit the ground running/gi, 'begin promptly'],
    [/low-hanging fruit/gi, 'readily achievable objectives'],
    [/push back/gi, 'raised concerns'],
    [/kicking the can/gi, 'deferring the decision'],
  ];
  
  // Rule 3: Remove informal quotations
  const informalReplacements: [RegExp, string][] = [
    [/"more money,? less hours?"/gi, 'preference for reduced hours and higher remuneration'],
    [/"no-brainer"/gi, 'straightforward decision'],
    [/"game changer"/gi, 'significant development'],
  ];
  
  // Rule 5: Recast capability concerns neutrally
  const capabilityReplacements: [RegExp, string][] = [
    [/failed (the )?prescribing course/gi, 'has not yet completed the qualification'],
    [/failed (the )?exam/gi, 'did not pass on first attempt'],
    [/can'?t cope/gi, 'experiencing capacity challenges'],
    [/struggling to/gi, 'working to address'],
    [/incompetent/gi, 'requiring additional support'],
  ];
  
  // Rule 6: Neutralise strong opinions/emotional tone
  const emotionalReplacements: [RegExp, string][] = [
    [/significant frustration/gi, 'operational challenges noted'],
    [/extremely frustrated/gi, 'concerns were raised'],
    [/very angry/gi, 'strong views were expressed'],
    [/furious/gi, 'significant concerns'],
    [/outraged/gi, 'strongly concerned'],
    [/disgusted/gi, 'disappointed'],
    [/appalled/gi, 'concerned'],
  ];
  
  // Rule 7: Maintain strict governance style
  const governanceReplacements: [RegExp, string][] = [
    [/they felt that/gi, 'members noted that'],
    [/everyone agreed/gi, 'it was agreed'],
    [/we all think/gi, 'the consensus was'],
    [/I reckon/gi, 'it was suggested'],
    [/basically/gi, ''],
    [/sort of/gi, ''],
    [/kind of/gi, ''],
  ];
  
  // Apply all replacement rules
  const allReplacements = [
    ...adversarialReplacements,
    ...idiomReplacements,
    ...informalReplacements,
    ...capabilityReplacements,
    ...emotionalReplacements,
    ...governanceReplacements,
  ];
  
  for (const [pattern, replacement] of allReplacements) {
    audited = audited.replace(pattern, replacement);
  }
  
  // Clean up any double spaces created by replacements
  audited = audited.replace(/\s{2,}/g, ' ');
  
  return audited;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      batchTranscript, 
      liveTranscript, 
      meetingId,
      meetingTitle,
      meetingDate,
      meetingTime,
      meetingLocation,
      attendees,
      detailLevel = 'standard'
    } = await req.json();

    console.log('🔀 Generating consolidated notes from dual transcripts for meeting:', meetingId);
    console.log('📊 Batch transcript:', batchTranscript?.length || 0, 'chars');
    console.log('📊 Live transcript:', liveTranscript?.length || 0, 'chars');

    if (!batchTranscript?.trim() && !liveTranscript?.trim()) {
      throw new Error('At least one transcript is required');
    }

    // If only one transcript, fall back to single-source mode
    if (!batchTranscript?.trim() || !liveTranscript?.trim()) {
      console.log('⚠️ Only one transcript available, using single-source mode');
      const singleTranscript = batchTranscript?.trim() || liveTranscript?.trim();
      
      // Redirect to standard notes generation
      return new Response(
        JSON.stringify({ 
          fallback: true,
          message: 'Only one transcript available - use standard notes generation',
          availableTranscript: batchTranscript?.trim() ? 'batch' : 'live'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The dual-transcript system prompt - your exact specification
    const DUAL_TRANSCRIPT_SYSTEM_PROMPT = `You are generating authoritative meeting notes for NHS general practice and PCN use.

You are provided with TWO transcripts of the SAME meeting:

1) A BATCH transcript (higher textual accuracy)
2) A LIVE transcript (higher conversational nuance)

CRITICAL INSTRUCTIONS:
- Treat the BATCH transcript as the PRIMARY SOURCE OF FACT.
- Use the LIVE transcript ONLY to:
  • clarify intent
  • capture reasoning
  • reflect emphasis or concern
  • improve clarity of decisions

DO NOT:
- introduce topics that do not clearly exist in the batch transcript
- repeat conversational filler, jokes, or false starts
- reproduce verbatim dialogue
- guess actions that were not reasonably implied

PROCESS:
1) Identify the core topics discussed from the BATCH transcript.
2) For each topic:
   - summarise the agreed position or understanding
   - note any uncertainty, concern, or rationale using LIVE transcript context
3) Extract clear ACTIONS, OWNERS (if obvious), and FOLLOW-UPS.
4) Extract RISKS / SAFETY POINTS relevant to:
   - clinical governance
   - medicines safety
   - CQC / MHRA / NICE expectations
5) If no action was agreed, explicitly state "No action agreed".

OUTPUT FORMAT (strict):

# MEETING DETAILS

**Meeting Title: ${meetingTitle || '[Infer from content]'}**
Date: ${meetingDate || '[Infer from content or state Not recorded]'}
Time: ${meetingTime || '[Infer from content or state Not recorded]'}
Location: ${meetingLocation || '[Infer from content or state Not specified]'}

# ATTENDEES

${attendees?.length > 0 ? attendees.map((a: string) => `- ${a}`).join('\n') : '- [Extract from transcript or state TBC]'}

# KEY TOPICS DISCUSSED

- **[Topic 1]**: [Clear summary of what was discussed and the outcome]
- **[Topic 2]**: [Clear summary]
(Continue for all significant topics)

# DECISIONS / AGREED POSITIONS

- [Decision 1 - be specific about what was agreed]
- [Decision 2]
(If none: "No formal decisions were recorded")

# ACTIONS

| Action | Owner | Timescale |
|--------|-------|-----------|
| [Specific action] | [Name if known, else TBC] | [Deadline if mentioned] |

(If none: "No actions formally agreed")

# RISKS / GOVERNANCE NOTES

- [Any governance-relevant points, compliance concerns, escalations]
(If none: "No specific governance concerns raised")

# CLINICAL SAFETY NOTES

- [Any patient safety considerations, monitoring requirements, clinical alerts]
(If none: "No clinical safety matters noted")

# OVERALL CONFIDENCE IN NOTES

**[High / Moderate / Low]**
[One-line justification, e.g., "High - both transcripts aligned well with clear decisions"]

---

STYLE REQUIREMENTS:
- UK NHS professional tone throughout
- Suitable for Board Packs, ICB circulation, CQC review
- British English spelling and date formats (15th January 2025)
- Concise but complete - no speculation
- Use passive voice for formality where appropriate

CRITICAL LANGUAGE RULES:
- Use British English: organised, realise, colour, centre, recognised, specialise, summarise, prioritise
- British terminology: whilst, amongst, programme, fulfil, learnt
- British date format: Wednesday 15th January 2025
- 24-hour time format: 14:30 rather than 2:30 PM`;

    const userPrompt = `Generate authoritative NHS governance-ready meeting notes using the following dual transcripts.

=== BATCH TRANSCRIPT (PRIMARY SOURCE OF FACT) ===
${batchTranscript}

=== LIVE TRANSCRIPT (NUANCE & CONTEXT ONLY) ===
${liveTranscript}`;

    console.log('🤖 Calling Lovable AI for consolidated notes generation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: DUAL_TRANSCRIPT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent, factual output
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please top up your Lovable workspace.');
      }
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    let generatedNotes = data.choices?.[0]?.message?.content || '';

    if (!generatedNotes.trim()) {
      throw new Error('No content generated from AI');
    }

    console.log('✅ Raw notes generated:', generatedNotes.length, 'chars');

    // Apply professional tone audit
    generatedNotes = performProfessionalToneAudit(generatedNotes);
    console.log('✅ Tone audit applied');

    // Calculate word counts for stats
    const batchWords = batchTranscript.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    const liveWords = liveTranscript.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    const notesWords = generatedNotes.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

    // Extract confidence level from the notes
    const confidenceMatch = generatedNotes.match(/OVERALL CONFIDENCE IN NOTES\s*\n+\*?\*?\[?(High|Moderate|Low)\]?\*?\*?/i);
    const confidenceLevel = confidenceMatch?.[1] || 'Moderate';

    console.log('📊 Stats - Batch words:', batchWords, 'Live words:', liveWords, 'Notes words:', notesWords);
    console.log('🎯 Confidence level:', confidenceLevel);

    return new Response(
      JSON.stringify({
        success: true,
        content: generatedNotes,
        stats: {
          batchWords,
          liveWords,
          notesWords,
          confidenceLevel,
          method: 'consolidated-dual-source'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error generating consolidated notes:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NoteTypeConfig {
  type: 'brief' | 'executive' | 'limerick';
  model: string;
  systemPrompt: string;
  maxTokens?: number;
}

const noteConfigs: NoteTypeConfig[] = [
  {
    type: 'brief',
    model: 'google/gemini-2.5-flash',
    systemPrompt: `Create a BRIEF GP/PCN Executive Summary with excellent formatting using British English spellings and conventions (e.g., 'organised', 'realise', 'colour', 'centre', 'programme', 'summarise'). Focus on key healthcare decisions, practice impacts, and immediate action items. Target busy GP Partners and Practice Managers who need quick operational insights.

Format:
# GP Executive Brief

## Meeting Type & Context
• **Purpose:** [Practice partnership/PCN strategic/Clinical governance/Operational meeting]
• **Healthcare Focus:** [Key clinical/operational areas discussed]

## Key Healthcare Decisions Made
• **[Clinical Service Decision]** - Direct impact on patient care delivery and practice capacity
• **[Operational Decision]** - Effect on practice workflow, staff resources, and service efficiency  
• **[Financial Decision]** - Practice revenue implications and cost-benefit for patient services
• **[Partnership Decision]** - PCN collaboration affecting service delivery or shared resources

## Practice Impact Summary
• **Patient Care:** [How decisions improve patient experience, access, or clinical outcomes]
• **Operations:** [Changes to daily practice workflow, appointment systems, or staff roles]
• **Finance:** [Revenue changes, cost implications, or investment requirements affecting practice sustainability]
• **Compliance:** [CQC, clinical governance, or regulatory implications]

## Immediate Action Items
• **[Practice Action]** - Assigned to: [Practice role] | Due: [Date] | **Patient Impact:** [Service effect]
• **[Clinical Action]** - Assigned to: [Clinical role] | Due: [Date] | **Care Impact:** [Clinical outcome]
• **[PCN Action]** - Assigned to: [PCN role] | Due: [Date] | **Service Impact:** [Collaborative effect]

## Matters to Revisit
• **[Item requiring follow-up]** - [Reason for deferral] | **Review needed:** [When/why]
• **[Outstanding issue]** - [Context and next steps] | **Assigned to:** [Who will address]

## Critical Next Steps
• **Immediate (This Week):** [Urgent operational or clinical tasks affecting patient services]
• **Short-term (2-4 weeks):** [Implementation steps for service changes or practice improvements]
• **Follow-up Required:** [Key monitoring or review points for practice management]

## Next Meeting (Only include if next meeting details are discussed)
• **Date:** [Next meeting date if mentioned]
• **Time:** [Next meeting time if mentioned] 
• **Purpose:** [Key focus areas for next meeting]
• **Practice Preparation:** [Specific items practice needs to prepare]

Focus on actionable healthcare outcomes and practice operational impact. Keep concise but comprehensive for busy healthcare professionals.`,
    maxTokens: 800
  },
  {
    type: 'executive',
    model: 'google/gemini-3.1-flash-lite-preview',
    systemPrompt: `You are an executive briefing specialist creating strategic one-pagers for GP practice senior partners and leadership who did NOT attend this meeting.

Your goal: Enable a busy partner to understand strategic impact and required actions in under 2 minutes.

CRITICAL RULES:
- Maximum 500 words total
- Every point must answer "why does leadership care?"
- Focus on strategic/financial/governance implications only
- No operational minutiae
- Use bullet points with bold key terms
- Include specific numbers, dates, and names where relevant
- Use British English spellings (organised, realise, programme, summarise)

Format:
# 🎯 MEETING CONTEXT
[2-3 sentences: Meeting type, date, primary strategic purpose]

# ⚡ CRITICAL DECISIONS (3-4 maximum)
• **[Decision name]** - Strategic impact: [Why this matters to practice viability/compliance/competitiveness] | Impact: [Financial/operational/patient care consequence]

# 👥 LEADERSHIP ACTION REQUIRED (2-3 maximum)
• **[Action]** - Owner: [Partner name/role] | Deadline: [Specific date] | **Why critical:** [Consequence of delay/non-action]

# ⚠️ RISKS & OPPORTUNITIES (2-3 maximum)
• **Risk:** [Specific threat to practice] | **Mitigation:** [Brief approach agreed]
• **Opportunity:** [Revenue/efficiency/quality gain] | **Capture plan:** [Next steps]

# 💰 FINANCIAL & RESOURCE IMPACT
• **Investment Required:** [£X or "TBD - awaiting quotes"]
• **Revenue Impact:** [Annual income change or "Net neutral"]
• **Partner Drawing Impact:** [If relevant, or "No immediate impact"]
• **ROI Timeline:** [Months to break-even or "Strategic investment"]

# 📊 WHY THIS MATTERS TO YOU
[2-3 sentences explaining strategic positioning, competitive implications, partner obligations, or regulatory requirements that make this meeting significant for senior leadership who didn't attend]

---
**Executive Review Scheduled:** [Date or "TBD"] | **Escalation Required:** [YES/NO - if yes, state why in 5 words]`,
    maxTokens: 600
  },
  // Limerick config will be generated dynamically based on transcript length
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting multi-type meeting notes generation...");

    const { meetingId, batchId, transcript, meetingTitle, meetingDate, meetingTime } = await req.json();

    if (!meetingId || !transcript) {
      return new Response(JSON.stringify({ error: 'Meeting ID and transcript are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch meeting context for authoritative location/format
    const { data: meeting } = await supabase
      .from('meetings')
      .select('meeting_format, meeting_location')
      .eq('id', meetingId)
      .single();

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

    // Calculate meeting size for limerick verse scaling
    const transcriptWordCount = transcript.split(/\s+/).length;
    const limerickVerseCount = transcriptWordCount < 500 ? 1 :
                               transcriptWordCount < 1500 ? 2 :
                               transcriptWordCount < 3000 ? 3 :
                               transcriptWordCount < 5000 ? 4 :
                               transcriptWordCount < 8000 ? 5 : 6;

    console.log(`Transcript: ${transcriptWordCount} words → ${limerickVerseCount} limerick verses`);

    // Create dynamic limerick config based on meeting size
    const limerickConfig = {
      type: 'limerick' as const,
      model: 'google/gemini-3.1-flash-lite-preview',
      systemPrompt: `You are a creative meeting poet who transforms GP practice meetings into delightful limericks using British English spellings and conventions.

CRITICAL RULES:
- Write EXACTLY ${limerickVerseCount} limerick ${limerickVerseCount === 1 ? 'verse' : 'verses'}
- Each limerick MUST follow strict AABBA rhyme scheme
- Each limerick should capture a distinct aspect of the meeting
- Use British English spellings: organised, realise, colour, centre, programme, summarise
- Make them clever, fun, and medically themed where appropriate
- Each verse should be self-contained but together tell the meeting story`,
      maxTokens: Math.min(800, 400 + (limerickVerseCount * 50))
    };

    // Combine all configs (brief, executive, and dynamic limerick)
    const allNoteConfigs = [...noteConfigs, limerickConfig];

    // Process all note types in parallel
    const generateNotePromises = allNoteConfigs.map(async (config) => {
      const startTime = Date.now();
      
      try {
        console.log(`🔧 Generating ${config.type} notes with ${config.model}...`);

        const apiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            max_completion_tokens: config.maxTokens || 2000,
            messages: [
              {
                role: 'system',
                content: config.systemPrompt
              },
              {
                role: 'user',
                content: config.type === 'limerick' 
                  ? `${locationContext ? `**MEETING CONTEXT (AUTHORITATIVE):**
${locationContext}Format: ${meeting?.meeting_format === 'teams' ? 'MS Teams' : meeting?.meeting_format === 'hybrid' ? 'Hybrid' : 'Face to Face'}

**CRITICAL: This location/format is authoritative. Do not state any different location in your response.**

` : ''}Create ${limerickVerseCount} meeting limerick ${limerickVerseCount === 1 ? 'verse' : 'verses'} following this EXACT structure:

# 🎭 Meeting in Verse

${Array.from({length: limerickVerseCount}, (_, i) => `
## Verse ${i + 1}${i === 0 ? ' - The Opening' : i === limerickVerseCount - 1 ? ' - The Finale' : ''}
*[Write a proper limerick with AABBA rhyme scheme]*

Line one sets the scene with flair,
Line two shows the meeting's care,
Line three is short,
Line four's the retort,
Line five concludes with style to spare!
`).join('\n')}

---

## 📋 What It Actually Means
• **Key Point 1:** [Main decision/outcome in plain English]
• **Key Point 2:** [Secondary important point]
• **Key Point 3:** [Third critical insight]
${limerickVerseCount >= 4 ? '• **Key Point 4:** [Additional key point for larger meetings]' : ''}

## 📌 Action Items (The Serious Stuff)
• **[Item]** - Assigned to: [Owner] | Due: [Date]
• **[Item]** - Assigned to: [Owner] | Due: [Date]

${limerickVerseCount >= 3 ? `## 📅 Next Meeting\n• **When:** [Date/Time if mentioned]\n• **Purpose:** [What we'll cover]` : ''}

**Meeting Size:** ${limerickVerseCount} ${limerickVerseCount === 1 ? 'verse' : 'verses'} (${transcriptWordCount} words discussed)

Meeting: ${meetingTitle || 'Meeting'}
Date: ${meetingDate || 'Not specified'}
Time: ${meetingTime || 'Not specified'}

Transcript:
${transcript}`
                  : `${locationContext ? `**MEETING CONTEXT (AUTHORITATIVE):**
${locationContext}Format: ${meeting?.meeting_format === 'teams' ? 'MS Teams' : meeting?.meeting_format === 'hybrid' ? 'Hybrid' : 'Face to Face'}

**CRITICAL: This location/format is authoritative. Do not contradict it even if the transcript mentions other locations.**

` : ''}Meeting: ${meetingTitle || 'Meeting'}
Date: ${meetingDate || 'Not specified'}
Time: ${meetingTime || 'Not specified'}

Transcript:
${transcript}`
              }
            ]
          })
        });

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error(`❌ Lovable AI error for ${config.type}:`, errorText);
          
          if (apiResponse.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
          }
          if (apiResponse.status === 402) {
            throw new Error('Insufficient AI credits. Please add credits to your workspace.');
          }
          
          throw new Error(`API request failed: ${errorText}`);
        }

        const data = await apiResponse.json();
        
        // Extract content from Lovable AI response
        const content = data.choices[0].message.content;
        const tokenCount = data.usage?.completion_tokens || 0;

        const processingTime = Date.now() - startTime;

        // Save to database
        const { error: saveError } = await supabase
          .from('meeting_notes_multi')
          .upsert({
            meeting_id: meetingId,
            note_type: config.type,
            content,
            model_used: config.model,
            token_count: tokenCount,
            processing_time_ms: processingTime
          }, {
            onConflict: 'meeting_id,note_type'
          });

        if (saveError) {
          console.error(`Error saving ${config.type} notes:`, saveError);
          throw saveError;
        }

        // Update queue status
        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'completed',
            processing_model: config.model,
            token_count: tokenCount,
            processing_time_ms: processingTime,
            updated_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId)
          .eq('note_type', config.type)
          .eq('batch_id', batchId);

        console.log(`Successfully generated ${config.type} notes (${tokenCount} tokens, ${processingTime}ms)`);

        return {
          type: config.type,
          status: 'completed',
          tokenCount,
          processingTime
        };

      } catch (error) {
        console.error(`Error generating ${config.type} notes:`, error);
        
        // Update queue with error
        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'failed',
            error_message: error.message,
            retry_count: 1,
            updated_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId)
          .eq('note_type', config.type)
          .eq('batch_id', batchId);

        return {
          type: config.type,
          status: 'failed',
          error: error.message
        };
      }
    });

    // Wait for all note types to complete
    const results = await Promise.all(generateNotePromises);

    const successCount = results.filter(r => r.status === 'completed').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    console.log(`Multi-type generation complete: ${successCount} successful, ${failureCount} failed`);

    return new Response(JSON.stringify({
      message: 'Multi-type note generation completed',
      results,
      successCount,
      failureCount,
      batchId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in multi-type notes generation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NoteTypeConfig {
  type: 'brief' | 'detailed' | 'very_detailed' | 'executive' | 'limerick';
  model: string;
  systemPrompt: string;
  maxTokens?: number;
}

const noteConfigs: NoteTypeConfig[] = [
  {
    type: 'brief',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create a BRIEF meeting summary with excellent formatting. Focus on key decisions and action items only. Use clear headings and bullet points.

Format:
# Brief Meeting Summary

## Key Decisions Made
• [Decision 1 with brief context]
• [Decision 2 with brief context]

## Action Items
• **[Item]** - Assigned to: [Owner] | Due: [Date]
• **[Item]** - Assigned to: [Owner] | Due: [Date]

## Next Steps
• [Next step with timeframe]

Keep it concise but well-formatted with clear sections and proper bullet points.`,
    maxTokens: 500
  },
  {
    type: 'executive',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create an EXECUTIVE SUMMARY with professional formatting for senior leadership. Focus on strategic decisions, impact, and outcomes.

Format:
# Executive Summary

## Meeting Overview
Brief context and purpose of the meeting.

## Strategic Decisions
• **[Decision]** - [Rationale and expected impact]
• **[Decision]** - [Rationale and expected impact]

## Business Impact & Outcomes
• **Financial:** [Impact details]
• **Operational:** [Impact details]
• **Strategic:** [Impact details]

## Key Risks & Mitigation
• **Risk:** [Description] | **Mitigation:** [Action plan]

## Executive Actions Required
• **[Action]** - [Owner] | [Timeline] | [Priority]

Use professional language with clear formatting and bullet points throughout.`,
    maxTokens: 800
  },
  {
    type: 'detailed',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create DETAILED meeting minutes with excellent formatting and comprehensive coverage. Use clear headings, bullet points, and structured layout.

Format:
# Detailed Meeting Minutes

## Meeting Information
• **Date:** [Date]
• **Time:** [Time]
• **Attendees:** [List with roles if available]
• **Chair:** [Name if identified]

## Discussion Points
### [Topic 1]
• [Key point discussed]
• [Decision or outcome]
• [Any concerns raised]

### [Topic 2]
• [Key point discussed]
• [Decision or outcome]

## Decisions Made
• **[Decision 1]** - [Full context and rationale]
• **[Decision 2]** - [Full context and rationale]

## Action Items
• **[Item]** - Assigned to: [Owner] | Due: [Date] | Priority: [Level]
• **[Item]** - Assigned to: [Owner] | Due: [Date] | Priority: [Level]

## Next Steps & Follow-up
• [Detailed next step with timeline]
• [Follow-up meeting or check-in details]

## Additional Notes
• [Any other relevant information]

Use clear formatting with consistent bullet points and bold text for emphasis.`,
    maxTokens: 2000
  },
  {
    type: 'very_detailed',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create VERY DETAILED meeting minutes with exceptional formatting and comprehensive documentation. Include verbatim quotes where significant and full context.

Format:
# Very Detailed Meeting Minutes

## Meeting Details
• **Date:** [Full date]
• **Time:** [Start - End time]
• **Location/Platform:** [Details]
• **Meeting Type:** [Format]
• **Chair:** [Name and role]
• **Secretary/Recorder:** [If applicable]

## Attendees
• **[Name]** - [Role/Title] - [Present/Apologies]
• **[Name]** - [Role/Title] - [Present/Apologies]

## Comprehensive Discussion Record
### [Topic 1] - [Time if available]
• **Background:** [Context provided]
• **Discussion Points:**
  - [Speaker if known]: "[Key point or quote]"
  - [Response or counterpoint]
  - [Resolution or agreement reached]
• **Outcome:** [Decision or next step]

### [Topic 2] - [Time if available]
• **Background:** [Context]
• **Key Arguments:**
  - [Position 1 with supporting rationale]
  - [Position 2 with supporting rationale]
• **Resolution:** [How it was resolved]

## Decision Documentation
• **[Decision 1]**
  - **Proposed by:** [Name if known]
  - **Discussion:** [Summary of debate]
  - **Alternatives considered:** [Other options discussed]
  - **Rationale:** [Why this decision was made]
  - **Vote/Consensus:** [How decision was reached]

## Complete Action Item Registry
• **[Detailed Action Item]**
  - **Assigned to:** [Full name and role]
  - **Due date:** [Specific date]
  - **Acceptance criteria:** [What constitutes completion]
  - **Dependencies:** [What must happen first]
  - **Resources needed:** [Budget, people, tools]

## Risk Assessment & Compliance Notes
• **Identified Risks:** [Potential issues discussed]
• **Mitigation Strategies:** [How risks will be managed]
• **Compliance Requirements:** [Any regulatory or policy matters]

## Follow-up Requirements
• **Next meeting:** [Date, time, agenda items]
• **Interim reporting:** [Status updates required]
• **Review points:** [When decisions will be evaluated]

Use exceptional formatting with clear hierarchy, consistent bullet points, and bold emphasis throughout.`,
    maxTokens: 4000
  },
  {
    type: 'limerick',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create a creative LIMERICK-style summary with proper formatting. Make it fun but informative, capturing the meeting essence in limerick form.

Format:
# Meeting Limerick Summary

## The Meeting Limerick
*[Write a proper limerick with AABBA rhyme scheme that captures the meeting's essence]*

There once was a meeting so bright,
Where decisions were made left and right,
With actions to do,
And outcomes so true,
The future now looks quite all right!

## What It Actually Means
• **Key Point 1:** [Clear explanation of main decision/outcome]
• **Key Point 2:** [Clear explanation of secondary point]
• **Key Point 3:** [Clear explanation of third point]

## Action Items (The Serious Stuff)
• **[Item]** - Assigned to: [Owner] | Due: [Date]
• **[Item]** - Assigned to: [Owner] | Due: [Date]

## Next Meeting
• **When:** [Date/Time]
• **Purpose:** [What we'll cover]

Keep it fun but informative with proper formatting and clear action items!`,
    maxTokens: 600
  }
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
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process all note types in parallel
    const generateNotePromises = noteConfigs.map(async (config) => {
      const startTime = Date.now();
      
      try {
        console.log(`Generating ${config.type} notes with ${config.model}...`);

        // All configs now use Claude, so always use Anthropic API
        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens || 2000,
            messages: [
              {
                role: 'user',
                content: `${config.systemPrompt}

Meeting: ${meetingTitle || 'Meeting'}
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
          console.error(`API error for ${config.type}:`, errorText);
          throw new Error(`API request failed: ${errorText}`);
        }

        const data = await apiResponse.json();
        
        // All responses are now from Claude
        const content = data.content[0].text;
        const tokenCount = data.usage?.output_tokens || 0;

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
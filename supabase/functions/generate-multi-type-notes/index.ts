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
    model: 'gpt-5-mini-2025-08-07',
    systemPrompt: `Create a BRIEF meeting summary. Focus on key decisions and action items only. Maximum 200 words.

Format:
# Brief Meeting Summary

**Key Decisions:**
- [Decision 1]
- [Decision 2]

**Action Items:**
- [Item] - [Owner] - [Due date]

**Next Steps:**
- [Next step]`,
    maxTokens: 300
  },
  {
    type: 'executive',
    model: 'gpt-5-mini-2025-08-07',
    systemPrompt: `Create an EXECUTIVE SUMMARY for senior leadership. Focus on strategic decisions, financial impact, and high-level outcomes. Professional tone.

Format:
# Executive Summary

**Meeting Overview:**
[Brief context]

**Strategic Decisions:**
- [Decision with rationale]

**Financial/Business Impact:**
- [Impact details]

**Key Risks & Mitigation:**
- [Risk] - [Mitigation]

**Executive Actions Required:**
- [Action] - [Timeline]`,
    maxTokens: 500
  },
  {
    type: 'detailed',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create DETAILED meeting minutes with comprehensive coverage of all discussion points, decisions, and context.

Format:
# Detailed Meeting Minutes

**Attendees:** [List]
**Date & Time:** [Details]

## Discussion Points
[Detailed coverage of all topics discussed]

## Decisions Made
[Full context and rationale for each decision]

## Action Items
[Comprehensive list with details, owners, timelines]

## Next Steps
[Detailed planning for follow-up activities]

## Additional Notes
[Any other relevant information]`,
    maxTokens: 2000
  },
  {
    type: 'very_detailed',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create VERY DETAILED meeting minutes with verbatim quotes, full context, and comprehensive documentation suitable for legal/compliance purposes.

Format:
# Very Detailed Meeting Minutes

**Meeting Details:** [Full metadata]
**Attendees:** [Complete list with roles]

## Comprehensive Discussion Record
[Detailed conversation flow with speaker attribution where possible]

## Decision Documentation
[Full rationale, alternatives considered, voting if applicable]

## Complete Action Item Registry
[Detailed specifications, acceptance criteria, dependencies]

## Risk Assessment & Compliance Notes
[Comprehensive risk documentation]

## Appendices
[Supporting information, references, follow-up items]`,
    maxTokens: 4000
  },
  {
    type: 'limerick',
    model: 'gpt-4.1-2025-04-14',
    systemPrompt: `Create a creative LIMERICK-style summary of the meeting. Make it fun but informative, capturing the essence of key decisions and outcomes in limerick form.

Format:
# Meeting Limerick Summary

[Creative limerick that captures the meeting essence]

**Translation:**
- Key Point 1: [Brief explanation]
- Key Point 2: [Brief explanation]
- Action Items: [List]

Have fun with it while keeping it professional and informative!`,
    maxTokens: 300
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process all note types in parallel
    const generateNotePromises = noteConfigs.map(async (config) => {
      const startTime = Date.now();
      
      try {
        console.log(`Generating ${config.type} notes with ${config.model}...`);

        let apiResponse;
        if (config.model.includes('claude')) {
          // Use Anthropic API
          apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
        } else {
          // Use OpenAI API
          const messages = [
            { role: 'system', content: config.systemPrompt },
            { 
              role: 'user', 
              content: `Meeting: ${meetingTitle || 'Meeting'}
Date: ${meetingDate || 'Not specified'}
Time: ${meetingTime || 'Not specified'}

Transcript:
${transcript}`
            }
          ];

          const requestBody: any = {
            model: config.model,
            messages,
            max_completion_tokens: config.maxTokens || 2000
          };

          // Add temperature for legacy models
          if (config.model.includes('gpt-4o') || config.model.includes('gpt-4.1')) {
            requestBody.temperature = 0.3;
          }

          apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });
        }

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error(`API error for ${config.type}:`, errorText);
          throw new Error(`API request failed: ${errorText}`);
        }

        const data = await apiResponse.json();
        let content: string;
        let tokenCount = 0;

        if (config.model.includes('claude')) {
          content = data.content[0].text;
          tokenCount = data.usage?.output_tokens || 0;
        } else {
          content = data.choices[0].message.content;
          tokenCount = data.usage?.total_tokens || 0;
        }

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
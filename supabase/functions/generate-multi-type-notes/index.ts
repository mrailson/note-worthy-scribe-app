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
    model: 'claude-sonnet-4-20250514',
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
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create an EXECUTIVE SUMMARY with professional formatting using British English spellings and conventions (e.g., 'organised', 'realise', 'colour', 'centre', 'programme', 'summarise') specifically for GP Partners, Practice Managers, and PCN leadership. Focus on strategic healthcare decisions, practice impact, and operational outcomes.

Format:
# GP/PCN Executive Summary

## Meeting Overview
Brief context and purpose - [Practice partnership/PCN strategic/Clinical governance/Operational planning meeting]

## Strategic Healthcare Decisions
• **[Clinical Service Decision]** - Impact on patient care delivery and practice capacity
• **[Operational Decision]** - Effect on practice efficiency, workflow, and staff resources  
• **[Financial Decision]** - Practice revenue, cost implications, and sustainability impact
• **[Partnership Decision]** - PCN collaboration, shared services, or external partnerships

## Practice & PCN Impact Analysis
• **Patient Care Impact:** [How decisions improve/change patient experience and clinical outcomes]
• **Operational Impact:** [Effects on daily practice operations, appointment availability, staff workload]
• **Financial Impact:** [Revenue changes, cost savings/increases, investment requirements]
• **Strategic Impact:** [Long-term practice positioning, competitive advantage, service expansion]

## Key Business Risks & Healthcare Governance
• **Clinical Risk:** [Patient safety considerations, clinical governance implications] | **Mitigation:** [Risk management approach]
• **Operational Risk:** [Service delivery, staffing, capacity risks] | **Mitigation:** [Contingency planning]
• **Financial Risk:** [Budget, funding, contract risks] | **Mitigation:** [Financial safeguarding measures]
• **Regulatory Risk:** [CQC, compliance, information governance] | **Mitigation:** [Compliance strategies]

## Leadership Actions Required
• **Practice Management:** [Critical operational tasks] - [Timeline] - [Resource requirements]
• **Clinical Leadership:** [Clinical pathway/quality actions] - [Timeline] - [Professional development needs]  
• **PCN Leadership:** [Collaborative initiatives] - [Timeline] - [Inter-practice coordination requirements]
• **Partnership Board:** [Strategic decisions requiring partner approval] - [Timeline] - [Business case needs]

## Matters to Revisit
• **[Deferred decision]** - [Reason for deferral] | **Next review:** [Timeline]
• **[Outstanding issue]** - [Context and implications] | **Action needed:** [Who/what/when]
• **[Future consideration]** - [Strategic importance] | **Follow-up required:** [Process/timeline]

## Resource Requirements & Investment Decisions
• **Staffing:** [New hires, role changes, training investments, workforce planning]
• **Technology:** [IT systems, clinical equipment, infrastructure upgrades]
• **Premises:** [Practice space, facilities, accessibility improvements]
• **Financial:** [Budget allocations, cash flow implications, partnership distributions]

## Patient & Population Health Outcomes
• **Service Enhancements:** [Improved patient access, new services, care quality improvements]
• **Population Health Impact:** [Screening programs, prevention services, health inequalities work]
• **Care Integration:** [Better coordination with secondary care, community services, social care]

## Next Executive Review Points
• **Immediate Review (2 weeks):** [Critical operational decisions requiring quick executive oversight]
• **Monthly Review (1 month):** [Progress monitoring on major initiatives and financial performance]
• **Quarterly Review (3 months):** [Strategic outcomes assessment and partnership performance review]

Focus on strategic implications for practice sustainability, patient care quality, and partnership success. Emphasize actionable leadership decisions and measurable outcomes.`,
    maxTokens: 1000
  },
  {
    type: 'limerick',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create a creative LIMERICK-style summary using British English spellings and conventions (e.g., 'organised', 'realise', 'colour', 'centre', 'programme', 'summarise') with proper formatting. Make it fun but informative, capturing the meeting essence in limerick form.

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
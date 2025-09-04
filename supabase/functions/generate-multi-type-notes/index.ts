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
    systemPrompt: `Create an EXECUTIVE SUMMARY with professional formatting specifically for GP Partners, Practice Managers, and PCN leadership. Focus on strategic healthcare decisions, practice impact, and operational outcomes.

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
    type: 'detailed',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create DETAILED GP/PCN meeting minutes focused specifically on operational agreements and decisions affecting GP practices and Primary Care Networks. Extract and highlight what matters most to healthcare professionals.

Format:
# GP/PCN Detailed Meeting Minutes

## Meeting Information
• **Date:** [Date]
• **Time:** [Time]
• **Meeting Type:** [Practice Meeting/PCN Meeting/Partnership Meeting/Clinical Meeting]
• **Attendees:** [List with GP/clinical roles where identified]
• **Chair:** [Name and role if identified]

## PRACTICE IMPACT SUMMARY
### Immediate Operational Changes
• **[Change 1]** - Impact on daily practice operations, patient care, or service delivery
• **[Change 2]** - How this affects practice workflow, staffing, or clinical protocols
• **[Change 3]** - Patient-facing service modifications or improvements

### Resource & Staffing Decisions
• **Staff Changes:** [Any hiring, role changes, training requirements, or workforce planning]
• **Equipment/Systems:** [New equipment, IT systems, clinical tools, or upgrades agreed]
• **Premises:** [Any practice premises changes, room allocations, or facility improvements]

## PCN SERVICE DELIVERY AGREEMENTS
### Clinical Services
• **[Service 1]:** [What was agreed about service provision, delivery model, or clinical pathways]
• **[Service 2]:** [Changes to existing services, new service launches, or service modifications]
• **Quality Standards:** [Any quality metrics, KPIs, or clinical standards discussed]

### Collaborative Working
• **Shared Services:** [Agreements on shared clinical services, back-office functions, or joint initiatives]
• **Care Coordination:** [Patient pathway agreements, referral processes, or care navigation changes]
• **Data Sharing:** [Clinical data sharing agreements, reporting requirements, or information governance]

## FINANCIAL IMPLICATIONS & AGREEMENTS
### Practice Finances
• **Funding Changes:** [Contract variations, new income streams, or funding allocations]
• **Cost Implications:** [New costs, shared costs, or cost-saving initiatives agreed]
• **Investment Decisions:** [Capital expenditure, equipment purchases, or practice investments]

### PCN Financial Arrangements
• **Shared Budgets:** [PCN funding allocations, shared service costs, or collaborative budgets]
• **Contract Delivery:** [DES requirements, contract milestones, or performance targets]
• **Financial Risk:** [Shared financial risks, mitigation strategies, or contingency planning]

## PATIENT CARE & SERVICE IMPACT
### Direct Patient Impact
• **Service Changes:** [How decisions directly affect patient experience, access, or care quality]
• **Appointment Systems:** [Changes to booking systems, availability, or access methods]
• **Clinical Protocols:** [New or updated clinical guidelines, treatment pathways, or care standards]

### Population Health
• **Prevention Services:** [Screening programs, vaccination campaigns, or health promotion initiatives]
• **Vulnerable Populations:** [Specific arrangements for elderly, complex needs, or high-risk patients]
• **Health Inequalities:** [Targeted interventions or equity-focused service changes]

## OPERATIONAL ACTION ITEMS
### Practice-Level Actions
• **[Practice/Individual]** - [Specific operational task] | **Due:** [Date] | **Impact:** [Patient/staff/service impact]
• **[Practice/Individual]** - [Implementation requirement] | **Due:** [Date] | **Resources needed:** [What's required]

### PCN-Level Actions  
• **[PCN Role/Team]** - [Collaborative action] | **Due:** [Date] | **Practices affected:** [Which practices]
• **[PCN Role/Team]** - [Service delivery task] | **Due:** [Date] | **Patient impact:** [Service implications]

## COMPLIANCE & GOVERNANCE MATTERS
### Regulatory Requirements
• **CQC Implications:** [Any CQC-related decisions, compliance requirements, or quality improvements]
• **Clinical Governance:** [Safety reporting, incident management, or governance process changes]
• **Information Governance:** [Data protection, confidentiality, or information sharing agreements]

### Professional Standards
• **Clinical Standards:** [Professional development, clinical audit requirements, or peer review processes]
• **Training Requirements:** [Mandatory training, CPD requirements, or skill development needs]

## STRATEGIC PLANNING & FUTURE DEVELOPMENTS
### Service Development
• **New Services:** [Plans for new clinical services, enhanced provision, or service expansion]
• **Service Integration:** [Plans for better integration between practices, with secondary care, or community services]
• **Innovation:** [Technology adoption, new care models, or pilot programs]

### Partnership Working
• **External Partnerships:** [Agreements with hospitals, community services, or other healthcare providers]
• **Stakeholder Engagement:** [Patient group involvement, community partnerships, or public health collaboration]

## RISKS & MITIGATION STRATEGIES
### Identified Risks
• **Operational Risk:** [Service delivery risks and mitigation plans]
• **Financial Risk:** [Budget risks, funding uncertainties, and contingency plans]
• **Clinical Risk:** [Patient safety considerations and risk management approaches]

### Contingency Planning
• **Backup Plans:** [Alternative arrangements for service delivery or operational continuity]
• **Risk Monitoring:** [How risks will be tracked and managed ongoing]

## COMMUNICATION REQUIREMENTS
### Internal Communication
• **Practice Staff:** [What needs to be communicated to practice teams]
• **Clinical Teams:** [Information for GPs, nurses, and other clinical staff]
• **Administrative Staff:** [Process changes affecting admin and support teams]

### External Communication  
• **Patients:** [What patients need to know about service changes]
• **Partners:** [Information to share with external healthcare partners]
• **Stakeholders:** [Updates for commissioners, CQC, or other oversight bodies]

## NEXT MEETING (Only include if next meeting details are discussed)
• **Date:** [Next meeting date if mentioned]
• **Time:** [Next meeting time if mentioned] 
• **Purpose:** [Key agenda items or focus areas for next meeting]
• **Preparation Required:** [Any specific preparation needed by attendees]

Focus on extracting specific operational agreements, resource commitments, and decisions that directly impact GP practice operations, patient care delivery, and PCN collaborative working. Prioritize actionable outcomes over meeting process details.`,
    maxTokens: 3000
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
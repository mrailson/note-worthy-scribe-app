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
    type: 'detailed',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Create DETAILED GP/PCN meeting minutes using British English spellings and conventions (e.g., 'organised', 'realise', 'colour', 'centre', 'programme', 'summarise') focused specifically on operational agreements and decisions affecting GP practices and Primary Care Networks. Extract and highlight what matters most to healthcare professionals.

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

## MATTERS TO REVISIT
### Deferred Items
• **[Deferred topic]** - [Reason for deferral] | **Next review:** [When] | **Who responsible:** [Name/role]
• **[Outstanding issue]** - [Context and current status] | **Action required:** [Next steps] | **Timeline:** [When]

### Future Considerations
• **[Strategic item]** - [Why important for future] | **Dependencies:** [What needs to happen first]
• **[Policy/process review]** - [Current gaps or concerns] | **Review schedule:** [When to address]

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
    systemPrompt: `Create COMPREHENSIVE GP/PCN Clinical Documentation using British English spellings and conventions (e.g., 'organised', 'realise', 'colour', 'centre', 'programme', 'summarise') with exceptional formatting and complete healthcare governance coverage. Include verbatim quotes of significant clinical discussions, full context for all healthcare decisions, and detailed clinical risk assessment.

Format:
# Comprehensive GP/PCN Clinical Record

## Meeting Information & Healthcare Context
• **Date:** [Full date]
• **Time:** [Start - End time with duration]
• **Meeting Type:** [Practice Partnership/PCN Board/Clinical Governance/MDT/Quality Review]
• **Clinical Focus Areas:** [Primary healthcare domains discussed]
• **Chair:** [Name, role, and clinical responsibilities]
• **Clinical Governance Lead:** [If applicable]
• **Practice Manager:** [If present]
• **Secretary/Minutes:** [Documentation responsibility]

## Healthcare Professional Attendees
• **[Name]** - [GP Partner/Salaried GP/Practice Nurse/Clinical roles] - [Present/Apologies/Virtual]
• **[Name]** - [Practice Manager/Operations/Administrative roles] - [Present/Apologies/Virtual]  
• **[Name]** - [PCN/External healthcare roles] - [Present/Apologies/Virtual]

## COMPREHENSIVE CLINICAL & OPERATIONAL DISCUSSIONS

### Healthcare Service Delivery Topics
#### [Clinical Service Topic 1] - [Time segment if available]
• **Clinical Background:** [Patient population impact, service history, clinical evidence base]
• **Professional Discussion Points:**
  - **[GP/Clinical Lead if known]:** "[Verbatim clinical opinion or key clinical statement]"
  - **Clinical Evidence Presented:** [Research, guidelines, or audit data referenced]
  - **Patient Safety Considerations:** [Safety implications discussed]
  - **Quality Metrics Impact:** [QOF, CQC, or performance indicator implications]
• **Clinical Decision Rationale:** [Evidence-based reasoning for clinical pathway changes]
• **Patient Care Outcome:** [Direct impact on patient experience, access, and clinical outcomes]

#### [Operational/Business Topic 2] - [Time segment if available]  
• **Practice Impact Context:** [Operational background, current practice position, resource implications]
• **Professional Perspectives:**
  - **[Practice Manager/GP Partner if known]:** "[Key operational or business perspective]"
  - **Resource Analysis:** [Staffing, financial, or capacity implications discussed]
  - **Implementation Challenges:** [Practical barriers and solutions identified]
• **Partnership/PCN Implications:** [Collaborative working effects and shared service impact]
• **Financial Sustainability Assessment:** [Long-term practice viability considerations]

### Clinical Risk & Patient Safety Discussions  
#### Clinical Governance & Safety Management
• **Patient Safety Incidents:** [Any safety events, near misses, or learning discussed]
• **Clinical Risk Assessment:** [Identified clinical risks and safety implications]
• **Mitigation Strategies:** [Clinical safety measures, protocols, and monitoring agreed]
• **Professional Development Needs:** [Training, competency, or clinical supervision requirements]
• **CQC Compliance Implications:** [Regulatory requirements and compliance strategies]

#### Professional Standards & Quality Assurance
• **Clinical Audit Outcomes:** [Quality measurement results and improvement actions]
• **Peer Review Processes:** [Clinical supervision, case review, or professional development]
• **Information Governance:** [Patient data protection, confidentiality, and sharing protocols]
• **Prescribing Safety:** [Medication management, formulary decisions, or safety protocols]

## DETAILED DECISION DOCUMENTATION & CLINICAL GOVERNANCE

### Strategic Healthcare Decisions
• **[Major Clinical Service Decision]**
  - **Proposed by:** [Clinical lead, practice partner, or healthcare role]
  - **Clinical Evidence Base:** [Guidelines, research, audit data supporting decision]
  - **Professional Discussion:** [Detailed clinical debate and professional perspectives]
  - **Alternative Care Models Considered:** [Other clinical approaches or service models evaluated]
  - **Clinical Risk Assessment:** [Patient safety implications and risk mitigation]
  - **Quality Impact Analysis:** [Effects on care quality, patient outcomes, and service standards]
  - **Professional Consensus:** [How clinical agreement was reached]
  - **Implementation Timeline:** [Phased clinical implementation and monitoring schedule]

### Practice Partnership & Operational Decisions  
• **[Significant Business/Operational Decision]**
  - **Business Case Presented by:** [Practice management or partnership role]
  - **Financial Analysis:** [Detailed cost-benefit analysis and practice sustainability impact]
  - **Operational Discussion:** [Workflow implications, staffing effects, and service delivery changes]
  - **Partnership Agreement Process:** [How partnership consensus was achieved]
  - **Risk Assessment:** [Business risks, financial implications, and mitigation strategies]
  - **Patient Service Impact:** [Direct effects on patient access, experience, and care quality]

## COMPREHENSIVE ACTION ITEM REGISTRY & CLINICAL IMPLEMENTATION

### Clinical Implementation Actions
• **[Detailed Clinical Action Item]**
  - **Clinical Lead Assigned:** [GP partner, clinical director, or healthcare professional]
  - **Implementation Date:** [Specific clinical implementation timeline]
  - **Clinical Acceptance Criteria:** [Measurable clinical outcomes and quality standards]
  - **Patient Safety Monitoring:** [How clinical safety will be monitored and measured]
  - **Professional Development Required:** [Training, competency, or clinical supervision needs]
  - **Clinical Dependencies:** [Other clinical services, professionals, or resources required]
  - **Quality Assurance Process:** [Audit, review, or monitoring methodology]

### Practice Management Implementation
• **[Operational Action Item]**
  - **Practice Management Lead:** [Practice manager, operations lead, or administrative role]
  - **Resource Allocation:** [Staffing, budget, equipment, or facility requirements]  
  - **Implementation Dependencies:** [IT systems, training, policy changes required]
  - **Performance Monitoring:** [KPIs, metrics, and review processes]
  - **Partnership Coordination:** [Multi-practice or PCN coordination requirements]

### PCN Collaborative Implementation
• **[PCN Service Delivery Action]**
  - **PCN Lead Responsible:** [PCN clinical director, manager, or coordination role]
  - **Inter-Practice Coordination:** [How multiple practices will collaborate]
  - **Shared Resource Requirements:** [Joint staffing, systems, or service provision]
  - **Quality Standardization:** [Ensuring consistent care standards across PCN practices]

## COMPREHENSIVE IMPACT ASSESSMENT & CLINICAL OUTCOMES

### Patient Care & Population Health Impact
• **Immediate Patient Experience Changes:** [Direct effects on patient access, appointment systems, and service delivery]
• **Clinical Outcome Expectations:** [Anticipated improvements in patient care quality and health outcomes]
• **Population Health Strategy:** [How decisions support prevention, screening, and population health management]
• **Health Equity Considerations:** [Impact on health inequalities and vulnerable patient populations]
• **Care Integration Enhancement:** [Improved coordination with secondary care, community services, and social care]

### Professional Practice & Service Development Impact  
• **Clinical Practice Enhancement:** [How decisions improve clinical effectiveness and professional practice]
• **Service Innovation:** [New care models, technology adoption, or service expansion initiatives]
• **Professional Development Outcomes:** [Enhanced clinical competencies, training programs, and career development]
• **Research & Quality Improvement:** [Clinical audit, research participation, or quality improvement initiatives]

### Practice Sustainability & Business Impact
• **Financial Sustainability Analysis:** [Long-term practice viability and partnership financial health]
• **Operational Efficiency Gains:** [Improved practice workflow, capacity optimization, and resource utilization]
• **Strategic Competitive Position:** [Practice positioning, service differentiation, and market advantages]
• **Partnership Relationship Impact:** [Effects on GP partnership dynamics and collaborative working]

## CLINICAL RISK MANAGEMENT & HEALTHCARE GOVERNANCE  

### Clinical Safety & Risk Assessment
• **Clinical Risks Identified:** [Patient safety risks, clinical governance concerns, and quality threats]
• **Professional Liability Considerations:** [Indemnity, clinical responsibility, and professional standards implications]
• **Clinical Risk Mitigation:** [Safety protocols, clinical supervision, and risk management strategies]
• **Incident Management Processes:** [How clinical incidents will be managed, reported, and learned from]
• **Clinical Audit Requirements:** [Quality monitoring, clinical effectiveness measurement, and improvement cycles]

### Regulatory & Compliance Management
• **CQC Compliance Strategy:** [How decisions align with CQC requirements and inspection preparation]
• **Clinical Governance Framework:** [Professional standards, clinical supervision, and governance structures]
• **Information Governance Compliance:** [Patient data protection, confidentiality protocols, and GDPR alignment]
• **Professional Registration Compliance:** [GMC, NMC, and other professional body requirements]
• **Safeguarding & Vulnerable Patient Protection:** [Child protection, adult safeguarding, and vulnerable population care]

### Quality Assurance & Performance Monitoring
• **Clinical Quality Metrics:** [QOF indicators, clinical effectiveness measures, and patient safety metrics]
• **Patient Experience Monitoring:** [Patient feedback systems, complaints management, and experience improvement]
• **Professional Performance Review:** [Clinical supervision, appraisal processes, and continuous professional development]
• **Service Quality Standards:** [Care pathway effectiveness, waiting time management, and access optimization]

## COMPREHENSIVE FOLLOW-UP & CLINICAL GOVERNANCE REQUIREMENTS

### Clinical Review & Monitoring Schedule
• **Immediate Clinical Review (1-2 weeks):** [Urgent clinical safety checks, patient impact monitoring, implementation verification]
• **Short-term Clinical Assessment (1 month):** [Clinical effectiveness measurement, patient outcome review, quality indicator monitoring]  
• **Quarterly Clinical Governance Review:** [Comprehensive clinical audit, professional development review, strategic healthcare planning]
• **Annual Practice Review:** [Partnership performance assessment, clinical service evaluation, strategic planning cycle]

### Professional Development & Training Requirements
• **Immediate Training Needs:** [Essential clinical competencies, safety training, regulatory compliance training]
• **Ongoing Professional Development:** [Clinical skills enhancement, leadership development, specialty training progression]
• **Multi-disciplinary Learning:** [Cross-professional education, team-based learning, collaborative competency development]
• **External Professional Networks:** [PCN clinical development, specialist society involvement, research participation]

### Communication & Clinical Governance Cascade
• **Internal Clinical Communication:** [How clinical decisions will be cascaded to all clinical and administrative staff]
• **Patient Communication Strategy:** [How service changes will be communicated to patient population]
• **Professional Network Communication:** [Updates to PCN partners, secondary care colleagues, and external healthcare providers]
• **Regulatory Reporting Requirements:** [CQC updates, commissioner reporting, and professional body notifications]

## VERBATIM CLINICAL DISCUSSIONS & PROFESSIONAL CONTEXT

### Key Clinical Quotes & Professional Perspectives
• **Significant Clinical Statements:** "[Verbatim quotes that capture essential clinical reasoning, patient safety considerations, or professional consensus]"
• **Professional Disagreement Resolution:** "[How clinical differences of opinion were professionally resolved]"
• **Patient Advocacy Statements:** "[Quotes demonstrating patient-centered decision making and advocacy]"
• **Professional Development Insights:** "[Statements about clinical learning, professional growth, and competency development]"

### Unresolved Clinical Issues & Future Professional Development
• **Complex Clinical Decisions Requiring Further Investigation:** [Clinical issues needing additional evidence, specialist consultation, or research]
• **Professional Development Gaps:** [Clinical competency needs, training requirements, or professional support needs]
• **Healthcare System Integration Challenges:** [Issues requiring broader healthcare system collaboration or policy development]
• **Innovation & Research Opportunities:** [Clinical research participation, service innovation potential, and professional development opportunities]

### Clinical Governance Context & Professional Standards
• **Professional Standards Compliance:** [How decisions align with GMC, NMC, and other professional body standards]
• **Clinical Evidence Base:** [Research evidence, clinical guidelines, and professional consensus supporting decisions]
• **Patient Safety Culture Development:** [How decisions contribute to enhanced patient safety culture and clinical governance]
• **Professional Team Effectiveness:** [Observations about clinical team functioning, collaborative working, and professional relationships]

## NEXT CLINICAL GOVERNANCE CYCLE (Only include if next meeting details are discussed)
• **Date:** [Next clinical governance meeting date]
• **Time:** [Next meeting time and expected duration]
• **Clinical Focus Areas:** [Key clinical governance items for next meeting agenda]
• **Professional Preparation Required:** [Clinical audits, case reviews, policy development, or professional development items needed]
• **Patient Data Requirements:** [Clinical data, patient feedback, or outcome measures to be prepared]
• **External Professional Input:** [Specialist consultation, external review, or professional development input required]

Focus on comprehensive clinical documentation, professional governance, and detailed healthcare operational context. Prioritize patient safety, clinical effectiveness, and professional development throughout all documentation. Ensure complete traceability of clinical decision-making and professional accountability.`,
    maxTokens: 4000
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
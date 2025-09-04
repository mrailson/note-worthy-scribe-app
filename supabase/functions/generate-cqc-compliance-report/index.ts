import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Function invoked, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting CQC report generation...');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API key available:', !!openAIApiKey);
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed:', requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      throw new Error('Invalid request body');
    }

    const { complaintId } = requestBody;
    console.log('Received complaintId:', complaintId);
    
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    // Get authorization header to extract user context
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Initialize client with user token for auth context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {}
        }
      }
    );
    
    // Get current user from auth token
    let currentUserId = null;
    if (token) {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (!userError && user) {
          currentUserId = user.id;
          console.log('Current user ID:', currentUserId);
        }
      } catch (err) {
        console.log('Could not get user from token:', err);
      }
    }

    console.log('Attempting to fetch complaint with ID:', complaintId);
    
    // Fetch complaint data first using admin client to bypass RLS
    const { data: complaint, error: complaintError } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .single();

    console.log('Complaint query result:', { complaint, complaintError });

    if (complaintError) {
      console.error('Error fetching complaint:', complaintError);
      throw new Error(`Complaint not found: ${complaintError.message}`);
    }

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    // Fetch related data separately
    console.log('Fetching related complaint data...');
    const [
      { data: outcomes, error: outcomesError },
      { data: acknowledgements, error: ackError },
      { data: auditLogs, error: auditError },
      { data: involvedParties, error: partiesError },
      { data: investigationDecisions, error: decisionsError },
      { data: investigationFindings, error: findingsError }
    ] = await Promise.all([
      supabaseAdmin.from('complaint_outcomes').select('*').eq('complaint_id', complaintId),
      supabaseAdmin.from('complaint_acknowledgements').select('*').eq('complaint_id', complaintId),
      supabaseAdmin.from('complaint_audit_log').select('*').eq('complaint_id', complaintId),
      supabaseAdmin.from('complaint_involved_parties').select('*').eq('complaint_id', complaintId),
      supabaseAdmin.from('complaint_investigation_decisions').select('*').eq('complaint_id', complaintId),
      supabaseAdmin.from('complaint_investigation_findings').select('*').eq('complaint_id', complaintId)
    ]);

    // Log any errors from related data fetching (but don't fail)
    if (outcomesError) console.log('Outcomes error:', outcomesError);
    if (ackError) console.log('Acknowledgements error:', ackError);
    if (auditError) console.log('Audit logs error:', auditError);
    if (partiesError) console.log('Involved parties error:', partiesError);
    if (decisionsError) console.log('Investigation decisions error:', decisionsError);
    if (findingsError) console.log('Investigation findings error:', findingsError);

    console.log('Related data loaded:', {
      outcomes: outcomes?.length || 0,
      acknowledgements: acknowledgements?.length || 0,
      auditLogs: auditLogs?.length || 0,
      involvedParties: involvedParties?.length || 0,
      investigationDecisions: investigationDecisions?.length || 0,
      investigationFindings: investigationFindings?.length || 0
    });

    // Attach related data to complaint object
    complaint.complaint_outcomes = outcomes || [];
    complaint.complaint_acknowledgements = acknowledgements || [];
    complaint.complaint_audit_log = auditLogs || [];
    complaint.complaint_involved_parties = involvedParties || [];
    complaint.complaint_investigation_decisions = investigationDecisions || [];
    complaint.complaint_investigation_findings = investigationFindings || [];

    console.log('Generating CQC compliance report for complaint:', complaintId);
    
    // Get practice details
    let practiceDetails = null;
    if (complaint.practice_id) {
      console.log('Fetching practice details for ID:', complaint.practice_id);
      const { data: practice, error: practiceError } = await supabaseAdmin
        .from('practice_details')
        .select('*')
        .eq('id', complaint.practice_id)
        .single();
      
      if (practiceError) {
        console.error('Error fetching practice details:', practiceError);
      } else {
        practiceDetails = practice;
        console.log('Practice details loaded:', practiceDetails?.practice_name);
      }
    }

    console.log('Calculating timeline metrics...');

    // Calculate timeline and compliance metrics
    const submittedDate = new Date(complaint.created_at);
    const acknowledgedDate = complaint.acknowledged_at ? new Date(complaint.acknowledged_at) : null;
    const completedDate = complaint.updated_at ? new Date(complaint.updated_at) : null;
    
    const acknowledgementTimeDays = acknowledgedDate ? 
      Math.ceil((acknowledgedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    const totalResolutionDays = completedDate ? 
      Math.ceil((completedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const systemPrompt = `You are a senior NHS compliance officer generating a comprehensive CQC evidence report for a completed complaint. This report will be used by CQC inspectors to assess complaint handling compliance and must be written in clear, professional language suitable for regulatory review.

CRITICAL REQUIREMENTS:
- Write in plain English while maintaining professional standards
- Provide narrative explanations of what happened and why
- Include specific regulatory citations and compliance evidence
- Demonstrate systematic approach to complaint resolution
- Show continuous improvement and learning outcomes

REPORT STRUCTURE (Use exactly these headings):

1. EXECUTIVE SUMMARY
   - Brief overview of the complaint and resolution in plain English
   - Key compliance achievements
   - Overall assessment of procedural adherence

2. COMPLAINT DETAILS AND CLASSIFICATION
   - Clear narrative of what the complaint was about
   - Patient concerns and desired outcomes
   - Complaint categorization and risk assessment
   - Regulatory context and applicable standards

3. PROCEDURAL COMPLIANCE ANALYSIS
   - Step-by-step compliance with NHS complaints procedure
   - Reference to specific regulations (NHS Constitution, LASCR 2009)
   - Evidence of adherence to statutory timeframes
   - Documentation and record-keeping compliance

4. INVESTIGATION METHODOLOGY
   - Detailed narrative of investigation approach
   - Staff interviews and evidence gathering
   - Clinical review processes (if applicable)
   - Impartiality and thoroughness assessment

5. TIMELINE AND STATUTORY COMPLIANCE
   - Acknowledgement compliance (3 working days requirement)
   - Investigation timeframe adherence (20 working days standard)
   - Extension justifications (if applicable)
   - Communication with complainant throughout

6. FINDINGS AND OUTCOMES
   - Clear summary of investigation conclusions
   - Evidence-based determinations
   - Outcome reasoning and regulatory alignment
   - Patient satisfaction and resolution effectiveness

7. LEARNING AND IMPROVEMENT ACTIONS
   - Specific lessons identified from the complaint
   - Systemic improvements implemented
   - Staff training and development outcomes
   - Quality improvement initiatives

8. GOVERNANCE AND OVERSIGHT EVIDENCE
   - Senior management involvement
   - Board/partnership reporting
   - External oversight compliance (if applicable)
   - Risk management integration

9. STAFF COMPETENCY AND TRAINING
   - Staff involved in complaint handling
   - Training records and competency assessments
   - Professional development outcomes
   - Duty of candour compliance

10. REGULATORY COMPLIANCE STATEMENT
    - Formal compliance declaration against each regulatory requirement
    - CQC Regulation 16 compliance evidence
    - NHS Constitution commitment fulfillment
    - PHSO guidance adherence

11. SUPPORTING EVIDENCE AND DOCUMENTATION
    - List of supporting documents and evidence
    - Quality assurance processes
    - Audit trail completeness
    - Data protection and confidentiality compliance

For each section, provide specific examples, quotes from regulations, and clear explanations of how the practice met or exceeded requirements. Use professional NHS language but ensure accessibility for diverse audiences including patients, regulators, and practice staff.`;

    console.log('Preparing OpenAI prompt...');
    const userPrompt = `Generate a comprehensive CQC compliance evidence report for the following completed complaint. This report must be suitable for CQC inspection and demonstrate full regulatory compliance.

**COMPLAINT REFERENCE:** ${complaint.reference_number}

**PRACTICE INFORMATION:**
${practiceDetails ? `
Practice Name: ${practiceDetails.practice_name}
Practice Address: ${practiceDetails.address || 'Not available'}
Practice Contact: ${practiceDetails.phone || 'Not available'} | ${practiceDetails.email || 'Not available'}
PCN Code: ${practiceDetails.pcn_code || 'Not specified'}
` : 'Practice details not available in system'}

**PATIENT AND COMPLAINT DETAILS:**
Patient Name: ${complaint.patient_name}
Patient DOB: ${complaint.patient_dob || 'Not provided'}
Patient Contact: ${complaint.patient_contact_email || complaint.patient_contact_phone || 'Not provided'}
Complaint on Behalf: ${complaint.complaint_on_behalf ? 'Yes' : 'No'}
Consent Given: ${complaint.consent_given ? 'Yes' : 'No'}
Consent Details: ${complaint.consent_details || 'Not applicable'}

**COMPLAINT CLASSIFICATION:**
Primary Category: ${complaint.category || 'Not categorized'}
Subcategory: ${complaint.subcategory || 'Not specified'}
Priority Level: ${complaint.priority || 'Standard'}
Location/Service: ${complaint.location_service || 'Not specified'}
Incident Date: ${complaint.incident_date ? new Date(complaint.incident_date).toLocaleDateString('en-GB') : 'Not specified'}

**DETAILED COMPLAINT DESCRIPTION:**
"${complaint.complaint_description}"

**TIMELINE AND COMPLIANCE METRICS:**
Date Submitted: ${submittedDate.toLocaleDateString('en-GB')} at ${submittedDate.toLocaleTimeString('en-GB')}
Date Acknowledged: ${acknowledgedDate?.toLocaleDateString('en-GB') || 'Not recorded'} ${acknowledgedDate ? `at ${acknowledgedDate.toLocaleTimeString('en-GB')}` : ''}
Date Completed: ${completedDate?.toLocaleDateString('en-GB') || 'In progress'} ${completedDate ? `at ${completedDate.toLocaleTimeString('en-GB')}` : ''}
Acknowledgement Time: ${acknowledgementTimeDays ? `${acknowledgementTimeDays} working days` : 'Not calculated'} (NHS Standard: ≤3 working days)
Total Resolution Time: ${totalResolutionDays ? `${totalResolutionDays} calendar days` : 'Not calculated'} (NHS Standard: ≤20 working days)
Final Status: ${complaint.status}

**STAFF INVOLVED IN COMPLAINT:**
${involvedParties && involvedParties.length > 0 ? 
  involvedParties.map(party => 
    `• ${party.staff_name} - ${party.staff_role || 'Role not specified'}
     Email: ${party.staff_email || 'Not provided'}
     Response Status: ${party.response_submitted_at ? `Submitted ${new Date(party.response_submitted_at).toLocaleDateString('en-GB')}` : 'Pending/Not required'}`
  ).join('\n') : 'No specific staff members identified in system'}

**INVESTIGATION PROCESS AND FINDINGS:**
Investigation Decision: ${investigationDecisions?.[0]?.decision_type || 'Not recorded'}
Investigation Reasoning: "${investigationDecisions?.[0]?.decision_reasoning || 'Investigation details not available in system'}"
Findings Text: "${investigationFindings?.[0]?.findings_text || 'Investigation findings not documented'}"
Clinical Review Required: ${investigationDecisions?.[0]?.clinical_review_required ? 'Yes' : 'No'}

**OUTCOMES AND RESOLUTION:**
Outcome Type: ${complaint.complaint_outcomes?.[0]?.outcome_type || 'Not specified'}
Outcome Summary: "${complaint.complaint_outcomes?.[0]?.outcome_summary || 'Outcome details not available in system'}"
Outcome Letter: "${complaint.complaint_outcomes?.[0]?.outcome_letter || 'Outcome communication not recorded'}"
Decided By: ${complaint.complaint_outcomes?.[0]?.decided_by || 'Not specified'}
Decision Date: ${complaint.complaint_outcomes?.[0]?.decided_at ? new Date(complaint.complaint_outcomes[0].decided_at).toLocaleDateString('en-GB') : 'Not recorded'}

**LEARNING AND IMPROVEMENT ACTIONS:**
Lessons Learned: "${investigationDecisions?.[0]?.lessons_learned || 'Learning outcomes not documented in system'}"
Action Plan: "${investigationDecisions?.[0]?.action_plan || 'Improvement actions not recorded'}"

**ACKNOWLEDGEMENT RECORDS:**
${acknowledgements && acknowledgements.length > 0 ? 
  acknowledgements.map(ack => 
    `Acknowledgement sent on ${new Date(ack.sent_at).toLocaleDateString('en-GB')} by ${ack.sent_by || 'System'}
     Content summary: ${ack.acknowledgement_letter ? 'Letter content recorded in system' : 'Content not preserved'}`
  ).join('\n') : 'No acknowledgement records found in system'}

**AUDIT TRAIL AND ACTIVITY LOG:**
${auditLogs && auditLogs.length > 0 ? 
  auditLogs.slice(0, 10).map(log => 
    `${new Date(log.performed_at).toLocaleDateString('en-GB')} ${new Date(log.performed_at).toLocaleTimeString('en-GB')}: ${log.action}
     ${log.details ? `Details: ${JSON.stringify(log.details)}` : ''}`
  ).join('\n') : 'Limited audit trail available - system may not have captured all activities'}

**REGULATORY COMPLIANCE REQUIREMENTS TO ADDRESS:**
1. NHS Constitution (2021) - Right to have complaints dealt with efficiently and properly investigated
2. Local Authority Social Services and NHS Complaints (England) Regulations 2009
3. CQC Regulation 16 - Receiving and acting on complaints
4. Parliamentary and Health Service Ombudsman guidance
5. NHS England Complaints Standards Framework
6. General Data Protection Regulation (GDPR) 2018 compliance
7. Duty of Candour requirements (if applicable)

**SPECIFIC INSTRUCTION:** 
Generate a professional, comprehensive report that a CQC inspector would use to assess this practice's complaint handling compliance. Explain in plain English what happened, why each step meets regulatory requirements, and provide specific evidence of good practice. Include direct quotes from regulations where relevant and demonstrate how this complaint case study shows systematic, compliant complaint management.`;

    console.log('Calling OpenAI API with model: gpt-5-2025-08-07...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 8000,
      }),
    });

    console.log('OpenAI API response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received, generating report...');
    const complianceReport = data.choices[0].message.content;

    console.log('Storing report as CQC evidence...');

    // Store the report as CQC evidence
    const evidenceTitle = `Complaints Compliance Report - ${complaint.reference_number}`;
    
    // Determine the best user to assign as uploader
    const uploadedBy = currentUserId || complaint.created_by || complaint.assigned_to;
    console.log('Setting uploaded_by to:', uploadedBy);
    
    const { data: evidenceRecord, error: evidenceError } = await supabaseAdmin
      .from('cqc_evidence')
      .insert({
        practice_id: complaint.practice_id,
        title: evidenceTitle,
        description: `Detailed CQC compliance evidence report for complaint ${complaint.reference_number}. This comprehensive report provides narrative analysis of complaint handling procedures, regulatory compliance evidence, timeline adherence, investigation methodology, outcomes, and learning actions in accordance with NHS England standards and CQC Regulation 16 requirements.`,
        evidence_type: 'complaint_compliance_report',
        cqc_domain: 'well_led',
        kloe_reference: 'W1',
        file_name: `complaint_compliance_${complaint.reference_number.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
        tags: [
          'complaint_handling',
          'nhs_standards',
          'regulatory_compliance',
          'governance',
          'patient_safety',
          complaint.category || 'general_complaint'
        ],
        uploaded_by: uploadedBy,
        status: 'active'
      })
      .select()
      .single();

    if (evidenceError) {
      console.error('Error storing CQC evidence:', evidenceError);
      // Continue with response even if evidence storage fails
    } else {
      console.log('CQC evidence stored successfully:', evidenceRecord?.id);
    }

    console.log('CQC compliance report generation completed successfully');
    return new Response(JSON.stringify({
      complianceReport,
      evidenceRecord,
      usage: data.usage,
      complianceMetrics: {
        acknowledgementDays: acknowledgementTimeDays,
        resolutionDays: totalResolutionDays,
        acknowledgementCompliant: acknowledgementTimeDays ? acknowledgementTimeDays <= 3 : null,
        resolutionCompliant: totalResolutionDays ? totalResolutionDays <= 20 : null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-cqc-compliance-report function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate CQC compliance report' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
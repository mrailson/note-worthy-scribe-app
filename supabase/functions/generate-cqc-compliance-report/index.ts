import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { complaintId } = await req.json();
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch comprehensive complaint data
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        complaint_outcomes (*),
        complaint_acknowledgements (*),
        complaint_audit_log (*),
        complaint_involved_parties (*),
        complaint_investigation_decisions (*)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError) {
      console.error('Error fetching complaint:', complaintError);
      throw new Error(`Complaint not found: ${complaintError.message}`);
    }

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    console.log('Generating CQC compliance report for complaint:', complaintId);
    
    // Get practice details
    let practiceDetails = null;
    if (complaint.practice_id) {
      const { data: practice, error: practiceError } = await supabase
        .from('practice_details')
        .select('*')
        .eq('id', complaint.practice_id)
        .single();
      
      if (practiceError) {
        console.error('Error fetching practice details:', practiceError);
      } else {
        practiceDetails = practice;
      }
    }

    // Calculate timeline and compliance metrics
    const submittedDate = new Date(complaint.created_at);
    const acknowledgedDate = complaint.acknowledged_at ? new Date(complaint.acknowledged_at) : null;
    const completedDate = complaint.updated_at ? new Date(complaint.updated_at) : null;
    
    const acknowledgementTimeDays = acknowledgedDate ? 
      Math.ceil((acknowledgedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    const totalResolutionDays = completedDate ? 
      Math.ceil((completedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const systemPrompt = `You are a NHS compliance officer generating a comprehensive CQC evidence report for a completed complaint. Generate a detailed report that demonstrates how the practice has met NHS complaint procedure requirements.

IMPORTANT: Structure the report with clear sections that CQC inspectors would expect to see:

1. EXECUTIVE SUMMARY
2. COMPLAINT OVERVIEW & CLASSIFICATION
3. PROCEDURAL COMPLIANCE EVIDENCE
4. TIMELINE COMPLIANCE
5. INVESTIGATION PROCESS
6. STAFF INVOLVEMENT & TRAINING
7. OUTCOMES & RESOLUTIONS
8. LEARNING & IMPROVEMENTS
9. GOVERNANCE & OVERSIGHT
10. COMPLIANCE DECLARATIONS
11. SUPPORTING DOCUMENTATION

For each section, provide specific evidence and reference NHS complaint handling standards, including:
- NHS Constitution requirements
- Local Authority Social Services and NHS Complaints Regulations
- Parliamentary and Health Service Ombudsman guidance
- CQC fundamental standards (Regulation 16)

Use professional NHS/CQC language and cite specific regulatory requirements where applicable.`;

    const userPrompt = `Generate a comprehensive CQC compliance evidence report for the following completed complaint:

COMPLAINT DETAILS:
- Reference: ${complaint.reference_number}
- Patient: ${complaint.patient_name}
- Date Submitted: ${submittedDate.toLocaleDateString('en-GB')}
- Date Acknowledged: ${acknowledgedDate?.toLocaleDateString('en-GB') || 'Not recorded'}
- Date Completed: ${completedDate?.toLocaleDateString('en-GB') || 'Not recorded'}
- Category: ${complaint.category || 'Not categorized'}
- Subcategory: ${complaint.subcategory || 'Not specified'}
- Priority Level: ${complaint.priority || 'Standard'}
- Final Status: ${complaint.status}

TIMELINE COMPLIANCE:
- Acknowledgement Time: ${acknowledgementTimeDays ? `${acknowledgementTimeDays} working days` : 'Not available'}
- Total Resolution Time: ${totalResolutionDays ? `${totalResolutionDays} calendar days` : 'Not available'}
- NHS Standard: 3 working days for acknowledgement, 20 working days for resolution

COMPLAINT DESCRIPTION:
${complaint.complaint_description}

INVESTIGATION FINDINGS:
${complaint.complaint_investigation_decisions?.[0]?.decision_reasoning || 'Investigation details not available'}

OUTCOMES:
${complaint.complaint_outcomes?.[0]?.outcome_summary || 'Outcome details not available'}
Outcome Type: ${complaint.complaint_outcomes?.[0]?.outcome_type || 'Not specified'}

LESSONS LEARNED:
${complaint.complaint_investigation_decisions?.[0]?.lessons_learned || 'Learning outcomes not documented'}

PRACTICE INFORMATION:
${practiceDetails ? `
Practice Name: ${practiceDetails.practice_name}
Address: ${practiceDetails.address || 'Not available'}
Contact: ${practiceDetails.phone || 'Not available'}
` : 'Practice details not available'}

STAFF INVOLVED:
${complaint.complaint_involved_parties?.map(party => 
  `- ${party.staff_name} (${party.staff_role || 'Role not specified'})`
).join('\n') || 'No staff specifically identified'}

AUDIT TRAIL:
${complaint.complaint_audit_log?.map(log => 
  `- ${new Date(log.performed_at).toLocaleDateString('en-GB')}: ${log.action}`
).join('\n') || 'Limited audit trail available'}

Generate a comprehensive report that demonstrates full compliance with NHS complaint handling procedures and provides evidence suitable for CQC inspection. Include specific regulatory references and compliance statements.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const complianceReport = data.choices[0].message.content;

    // Store the report as CQC evidence
    const evidenceTitle = `Complaints Compliance Report - ${complaint.reference_number}`;
    const { data: evidenceRecord, error: evidenceError } = await supabase
      .from('cqc_evidence')
      .insert({
        practice_id: complaint.practice_id,
        title: evidenceTitle,
        description: `Comprehensive CQC compliance evidence report for completed complaint ${complaint.reference_number}, demonstrating adherence to NHS complaint handling procedures and regulations.`,
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
        uploaded_by: complaint.assigned_to,
        status: 'active'
      })
      .select()
      .single();

    if (evidenceError) {
      console.error('Error storing CQC evidence:', evidenceError);
      // Continue with response even if evidence storage fails
    }

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
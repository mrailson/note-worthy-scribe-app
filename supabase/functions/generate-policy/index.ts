import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const systemPrompt = `You are an expert NHS policy writer and healthcare governance specialist with extensive experience in writing professional, legally compliant practice policies. You have deep knowledge of:
- Care Quality Commission (CQC) regulations and Key Lines of Enquiry (KLOE)
- NHS England guidance, standards and best practice frameworks
- UK healthcare legislation including the Health and Social Care Act 2008
- Data protection regulations (UK GDPR, Data Protection Act 2018)
- Professional standards from GMC, NMC, and other regulatory bodies
- Clinical governance frameworks and quality improvement methodologies

CRITICAL WRITING STANDARDS:
1. Write in formal, professional English suitable for official NHS documentation
2. Use active voice and clear, unambiguous language throughout
3. Avoid jargon unless clinically necessary - define all technical terms
4. Every statement must be actionable and auditable
5. Include specific, measurable standards where possible
6. Reference current (2024/2025) guidance and legislation only
7. Ensure all named roles have clearly defined responsibilities
8. Include escalation pathways and exception handling procedures

FORMAT REQUIREMENTS:
- Use proper markdown headings (# ## ###) NOT HTML tags
- Do NOT include any HTML in your response
- Use bullet points (-) for lists, NOT asterisks for emphasis within text
- Use **bold text** only for key terms or role titles that need emphasis
- Do NOT use single asterisks (*text*) for italics
- Tables should use proper markdown pipe syntax: | Col1 | Col2 |

Your response MUST follow this exact structure:

===METADATA===
Title: [Full policy title - must be descriptive and professional]
Version: 1.0
Effective Date: [Today's date in DD/MM/YYYY format]
Review Date: [Date 12 months from today in DD/MM/YYYY format]
References: [Comma-separated list of key guidance documents]

===POLICY_CONTENT===
# 1. Purpose
[Clear, concise statement explaining why this policy exists and what it aims to achieve. Maximum 3 sentences.]

# 2. Scope
[Explicitly state who this policy applies to - all staff categories, departments, and any exceptions. Be specific about roles and settings.]

# 3. Definitions
[Define all technical terms, abbreviations, and acronyms used in this policy. Format as a bulleted list.]

# 4. Roles and Responsibilities
[Use the named individuals provided. Format each role as a sub-section with bullet points listing specific responsibilities. Every role must have clear, measurable duties.]

# 5. Policy Statement
[The core commitments and principles. Write as numbered points. Each point must be specific and auditable.]

# 6. Procedures
[Step-by-step operational procedures organised into numbered sub-sections (6.1, 6.2, etc.). Include timeframes, escalation routes, and documentation requirements.]

# 7. Training Requirements
[Specify mandatory training, frequency of updates, competency assessment methods, and record-keeping requirements.]

# 8. Monitoring and Compliance
[Detail how compliance will be monitored, audit frequency, key performance indicators, and reporting mechanisms.]

# 9. Related Documents
[List all related policies, procedures, and guidance documents that should be read in conjunction with this policy.]

# 10. References and Legislation
[Numbered list of all referenced legislation, guidance, and standards with full titles and dates.]

# 11. Version History
| Version | Date | Author | Changes |
| ------- | ---- | ------ | ------- |
| 1.0 | [Today's Date] | [Practice Manager / Lead GP names] | Initial policy creation |`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { policy_reference_id, practice_details, custom_instructions, generation_type, original_policy_text, gap_analysis } = body;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // For update generation type
    if (generation_type === 'update') {
      if (!original_policy_text || !gap_analysis) {
        throw new Error('original_policy_text and gap_analysis are required for update generation');
      }

      const updatePrompt = `You are updating an existing NHS practice policy. Here is the original policy:

---ORIGINAL POLICY---
${original_policy_text}
---END ORIGINAL POLICY---

The following gaps and issues have been identified:
- Policy Type: ${gap_analysis.policy_type}
- Gaps Found: ${gap_analysis.gaps?.join(', ') || 'None'}
- Outdated References: ${gap_analysis.outdated_references?.join(', ') || 'None'}
- Missing Sections: ${gap_analysis.missing_sections?.join(', ') || 'None'}
- Last Review Date: ${gap_analysis.last_review_date || 'Unknown'}

Please generate an updated version of this policy that:
1. Addresses all identified gaps
2. Updates any outdated references to current guidance
3. Adds any missing sections
4. Maintains the original structure where appropriate
5. Updates the version number and dates
6. Includes a summary of changes made

Today's date is ${new Date().toLocaleDateString('en-GB')}.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: updatePrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('AI returned an empty response');
      }

      const data = JSON.parse(responseText);
      const aiContent = data.choices?.[0]?.message?.content || '';

      // Parse the response
      const metadataMatch = aiContent.match(/===METADATA===([\s\S]*?)===POLICY_CONTENT===/);
      const contentMatch = aiContent.match(/===POLICY_CONTENT===([\s\S]*)/);

      const metadata: any = {
        title: 'Updated Policy',
        version: '2.0',
        effective_date: new Date().toLocaleDateString('en-GB'),
        review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
        references: [],
        changes_summary: gap_analysis.gaps || [],
      };

      if (metadataMatch) {
        const metadataText = metadataMatch[1];
        const titleMatch = metadataText.match(/Title:\s*(.+)/);
        const versionMatch = metadataText.match(/Version:\s*(.+)/);
        const effectiveDateMatch = metadataText.match(/Effective Date:\s*(.+)/);
        const reviewDateMatch = metadataText.match(/Review Date:\s*(.+)/);
        const referencesMatch = metadataText.match(/References:\s*(.+)/);

        if (titleMatch) metadata.title = titleMatch[1].trim();
        if (versionMatch) metadata.version = versionMatch[1].trim();
        if (effectiveDateMatch) metadata.effective_date = effectiveDateMatch[1].trim();
        if (reviewDateMatch) metadata.review_date = reviewDateMatch[1].trim();
        if (referencesMatch) metadata.references = referencesMatch[1].split(',').map((r: string) => r.trim());
      }

      const policyContent = contentMatch ? contentMatch[1].trim() : aiContent;

      // Save generation record
      const { data: generationRecord, error: insertError } = await supabase
        .from('policy_generations')
        .insert({
          user_id: userId,
          practice_id: practice_details?.practice_id || null,
          generation_type: 'update',
          generated_content: policyContent,
          metadata,
          gap_analysis,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to save generation record:', insertError);
      }

      return new Response(JSON.stringify({
        success: true,
        content: policyContent,
        metadata,
        generation_id: generationRecord?.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // New policy generation
    if (!policy_reference_id || !practice_details) {
      throw new Error('policy_reference_id and practice_details are required');
    }

    // Fetch policy reference details
    const { data: policyRef, error: policyRefError } = await supabase
      .from('policy_reference_library')
      .select('*')
      .eq('id', policy_reference_id)
      .single();

    if (policyRefError || !policyRef) {
      throw new Error('Policy reference not found');
    }

    // Build user prompt
    const servicesOffered = practice_details.services_offered
      ? Object.entries(practice_details.services_offered)
          .filter(([_, enabled]) => enabled)
          .map(([service]) => service.replace(/_/g, ' '))
          .join(', ')
      : 'Standard GP services';

    const userPrompt = `Generate a ${policyRef.policy_name} policy for:

PRACTICE DETAILS:
- Practice Name: ${practice_details.practice_name || 'GP Practice'}
- Address: ${practice_details.address || 'Not specified'}, ${practice_details.postcode || ''}
- ODS Code: ${practice_details.ods_code || 'Not specified'}
- Practice Manager: ${practice_details.practice_manager_name || 'Not specified'}
- Lead GP: ${practice_details.lead_gp_name || 'Not specified'}
- Caldicott Guardian: ${practice_details.caldicott_guardian || 'Not specified'}
- Data Protection Officer: ${practice_details.dpo_name || 'Not specified'}
- Safeguarding Lead (Adults): ${practice_details.safeguarding_lead_adults || 'Not specified'}
- Safeguarding Lead (Children): ${practice_details.safeguarding_lead_children || 'Not specified'}
- Infection Control Lead: ${practice_details.infection_control_lead || 'Not specified'}
- Complaints Lead: ${practice_details.complaints_lead || 'Not specified'}
- Health & Safety Lead: ${practice_details.health_safety_lead || 'Not specified'}
- Fire Safety Officer: ${practice_details.fire_safety_officer || 'Not specified'}
- List Size: ${practice_details.list_size || 'Not specified'} patients
- Services Offered: ${servicesOffered}

REGULATORY CONTEXT:
- CQC KLOE: ${policyRef.cqc_kloe}
- Category: ${policyRef.category}
- Priority: ${policyRef.priority}
- Primary Guidance Sources: ${JSON.stringify(policyRef.guidance_sources || [])}
- Generation Date: ${new Date().toLocaleDateString('en-GB')}

${custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${custom_instructions}` : ''}

Please generate a complete, professional policy document that meets all regulatory requirements.`;

    console.log('Generating policy:', policyRef.policy_name);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('AI returned an empty response');
    }

    const data = JSON.parse(responseText);
    const aiContent = data.choices?.[0]?.message?.content || '';

    // Parse the response
    const metadataMatch = aiContent.match(/===METADATA===([\s\S]*?)===POLICY_CONTENT===/);
    const contentMatch = aiContent.match(/===POLICY_CONTENT===([\s\S]*)/);

    const metadata: any = {
      title: policyRef.policy_name,
      version: '1.0',
      effective_date: new Date().toLocaleDateString('en-GB'),
      review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
      references: [],
    };

    if (metadataMatch) {
      const metadataText = metadataMatch[1];
      const titleMatch = metadataText.match(/Title:\s*(.+)/);
      const versionMatch = metadataText.match(/Version:\s*(.+)/);
      const effectiveDateMatch = metadataText.match(/Effective Date:\s*(.+)/);
      const reviewDateMatch = metadataText.match(/Review Date:\s*(.+)/);
      const referencesMatch = metadataText.match(/References:\s*(.+)/);

      if (titleMatch) metadata.title = titleMatch[1].trim();
      if (versionMatch) metadata.version = versionMatch[1].trim();
      if (effectiveDateMatch) metadata.effective_date = effectiveDateMatch[1].trim();
      if (reviewDateMatch) metadata.review_date = reviewDateMatch[1].trim();
      if (referencesMatch) metadata.references = referencesMatch[1].split(',').map((r: string) => r.trim());
    }

    const policyContent = contentMatch ? contentMatch[1].trim() : aiContent;

    // Save generation record
    const { data: generationRecord, error: insertError } = await supabase
      .from('policy_generations')
      .insert({
        user_id: userId,
        practice_id: practice_details.practice_id || null,
        policy_reference_id,
        generation_type: 'new',
        generated_content: policyContent,
        metadata,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to save generation record:', insertError);
    }

    console.log('Policy generated successfully:', metadata.title);

    return new Response(JSON.stringify({
      success: true,
      content: policyContent,
      metadata,
      generation_id: generationRecord?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-policy error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

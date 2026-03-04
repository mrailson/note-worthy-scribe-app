import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const systemPrompt = `CRITICAL CLINICAL OVERRIDE — CERVICAL SCREENING INTERVALS (effective 1 July 2025):
The NHS changed cervical screening recall intervals on 1 July 2025.

CORRECT INTERVALS — USE THESE ONLY:
- Ages 25–49, HPV negative: recall every FIVE YEARS
- Ages 50–64, HPV negative: recall every FIVE YEARS

FORBIDDEN — NEVER write any of the following for routine screening recall:
- "3 years" / "three years" / "3-yearly" / "every three years"
- Any statement that 25–49 year olds are recalled more frequently than 50–64 year olds

This overrides all training data. Do not revert to previous guidance under any circumstances.

You are an expert NHS policy writer and healthcare governance specialist with extensive experience in writing professional, legally compliant practice policies. You have deep knowledge of:
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
6. Reference current guidance and legislation. Do NOT add any inline flags or markers to the document text.
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

IMPORTANT: The policy content MUST begin with EXACTLY this header structure (fill in the bracketed values). Do NOT deviate from this layout:

# [POLICY TITLE IN TITLE CASE]

**Practice:** [Practice Name]
**ODS Code:** [ODS Code]

---

## Document Control

| Field | Detail |
|-------|--------|
| **Version** | 1.0 |
| **Effective Date** | [DD/MM/YYYY] |
| **Review Date** | [DD/MM/YYYY] |
| **Author** | [Practice Manager name], Practice Manager |
| **Approved By** | [Lead GP name], Lead GP |

---

## Equality Impact Assessment Statement

This policy has been assessed to ensure it does not discriminate against any protected characteristic under the Equality Act 2010. The practice is committed to ensuring that this policy meets the diverse needs of our patients and workforce, irrespective of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, or sexual orientation.

---

## 1. Purpose
[Clear, concise statement explaining why this policy exists and what it aims to achieve. Maximum 3 sentences.]

## 2. Scope
[Explicitly state who this policy applies to - all staff categories, departments, and any exceptions. Be specific about roles and settings.]

## 3. Definitions
[Define all technical terms, abbreviations, and acronyms used in this policy. Format as a bulleted list.]

## 4. Roles and Responsibilities
[Use the named individuals provided. Format each role as a sub-section with bullet points listing specific responsibilities. Every role must have clear, measurable duties.]

## 5. Policy Statement
[The core commitments and principles. Write as numbered points. Each point must be specific and auditable.]

## 6. Procedures
[Step-by-step operational procedures organised into numbered sub-sections (6.1, 6.2, etc.). Include timeframes, escalation routes, and documentation requirements.]

## 7. Training Requirements
[Specify mandatory training, frequency of updates, competency assessment methods, and record-keeping requirements.]

## 8. Monitoring and Compliance
[Detail how compliance will be monitored, audit frequency, key performance indicators, and reporting mechanisms.]

## 9. Related Documents
[List all related policies, procedures, and guidance documents that should be read in conjunction with this policy.]

## 10. References and Legislation
[Numbered list of all referenced legislation, guidance, and standards with full titles and dates.]

## 11. Version History

| Version | Date | Author | Changes |
| ------- | ---- | ------ | ------- |
| 1.0 | [Today's Date] | [Practice Manager / Lead GP names] | Initial policy creation |`;

// Helper: stream from Anthropic and collect content, sending SSE keepalives to client
async function streamAnthropicWithKeepalive(
  anthropicResponse: Response,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
): Promise<string> {
  let aiContent = '';
  const reader = anthropicResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastPing = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            aiContent += event.delta.text;
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    // Send keepalive ping every 10 seconds to prevent gateway timeout
    if (Date.now() - lastPing > 10000) {
      await writer.write(encoder.encode(`data: {"type":"ping"}\n\n`));
      lastPing = Date.now();
    }
  }

  return aiContent;
}

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

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    // Look up practice_id from ODS code (must match gp_practices FK)
    let practiceId: string | null = null;
    if (practice_details?.ods_code) {
      const { data: practiceRecord } = await supabase
        .from('gp_practices')
        .select('id')
        .eq('ods_code', practice_details.ods_code)
        .maybeSingle();
      practiceId = practiceRecord?.id || null;
    }

    // Set up SSE streaming response to keep gateway alive
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Process in background while streaming keepalives
    const processPolicy = async () => {
      try {
        let userPrompt: string;
        let defaultTitle: string;
        let genType: string;
        let extraInsertFields: Record<string, any> = {};

        if (generation_type === 'update') {
          if (!original_policy_text || !gap_analysis) {
            throw new Error('original_policy_text and gap_analysis are required for update generation');
          }

          userPrompt = `You are updating an existing NHS practice policy. Here is the original policy:

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

          defaultTitle = 'Updated Policy';
          genType = 'update';
          extraInsertFields = { gap_analysis };
        } else {
          // New policy generation
          if (!policy_reference_id || !practice_details) {
            throw new Error('policy_reference_id and practice_details are required');
          }

          const { data: policyRef, error: policyRefError } = await supabase
            .from('policy_reference_library')
            .select('*')
            .eq('id', policy_reference_id)
            .single();

          if (policyRefError || !policyRef) {
            throw new Error('Policy reference not found');
          }

          const servicesOffered = practice_details.services_offered
            ? Object.entries(practice_details.services_offered)
                .filter(([_, enabled]) => enabled)
                .map(([service]) => service.replace(/_/g, ' '))
                .join(', ')
            : 'Standard GP services';

          let branchSiteInfo = 'None';
          if (practice_details.has_branch_site && practice_details.branch_site_name) {
            branchSiteInfo = `${practice_details.branch_site_name}`;
            if (practice_details.branch_site_address) branchSiteInfo += `, ${practice_details.branch_site_address}`;
            if (practice_details.branch_site_postcode) branchSiteInfo += `, ${practice_details.branch_site_postcode}`;
            if (practice_details.branch_site_phone) branchSiteInfo += ` (Tel: ${practice_details.branch_site_phone})`;
          }

          userPrompt = `Generate a ${policyRef.policy_name} policy for:

PRACTICE DETAILS:
- Practice Name: ${practice_details.practice_name || 'GP Practice'}
- Address: ${practice_details.address || 'Not specified'}, ${practice_details.postcode || ''}
- ODS Code: ${practice_details.ods_code || 'Not specified'}
- Clinical System: ${practice_details.clinical_system || 'Not specified'}
- Branch Site(s): ${branchSiteInfo}
- Practice Manager: ${practice_details.practice_manager_name || '[PRACTICE TO COMPLETE - Practice Manager name]'}
- Lead GP: ${practice_details.lead_gp_name || '[PRACTICE TO COMPLETE - Lead GP name]'}
- SIRO (Senior Information Risk Owner): ${practice_details.siro || '[PRACTICE TO COMPLETE - SIRO name]'}
- Caldicott Guardian: ${practice_details.caldicott_guardian || '[PRACTICE TO COMPLETE - Caldicott Guardian name]'}
- Data Protection Officer: ${practice_details.dpo_name || '[PRACTICE TO COMPLETE - DPO name]'}
- Safeguarding Lead (Adults): ${practice_details.safeguarding_lead_adults || '[PRACTICE TO COMPLETE - Adult Safeguarding Lead name]'}
- Safeguarding Lead (Children): ${practice_details.safeguarding_lead_children || '[PRACTICE TO COMPLETE - Children Safeguarding Lead name]'}
- Infection Control Lead: ${practice_details.infection_control_lead || '[PRACTICE TO COMPLETE - Infection Control Lead name]'}
- Complaints Lead: ${practice_details.complaints_lead || '[PRACTICE TO COMPLETE - Complaints Lead name]'}
- Health & Safety Lead: ${practice_details.health_safety_lead || '[PRACTICE TO COMPLETE - H&S Lead name]'}
- Fire Safety Officer: ${practice_details.fire_safety_officer || '[PRACTICE TO COMPLETE - Fire Safety Officer name]'}
- List Size: ${practice_details.list_size || 'Not specified'} patients
- Services Offered: ${servicesOffered}

REGULATORY CONTEXT:
- CQC KLOE: ${policyRef.cqc_kloe}
- Category: ${policyRef.category}
- Priority: ${policyRef.priority}
- Primary Guidance Sources: ${JSON.stringify(policyRef.guidance_sources || [])}
- Generation Date: ${new Date().toLocaleDateString('en-GB')}

CRITICAL INSTRUCTIONS FOR CONTACT DETAILS:
- For any phone numbers, mobile numbers, or contact numbers that are not provided, use the placeholder format: [PRACTICE TO COMPLETE - description]
- NEVER use dates (like 28/01/2026) as placeholder values for phone numbers
- For out-of-hours contacts, use placeholders like: [PRACTICE TO COMPLETE - local occupational health service contact] or [PRACTICE TO COMPLETE - out of hours contact number]
- For direct line numbers, use: [PRACTICE TO COMPLETE - direct line]
- All placeholders must be in square brackets and start with "PRACTICE TO COMPLETE"

${custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${custom_instructions}` : ''}

Please generate a complete, professional policy document that meets all regulatory requirements.`;

          console.log('Generating policy:', policyRef.policy_name);
          defaultTitle = policyRef.policy_name;
          genType = 'new';
          extraInsertFields = { policy_reference_id };
        }

        // Call Anthropic with streaming
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            stream: true,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anthropic API error:', response.status, errorText);
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        // Stream from Anthropic while sending keepalives to client
        const aiContent = await streamAnthropicWithKeepalive(response, writer, encoder);

        // Parse the response
        const metadataMatch = aiContent.match(/===METADATA===([\s\S]*?)===POLICY_CONTENT===/);
        const contentMatch = aiContent.match(/===POLICY_CONTENT===([\s\S]*)/);

        const metadata: any = {
          title: defaultTitle,
          version: genType === 'update' ? '2.0' : '1.0',
          effective_date: new Date().toLocaleDateString('en-GB'),
          review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
          references: [],
        };
        if (genType === 'update' && gap_analysis) {
          metadata.changes_summary = gap_analysis.gaps || [];
        }

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
            practice_id: practiceId,
            policy_name: metadata?.title || defaultTitle,
            generation_type: genType,
            generated_content: policyContent,
            metadata,
            ...extraInsertFields,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Failed to save generation record:', insertError);
        }

        console.log('Policy generated successfully:', metadata.title);

        // Send final result as SSE event
        const result = JSON.stringify({
          success: true,
          content: policyContent,
          metadata,
          generation_id: generationRecord?.id,
        });
        await writer.write(encoder.encode(`data: {"type":"result","data":${result}}\n\n`));
      } catch (error) {
        console.error('generate-policy error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        await writer.write(encoder.encode(`data: {"type":"error","error":"${errMsg.replace(/"/g, '\\"')}"}\n\n`));
      } finally {
        await writer.close();
      }
    };

    // Start processing (don't await — the response streams back immediately)
    processPolicy();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Enhancement system prompt (inlined from enhance-policy for background jobs)
const ENHANCEMENT_SYSTEM_PROMPT = `You are an NHS primary care policy expert preparing GP practices for CQC inspection. Your task is to review and enhance generated policies to ensure full regulatory compliance.

## KNOWN GUIDANCE CHANGES — APPLY BEFORE ENHANCING

### CERVICAL SCREENING (effective 1 July 2025)
- Ages 25–49 who test HPV NEGATIVE → recall is 5 YEARS (not 3 years)
- Ages 50–64 HPV negative → 5 years
- Exception: if HPV positive result within last 5 years without subsequent HPV negative test, recall remains at 1 year
- Exception: if no HPV result on record (screened pre-2019), maintain 3-year recall until HPV test obtained
- NHS App now used for screening invitations and reminders

### FLEXIBLE WORKING (effective 6 April 2024)
- Day-one right to request flexible working — remove any reference to 26-week qualifying period
- Two requests permitted per year (was one)
- Employer must consult before refusing

### SAFEGUARDING CHILDREN
- Working Together to Safeguard Children 2023 is the current version

### DNACPR / ReSPECT
- Ensure ReSPECT process is referenced
- Tracey v Cambridge University Hospitals NHS Foundation Trust [2014] must be referenced

### DATA PROTECTION / DSPT
- DSPT 2024/25 standards apply

## OUTPUT FORMAT
CRITICAL: Preserve the EXACT document header structure. Do NOT restructure Document Control table, header fields, Equality Impact Assessment Statement, section numbering, or Version History table position (must remain section 11). Only enhance CONTENT within existing sections.

## SECTION 8.1 — KPI TABLE (MANDATORY)
Section 8.1 MUST contain a populated KPI table with at least 5 measurable Key Performance Indicators relevant to the specific policy type. Each KPI row must include: KPI Name, Target/Standard, Measurement Method, Frequency, and Responsible Person. Do NOT leave this section empty or with placeholder text.

## SECTION 11 — VERSION HISTORY (STRICT RULES)
Section 11 must contain ONLY a version history table with columns: Version | Date | Author | Summary of Changes. Do NOT output internal notes, compliance gap analyses, AI instructions, or enhancement commentary into section 11.

Return the enhanced policy as a complete document with all mandatory sections, policy-specific requirements addressed, current references with years, clean finalised text without inline flags, a populated KPI table in section 8.1, and only a version history table in section 11.`;

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
    const { policy_reference_id, practice_details, custom_instructions, generation_type, original_policy_text, gap_analysis, action, job_user_id } = body;

    // ========== BACKGROUND JOB QUEUE PROCESSOR ==========
    if (action === 'process-job') {
      const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const targetUserId = job_user_id || userId;

      // --- PHASE 1: Check for pending jobs (need generation) ---
      const { data: pendingJob } = await serviceSupabase
        .from('policy_generation_jobs')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('status', 'pending')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true })
        .limit(1)
        .select()
        .single();

      if (pendingJob) {
        console.log(`[Phase 1: Generate] Job ${pendingJob.id} - ${pendingJob.policy_title}`);
        try {
          const { data: policyRef } = await serviceSupabase
            .from('policy_reference_library')
            .select('*')
            .eq('id', pendingJob.policy_reference_id)
            .single();
          if (!policyRef) throw new Error('Policy reference not found');

          const jobPractice = pendingJob.practice_details;
          const servicesOffered = jobPractice?.services_offered
            ? Object.entries(jobPractice.services_offered)
                .filter(([_, enabled]) => enabled)
                .map(([service]) => service.replace(/_/g, ' '))
                .join(', ')
            : 'Standard GP services';

          let branchSiteInfo = 'None';
          if (jobPractice?.has_branch_site && jobPractice?.branch_site_name) {
            branchSiteInfo = `${jobPractice.branch_site_name}`;
            if (jobPractice.branch_site_address) branchSiteInfo += `, ${jobPractice.branch_site_address}`;
            if (jobPractice.branch_site_postcode) branchSiteInfo += `, ${jobPractice.branch_site_postcode}`;
            if (jobPractice.branch_site_phone) branchSiteInfo += ` (Tel: ${jobPractice.branch_site_phone})`;
          }

          const jobUserPrompt = `Generate a ${policyRef.policy_name} policy for:

PRACTICE DETAILS:
- Practice Name: ${jobPractice?.practice_name || 'GP Practice'}
- Address: ${jobPractice?.address || 'Not specified'}, ${jobPractice?.postcode || ''}
- ODS Code: ${jobPractice?.ods_code || 'Not specified'}
- Clinical System: ${jobPractice?.clinical_system || 'Not specified'}
- Branch Site(s): ${branchSiteInfo}
- Practice Manager: ${jobPractice?.practice_manager_name || '[PRACTICE TO COMPLETE - Practice Manager name]'}
- Lead GP: ${jobPractice?.lead_gp_name || '[PRACTICE TO COMPLETE - Lead GP name]'}
- SIRO: ${jobPractice?.siro || '[PRACTICE TO COMPLETE - SIRO name]'}
- Caldicott Guardian: ${jobPractice?.caldicott_guardian || '[PRACTICE TO COMPLETE - Caldicott Guardian name]'}
- Data Protection Officer: ${jobPractice?.dpo_name || '[PRACTICE TO COMPLETE - DPO name]'}
- Safeguarding Lead (Adults): ${jobPractice?.safeguarding_lead_adults || '[PRACTICE TO COMPLETE - Adult Safeguarding Lead name]'}
- Safeguarding Lead (Children): ${jobPractice?.safeguarding_lead_children || '[PRACTICE TO COMPLETE - Children Safeguarding Lead name]'}
- Infection Control Lead: ${jobPractice?.infection_control_lead || '[PRACTICE TO COMPLETE - Infection Control Lead name]'}
- Complaints Lead: ${jobPractice?.complaints_lead || '[PRACTICE TO COMPLETE - Complaints Lead name]'}
- Health & Safety Lead: ${jobPractice?.health_safety_lead || '[PRACTICE TO COMPLETE - H&S Lead name]'}
- Fire Safety Officer: ${jobPractice?.fire_safety_officer || '[PRACTICE TO COMPLETE - Fire Safety Officer name]'}
- List Size: ${jobPractice?.list_size || 'Not specified'} patients
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
- For out-of-hours contacts, use placeholders like: [PRACTICE TO COMPLETE - local occupational health service contact]
- All placeholders must be in square brackets and start with "PRACTICE TO COMPLETE"

${pendingJob.custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${pendingJob.custom_instructions}` : ''}

Please generate a complete, professional policy document that meets all regulatory requirements.`;

          // Single Anthropic call: GENERATE only
          const genResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY!,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 16000,
              system: systemPrompt,
              messages: [{ role: 'user', content: jobUserPrompt }],
            }),
          });

          if (!genResponse.ok) {
            const errText = await genResponse.text();
            throw new Error(`Anthropic generation error: ${genResponse.status} - ${errText}`);
          }

          const genData = await genResponse.json();
          let generatedContent = genData.content?.[0]?.text || '';

          // Parse metadata
          const metadataMatch = generatedContent.match(/===METADATA===([\s\S]*?)===POLICY_CONTENT===/);
          const contentMatch = generatedContent.match(/===POLICY_CONTENT===([\s\S]*)/);

          const jobMetadata: any = {
            title: policyRef.policy_name,
            version: '1.0',
            effective_date: new Date().toLocaleDateString('en-GB'),
            review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
            references: [],
          };

          if (metadataMatch) {
            const mt = metadataMatch[1];
            const t = mt.match(/Title:\s*(.+)/); if (t) jobMetadata.title = t[1].trim();
            const v = mt.match(/Version:\s*(.+)/); if (v) jobMetadata.version = v[1].trim();
            const ed = mt.match(/Effective Date:\s*(.+)/); if (ed) jobMetadata.effective_date = ed[1].trim();
            const rd = mt.match(/Review Date:\s*(.+)/); if (rd) jobMetadata.review_date = rd[1].trim();
            const refs = mt.match(/References:\s*(.+)/); if (refs) jobMetadata.references = refs[1].split(',').map((r: string) => r.trim());
          }

          const policyContent = contentMatch ? contentMatch[1].trim() : generatedContent;

          // Save generated content to job row, set status to 'enhancing'
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'enhancing',
              generated_content: policyContent,
              metadata: jobMetadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingJob.id);

          console.log(`[Phase 1 done] Job ${pendingJob.id} generated, now queued for enhancement`);

          // Fire self again (non-blocking) to handle the enhancement phase
          fetch(`${SUPABASE_URL}/functions/v1/generate-policy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
            },
            body: JSON.stringify({ action: 'process-job', job_user_id: targetUserId }),
          }).catch(e => console.error('Fire-and-forget enhance failed:', e));

          return new Response(JSON.stringify({ success: true, phase: 'generated', jobId: pendingJob.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (jobError) {
          console.error(`[Phase 1 failed] Job ${pendingJob.id}:`, jobError);
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'failed',
              error_message: jobError instanceof Error ? jobError.message : 'Unknown error during generation',
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingJob.id);

          return new Response(JSON.stringify({ success: false, error: 'Generation failed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // --- PHASE 2: Check for enhancing jobs (need enhancement) ---
      const { data: enhancingJob } = await serviceSupabase
        .from('policy_generation_jobs')
        .update({ updated_at: new Date().toISOString() })
        .eq('status', 'enhancing')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true })
        .limit(1)
        .select()
        .single();

      if (enhancingJob) {
        // Check retry count to prevent infinite loops
        const retryCount = (enhancingJob.metadata as any)?.enhance_retries || 0;
        console.log(`[Phase 2: Enhance] Job ${enhancingJob.id} - ${enhancingJob.policy_title} (attempt ${retryCount + 1})`);

        if (retryCount >= 3) {
          console.log(`[Phase 2] Job ${enhancingJob.id} exceeded max retries, saving generated content as-is`);
          // Skip enhancement, save generated content directly
          const jobPractice = enhancingJob.practice_details;
          let policyContent = enhancingJob.generated_content || '';
          const jobMetadata = enhancingJob.metadata || {};

          const { data: policyRef } = await serviceSupabase
            .from('policy_reference_library')
            .select('policy_name')
            .eq('id', enhancingJob.policy_reference_id)
            .single();
          const policyName = policyRef?.policy_name || enhancingJob.policy_title;

          // Jump directly to saving (reuse code below by setting enhancedContent = null)
          // We'll handle this in the save block
        }

        try {
          const jobPractice = enhancingJob.practice_details;
          let policyContent = enhancingJob.generated_content || '';
          const jobMetadata = enhancingJob.metadata || {};

          // Increment retry counter
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: { ...jobMetadata, enhance_retries: retryCount + 1 },
              updated_at: new Date().toISOString(),
            })
            .eq('id', enhancingJob.id);

          // Look up policy ref for name
          const { data: policyRef } = await serviceSupabase
            .from('policy_reference_library')
            .select('policy_name')
            .eq('id', enhancingJob.policy_reference_id)
            .single();

          const policyName = policyRef?.policy_name || enhancingJob.policy_title;

          // Only attempt enhancement if under retry limit
          if (retryCount < 3) {
            const enhancePrompt = `Please review and enhance the following ${policyName} policy for ${jobPractice?.practice_name || '[PRACTICE NAME]'} (ODS: ${jobPractice?.ods_code || '[ODS CODE]'}).

Ensure it meets all CQC KLOE requirements, applies all known guidance changes listed at the top of your instructions, and includes current regulatory references.

${policyContent}`;

            // Add 4-minute timeout to prevent edge function timeout
            const enhanceController = new AbortController();
            const enhanceTimeout = setTimeout(() => enhanceController.abort(), 240000);

            try {
              const enhResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': ANTHROPIC_API_KEY!,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-6',
                  max_tokens: 16000,
                  system: ENHANCEMENT_SYSTEM_PROMPT,
                  messages: [{ role: 'user', content: enhancePrompt }],
                }),
                signal: enhanceController.signal,
              });

              clearTimeout(enhanceTimeout);

              if (enhResponse.ok) {
                const enhData = await enhResponse.json();
                const enhancedContent = enhData.content?.[0]?.text;
                if (enhancedContent) policyContent = enhancedContent;
              } else {
                console.error('Enhancement API error, using generated content:', enhResponse.status);
              }
            } catch (fetchErr) {
              clearTimeout(enhanceTimeout);
              if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
                console.error(`[Phase 2] Enhancement timed out for job ${enhancingJob.id}, will retry or use generated content`);
                // Self-trigger retry
                fetch(`${SUPABASE_URL}/functions/v1/generate-policy`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  },
                  body: JSON.stringify({ action: 'process-job', job_user_id: targetUserId }),
                }).catch(() => {});

                return new Response(JSON.stringify({ success: true, phase: 'enhance-timeout-retry', jobId: enhancingJob.id }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
              }
              throw fetchErr;
            }
          } else {
            console.log(`[Phase 2] Using generated content without enhancement (max retries exceeded)`);
          }

          // Save to policy_completions
          const convertToISO = (dateStr: string): string => {
            if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
            const parts = dateStr.split('/');
            if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            return dateStr;
          };

          let jobPracticeId: string | null = null;
          if (jobPractice?.ods_code) {
            const { data: pr } = await serviceSupabase
              .from('gp_practices')
              .select('id')
              .eq('ods_code', jobPractice.ods_code)
              .maybeSingle();
            jobPracticeId = pr?.id || null;
          }

          const { data: existingCompletion } = await serviceSupabase
            .from('policy_completions')
            .select('id')
            .eq('user_id', enhancingJob.user_id)
            .eq('policy_reference_id', enhancingJob.policy_reference_id)
            .eq('status', 'completed')
            .maybeSingle();

          if (existingCompletion) {
            await serviceSupabase
              .from('policy_completions')
              .update({
                policy_title: (jobMetadata as any).title || policyName,
                policy_content: policyContent,
                metadata: jobMetadata,
                effective_date: convertToISO((jobMetadata as any).effective_date || new Date().toLocaleDateString('en-GB')),
                review_date: convertToISO((jobMetadata as any).review_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')),
                version: (jobMetadata as any).version || '1.0',
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingCompletion.id);
          } else {
            await serviceSupabase
              .from('policy_completions')
              .insert({
                user_id: enhancingJob.user_id,
                practice_id: jobPracticeId,
                policy_reference_id: enhancingJob.policy_reference_id,
                policy_title: (jobMetadata as any).title || policyName,
                policy_content: policyContent,
                metadata: jobMetadata,
                effective_date: convertToISO((jobMetadata as any).effective_date || new Date().toLocaleDateString('en-GB')),
                review_date: convertToISO((jobMetadata as any).review_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')),
                version: (jobMetadata as any).version || '1.0',
                status: 'completed',
              });
          }

          // Save to policy_generations
          await serviceSupabase
            .from('policy_generations')
            .insert({
              user_id: enhancingJob.user_id,
              practice_id: jobPracticeId,
              policy_name: (jobMetadata as any).title || policyName,
              generation_type: 'new',
              generated_content: policyContent,
              metadata: jobMetadata,
              policy_reference_id: enhancingJob.policy_reference_id,
            });

          // Mark job completed
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'completed',
              generated_content: policyContent,
              metadata: jobMetadata,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', enhancingJob.id);

          console.log(`[Phase 2 done] Job ${enhancingJob.id} completed successfully`);

          // Email if requested
          if (enhancingJob.email_when_ready) {
            try {
              const { data: userData } = await serviceSupabase.auth.admin.getUserById(enhancingJob.user_id);
              const userEmail = userData?.user?.email;
              if (userEmail) {
                await fetch(`${SUPABASE_URL}/functions/v1/send-email-resend`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  },
                  body: JSON.stringify({
                    to_email: userEmail,
                    subject: `Your policy is ready: ${(jobMetadata as any).title || policyName}`,
                    html_content: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a365d;">Your Policy is Ready</h2>
                        <p>Hi,</p>
                        <p>Your policy <strong>${(jobMetadata as any).title || policyName}</strong> has been generated and enhanced successfully.</p>
                        <p>You can view and download it from your <a href="https://meetingmagic.lovable.app/policy-service/my-policies" style="color: #2563eb;">My Policies</a> page.</p>
                        <div style="margin: 24px 0; padding: 16px; background-color: #f0f9ff; border-radius: 8px;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;">
                            <strong>Version:</strong> ${(jobMetadata as any).version || '1.0'}<br/>
                            <strong>Effective Date:</strong> ${(jobMetadata as any).effective_date}<br/>
                            <strong>Review Date:</strong> ${(jobMetadata as any).review_date}
                          </p>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">This is an automated notification from Notewell AI.</p>
                      </div>
                    `,
                  }),
                });
                console.log(`Email sent to ${userEmail} for job ${enhancingJob.id}`);
              }
            } catch (emailErr) {
              console.error('Failed to send email notification:', emailErr);
            }
          }

          // Fire self again to check for more pending jobs
          fetch(`${SUPABASE_URL}/functions/v1/generate-policy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
            },
            body: JSON.stringify({ action: 'process-job', job_user_id: targetUserId }),
          }).catch(e => console.error('Fire-and-forget next job failed:', e));

          return new Response(JSON.stringify({ success: true, phase: 'enhanced', jobId: enhancingJob.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (jobError) {
          console.error(`[Phase 2 failed] Job ${enhancingJob.id}:`, jobError);
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'failed',
              error_message: jobError instanceof Error ? jobError.message : 'Unknown error during enhancement',
              updated_at: new Date().toISOString(),
            })
            .eq('id', enhancingJob.id);

          return new Response(JSON.stringify({ success: false, error: 'Enhancement failed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // No jobs to process
      return new Response(JSON.stringify({ success: true, message: 'No pending jobs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ========== END BACKGROUND JOB QUEUE PROCESSOR ==========


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

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

// ---- Constants ----
const LEASE_DURATION_MS = 210_000; // 3.5 minutes (must exceed per-step model timeout)
const MAX_STEP_ATTEMPTS = 3;
const ANTHROPIC_TIMEOUT_MS = 130_000; // 130s per Anthropic call (safe margin under 150s edge limit)
const RETRY_BACKOFF_MS = [20_000, 45_000, 90_000];

// ---- Prompts ----
const ENHANCEMENT_SYSTEM_PROMPT = `You are an NHS primary care policy expert preparing GP practices for CQC inspection. Your task is to review and enhance generated policies to ensure full regulatory compliance.

## KNOWN GUIDANCE CHANGES - APPLY BEFORE ENHANCING

### CERVICAL SCREENING (effective 1 July 2025)
- Ages 25-49 who test HPV NEGATIVE -> recall is 5 YEARS (not 3 years)
- Ages 50-64 HPV negative -> 5 years
- Exception: if HPV positive result within last 5 years without subsequent HPV negative test, recall remains at 1 year
- Exception: if no HPV result on record (screened pre-2019), maintain 3-year recall until HPV test obtained
- NHS App now used for screening invitations and reminders

### FLEXIBLE WORKING (effective 6 April 2024)
- Day-one right to request flexible working - remove any reference to 26-week qualifying period
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

## SECTION 8.1 - KPI TABLE (MANDATORY)
Section 8.1 MUST contain a populated KPI table with at least 5 measurable Key Performance Indicators relevant to the specific policy type. Each KPI row must include: KPI Name, Target/Standard, Measurement Method, Frequency, and Responsible Person. Do NOT leave this section empty or with placeholder text.

## SECTION 11 - VERSION HISTORY (STRICT RULES)
Section 11 must contain ONLY a version history table with columns: Version | Date | Author | Summary of Changes. This table must ALWAYS be populated - never leave it empty. Populate it as follows: Version = 1.0, Date = today's date in DD/MM/YYYY format, Author = the Practice Manager name from the practice details provided, Summary = "Initial issue - new policy created for [Practice Name]" (replacing [Practice Name] with the actual practice name). Do NOT output internal notes, compliance gap analyses, AI instructions, or enhancement commentary into section 11.

## PLACEHOLDER REPLACEMENT (MANDATORY - FINAL STEP)
Before returning the enhanced policy, you MUST replace every placeholder where the value is known from the practice profile data provided in the user prompt. Specifically:
- [Practice Name] -> the practice name provided
- [Practice Manager] or [Author] -> Practice Manager name provided
- [Lead GP] or [Approved By] -> Lead GP name provided
- [Practice Address] / [Address] -> practice address provided
- [Postcode] -> postcode provided
- [ODS Code] -> ODS code provided
- [Review Date] -> one year from today's date in DD/MM/YYYY format
- [SIRO] -> SIRO name if provided
- [Caldicott Guardian] -> Caldicott Guardian name if provided
- [DPO] / [Data Protection Officer] -> DPO name if provided
- [Safeguarding Lead] -> relevant safeguarding lead name if provided
- [Infection Control Lead] -> infection control lead name if provided
- [Complaints Lead] -> complaints lead name if provided
- [Health & Safety Lead] -> H&S lead name if provided
- [Fire Safety Officer] -> fire safety officer name if provided
Only leave a placeholder as [PRACTICE TO COMPLETE] if the value is genuinely not provided in the practice data.

Return the enhanced policy as a complete document with all mandatory sections, policy-specific requirements addressed, current references with years, clean finalised text without inline flags, a populated KPI table in section 8.1, a populated version history table in section 11, and ALL known placeholders replaced with actual values from the practice data.`;

const BASE_SYSTEM_PROMPT = `CRITICAL CLINICAL OVERRIDE - CERVICAL SCREENING INTERVALS (effective 1 July 2025):
The NHS changed cervical screening recall intervals on 1 July 2025.

CORRECT INTERVALS - USE THESE ONLY:
- Ages 25-49, HPV negative: recall every FIVE YEARS
- Ages 50-64, HPV negative: recall every FIVE YEARS
- HPV positive within last 5 years (no subsequent negative): recall at 1 YEAR
- No HPV result on record (pre-2019 screening): maintain 3-year recall until HPV test obtained

DO NOT write "3 years" or "three years" for routine recall intervals. The 3-year interval has been replaced by 5 years for HPV-negative results.

You are an NHS primary care policy specialist generating comprehensive, CQC-inspection-ready policies for UK General Practice. Generate professional, regulatory-compliant policies.

IMPORTANT RULES:
- Use specific named individuals from practice details provided (not just role titles)
- Include current legislation with years
- Include specific SNOMED/Read codes where clinically relevant
- All phone number placeholders must use format: [PRACTICE TO COMPLETE - description]
- Never use dates as placeholder values for phone numbers
- Replace ALL placeholders with known values from practice data. Only use [PRACTICE TO COMPLETE] for genuinely unknown values.`;

// Step-specific system prompt additions
const PART1_SYSTEM_ADDITION = `
You are generating the FIRST PART of a policy document. Generate ONLY:
1. The full document header (title, practice details, document control table, equality impact assessment)
2. Section 1: PURPOSE
3. Section 2: SCOPE
4. Section 3: DEFINITIONS

MANDATORY HEADER FORMAT (use exactly this structure):
# [Policy Title]

**Practice:** [Practice Name]
**ODS Code:** [ODS Code]

| Field | Detail |
|---|---|
| **Document Title** | [Policy Title] |
| **Version** | 1.0 |
| **Effective Date** | [Today's Date] |
| **Review Date** | [One Year from Today] |
| **Author** | [Practice Manager Name], Practice Manager |
| **Approved By** | [Lead GP Name], Lead GP |
| **Practice** | [Practice Name] |
| **ODS Code** | [ODS Code] |

**Equality Impact Assessment Statement:** This policy has been assessed for its impact on equality in accordance with the Equality Act 2010. It applies equally to all patients and staff regardless of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, or sexual orientation.

---

Do NOT include sections 4-11. Do NOT include ===METADATA=== blocks. Output ONLY the header and sections 1-3 in markdown.`;

const PART2A_SYSTEM_ADDITION = `
You are generating the MIDDLE PART of a policy document. Sections 1-3 already exist and are provided for context.
Generate ONLY:
4. ROLES AND RESPONSIBILITIES
5. POLICY STATEMENT / PROCEDURE

CRITICAL: Section 5 must be COMPLETE. For clinical policies this includes ALL sub-sections — screening pathways, referral criteria, colposcopy referral pathways, HPV triage algorithms, follow-up protocols, etc. Do NOT truncate or abbreviate any sub-section. Complete every bullet point and every sub-heading fully before finishing.

Do NOT regenerate header or sections 1-3.
Do NOT include sections 6-11.
Do NOT include ===METADATA=== blocks.
Output ONLY sections 4-5 in markdown.`;

const PART2B_SYSTEM_ADDITION = `
You are generating section 6 of a policy document. Sections 1-5 already exist and are provided for context.
Generate ONLY:
6. TRAINING REQUIREMENTS

This section should cover mandatory and recommended training, competency frameworks, update frequencies, and record-keeping requirements relevant to this specific policy area.

Do NOT regenerate any previous sections.
Do NOT include sections 7-11.
Do NOT include ===METADATA=== blocks.
Output ONLY section 6 in markdown.`;

const PART3_SYSTEM_ADDITION = `
You are generating the FINAL PART of a policy document. Sections 1-6 already exist and are provided for context. You must now generate ONLY:

7. RELATED POLICIES
8. MONITORING AND COMPLIANCE (Section 8.1 MUST contain a KPI table with at least 5 measurable KPIs: KPI Name | Target/Standard | Measurement Method | Frequency | Responsible Person)
9. REFERENCES AND LEGISLATION
10. APPENDICES
11. VERSION HISTORY (MUST contain a populated version history table: Version 1.0, today's date DD/MM/YYYY, Practice Manager as author, "Initial issue - new policy created for [Practice Name]" as summary)

CRITICAL: Section 8.1 KPI table is MANDATORY with 5+ rows. Section 11 must ONLY contain the version history table - no notes or commentary.

At the END of your output, include this metadata block:
===METADATA===
Title: [policy title]
Version: 1.0
Effective Date: [today's date DD/MM/YYYY]
Review Date: [one year from today DD/MM/YYYY]
References: [comma-separated list of key references]
===END_METADATA===

Output sections 7-11 followed by the metadata block. Do NOT repeat sections 1-6 or the header.`;

// ---- Helpers ----
function buildPracticeContext(jobPractice: any): string {
  const servicesOffered = jobPractice?.services_offered
    ? Object.entries(jobPractice.services_offered)
        .filter(([_, enabled]: [string, any]) => enabled)
        .map(([service]: [string, any]) => service.replace(/_/g, ' '))
        .join(', ')
    : 'Standard GP services';

  let branchSiteInfo = 'None';
  if (jobPractice?.has_branch_site && jobPractice?.branch_site_name) {
    branchSiteInfo = `${jobPractice.branch_site_name}`;
    if (jobPractice.branch_site_address) branchSiteInfo += `, ${jobPractice.branch_site_address}`;
    if (jobPractice.branch_site_postcode) branchSiteInfo += `, ${jobPractice.branch_site_postcode}`;
    if (jobPractice.branch_site_phone) branchSiteInfo += ` (Tel: ${jobPractice.branch_site_phone})`;
  }

  return `PRACTICE DETAILS:
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
- Services Offered: ${servicesOffered}`;
}

async function callAnthropic(system: string, userContent: string, maxTokens: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic ${response.status}: ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Anthropic timeout after ${Math.floor(ANTHROPIC_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateHeartbeat(serviceSupabase: any, jobId: string, step: string, progressPct: number) {
  await serviceSupabase
    .from('policy_generation_jobs')
    .update({
      heartbeat_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + LEASE_DURATION_MS).toISOString(),
      current_step: step,
      progress_pct: progressPct,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

function selfTrigger(targetUserId: string) {
  fetch(`${SUPABASE_URL}/functions/v1/generate-policy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ action: 'process-job', job_user_id: targetUserId }),
  }).catch(() => {});
}

// Helper: stream Anthropic response while sending keepalive pings to the client
async function streamAnthropicWithKeepalive(
  anthropicResponse: Response,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<string> {
  const reader = anthropicResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  const pingInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(`data: {"type":"ping"}\n\n`));
    } catch {
      // Writer closed
    }
  }, 10000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            await writer.write(encoder.encode(`data: {"type":"progress","chars":${fullContent.length}}\n\n`));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    clearInterval(pingInterval);
  }

  return fullContent;
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { policy_reference_id, practice_details, custom_instructions, generation_type, original_policy_text, gap_analysis, action, job_user_id } = body;

    // ========== BACKGROUND JOB QUEUE PROCESSOR (STEP PIPELINE) ==========
    if (action === 'process-job') {
      const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const targetUserId = job_user_id;

      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'job_user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Step 1: Find & claim next job ---
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const isRetryReady = (candidate: any) =>
        !candidate?.next_retry_at || new Date(candidate.next_retry_at).getTime() <= nowMs;

      let job: any = null;

      // First try pending jobs
      const { data: pendingJobs } = await serviceSupabase
        .from('policy_generation_jobs')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      job = (pendingJobs || []).find(isRetryReady) || null;

      // If no pending, look for stale generating/enhancing jobs (lease expired)
      if (!job) {
        const { data: staleJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('*')
          .eq('user_id', targetUserId)
          .in('status', ['generating', 'enhancing'])
          .lt('lease_expires_at', now)
          .order('created_at', { ascending: true })
          .limit(10);

        job = (staleJobs || []).find(isRetryReady) || null;
        if (job) {
          console.log(`[Recovery] Reclaiming stale job ${job.id} (step: ${job.current_step}, lease expired: ${job.lease_expires_at})`);
        }
      }

      // Also check for generating/enhancing jobs with NULL lease (legacy rows)
      if (!job) {
        const { data: legacyJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('*')
          .eq('user_id', targetUserId)
          .in('status', ['generating', 'enhancing'])
          .is('lease_expires_at', null)
          .order('created_at', { ascending: true })
          .limit(10);

        job = (legacyJobs || []).find(isRetryReady) || null;
        if (job) {
          console.log(`[Recovery] Reclaiming legacy job ${job.id} (no lease set)`);
        }
      }

      // Recovery path for recent transiently-failed jobs (post-timeout/abort)
      if (!job) {
        const { data: failedJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('status', 'failed')
          .order('updated_at', { ascending: false })
          .limit(10);

        job = (failedJobs || []).find((candidate: any) => {
          const msg = String(candidate?.error_message || '').toLowerCase();
          const recentlyFailed = Date.now() - new Date(candidate.updated_at).getTime() < 30 * 60 * 1000;
          const retriableError = msg.includes('aborted') || msg.includes('timeout') || msg.includes('429') || msg.includes('50');
          const hasAttemptsLeft = (candidate?.attempt_count || 0) < MAX_STEP_ATTEMPTS;
          return recentlyFailed && retriableError && hasAttemptsLeft;
        }) || null;

        if (job) {
          console.log(`[Recovery] Requeueing transient failed job ${job.id} (step: ${job.current_step})`);
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: job.current_step === 'enhance' ? 'enhancing' : 'pending',
              lease_expires_at: null,
              next_retry_at: null,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          job.status = job.current_step === 'enhance' ? 'enhancing' : 'pending';
        }
      }

      if (!job) {
        return new Response(JSON.stringify({ success: true, phase: 'idle', message: 'No jobs to process' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Claim the job with a lease
      const currentStep = job.current_step || 'generate_part_1';
      const attemptCount = (job.attempt_count || 0) + 1;

      if (attemptCount > MAX_STEP_ATTEMPTS) {
        // Too many attempts for this step - fail permanently
        await serviceSupabase
          .from('policy_generation_jobs')
          .update({
            status: 'failed',
            error_message: `Step ${currentStep} exceeded maximum retry attempts (${MAX_STEP_ATTEMPTS}). Please restart generation.`,
            lease_expires_at: null,
            next_retry_at: null,
            updated_at: now,
          })
          .eq('id', job.id);
        return new Response(JSON.stringify({ success: false, error: 'Max retries exceeded' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Set lease
      await serviceSupabase
        .from('policy_generation_jobs')
        .update({
          status: currentStep === 'enhance' ? 'enhancing' : 'generating',
          current_step: currentStep,
          heartbeat_at: now,
          lease_expires_at: new Date(Date.now() + LEASE_DURATION_MS).toISOString(),
          attempt_count: attemptCount,
          next_retry_at: null,
          updated_at: now,
        })
        .eq('id', job.id);

      console.log(`[Step: ${currentStep}] Job ${job.id} - ${job.policy_title} (attempt ${attemptCount})`);

      try {
        // Fetch policy reference
        const { data: policyRef } = await serviceSupabase
          .from('policy_reference_library')
          .select('*')
          .eq('id', job.policy_reference_id)
          .single();

        if (!policyRef) throw new Error('Policy reference not found');

        const jobPractice = job.practice_details;
        const practiceContext = buildPracticeContext(jobPractice);
        const jobMetadata: any = job.metadata || {};
        const policyName = policyRef.policy_name;

        const regulatoryContext = `REGULATORY CONTEXT:
- CQC KLOE: ${policyRef.cqc_kloe}
- Category: ${policyRef.category}
- Priority: ${policyRef.priority}
- Primary Guidance Sources: ${JSON.stringify(policyRef.guidance_sources || [])}
- Generation Date: ${new Date().toLocaleDateString('en-GB')}`;

        const contactInstructions = `CRITICAL INSTRUCTIONS FOR CONTACT DETAILS:
- For any phone numbers not provided, use: [PRACTICE TO COMPLETE - description]
- NEVER use dates as placeholder values for phone numbers
- All placeholders must be in square brackets and start with "PRACTICE TO COMPLETE"`;

        // ---- STEP: generate_part_1 ----
        if (currentStep === 'generate_part_1') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_1', 10);

          const userPrompt = `Generate the first part of a ${policyName} policy for:

${practiceContext}

${regulatoryContext}

${contactInstructions}

${job.custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${job.custom_instructions}` : ''}

Generate the complete header and sections 1-3 only.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + PART1_SYSTEM_ADDITION,
            userPrompt,
            5200
          );

          if (!content || content.length < 150) {
            throw new Error('Generation part 1 returned insufficient content');
          }

          // Store partial content and advance step
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: { ...jobMetadata, partial_sections_1_3: content },
              current_step: 'generate_part_2a',
              progress_pct: 15,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null, // Release lease before self-trigger
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_1] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_1', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_2a (sections 4-5) ----
        // Also handles legacy 'generate_part_2' jobs
        if (currentStep === 'generate_part_2a' || currentStep === 'generate_part_2') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_2a', 25);

          const part1Content = jobMetadata.partial_sections_1_3 || '';
          if (!part1Content) {
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_1',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_1' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here is the first part of the ${policyName} policy (header + sections 1-3) that has already been generated:

---FIRST PART---
${part1Content}
---END FIRST PART---

${practiceContext}

${regulatoryContext}

${contactInstructions}

Now generate sections 4-5 only. Section 5 must be COMPLETE with all sub-sections fully written out.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + PART2A_SYSTEM_ADDITION,
            userPrompt,
            8000
          );

          if (!content || content.length < 150) {
            throw new Error('Generation part 2a returned insufficient content');
          }

          const sections1to5 = `${part1Content.trim()}\n\n${content.trim()}`;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: {
                ...jobMetadata,
                partial_sections_1_3: part1Content,
                partial_sections_1_5: sections1to5,
              },
              current_step: 'generate_part_2b',
              progress_pct: 35,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_2a] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_2a', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_2b (section 6) ----
        if (currentStep === 'generate_part_2b') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_2b', 45);

          const sections1to5 = jobMetadata.partial_sections_1_5 || '';
          if (!sections1to5) {
            // Missing part 2a, go back
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_2a',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_2a' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here are sections 1-5 of the ${policyName} policy (already generated):

---SECTIONS 1-5---
${sections1to5}
---END SECTIONS 1-5---

${practiceContext}

${regulatoryContext}

${contactInstructions}

Now generate section 6 (Training Requirements) only.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + PART2B_SYSTEM_ADDITION,
            userPrompt,
            3000
          );

          if (!content || content.length < 100) {
            throw new Error('Generation part 2b returned insufficient content');
          }

          const sections1to6 = `${sections1to5.trim()}\n\n${content.trim()}`;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: {
                ...jobMetadata,
                partial_sections_1_3: jobMetadata.partial_sections_1_3,
                partial_sections_1_5: sections1to5,
                partial_sections_1_6: sections1to6,
              },
              current_step: 'generate_part_3',
              progress_pct: 50,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_2b] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_2b', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_3 ----
        if (currentStep === 'generate_part_3') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_3', 65);

          const sections1to6 = jobMetadata.partial_sections_1_6 || '';
          if (!sections1to6) {
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_1',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_1' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here are sections 1-6 of the ${policyName} policy (already generated):

---SECTIONS 1-6---
${sections1to6}
---END SECTIONS 1-6---

${practiceContext}

${regulatoryContext}

${contactInstructions}

Now generate sections 7-11 to complete this policy, followed by the ===METADATA=== block.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + PART3_SYSTEM_ADDITION,
            userPrompt,
            7000
          );

          if (!content || content.length < 200) {
            throw new Error('Generation part 3 returned insufficient content');
          }

          const metadataMatch = content.match(/===METADATA===([\s\S]*?)(?:===END_METADATA===|$)/);
          const sectionsContent = content.replace(/===METADATA===[\s\S]*$/, '').trim();

          const metadata: any = {
            title: policyName,
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

          const fullContent = `${sections1to6.trim()}\n\n${sectionsContent}`;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'enhancing',
              generated_content: fullContent,
              metadata: {
                ...metadata,
                partial_sections_1_3: undefined,
                partial_sections_1_5: undefined,
                partial_sections_1_6: undefined,
              },
              current_step: 'enhance',
              progress_pct: 80,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_3] Job ${job.id} - combined ${fullContent.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_3', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: enhance ----
        if (currentStep === 'enhance') {
          await updateHeartbeat(serviceSupabase, job.id, 'enhance', 65);

          let policyContent = job.generated_content || '';
          const enhanceRetries = jobMetadata.enhance_retries || 0;

          if (enhanceRetries >= 2 || policyContent.length > 25000) {
            console.log(`[Step: enhance] Skipping enhancement (retries: ${enhanceRetries}, length: ${policyContent.length})`);
          } else {
            const enhancePrompt = `Please review and enhance the following ${policyName} policy for ${(jobPractice as any)?.practice_name || '[PRACTICE NAME]'} (ODS: ${(jobPractice as any)?.ods_code || '[ODS CODE]'}).

Ensure it meets all CQC KLOE requirements, applies all known guidance changes listed at the top of your instructions, and includes current regulatory references.

PRACTICE DATA FOR PLACEHOLDER REPLACEMENT:
${practiceContext}

POLICY TO ENHANCE:
${policyContent}`;

            try {
              const enhanced = await callAnthropic(ENHANCEMENT_SYSTEM_PROMPT, enhancePrompt, 10000);
              if (enhanced && enhanced.length > 500) {
                policyContent = enhanced;
                console.log(`[Step: enhance] Enhancement succeeded - ${enhanced.length} chars`);
              } else {
                console.warn(`[Step: enhance] Enhancement returned insufficient content, using original`);
              }
            } catch (enhErr) {
              console.error(`[Step: enhance] Enhancement failed, using generated content:`, enhErr);
              // Store retry count but continue to finalise
              await serviceSupabase
                .from('policy_generation_jobs')
                .update({
                  metadata: { ...jobMetadata, enhance_retries: enhanceRetries + 1 },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);
            }
          }

          // Advance to finalise
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              generated_content: policyContent,
              current_step: 'finalise',
              progress_pct: 80,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: enhance] Job ${job.id}`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'enhance', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: finalise ----
        if (currentStep === 'finalise') {
          await updateHeartbeat(serviceSupabase, job.id, 'finalise', 90);

          const policyContent = job.generated_content || '';

          // Save to policy_completions
          try {
            const today = new Date().toISOString().split('T')[0];
            const reviewDate = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
            await serviceSupabase.from('policy_completions').insert({
              user_id: job.user_id,
              policy_reference_id: job.policy_reference_id,
              policy_title: policyName,
              policy_content: policyContent,
              metadata: jobMetadata,
              version: jobMetadata.version || '1.0',
              status: 'completed',
              effective_date: jobMetadata.effective_date || today,
              review_date: jobMetadata.review_date || reviewDate,
            });
          } catch (saveErr) {
            console.error(`[Finalise] Failed to save completion:`, saveErr);
          }

          // Mark completed
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'completed',
              generated_content: policyContent,
              completed_at: new Date().toISOString(),
              progress_pct: 100,
              current_step: 'done',
              attempt_count: 0,
              lease_expires_at: null,
              next_retry_at: null,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Finalise] Job ${job.id} completed`);

          // Send email if requested
          if (job.email_when_ready) {
            try {
              const { data: userData } = await serviceSupabase.auth.admin.getUserById(job.user_id);
              const userEmail = userData?.user?.email;
              if (userEmail) {
                // Generate Word attachment
                let wordAttachment = null;
                try {
                  const policyTitle = jobMetadata.title || policyName;
                  const jobPracticeDetails = job.practice_details as any;

                  // Fetch practice logo
                  let logoUrl: string | null = null;
                  try {
                    const { data: pdRow } = await serviceSupabase
                      .from('practice_details')
                      .select('logo_url, practice_logo_url')
                      .eq('user_id', job.user_id)
                      .order('is_default', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    if (pdRow) logoUrl = pdRow.practice_logo_url || pdRow.logo_url || null;
                  } catch (logoErr) {
                    console.warn('Could not fetch practice logo:', logoErr);
                  }

                  // Fetch and base64 the logo
                  let logoBase64 = '';
                  let logoMime = 'image/png';
                  if (logoUrl) {
                    try {
                      const logoResp = await fetch(logoUrl);
                      if (logoResp.ok) {
                        const logoBuffer = await logoResp.arrayBuffer();
                        const logoBytes = new Uint8Array(logoBuffer);
                        let logoBinary = '';
                        for (let i = 0; i < logoBytes.length; i++) {
                          logoBinary += String.fromCharCode(logoBytes[i]);
                        }
                        logoBase64 = btoa(logoBinary);
                        const ct = logoResp.headers.get('content-type');
                        if (ct) logoMime = ct.split(';')[0].trim();
                      }
                    } catch (imgErr) {
                      console.warn('Could not fetch logo image:', imgErr);
                    }
                  }

                  // Convert markdown to Word-compatible HTML with professional formatting
                  const mdToHtml = (md: string): string => {
                    const lines = md.split('\n');
                    const output: string[] = [];
                    let inTable = false;
                    let tableRows: string[][] = [];
                    let inList = false;
                    let listItems: string[] = [];

                    const flushTable = () => {
                      if (tableRows.length === 0) return;
                      let t = '<table style="border-collapse:collapse;width:100%;margin:10pt 0;mso-table-lspace:0;mso-table-rspace:0;">';
                      tableRows.forEach((cells, idx) => {
                        const isHeader = idx === 0;
                        const bg = isHeader ? 'background-color:#EFF6FF;' : '';
                        const fw = isHeader ? 'font-weight:bold;' : '';
                        t += '<tr>';
                        cells.forEach(c => {
                          const tag = isHeader ? 'td' : 'td';
                          t += `<${tag} style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;${bg}${fw}vertical-align:top;">${c.trim()}</${tag}>`;
                        });
                        t += '</tr>';
                      });
                      t += '</table>';
                      output.push(t);
                      tableRows = [];
                    };

                    const flushList = () => {
                      if (listItems.length === 0) return;
                      output.push('<ul style="margin:4pt 0 8pt 24pt;padding:0;">');
                      listItems.forEach(li => {
                        output.push(`<li style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;margin-bottom:3pt;">${li}</li>`);
                      });
                      output.push('</ul>');
                      listItems = [];
                    };

                    const inlineFormat = (text: string): string => {
                      return text
                        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>');
                    };

                    for (const rawLine of lines) {
                      const line = rawLine.trimEnd();

                      // Separator rows in tables
                      if (/^\|[\s\-:|]+\|$/.test(line)) continue;

                      // Table row
                      if (line.startsWith('|') && line.endsWith('|')) {
                        if (!inTable) { flushList(); inTable = true; }
                        const cells = line.slice(1, -1).split('|').map(c => inlineFormat(c.trim()));
                        tableRows.push(cells);
                        continue;
                      } else if (inTable) {
                        inTable = false;
                        flushTable();
                      }

                      // Headings
                      const h3 = line.match(/^### (.+)$/);
                      if (h3) { flushList(); output.push(`<h3 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:13pt;margin-top:14pt;margin-bottom:4pt;mso-style-name:'Heading 3';">${inlineFormat(h3[1])}</h3>`); continue; }

                      const h2 = line.match(/^## (.+)$/);
                      if (h2) { flushList(); output.push(`<h2 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:15pt;margin-top:20pt;margin-bottom:6pt;mso-style-name:'Heading 2';">${inlineFormat(h2[1])}</h2>`); continue; }

                      const h1 = line.match(/^# (.+)$/);
                      if (h1) { flushList(); output.push(`<h1 style="color:#003087;font-family:Calibri,Arial,sans-serif;font-size:20pt;margin-top:0;margin-bottom:10pt;mso-style-name:'Heading 1';">${inlineFormat(h1[1])}</h1>`); continue; }

                      // Numbered section headings like "1. PURPOSE" or "10. REFERENCES"
                      const numHeading = line.match(/^(\d+)\.\s+([A-Z][A-Z\s&/,-]+)$/);
                      if (numHeading) { flushList(); output.push(`<h2 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:14pt;font-weight:bold;margin-top:20pt;margin-bottom:6pt;">${numHeading[1]}. ${numHeading[2]}</h2>`); continue; }

                      // Sub-numbered headings like "1.1" or "2.3 Heading Text"
                      const subHeading = line.match(/^(\d+\.\d+)\s+(.+)$/);
                      if (subHeading) { flushList(); output.push(`<h3 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:bold;margin-top:12pt;margin-bottom:4pt;">${subHeading[1]} ${inlineFormat(subHeading[2])}</h3>`); continue; }

                      // Bullet points
                      const bullet = line.match(/^[\s]*[-*]\s+(.+)$/);
                      if (bullet) { if (!inList) inList = true; listItems.push(inlineFormat(bullet[1])); continue; }
                      if (inList) { inList = false; flushList(); }

                      // Empty line
                      if (line.trim() === '') { output.push(''); continue; }

                      // Regular paragraph
                      output.push(`<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;margin:0 0 6pt 0;mso-line-height-rule:exactly;">${inlineFormat(line)}</p>`);
                    }

                    // Flush remaining
                    if (inTable) flushTable();
                    if (inList) flushList();

                    return output.join('\n');
                  };

                  const htmlBody = mdToHtml(policyContent);
                  const nowDate = new Date();
                  const dateStr = nowDate.toLocaleDateString('en-GB');
                  const timeStr = nowDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                  const practiceName = jobPracticeDetails?.practice_name || '';
                  const practiceAddr = jobPracticeDetails?.address || '';
                  const practicePostcode = jobPracticeDetails?.postcode || '';
                  const practicePhone = jobPracticeDetails?.phone || '';
                  const odsCode = jobPracticeDetails?.ods_code || '';

                  // Document control table
                  const version = jobMetadata.version || '1.0';
                  const effectiveDate = jobMetadata.effective_date || dateStr;
                  const reviewDate = jobMetadata.review_date || '';
                  const author = jobMetadata.author || practiceName || '';
                  const approvedBy = jobMetadata.approved_by || '';

                  const docControlTable = `
<table style="border-collapse:collapse;width:100%;margin:12pt 0 18pt 0;">
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;width:35%;">Version</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${version}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Effective Date</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${effectiveDate}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Review Date</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${reviewDate}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Author</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${author}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Approved By</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${approvedBy}</td></tr>
</table>`;

                  // Header with fixed-size logo
                  let headerHtml = '<div style="border-bottom:2pt solid #005EB8;padding-bottom:12pt;margin-bottom:6pt;">';
                  headerHtml += '<table style="width:100%;border:none;"><tr>';
                  if (logoBase64) {
                    headerHtml += `<td style="width:90px;vertical-align:middle;border:none;padding:0 12pt 0 0;">
                      <img src="data:${logoMime};base64,${logoBase64}" width="80" height="60" style="width:80px;height:60px;object-fit:contain;" alt="Practice logo" />
                    </td>`;
                  }
                  headerHtml += '<td style="vertical-align:middle;border:none;padding:0;">';
                  if (practiceName) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:14pt;font-weight:bold;color:#003087;margin:0 0 4pt 0;">${practiceName}</p>`;
                  const addressParts = [practiceAddr, practicePostcode].filter(Boolean).join(', ');
                  if (addressParts) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#666;margin:0 0 2pt 0;">${addressParts}</p>`;
                  if (practicePhone) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#666;margin:0 0 2pt 0;">Tel: ${practicePhone}</p>`;
                  if (odsCode) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#666;margin:0;">ODS Code: ${odsCode}</p>`;
                  headerHtml += '</td></tr></table></div>';

                  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${policyTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { margin: 2.54cm; }
  body {
    font-family: Calibri, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #374151;
    mso-line-height-rule: exactly;
    mso-default-props: yes;
  }
  h1, h2, h3 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
  p { mso-style-parent: ""; margin: 0 0 6pt 0; }
</style>
</head><body>
${headerHtml}
${docControlTable}
${htmlBody}
<br style="page-break-before:auto;"/>
<hr style="margin-top:30pt;border:none;border-top:1pt solid #CBD5E1;"/>
<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#64748B;text-align:center;margin-top:6pt;">${practiceName ? practiceName + ' | ' : ''}Generated by Notewell AI on ${dateStr} at ${timeStr}</p>
</body></html>`;

                  const enc = new TextEncoder();
                  const uint8 = enc.encode(wordHtml);
                  let binary = '';
                  for (let i = 0; i < uint8.length; i++) {
                    binary += String.fromCharCode(uint8[i]);
                  }
                  const base64Content = btoa(binary);

                  const safeFilename = policyTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 60);
                  wordAttachment = {
                    filename: `${safeFilename}.doc`,
                    content: base64Content,
                    type: 'application/msword'
                  };
                } catch (docErr) {
                  console.warn('Word document generation failed:', docErr);
                }

                await fetch(`${SUPABASE_URL}/functions/v1/send-email-resend`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  },
                  body: JSON.stringify({
                    to_email: userEmail,
                    subject: `Your policy is ready: ${jobMetadata.title || policyName}`,
                    html_content: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a365d;">Your Policy is Ready</h2>
                        <p>Hi,</p>
                        <p>Your policy <strong>${jobMetadata.title || policyName}</strong> has been generated and enhanced successfully.</p>
                        <p>You can view and download it from your <a href="https://gpnotewell.co.uk/policy-service/my-policies" style="color: #2563eb;">My Policies</a> page.</p>
                        ${wordAttachment ? '<p>The policy document is attached to this email as a Word file.</p>' : ''}
                        <div style="margin: 24px 0; padding: 16px; background-color: #f0f9ff; border-radius: 8px;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;">
                            <strong>Version:</strong> ${jobMetadata.version || '1.0'}<br/>
                            <strong>Effective Date:</strong> ${jobMetadata.effective_date}<br/>
                            <strong>Review Date:</strong> ${jobMetadata.review_date}
                          </p>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">This is an automated notification from Notewell AI.</p>
                      </div>
                    `,
                    attachments: wordAttachment ? [wordAttachment] : undefined,
                  }),
                });
                console.log(`Email sent to ${userEmail} for job ${job.id}`);
              }
            } catch (emailErr) {
              console.error('Failed to send email:', emailErr);
            }
          }

          // Check for more jobs
          const { data: moreJobs } = await serviceSupabase
            .from('policy_generation_jobs')
            .select('id')
            .eq('user_id', targetUserId)
            .in('status', ['pending'])
            .limit(1);

          if (moreJobs && moreJobs.length > 0) {
            selfTrigger(targetUserId);
          }

          return new Response(JSON.stringify({ success: true, phase: 'finalise', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Unknown step - reset to part 1
        console.warn(`[Unknown step: ${currentStep}] Resetting job ${job.id}`);
        await serviceSupabase
          .from('policy_generation_jobs')
          .update({ current_step: 'generate_part_1', lease_expires_at: null, updated_at: new Date().toISOString() })
          .eq('id', job.id);
        selfTrigger(targetUserId);

        return new Response(JSON.stringify({ success: true, phase: 'reset' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (stepError) {
        const errMsg = stepError instanceof Error ? stepError.message : 'Unknown error';
        const normalisedError = errMsg.toLowerCase();
        const isTransient =
          normalisedError.includes('abort') ||
          normalisedError.includes('timeout') ||
          normalisedError.includes('429') ||
          normalisedError.includes('500') ||
          normalisedError.includes('502') ||
          normalisedError.includes('503') ||
          normalisedError.includes('504') ||
          normalisedError.includes('network');

        console.error(`[Step failed: ${currentStep}] Job ${job.id}:`, errMsg);

        if (isTransient && attemptCount < MAX_STEP_ATTEMPTS) {
          // Transient failure - release lease and retry with backoff
          const backoffMs = RETRY_BACKOFF_MS[Math.min(attemptCount - 1, RETRY_BACKOFF_MS.length - 1)];
          const retryAt = new Date(Date.now() + backoffMs).toISOString();

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: currentStep === 'enhance' ? 'enhancing' : 'generating',
              lease_expires_at: retryAt,
              next_retry_at: retryAt,
              error_message: `Step ${currentStep} failed (attempt ${attemptCount}/${MAX_STEP_ATTEMPTS}): ${errMsg}. Retrying...`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // Schedule retry
          setTimeout(() => selfTrigger(targetUserId), backoffMs);
        } else {
          // Permanent failure
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'failed',
              error_message: `Step ${currentStep} failed permanently: ${errMsg}`,
              lease_expires_at: null,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        }

        return new Response(JSON.stringify({ success: false, error: errMsg }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========== SSE STREAMING PATH (synchronous generation) ==========
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    let practiceId: string | null = null;
    if (practice_details?.ods_code) {
      const { data: practiceRecord } = await supabase
        .from('gp_practices')
        .select('id')
        .eq('ods_code', practice_details.ods_code)
        .maybeSingle();
      practiceId = practiceRecord?.id || null;
    }

    const systemPrompt = BASE_SYSTEM_PROMPT + `

MANDATORY HEADER FORMAT (use exactly this structure):
# [Policy Title]

**Practice:** [Practice Name]
**ODS Code:** [ODS Code]

| Field | Detail |
|---|---|
| **Document Title** | [Policy Title] |
| **Version** | 1.0 |
| **Effective Date** | [Today's Date] |
| **Review Date** | [One Year from Today] |
| **Author** | [Practice Manager Name], Practice Manager |
| **Approved By** | [Lead GP Name], Lead GP |
| **Practice** | [Practice Name] |
| **ODS Code** | [ODS Code] |

**Equality Impact Assessment Statement:** This policy has been assessed for its impact on equality in accordance with the Equality Act 2010. It applies equally to all patients and staff regardless of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, or sexual orientation.

---

MANDATORY SECTIONS (in this exact order):
1. PURPOSE
2. SCOPE
3. DEFINITIONS
4. ROLES AND RESPONSIBILITIES
5. POLICY STATEMENT / PROCEDURE
6. TRAINING REQUIREMENTS
7. RELATED POLICIES
8. MONITORING AND COMPLIANCE (8.1 must contain KPI table with 5+ KPIs)
9. REFERENCES AND LEGISLATION
10. APPENDICES
11. VERSION HISTORY (must contain populated version history table)

OUTPUT FORMAT:
===METADATA===
Title: [policy title]
Version: 1.0
Effective Date: [today's date DD/MM/YYYY]
Review Date: [one year from today DD/MM/YYYY]
References: [comma-separated list of key references]
===POLICY_CONTENT===
[full policy document in markdown]`;

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

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
- SIRO: ${practice_details.siro || '[PRACTICE TO COMPLETE - SIRO name]'}
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
- For any phone numbers not provided, use: [PRACTICE TO COMPLETE - description]
- NEVER use dates as placeholder values for phone numbers
- All placeholders must be in square brackets and start with "PRACTICE TO COMPLETE"

${custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${custom_instructions}` : ''}

Please generate a complete, professional policy document that meets all regulatory requirements.`;

          console.log('Generating policy:', policyRef.policy_name);
          defaultTitle = policyRef.policy_name;
          genType = 'new';
          extraInsertFields = { policy_reference_id };
        }

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

        const aiContent = await streamAnthropicWithKeepalive(response, writer, encoder);

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

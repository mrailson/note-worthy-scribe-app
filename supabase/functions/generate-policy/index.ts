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

const systemPrompt = `CRITICAL CLINICAL OVERRIDE - CERVICAL SCREENING INTERVALS (effective 1 July 2025):
The NHS changed cervical screening recall intervals on 1 July 2025.

CORRECT INTERVALS - USE THESE ONLY:
- Ages 25-49, HPV negative: recall every FIVE YEARS
- Ages 50-64, HPV negative: recall every FIVE YEARS
- HPV positive within last 5 years (no subsequent negative): recall at 1 YEAR
- No HPV result on record (pre-2019 screening): maintain 3-year recall until HPV test obtained

DO NOT write "3 years" or "three years" for routine recall intervals. The 3-year interval has been replaced by 5 years for HPV-negative results.

You are an NHS primary care policy specialist generating comprehensive, CQC-inspection-ready policies for UK General Practice. Generate professional, regulatory-compliant policies.

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

IMPORTANT RULES:
- Use specific named individuals from practice details provided (not just role titles)
- Include current legislation with years
- Include specific SNOMED/Read codes where clinically relevant
- All phone number placeholders must use format: [PRACTICE TO COMPLETE - description]
- Never use dates as placeholder values for phone numbers
- Section 8.1 MUST have a KPI table with at least 5 measurable KPIs
- Section 11 MUST have a version history table: Version 1.0, today's date, Practice Manager as author, "Initial issue" as summary
- Replace ALL placeholders with known values from practice data. Only use [PRACTICE TO COMPLETE] for genuinely unknown values.

OUTPUT FORMAT:
===METADATA===
Title: [policy title]
Version: 1.0
Effective Date: [today's date DD/MM/YYYY]
Review Date: [one year from today DD/MM/YYYY]
References: [comma-separated list of key references]
===POLICY_CONTENT===
[full policy document in markdown]`;

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

  // Send keepalive pings every 10 seconds
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
            // Forward progress to client
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { policy_reference_id, practice_details, custom_instructions, generation_type, original_policy_text, gap_analysis, action, job_user_id } = body;

    // ========== BACKGROUND JOB QUEUE PROCESSOR ==========
    if (action === 'process-job') {
      const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const targetUserId = job_user_id;

      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'job_user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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

          const genPrompt = `Generate a ${policyRef.policy_name} policy for:

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

          // 240-second timeout for generation
          const generateController = new AbortController();
          const generateTimeout = setTimeout(() => generateController.abort(), 240000);

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
              messages: [{ role: 'user', content: genPrompt }],
            }),
            signal: generateController.signal,
          });

          clearTimeout(generateTimeout);

          if (!genResponse.ok) {
            const errText = await genResponse.text();
            throw new Error(`Anthropic error ${genResponse.status}: ${errText.substring(0, 200)}`);
          }

          const genData = await genResponse.json();
          const rawContent = genData.content?.[0]?.text || '';

          // Parse metadata
          const metadataMatch = rawContent.match(/===METADATA===([\s\S]*?)===POLICY_CONTENT===/);
          const contentMatch = rawContent.match(/===POLICY_CONTENT===([\s\S]*)/);
          
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

          const generatedContent = contentMatch ? contentMatch[1].trim() : rawContent;

          // Update job to enhancing state
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'enhancing',
              generated_content: generatedContent,
              metadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingJob.id);

          console.log(`[Phase 1 done] Job ${pendingJob.id} generated, moving to enhance`);

          // Self-trigger Phase 2
          fetch(`${SUPABASE_URL}/functions/v1/generate-policy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
            },
            body: JSON.stringify({ action: 'process-job', job_user_id: targetUserId }),
          }).catch(() => {});

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

        const jobPractice = enhancingJob.practice_details;
        let policyContent = enhancingJob.generated_content || '';
        const jobMetadata = enhancingJob.metadata || {};

        // Look up policy ref for name
        const { data: policyRef } = await serviceSupabase
          .from('policy_reference_library')
          .select('policy_name')
          .eq('id', enhancingJob.policy_reference_id)
          .single();

        const policyName = policyRef?.policy_name || enhancingJob.policy_title;

        if (retryCount >= 3) {
          console.log(`[Phase 2] Job ${enhancingJob.id} exceeded max retries, saving generated content as-is`);
        }

        // Increment retry counter
        await serviceSupabase
          .from('policy_generation_jobs')
          .update({
            metadata: { ...jobMetadata, enhance_retries: retryCount + 1 },
            updated_at: new Date().toISOString(),
          })
          .eq('id', enhancingJob.id);

        // Only attempt enhancement if content size and retry count are safe
        const shouldAttemptEnhancement = retryCount < 2 && policyContent.length <= 25000;

        if (shouldAttemptEnhancement) {
          const enhancePrompt = `Please review and enhance the following ${policyName} policy for ${(jobPractice as any)?.practice_name || '[PRACTICE NAME]'} (ODS: ${(jobPractice as any)?.ods_code || '[ODS CODE]'}).

Ensure it meets all CQC KLOE requirements, applies all known guidance changes listed at the top of your instructions, and includes current regulatory references.

${policyContent}`;

          // 90-second timeout to prevent edge function timeout loops
          const enhanceController = new AbortController();
          const enhanceTimeout = setTimeout(() => enhanceController.abort(), 90000);

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
                max_tokens: 10000,
                system: ENHANCEMENT_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: enhancePrompt }],
              }),
              signal: enhanceController.signal,
            });

            clearTimeout(enhanceTimeout);

            if (enhResponse.ok) {
              const enhData = await enhResponse.json();
              const enhancedContent = enhData.content?.[0]?.text;
              if (enhancedContent && enhancedContent.length > 500) {
                policyContent = enhancedContent;
                console.log(`[Phase 2] Enhancement succeeded for job ${enhancingJob.id}`);
              } else {
                console.warn(`[Phase 2] Enhancement returned insufficient content, using original`);
              }
            } else {
              console.error(`[Phase 2] Enhancement API error ${enhResponse.status}`);
            }
          } catch (fetchErr) {
            clearTimeout(enhanceTimeout);
            if ((fetchErr as any).name === 'AbortError') {
              console.error(`Enhancement timed out for job ${enhancingJob.id}, using generated content`);
            } else {
              console.error(`Enhancement fetch error for job ${enhancingJob.id}:`, fetchErr);
            }
          }
        }

        // Save to policy_completions
        try {
          await serviceSupabase.from('policy_completions').insert({
            user_id: enhancingJob.user_id,
            policy_reference_id: enhancingJob.policy_reference_id,
            policy_title: policyName,
            policy_content: policyContent,
            metadata: jobMetadata,
            version: (jobMetadata as any)?.version || '1.0',
            status: 'current',
          });
        } catch (saveErr) {
          console.error(`Failed to save completion for job ${enhancingJob.id}:`, saveErr);
        }

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
              // Generate Word-compatible HTML document from policy content
              let wordAttachment = null;
              try {
                const policyTitle = (jobMetadata as any).title || policyName;
                const jobPracticeDetails = enhancingJob.practice_details as any;
                
                // Fetch practice logo URL from practice_details table
                let logoUrl: string | null = null;
                try {
                  const { data: pdRow } = await serviceSupabase
                    .from('practice_details')
                    .select('logo_url, practice_logo_url')
                    .eq('user_id', enhancingJob.user_id)
                    .order('is_default', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (pdRow) {
                    logoUrl = pdRow.practice_logo_url || pdRow.logo_url || null;
                  }
                } catch (logoErr) {
                  console.warn('Could not fetch practice logo:', logoErr);
                }

                // Fetch and base64-encode the logo image for embedding in Word
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
                
                // Convert markdown-style content to basic HTML for Word
                const mdToHtml = (md: string): string => {
                  return md
                    .replace(/^### (.+)$/gm, '<h3 style="color:#005eb8;font-family:Arial,sans-serif;font-size:14pt;margin-top:18pt;margin-bottom:6pt;">$1</h3>')
                    .replace(/^## (.+)$/gm, '<h2 style="color:#005eb8;font-family:Arial,sans-serif;font-size:16pt;margin-top:24pt;margin-bottom:8pt;">$1</h2>')
                    .replace(/^# (.+)$/gm, '<h1 style="color:#003087;font-family:Arial,sans-serif;font-size:20pt;margin-top:0;margin-bottom:12pt;">$1</h1>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/^\|(.+)\|$/gm, (match) => {
                      const cells = match.split('|').filter(c => c.trim());
                      const isHeader = cells.every(c => /^[\s-]+$/.test(c));
                      if (isHeader) return '';
                      const cellHtml = cells.map(c => `<td style="border:1px solid #ccc;padding:6px 10px;font-family:Arial,sans-serif;font-size:10pt;">${c.trim()}</td>`).join('');
                      return `<tr>${cellHtml}</tr>`;
                    })
                    .replace(/^- (.+)$/gm, '<li style="font-family:Arial,sans-serif;font-size:11pt;margin-bottom:4pt;">$1</li>')
                    .replace(/^(?!<[hltrd])((?!<li).+)$/gm, '<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;margin-bottom:6pt;">$1</p>')
                    .replace(/<p style="[^"]*"><\/p>/g, '')
                    .replace(/(<tr>[\s\S]*?<\/tr>)/g, '<table style="border-collapse:collapse;width:100%;margin:12pt 0;">$1</table>')
                    .replace(/<\/table>\s*<table[^>]*>/g, '')
                    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="margin:6pt 0 6pt 20pt;">$1</ul>')
                    .replace(/<\/ul>\s*<ul[^>]*>/g, '');
                };
                
                const htmlBody = mdToHtml(policyContent);
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-GB');
                const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                // Build header with logo and practice details
                const practiceName = jobPracticeDetails?.practice_name || '';
                const practiceAddr = jobPracticeDetails?.address || '';
                const practicePostcode = jobPracticeDetails?.postcode || '';
                const practicePhone = jobPracticeDetails?.phone || '';
                const odsCode = jobPracticeDetails?.ods_code || '';
                
                let headerHtml = '<div style="border-bottom:2px solid #005eb8;padding-bottom:12pt;margin-bottom:18pt;">';
                headerHtml += '<table style="width:100%;border:none;"><tr>';
                
                // Logo cell (left)
                if (logoBase64) {
                  headerHtml += `<td style="width:100px;vertical-align:middle;border:none;padding:0 12pt 0 0;">
                    <img src="data:${logoMime};base64,${logoBase64}" style="max-width:90px;max-height:90px;" />
                  </td>`;
                }
                
                // Practice details cell (right)
                headerHtml += '<td style="vertical-align:middle;border:none;padding:0;">';
                if (practiceName) {
                  headerHtml += `<p style="font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;color:#003087;margin:0 0 4pt 0;">${practiceName}</p>`;
                }
                const addressParts = [practiceAddr, practicePostcode].filter(Boolean).join(', ');
                if (addressParts) {
                  headerHtml += `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#666;margin:0 0 2pt 0;">${addressParts}</p>`;
                }
                if (practicePhone) {
                  headerHtml += `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#666;margin:0 0 2pt 0;">Tel: ${practicePhone}</p>`;
                }
                if (odsCode) {
                  headerHtml += `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#666;margin:0;">ODS Code: ${odsCode}</p>`;
                }
                headerHtml += '</td></tr></table></div>';
                
                const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${policyTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>@page{margin:2.54cm;}body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;}</style>
</head><body>
${headerHtml}
${htmlBody}
<hr style="margin-top:36pt;border:none;border-top:1px solid #ccc;"/>
<p style="font-family:Arial,sans-serif;font-size:9pt;color:#999;text-align:center;">${practiceName ? practiceName + ' | ' : ''}Generated by Notewell AI on ${dateStr} at ${timeStr}</p>
</body></html>`;
                
                // Base64 encode the HTML Word document
                const encoder = new TextEncoder();
                const uint8 = encoder.encode(wordHtml);
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
                console.log(`Word attachment generated for job ${enhancingJob.id}: ${safeFilename}.doc`);
              } catch (docErr) {
                console.warn('Word document generation failed, sending email without attachment:', docErr);
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
                  subject: `Your policy is ready: ${(jobMetadata as any).title || policyName}`,
                  html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #1a365d;">Your Policy is Ready</h2>
                      <p>Hi,</p>
                      <p>Your policy <strong>${(jobMetadata as any).title || policyName}</strong> has been generated and enhanced successfully.</p>
                      <p>You can view and download it from your <a href="https://gpnotewell.co.uk/policy-service/my-policies" style="color: #2563eb;">My Policies</a> page.</p>
                      ${wordAttachment ? '<p>The policy document is attached to this email as a Word file.</p>' : ''}
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
                  attachments: wordAttachment ? [wordAttachment] : undefined,
                }),
              });
              console.log(`Email sent to ${userEmail} for job ${enhancingJob.id}`);
            }
          } catch (emailErr) {
            console.error('Failed to send email notification:', emailErr);
          }
        }

        // Check for more jobs
        const { data: moreJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('id')
          .eq('user_id', targetUserId)
          .in('status', ['pending', 'enhancing'])
          .limit(1);

        if (moreJobs && moreJobs.length > 0) {
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

        return new Response(JSON.stringify({ success: true, phase: 'completed', jobId: enhancingJob.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // No jobs to process
      return new Response(JSON.stringify({ success: true, phase: 'idle', message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== SSE STREAMING PATH (synchronous generation) ==========

    // Authenticate the request
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

    // Start processing (don't await -- the response streams back immediately)
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

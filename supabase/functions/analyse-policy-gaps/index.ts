import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Levenshtein distance for fuzzy name matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const systemPrompt = `You are an expert NHS policy analyst specialising in GP practice policy compliance. Your task is to analyse existing practice policies and identify genuine, material issues only.

## SEVERITY FILTER — WHAT TO FLAG AND WHAT TO IGNORE

Only report issues in these three categories:

1. CLINICAL / LEGAL RISK
   Flag if: incorrect clinical intervals or thresholds, superseded legislation cited as current, missing mandatory legal rights (e.g. right to erasure), missing statutory duties (e.g. safeguarding referral obligations).
   Do NOT flag: case law that remains good law even if old, minor wording preferences, references that are technically superseded but still valid.

2. CQC INSPECTION RISK
   Flag if: a missing section that a CQC inspector would specifically look for evidence of (e.g. audit trail process, training levels, complaints procedure). Only flag if the gap is material — a missing heading is not the same as missing content.
   Do NOT flag: absence of nice-to-have sections, vendor neutrality preferences, stylistic observations.

3. PATIENT SAFETY / OPERATIONAL RISK
   Flag if: a process gap that could directly lead to patient harm or a significant operational failure (e.g. no failsafe process, no escalation pathway for abnormal results).
   Do NOT flag: theoretical risks, minor process improvements, observations about best practice that are not required.

NEVER FLAG:
- Single word mentions of outdated technology (e.g. "fax" in a list)
- Case law that remains binding even if older
- DSPT or guidance version numbers that are correct for the current cycle
- Vendor-specific system names (SystmOne, EMIS) in single-system practices
- Style or formatting observations
- Anything that would be fixed at the next annual review rather than now
- Issues already covered adequately elsewhere in the document

## SCORING
- Maximum 8 issues per review
- Each issue must state: what is missing/wrong, why it matters (CQC/legal/patient safety), and the specific section where it should be addressed
- Do not report an issue unless you are confident it is a genuine gap
- STRICT DEDUPLICATION: Each issue must appear exactly once across the entire output (gaps, outdated_references, missing_sections combined). Before returning, compare all items — if two refer to the same underlying issue (even worded differently), keep only the one under the most appropriate category and discard the other. Never list the same gap under both "gaps" and "missing_sections".

## ANALYSIS TASKS

1. POLICY TYPE DETECTION:
   - Identify the type of policy from the content
   - Match to standard NHS GP practice policy categories

2. GAP ANALYSIS:
   - Compare against current CQC requirements
   - Check for compliance with latest NHS England guidance
   - Apply the severity filter above — only report material gaps

3. OUTDATED REFERENCES:
   - Flag references to superseded legislation ONLY where the superseded version is materially different
   - Do NOT flag version numbers that remain current

4. MISSING SECTIONS:
   - Check for standard policy sections (Purpose, Scope, Responsibilities, etc.)
   - Only flag if a CQC inspector would specifically look for the missing section

5. REVIEW DATE EXTRACTION:
   - Extract the last review date if present
   - Note if the policy appears overdue for review

You must respond in valid JSON format with the following structure:
{
  "policy_type": "string - the identified policy type",
  "gaps": ["array of identified compliance gaps - max 8, each stating what/why/where"],
  "outdated_references": ["array of genuinely outdated references"],
  "missing_sections": ["array of materially missing sections only"],
  "last_review_date": "string or null - extracted review date",
  "summary": "brief summary of the analysis",
  "priority_actions": ["top 3 actions recommended"]
}`;

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

    const body = await req.json();
    const { extracted_text, action, audience, practice_name, policy_source } = body;

    if (!extracted_text) {
      throw new Error('extracted_text is required');
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Pass full document — Gemini Flash supports 1M token context
    const maxLength = 200000;
    const documentText = extracted_text.length > maxLength
      ? extracted_text.substring(0, maxLength) + '\n\n[Content truncated due to length]'
      : extracted_text;

    // ─── QUICK GUIDE ACTION ───
    if (action === 'quick-guide') {
      // Build audience-specific instructions
      let audienceInstruction = '';
      switch (audience) {
        case 'non-clinical':
          audienceInstruction = `This guide is specifically for NON-CLINICAL staff (receptionists, administrators, practice managers, secretaries).
Focus ONLY on administrative duties, front-desk processes, data handling, patient communication, and operational tasks.
Do NOT include clinical procedures, prescribing, clinical decision-making, or clinical examination processes.
Frame all responsibilities from an administrative perspective.`;
          break;
        case 'clinical':
          audienceInstruction = `This guide is specifically for CLINICAL staff (GPs, nurses, healthcare assistants, pharmacists, paramedics).
Focus ONLY on clinical responsibilities, patient assessment, treatment pathways, prescribing, referrals, and clinical documentation.
Do NOT include administrative tasks like appointment booking, filing, or front-desk operations.
Frame all responsibilities from a clinical perspective.`;
          break;
        case 'patient':
          audienceInstruction = `PATIENT INFORMATION LEAFLET MODE`;
          break;
        default: // 'all-staff'
          audienceInstruction = `This guide is for ALL STAFF — both clinical and non-clinical.
Include responsibilities for clinicians (GPs, nurses, HCAs) AND administrative staff (receptionists, managers, secretaries).
Clearly separate clinical vs administrative responsibilities where relevant.`;
          break;
      }

      const audienceLabel = audience === 'non-clinical' ? 'Non-Clinical Staff' : audience === 'clinical' ? 'Clinical Staff' : audience === 'patient' ? 'Patient' : 'All Staff';

      // ── FIX 1: Build separated practice reference data block ──
      const practiceStaffNames: string[] = body.practice_staff_names || [];
      let practiceReferenceBlock = '';
      if (practiceStaffNames.length > 0) {
        practiceReferenceBlock = `

═══════════════════════════════════════════════════════
PRACTICE REFERENCE DATA — USE ONLY FOR NAMED ROLES, DO NOT USE AS VOCABULARY
The following are staff names from the practice profile. Use them ONLY when referring to specific named role holders (e.g. "The Practice Manager is [Name]"). Do NOT use any of these names as substitutes for ordinary English words. These names must NEVER replace or be confused with common words.
═══════════════════════════════════════════════════════
${practiceStaffNames.join('\n')}
═══════════════════════════════════════════════════════
END PRACTICE REFERENCE DATA
═══════════════════════════════════════════════════════`;
      }

      let quickGuideSystem: string;
      let quickGuideUserPrompt: string;

      if (audience === 'patient') {
        quickGuideSystem = `You are generating a patient information leaflet for a UK NHS GP practice.

Use the full policy provided as the source document.

Your task is to translate the policy into clear, reassuring, patient-friendly language so that patients understand:

• what the policy means
• how it affects their care
• what their rights are
• what they can expect from the practice

The leaflet must NOT include internal governance details, staff training frameworks, legislation lists, or internal procedures unless they are directly relevant to patient understanding.

The leaflet must be written in plain English suitable for the general public.

The tone must be:
• clear
• reassuring
• respectful
• easy to understand
• NHS appropriate

Avoid technical or clinical jargon wherever possible.

Structure the leaflet using the following sections:

1. Title
Use the format: "[Policy Name] – Information for Patients"

2. Why This Policy Exists
Explain in 2–3 sentences why the practice has this policy and how it helps provide safe, respectful, or effective care.

3. What This Means for You
Explain clearly how this policy may affect the patient when they visit the practice or receive care. Use bullet points.

4. What You Can Expect from Our Practice
Explain what the practice will do to follow the policy. Use reassuring language such as:
• "Our team will..."
• "We will always..."
• "We aim to..."

5. Your Rights as a Patient
Clearly explain the patient's rights related to this policy. Examples may include:
• asking questions
• requesting support
• declining certain options
• raising concerns
Use bullet points.

6. If You Have Questions or Concerns
Explain how a patient can raise questions or concerns about the issue covered by the policy.
Encourage speaking to reception staff, a clinician, or the practice manager.

7. Accessibility Statement
Include a short statement confirming the practice will make reasonable adjustments for patients with additional needs, disabilities, or language requirements.

Formatting requirements:
• Maximum length: one page
• Use clear headings
• Use short paragraphs
• Use bullet points where helpful
• Avoid technical terminology
• Write for a general public audience
• British English throughout

The leaflet must be easy for patients to read in under two minutes.

The leaflet should be suitable for:
• the practice website
• waiting room posters
• printed patient information leaflets

CRITICAL INSTRUCTION: The practice reference data below contains staff names. These are proper nouns referring to real people. You must NEVER use these names as replacements for common English words. For example, if a staff member is named "Paul", you must still use the word "put" when you mean "put" — never substitute "Paul" for "put" or any other word. Staff names must ONLY appear when explicitly naming a role holder.${practiceReferenceBlock}`;

        quickGuideUserPrompt = `CONTENT INSTRUCTIONS:
Generate a patient information leaflet for the following policy document:

---POLICY DOCUMENT START---
${documentText}
---POLICY DOCUMENT END---`;

      } else {
        quickGuideSystem = `You are generating a one-page NHS staff quick guide for a GP practice policy.

TARGET AUDIENCE: ${audienceLabel}
${audienceInstruction}

Use the full policy provided as the source document.

Your task is NOT to summarise the entire policy but to extract the key operational requirements that the target audience must follow.

The quick guide must be concise, clear, and suitable for busy staff.

Structure the guide using the following sections:

1. Purpose (1–2 sentences)

2. When This Policy Applies
List the situations when the policy is relevant to ${audienceLabel.toLowerCase()}.

3. Key Staff Responsibilities
List responsibilities relevant to the target audience only.

4. Step-by-Step Process
Provide a numbered workflow (maximum 7 steps) describing how ${audienceLabel.toLowerCase()} should follow the policy in practice.

5. Documentation Requirements
Explain what must be recorded and where (e.g., SystmOne, incident log).

6. If Something Goes Wrong
Explain what staff should do if concerns, incidents, or risks arise.

7. Quick Reminders
Provide 4–6 short bullet points highlighting the most important rules for ${audienceLabel.toLowerCase()}.

Formatting requirements:
• Use clear headings
• Use bullet points
• Avoid long paragraphs
• Maximum length: one page
• Use plain NHS-appropriate language

This guide should be readable in under two minutes.

CRITICAL INSTRUCTION: The practice reference data below contains staff names. These are proper nouns referring to real people. You must NEVER use these names as replacements for common English words. For example, if a staff member is named "Paul", you must still use the word "put" when you mean "put" — never substitute "Paul" for "put" or any other word. Staff names must ONLY appear when explicitly naming a role holder.${practiceReferenceBlock}`;

        quickGuideUserPrompt = `CONTENT INSTRUCTIONS:
Generate a quick guide for the following policy document:

---POLICY DOCUMENT START---
${documentText}
---POLICY DOCUMENT END---`;
      }

      console.log('Generating quick guide, text length:', extracted_text.length);

      // ── FIX 3: Use Claude (Anthropic) for quick guides instead of Gemini/GPT ──
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
      let quickGuide = '';

      if (ANTHROPIC_API_KEY) {
        console.log('Using Claude for quick guide generation (anti-contamination)');
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: quickGuideSystem,
            messages: [
              { role: 'user', content: quickGuideUserPrompt },
            ],
          }),
        });

        if (!claudeResponse.ok) {
          const errorText = await claudeResponse.text();
          console.error('Claude API error:', claudeResponse.status, errorText);
          // Fall back to Lovable AI Gateway
          console.log('Falling back to Lovable AI Gateway');
        } else {
          const claudeData = await claudeResponse.json();
          quickGuide = claudeData.content?.[0]?.text || '';
        }
      }

      // Fallback to Lovable AI Gateway if Claude unavailable or failed
      if (!quickGuide) {
        console.log('Using Lovable AI Gateway for quick guide generation');
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            max_tokens: 4096,
            messages: [
              { role: 'system', content: quickGuideSystem },
              { role: 'user', content: quickGuideUserPrompt },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI Gateway error:', response.status, errorText);
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw new Error(`AI gateway error: ${response.status}`);
        }

        const responseText = await response.text();
        if (!responseText || responseText.trim().length === 0) {
          throw new Error('AI returned an empty response');
        }

        const data = JSON.parse(responseText);
        quickGuide = data.choices?.[0]?.message?.content || '';
      }

      if (!quickGuide) {
        throw new Error('AI returned an empty quick guide');
      }

      // ── Strip footer prompt leak ──
      quickGuide = quickGuide.replace(
        /(Powered\s+by\s+Note[Ww]ell\s+AI)[''"""'´`].*/g,
        '$1'
      );

      // ══════════════════════════════════════════════════
      // FIX 1: Duplicate word check
      // ══════════════════════════════════════════════════
      // Remove consecutive duplicate words (e.g. "use, use" → "use," or "the the" → "the")
      quickGuide = quickGuide.replace(/\b(\w+)([,;.]?\s+)\1\b/gi, '$1$2');

      // ══════════════════════════════════════════════════
      // FIX 2: Practice name in subtitle
      // ══════════════════════════════════════════════════
      const practiceNameValue: string = practice_name || body.practice_name || '';
      if (practiceNameValue && audience !== 'patient') {
        // Ensure subtitle reads "For [Audience] at [Practice Name]"
        const subtitleTarget = `For ${audienceLabel}`;
        const subtitleWithPractice = `For ${audienceLabel} at ${practiceNameValue}`;
        // Replace bare subtitle that doesn't already include the practice name
        if (!quickGuide.includes(practiceNameValue)) {
          quickGuide = quickGuide.replace(
            new RegExp(`(For\\s+${audienceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?!\\s+at\\s)`, 'gi'),
            subtitleWithPractice
          );
        }
      } else if (practiceNameValue && audience === 'patient') {
        // For patient leaflets, inject practice name into "Our Practice" references
        if (!quickGuide.includes(practiceNameValue)) {
          quickGuide = quickGuide.replace(/\bOur Practice\b/i, practiceNameValue);
        }
      }

      // ══════════════════════════════════════════════════
      // FIX 3: Placeholder contacts in footer
      // ══════════════════════════════════════════════════
      // Replace vague/unfinished placeholders with a clear instruction for the PM
      const vagueContactPatterns = [
        /\[Contact details? posted (?:by|near|on|at) [\w\s]+\]/gi,
        /\[Contact [\w\s]+ for details?\]/gi,
        /\[See [\w\s]+ for contact\]/gi,
        /\[Phone number (?:on|posted|displayed|near) [\w\s]+\]/gi,
        /\[Refer to [\w\s]+ poster\]/gi,
      ];
      for (const pattern of vagueContactPatterns) {
        quickGuide = quickGuide.replace(pattern, '[Complete before display — see practice contacts list]');
      }

      // ══════════════════════════════════════════════════
      // FIX 4: Staff name corruption — verb-context hardening
      // ══════════════════════════════════════════════════
      const staffFirstNames: string[] = [];
      const staffFullNames: string[] = [];
      const titleWords = new Set(['Dr', 'Mr', 'Ms', 'Mrs', 'Miss', 'Prof', 'The', 'Sir', 'Dame']);
      
      if (practiceStaffNames.length > 0) {
        for (const fullName of practiceStaffNames) {
          const parts = fullName.split(/\s+/).map(p => p.replace(/[^a-zA-Z'-]/g, '')).filter(p => p.length >= 3);
          staffFullNames.push(fullName);
          for (const part of parts) {
            if (!titleWords.has(part) && part.length >= 3) {
              staffFirstNames.push(part);
            }
          }
        }
      }

      // Dictionary of common verbs/prepositions that names could accidentally replace
      const commonWords = new Set([
        'contact', 'call', 'inform', 'notify', 'alert', 'ask', 'tell', 'log', 'check',
        'store', 'place', 'put', 'keep', 'ensure', 'use', 'make', 'take', 'give', 'get',
        'set', 'run', 'see', 'let', 'say', 'try', 'add', 'pay', 'buy', 'cut', 'sit',
        'room', 'door', 'book', 'file', 'note', 'mark', 'sign', 'post', 'lead', 'hold',
        'meet', 'send', 'read', 'move', 'pull', 'push', 'turn', 'walk', 'talk', 'work',
        'open', 'close', 'stop', 'start', 'plan', 'risk', 'safe', 'cold', 'warm', 'cool',
        'need', 'must', 'will', 'shall', 'should', 'would', 'could', 'might',
        'always', 'never', 'also', 'then', 'when', 'where', 'what', 'which', 'that', 'this',
        'with', 'from', 'into', 'onto', 'upon', 'over', 'under', 'about', 'after', 'before',
      ]);

      let regenerationAttempts = 0;
      const MAX_REGEN_ATTEMPTS = 2;

      const runCorruptionCheck = (text: string): { corrupted: boolean; count: number; cleaned: string } => {
        if (staffFirstNames.length === 0) return { corrupted: false, count: 0, cleaned: text };

        const uniqueFirstNames = [...new Set(staffFirstNames)];
        const escapedNames = uniqueFirstNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        const safePrefixes = `(?:Dr\\.?|Mr\\.?|Ms\\.?|Mrs\\.?|Miss|Prof\\.?|Contact|Lead|Manager|Nurse|Officer|Guardian|Partner|Pharmacist|Paramedic|Secretary|Receptionist|Administrator|Caldicott|Senior|Deputy)`;
        const corruptionPattern = new RegExp(
          `(?<!${safePrefixes}\\s)(?<!${safePrefixes}\\s\\w+\\s)\\b(${escapedNames.join('|')})\\b(?!\\s+[A-Z][a-z])`,
          'gi'
        );

        const matches = text.match(corruptionPattern) || [];
        console.log(`🔍 Corruption scan: ${matches.length} suspicious name-token occurrences`, matches.slice(0, 10));

        // Additional verb-context check: if a staff name appears where a common verb/word is expected
        let verbContextHits = 0;
        for (const firstName of uniqueFirstNames) {
          const lowerName = firstName.toLowerCase();
          // Check if any common word is phonetically/visually similar (Levenshtein ≤ 2)
          for (const word of commonWords) {
            if (levenshtein(lowerName, word) <= 2 && lowerName !== word) {
              // This name could be confused with a common word — check if it appears in verb-like positions
              const verbPosPattern = new RegExp(
                `(?:always|never|must|should|shall|will|would|could|to|and|or|then|please)\\s+${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?!\\s+[A-Z])`,
                'gi'
              );
              const verbHits = text.match(verbPosPattern) || [];
              verbContextHits += verbHits.length;
            }
          }
        }
        console.log(`🔍 Verb-context hits: ${verbContextHits}`);

        const totalSuspicious = matches.length + verbContextHits;

        if (totalSuspicious > 3) {
          // Clean: replace suspicious occurrences with [CONTACT]
          let cleaned = text.replace(corruptionPattern, (match) => {
            return '[CONTACT]';
          });
          return { corrupted: true, count: totalSuspicious, cleaned };
        }

        return { corrupted: false, count: totalSuspicious, cleaned: text };
      };

      let check = runCorruptionCheck(quickGuide);

      while (check.corrupted && regenerationAttempts < MAX_REGEN_ATTEMPTS) {
        regenerationAttempts++;
        console.warn(`⚠️ Corruption detected (attempt ${regenerationAttempts}/${MAX_REGEN_ATTEMPTS}): ${check.count} suspicious occurrences. Regenerating...`);

        const antiContaminationSuffix = `\n\nABSOLUTE RULE (attempt ${regenerationAttempts}): In your previous attempt, staff names from the practice profile leaked into ordinary text as word substitutions (e.g. "Paul" replacing "put", "Boon" replacing "room"). This is UNACCEPTABLE. Every common English word must remain as-is. Staff names must ONLY appear when explicitly naming a role holder in the format "Role: Full Name" (e.g. "Practice Manager: Sarah Berry"). Never use a staff name as a verb, noun, preposition, or any part of ordinary English text.`;

        const retrySystem = quickGuideSystem + antiContaminationSuffix;
        let retryGuide = '';

        if (ANTHROPIC_API_KEY) {
          const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: retrySystem,
              messages: [{ role: 'user', content: quickGuideUserPrompt }],
            }),
          });
          if (retryResp.ok) {
            const retryData = await retryResp.json();
            retryGuide = retryData.content?.[0]?.text || '';
          }
        }

        if (!retryGuide) {
          const retryResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              max_tokens: 4096,
              messages: [
                { role: 'system', content: retrySystem },
                { role: 'user', content: quickGuideUserPrompt },
              ],
            }),
          });
          if (retryResp.ok) {
            const retryText = await retryResp.text();
            const retryData = JSON.parse(retryText);
            retryGuide = retryData.choices?.[0]?.message?.content || '';
          }
        }

        if (retryGuide) {
          quickGuide = retryGuide.replace(/(Powered\s+by\s+Note[Ww]ell\s+AI)[''"""'´`].*/g, '$1');
          // Re-apply duplicate word fix
          quickGuide = quickGuide.replace(/\b(\w+)([,;.]?\s+)\1\b/gi, '$1$2');
          console.log(`✅ Regenerated quick guide (attempt ${regenerationAttempts})`);
          check = runCorruptionCheck(quickGuide);
        } else {
          break;
        }
      }

      // If still corrupted after max attempts, apply find-and-replace cleanup and flag
      if (check.corrupted) {
        console.warn(`⚠️ Quick guide still corrupted after ${MAX_REGEN_ATTEMPTS} attempts. Applying [CONTACT] cleanup and flagging for manual review.`);
        quickGuide = check.cleaned;
      }

      // ══════════════════════════════════════════════════
      // FIX 5: Section heading validation, content-based reordering, LBC bullet, min section count
      // ══════════════════════════════════════════════════
      const expectedSectionOrder = audience === 'patient' 
        ? ['Title', 'Why This Policy Exists', 'What This Means for You', 'What You Can Expect from Our Practice', 'Your Rights as a Patient', 'If You Have Questions or Concerns', 'Accessibility Statement']
        : ['Purpose', 'When This Policy Applies', 'Key Staff Responsibilities', 'Step-by-Step Process', 'Documentation Requirements', 'If Something Goes Wrong', 'Quick Reminders'];
      
      // Content-type keyword map for matching sections to canonical order
      const sectionContentKeywords: Record<string, string[]> = audience === 'patient' ? {} : {
        'Purpose': ['purpose', 'when it applies', 'overview', 'aim', 'objective', 'about this', 'introduction'],
        'When This Policy Applies': ['when this', 'applies', 'scope', 'situations', 'circumstances', 'relevant when'],
        'Key Staff Responsibilities': ['responsibilit', 'staff role', 'key role', 'who is responsible', 'duties', 'accountab'],
        'Step-by-Step Process': ['step-by-step', 'step by step', 'process', 'workflow', 'procedure', 'how to', 'action steps'],
        'Documentation Requirements': ['document', 'record', 'logging', 'audit', 'evidence', 'systmone', 'emis', 'filing'],
        'If Something Goes Wrong': ['something goes wrong', 'incident', 'concern', 'escalat', 'error', 'breach', 'risk', 'adverse', 'emergency'],
        'Quick Reminders': ['reminder', 'key points', 'remember', 'golden rules', 'do and don', 'top tips', 'checklist'],
      };

      // Fix truncated section headings
      for (const heading of expectedSectionOrder) {
        if (heading.length >= 6) {
          for (let len = 4; len < heading.length; len++) {
            const truncated = heading.substring(0, len);
            const truncPattern = new RegExp(`(^|\\n)(#+\\s*\\d*\\.?\\s*)${truncated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gm');
            quickGuide = quickGuide.replace(truncPattern, `$1$2${heading}`);
          }
        }
      }

      // Simple sequential renumbering (preserve AI section order)
      {
        let counter = 0;
        quickGuide = quickGuide.replace(/((?:^|\n)(?:#+\s*)?)(\d+)(\.\s+)/g, (match, prefix, _num, suffix) => {
          counter++;
          return `${prefix}${counter}${suffix}`;
        });
      }

      // ── Section count validation: must be 6-7 sections, regenerate if fewer ──
      const sectionCountMatch = quickGuide.match(/(?:^|\n)(?:#+\s*)?\d+\.\s+/g) || [];
      const sectionCount = sectionCountMatch.length;
      console.log(`📋 Section count: ${sectionCount}`);
      
      let sectionCountFlag = false;
      if (sectionCount < 6 && regenerationAttempts < MAX_REGEN_ATTEMPTS) {
        console.warn(`⚠️ Only ${sectionCount} sections returned — regenerating for completeness`);
        regenerationAttempts++;
        const sectionFixSuffix = `\n\nCRITICAL: Your previous response only had ${sectionCount} sections. You MUST return exactly 6 or 7 numbered sections covering: Purpose, When This Policy Applies, Key Staff Responsibilities, Step-by-Step Process, Documentation Requirements, If Something Goes Wrong, and Quick Reminders. Do not merge or skip any section.`;
        
        let retryGuide = '';
        if (ANTHROPIC_API_KEY) {
          const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4096, system: quickGuideSystem + sectionFixSuffix, messages: [{ role: 'user', content: quickGuideUserPrompt }] }),
          });
          if (retryResp.ok) {
            const d = await retryResp.json();
            retryGuide = d.content?.[0]?.text || '';
          }
        }
        if (!retryGuide) {
          const retryResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/gemini-3-flash-preview', max_tokens: 4096, messages: [{ role: 'system', content: quickGuideSystem + sectionFixSuffix }, { role: 'user', content: quickGuideUserPrompt }] }),
          });
          if (retryResp.ok) {
            const t = await retryResp.text();
            const d = JSON.parse(t);
            retryGuide = d.choices?.[0]?.message?.content || '';
          }
        }
        if (retryGuide) {
          quickGuide = retryGuide;
          // Re-apply all cleanup passes
          quickGuide = quickGuide.replace(/(Powered\s+by\s+Note[Ww]ell\s+AI)[''"""'´`].*/g, '$1');
          quickGuide = quickGuide.replace(/\b(\w+)([,;.]?\s+)\1\b/gi, '$1$2');
          check = runCorruptionCheck(quickGuide);
          if (check.corrupted) quickGuide = check.cleaned;
        } else {
          sectionCountFlag = true;
        }
      } else if (sectionCount < 6) {
        sectionCountFlag = true;
      }

      // ── LBC vials hardcoded bullet for cold chain / cervical screening guides ──
      const policyLower = documentText.toLowerCase();
      const isColdChainOrCervical = policyLower.includes('cold chain') || policyLower.includes('vaccine refriger') || policyLower.includes('cervical screen') || policyLower.includes('lbc vial') || policyLower.includes('liquid based cytology');
      
      if (isColdChainOrCervical && audience !== 'patient') {
        const lbcBullet = '- LBC cervical screening vials are stored at room temperature (15–30°C) — never put them in the vaccine refrigerator.';
        // Insert into Quick Reminders section if it exists
        const remindersMatch = quickGuide.match(/((?:#+\s*)?\d+\.\s+(?:Quick\s+Reminders?|Key\s+Points?|Remember).*?)(\n(?:(?:#+\s*)?\d+\.|$))/si);
        if (remindersMatch) {
          // Check if LBC bullet already present
          if (!quickGuide.toLowerCase().includes('lbc cervical screening vials')) {
            const insertPoint = remindersMatch.index! + remindersMatch[1].length;
            quickGuide = quickGuide.slice(0, insertPoint) + '\n' + lbcBullet + quickGuide.slice(insertPoint);
            console.log('✅ Injected LBC vials bullet into Quick Reminders');
          }
        } else if (!quickGuide.toLowerCase().includes('lbc cervical screening vials')) {
          // Append to end if no Quick Reminders section found
          quickGuide += '\n\n' + lbcBullet;
          console.log('✅ Appended LBC vials bullet to end');
        }
      }

      // Determine if manual review flag is needed
      const needsManualReview = check.corrupted || sectionCountFlag;

      console.log('Quick guide generated, length:', quickGuide.length, needsManualReview ? '⚠️ FLAGGED FOR MANUAL REVIEW' : '✅');

      return new Response(JSON.stringify({ 
        success: true, 
        quick_guide: quickGuide,
        needs_manual_review: needsManualReview,
        regeneration_attempts: regenerationAttempts,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── DEFAULT: GAP ANALYSIS ───
    const isNotewell = policy_source === 'notewell';
    
    const sourceFilterInstructions = isNotewell
      ? `\n\nIMPORTANT — THIS POLICY WAS GENERATED BY NOTEWELL AI:
Apply a LIGHTER severity filter for Notewell-generated policies:
- Only report issues that are: (a) factually incorrect, (b) reference outdated legislation or bodies (e.g. CCGs, PHE), or (c) missing a mandatory legal duty that cannot be implied from existing content.
- Do NOT report missing edge cases, depth suggestions, or structural improvements — these are style preferences, not compliance failures.
- Maximum 3 issues. If fewer than 3 genuine issues exist, report fewer.
- Tone: constructive, not critical. Frame as "consider adding" not "fails to address".
- SCORING BONUS: Apply a +10 baseline bonus before deductions (start at 110, cap at 100). This reflects that Notewell-generated documents already meet structural, governance, and formatting standards.`
      : '';

    const userPrompt = `Analyse the following practice policy document IN FULL and provide a comprehensive gap analysis. You MUST read and consider every section of the document — do not skip or skim any part.
${sourceFilterInstructions}

---POLICY DOCUMENT START---
${documentText}
---POLICY DOCUMENT END---

Today's date is ${new Date().toLocaleDateString('en-GB')}.

Please analyse this policy against current NHS England and CQC requirements and provide your analysis in the specified JSON format.`;

    console.log('Analysing policy gaps, text length:', extracted_text.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        max_tokens: 8192,
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
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // Parse JSON from AI response
    let analysis;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      analysis = {
        policy_type: 'Unknown',
        gaps: ['Unable to fully analyse - please review manually'],
        outdated_references: [],
        missing_sections: [],
        last_review_date: null,
        summary: 'Analysis could not be completed automatically',
        priority_actions: ['Manual review recommended'],
      };
    }

    console.log('Policy analysis complete:', analysis.policy_type);

    return new Response(JSON.stringify({
      success: true,
      policy_type: analysis.policy_type,
      policy_source: policy_source || 'uploaded',
      gaps: analysis.gaps || [],
      outdated_references: analysis.outdated_references || [],
      missing_sections: analysis.missing_sections || [],
      last_review_date: analysis.last_review_date,
      summary: analysis.summary,
      priority_actions: analysis.priority_actions || [],
      compliance_score: typeof analysis.compliance_score === 'number' ? Math.max(0, Math.min(100, analysis.compliance_score)) : null,
      score_summary: analysis.score_summary || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('analyse-policy-gaps error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

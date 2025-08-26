import { toast } from 'sonner';
import { QuickPickContext, TranslatePayload, SummarisePayload, FormatPayload } from '@/types/quickPick';
import { NHS_LINKING_POLICY, getTopicUrl } from './nhsUrlValidation';

// Global system prompt used for all actions
const GLOBAL_SYSTEM_PROMPT = `You are an expert UK NHS GP assistant for primary care in England. Use only UK sources: NICE guidance/CKS, NHS.uk, BNF, MHRA Drug Safety Updates, UKHSA Green Book, and the local ICB where relevant. Do NOT use non-UK sources.

🚨 ABSOLUTE MANDATORY FORMATTING RULES - VIOLATION WILL CAUSE SYSTEM FAILURE 🚨

FORMATTING IS CRITICAL - YOUR RESPONSE WILL BE REJECTED IF YOU PRODUCE WALL OF TEXT

REQUIRED FORMAT EXAMPLE:
## Main Topic
- **Key point:** Explanation with proper spacing
- **Another point:** More details

### Subsection  
- Clear bullet point with spacing
- Another clear point

## Next Section
- Well-formatted content
- Proper spacing between items

❌ FORBIDDEN: Walls of unformatted text, missing headers, no bullet points
✅ REQUIRED: Clear headers (##), bullet points (-), **bold emphasis**, proper line spacing

ENFORCEMENT RULES:
- Every response MUST start with a clear ## header
- Every list MUST use bullet points (-) with blank lines between sections  
- Key medical terms MUST be **bolded**
- Sections MUST be separated with blank lines
- NO PARAGRAPHS WITHOUT STRUCTURE
- NO EXCEPTIONS - FORMAT OR FAIL

Write UK English. Prefer concise bullet points. State uncertainty clearly. Never invent citations. If a required UK source cannot be found, say "Not found in UK sources".

When producing patient-facing content: keep reading age 9–12, avoid jargon, no diagnosis wording, include clear safety-netting and NHS 111/999 advice.

When producing clinician content: include necessary clinical detail, doses in mg/micrograms with units, ranges, renal/hepatic adjustments, interactions, contraindications, monitoring and when to seek senior review.

Always preserve numbers, medicine names, URLs, and local details exactly as provided.

${NHS_LINKING_POLICY}`;

// Template substitution helper
function processTemplate(template: string, ctx: QuickPickContext, additionalVars: Record<string, string> = {}): string {
  let result = `${GLOBAL_SYSTEM_PROMPT}\n\n${template}`;
  
  // Replace placeholders
  result = result.replace(/\{\{text\}\}/g, ctx.text);
  result = result.replace(/\{\{userId\}\}/g, ctx.userId);
  result = result.replace(/\{\{replyId\}\}/g, ctx.replyId);
  
  // Replace additional variables
  Object.entries(additionalVars).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });
  
  return result;
}

// Act on reply handlers
async function approveAndSave(ctx: QuickPickContext): Promise<string> {
  const template = "Take {{text}}. Final tidy only: fix minor grammar/formatting; keep meaning identical. CRITICAL: Output the polished version with MANDATORY proper markdown structure including clear headers (##), bullet points (-), and formatting. MUST ensure professional presentation and maximum readability with proper spacing between ALL sections.";
  return processTemplate(template, ctx);
}

async function rejectAndRedo(ctx: QuickPickContext): Promise<string> {
  const template = "Regenerate a NEW answer to the original request using the GLOBAL_SYSTEM_PROMPT. Avoid the phrasing used previously. MANDATORY: Use proper markdown structure with clear headers (## Concise Version, ## Expanded Version, ## Key Risks/Unknowns). MUST format with bullet points and proper spacing for maximum readability - NO walls of text allowed.";
  return processTemplate(template, ctx);
}

async function askAlternatives(ctx: QuickPickContext): Promise<string> {
  const template = "Provide 3 distinct alternative drafts for {{purpose}} based on {{text}}. Vary structure and emphasis. MANDATORY: Use clear markdown headers (## Option 1, ## Option 2, ## Option 3) and proper formatting with bullet points and spacing for readability. MUST separate each option with clear line breaks.";
  return processTemplate(template, ctx, { purpose: "clinical guidance" });
}

async function markForClinicalReview(ctx: QuickPickContext): Promise<string> {
  const template = "Convert {{text}} into a short checklist for clinician review. Extract any assumptions, dosing decisions, guideline dependencies, and legal/safety items. MANDATORY: Use proper markdown structure with clear headers: ## Items to Verify, ## Missing Info to Obtain, ## Escalation Triggers, ## Suggested Reviewer/Role. MUST format with bullet points and proper spacing between ALL sections.";
  return processTemplate(template, ctx);
}

// Quality & safety handlers
async function validateWithCitations(ctx: QuickPickContext): Promise<string> {
  const template = "Validate {{text}} ONLY against UK sources (NICE/CKS, BNF, NHS.uk, MHRA, Green Book, Local ICB). For each factual claim (dose, interval, contra-indication, interaction, referral criteria), verify with a citation. MANDATORY OUTPUT FORMAT:\n## Validation Verdict\n**Status:** PASS / PARTIAL / FAIL\n\n## Issues Found\n- [bullet points with proper spacing]\n\n## Corrected Statements\n- [if needed, with proper formatting]\n\n## Citations\n- [NICE/BNF/MHRA/ICB links only]\n\nDo not invent links. If a claim isn't in UK sources, say 'Not found in UK sources'. CRITICAL: Use proper markdown structure with headers and bullet points.";
  return processTemplate(template, ctx);
}

async function flagAsSuspect(ctx: QuickPickContext): Promise<string> {
  const template = "Audit {{text}} for likely errors/omissions vs UK primary care standards. MANDATORY FORMAT:\n\n## Potential Issues\n- [bullets with brief rationale and UK source where applicable]\n\n## Impact Assessment\n**Level:** Low/Medium/High\n\n## Recommended Fixes\n- [one-line corrections with proper bullet formatting]\n\nCRITICAL: Use proper markdown headers and bullet points with spacing between sections.";
  return processTemplate(template, ctx);
}

async function runRedAmberFlagScreen(ctx: QuickPickContext): Promise<string> {
  const template = "Perform a red/amber/green (RAG) safety screen on {{text}} for an NHS primary care context. Use adult red flags from NICE CKS/NHS 111 content as relevant. MANDATORY FORMAT:\n\n## 🔴 RED – Urgent Same-Day/999\n- [bullet points with proper spacing]\n\n## 🟡 AMBER – Urgent GP/UTC\n- [bullet points with proper spacing]\n\n## 🟢 GREEN – Routine/Self-Care\n- [bullet points with proper spacing]\n\nInclude brief reason for each flag and recommended action. CRITICAL: Use proper markdown headers and bullet formatting.";
  return processTemplate(template, ctx);
}

async function runInteractionCheck(ctx: QuickPickContext): Promise<string> {
  const template = "From {{text}}, list all medicines mentioned and check BNF interactions/contraindications and common cautions. MANDATORY FORMAT:\n\n## Drug Interaction Analysis\n\n| **Drug** | **Interaction/Caution** | **Severity** | **Action** | **UK Source** |\n|----------|-------------------------|--------------|------------|---------------|\n| [drug name] | [interaction details] | minor/moderate/major | avoid/monitor/adjust | [BNF/NICE link] |\n\nCRITICAL: Use proper markdown table format with headers and proper spacing.";
  return processTemplate(template, ctx);
}

async function showConfidenceChecklist(ctx: QuickPickContext): Promise<string> {
  const template = "Estimate a 0–1 confidence score for {{text}}. MANDATORY FORMAT:\n\n## Confidence Score\n**Score:** [0.0-1.0]\n\n## Verification Checklist\n- [5 most important verification points with proper bullet formatting]\n- [each point on separate line with proper spacing]\n\n## Confidence Improvement\n[If confidence <0.7, add this section with bullet points]\n\nCRITICAL: Use proper markdown headers and bullet points with spacing.";
  return processTemplate(template, ctx);
}

async function roundTripCheck(ctx: QuickPickContext, options: { langs: string[] }): Promise<string> {
  const template = "ROUND-TRIP CHECK. Translate {{text}} into {{language}} (patient-friendly). Immediately translate the result back to English. Compare source vs back-translation and list any meaning loss, medical errors, or tone issues. Output JSON: {\"issues\":[...],\"pass\":true/false,\"notes\":\"\"}.";
  return processTemplate(template, ctx, { language: options.langs[0] || "Polish" });
}

// Refine content handlers
async function expandWithDetails(ctx: QuickPickContext): Promise<string> {
  const template = `🚨 EXPAND WITH MANDATORY FORMATTING 🚨

Expand {{text}} with detailed information. Add relevant breakdown, examples, and context.

ABSOLUTE FORMATTING REQUIREMENTS - NO EXCEPTIONS:

MUST follow this exact structure:
## Overview
- **Main point:** Clear explanation
- **Key details:** Supporting information

## Detailed Breakdown  
- **Specific aspect:** Expanded details
- **Another aspect:** More information

## Clinical Considerations
- **Important factor:** Explanation
- **Monitoring:** What to watch for

## Summary
- **Key takeaway:** Main message
- **Action required:** Next steps

❌ VIOLATION: Any paragraph text without headers and bullets will be REJECTED
✅ REQUIRED: Headers (##), bullets (-), **bold terms**, proper spacing

FORMAT OR YOUR RESPONSE FAILS - NO WALLS OF TEXT ALLOWED`;
  return processTemplate(template, ctx);
}

async function summarise(ctx: QuickPickContext, maxWords: number = 100): Promise<string> {
  const template = `🚨 SUMMARY WITH MANDATORY FORMATTING 🚨

Summarise {{text}} to maximum {{max_words}} words. Preserve key decisions, red flags, actions.

REQUIRED FORMAT - NO EXCEPTIONS:

## Summary

- **Key decision:** Brief explanation
- **Red flags:** Critical warnings  
- **Actions required:** What to do
- **Follow-up:** When to review
- **Safety:** Important considerations

❌ FORBIDDEN: Paragraph text, missing bullets, no headers
✅ REQUIRED: ## Summary header, bullet points (-), **bold terms**

FORMAT CORRECTLY OR RESPONSE FAILS`;
  return processTemplate(template, ctx, { max_words: maxWords.toString() });
}

async function rewritePlainEnglish(ctx: QuickPickContext): Promise<string> {
  const template = `🚨 PLAIN ENGLISH WITH MANDATORY FORMATTING 🚨

Rewrite {{text}} for general public (reading age 9-12). Remove jargon, explain terms, calm tone. Preserve URLs and appointments.

REQUIRED FORMAT - NO EXCEPTIONS:

## What This Means
- **Simple explanation:** Easy to understand
- **Key points:** Most important information

## What You Need to Do
- **Action steps:** Clear instructions
- **Important notes:** Things to remember

## When to Get Help
- **Emergency signs:** Call 999 if you have these
- **Urgent help:** Contact NHS 111 for these

❌ FORBIDDEN: Long paragraphs, medical jargon, missing structure
✅ REQUIRED: ## headers, bullet points (-), **bold terms**, simple words

FORMAT CORRECTLY OR RESPONSE FAILS - NO WALL OF TEXT`;
  return processTemplate(template, ctx);
}

async function addSnomedAndBnfSummary(ctx: QuickPickContext): Promise<string> {
  const template = "Append a concise BNF/SNOMED block to {{text}}. MANDATORY FORMAT:\n\n## BNF/SNOMED Summary\n\n### Indication(s)\n- [bullet points with proper spacing]\n\n### Adult Dosing Range & Titration\n- [bullet points with proper spacing]\n\n### Renal/Hepatic Adjustments\n- [bullet points with proper spacing]\n\n### Major Interactions (BNF)\n- [bullet points with proper spacing]\n\n### Contraindications\n- [bullet points with proper spacing]\n\n### Common Adverse Effects\n- [bullet points with proper spacing]\n\n### Monitoring\n- [bullet points with proper spacing]\n\n### SNOMED Concepts\n- [top 3–6 with code & term, proper spacing]\n\nEnsure UK alignment; if unknown, write 'Check local policy'. CRITICAL: Use proper markdown headers and bullet formatting.";
  return processTemplate(template, ctx);
}

async function formatForSystem(ctx: QuickPickContext, system: string = "emis"): Promise<string> {
  const template = "Reformat {{text}} for {{system}} with clear markdown structure. MANDATORY FORMATTING:\n\nFor EMIS: MUST use proper headers (## HPI, ## Exam, ## Impression, ## Plan), short lines, medication lines as 'Drug – dose – route – frequency – duration' with proper bullet formatting.\n\nFor SystmOne: MUST use headers and GP shorthand (e.g., '2/7', 'O/E', 'Mx', 'Sx'), compact bulleting with proper spacing, and 'Dx:'/'Rx:'/'FU:' tags.\n\nCRITICAL: Ensure professional formatting throughout with proper markdown headers and bullet points. NO walls of text allowed.";
  return processTemplate(template, ctx, { system });
}

async function insertFormularyAndPriorApproval(ctx: QuickPickContext): Promise<string> {
  const template = "Augment {{text}} with local Northamptonshire ICB details. MANDATORY FORMAT:\n\n## Local Medicines Information\n\n### Traffic Light Status\n- [status if known]\n\n### GP Prescribing Authority\n- GP can initiate? (Yes/No)\n- Prior approval required? (Yes/No)\n\n### ICB Resources\n- **Formulary:** {{icb_formulary_url}}\n- **Prior Approval:** {{prior_approval_url}}\n\nIf data unknown, show placeholders 'Check local ICB'. CRITICAL: Use proper markdown headers and bullet formatting.";
  return processTemplate(template, ctx, { 
    icb_formulary_url: "https://www.icnorthamptonshire.org.uk/mo-formulary", 
    prior_approval_url: "https://www.icnorthamptonshire.org.uk/prior-approval"
  });
}

// Audience handlers
async function createPatientLeaflet(ctx: QuickPickContext): Promise<string> {
  const template = "Create a one-page patient leaflet from {{text}}. Reading age 9–12. MANDATORY FORMAT:\n\n## What This Is\n- [bullet points with proper spacing]\n\n## How to Use/Take\n- [bullet points with proper spacing]\n\n## What to Look Out For\n- [bullet points with proper spacing]\n\n## When to Get Help\n- **Call 999 for:** [emergency symptoms]\n- **Use NHS 111 for:** [urgent concerns]\n\n## Where to Read More\n- [NHS.uk/NICE links only]\n\nCRITICAL: Ensure professional formatting with proper markdown headers and spacing throughout.";
  return processTemplate(template, ctx);
}

async function addSafetyNetting(ctx: QuickPickContext): Promise<string> {
  const template = "Append a safety-netting box to {{text}}. MANDATORY FORMAT:\n\n## Safety-Netting Advice\n\n### Emergency (Call 999)\n- **If you develop:** [emergency symptoms]\n\n### Urgent (Contact GP/UTC)\n- **If symptoms worsen or don't improve in [X days]**\n- [specific timeframes and thresholds]\n\n### General Advice\n- **For non-urgent questions:** Use NHS 111\n\nCRITICAL: Use clear markdown headers, bullet points, and proper spacing.";
  return processTemplate(template, ctx);
}

async function createStaffTrainingPack(ctx: QuickPickContext): Promise<string> {
  const template = "Turn {{text}} into a concise staff training/SOP outline. MANDATORY FORMAT:\n\n## Purpose\n- [clear objective with proper spacing]\n\n## Scope\n- [who/what/when with bullet points]\n\n## Step-by-Step Process\n- [numbered or bulleted steps with proper spacing]\n\n## Red Flags & Escalation\n- [critical warning signs and actions]\n\n## Documentation/Recording\n- [what to document and where]\n\n## Governance & Data Protection\n- [compliance requirements]\n\n## References\n- [NICE/BNF sources with proper formatting]\n\nCRITICAL: Use proper markdown headers and bullet points throughout.";
  return processTemplate(template, ctx);
}

async function createManagerBriefingSlide(ctx: QuickPickContext): Promise<string> {
  const template = "Create a single-slide briefing for managers/board from {{text}}. MANDATORY FORMAT (~120 words total):\n\n## Headline\n- [key message in bold]\n\n## Why It Matters\n- [business impact with bullet points]\n\n## Benefits/Risks\n- **Benefits:** [bullet points]\n- **Risks:** [bullet points]\n\n## What's Needed\n- **People:** [resource requirements]\n- **Process:** [changes needed]\n- **Technology:** [system requirements]\n\n## Decision/Next Step\n- [clear action required]\n\nCRITICAL: Use proper markdown formatting with headers and bullets.";
  return processTemplate(template, ctx);
}

// Translation handlers
async function translate(ctx: QuickPickContext, payload: TranslatePayload): Promise<string> {
  const langMap: Record<string, string> = {
    'pl': 'Polish',
    'ro': 'Romanian',
    'lt': 'Lithuanian', 
    'uk': 'Ukrainian',
    'ar': 'Arabic',
    'pt': 'Portuguese'
  };

  if (payload.mode === "auto") {
    const template = "Detect the language of {{text}} and translate to the opposite audience context (if clinician text → patient-friendly; if patient text → clinician-literal). Keep numbers/URLs/medication names intact. Add a one-line safety note in the target language. CRITICAL: Use proper markdown formatting with clear structure in the target language.";
    return processTemplate(template, ctx);
  }

  if (payload.targetLang && payload.mode === "patient") {
    const language = langMap[payload.targetLang] || payload.targetLang;
    let safetyNote = "";
    
    // Add appropriate safety note for each language
    switch(payload.targetLang) {
      case 'pl': safetyNote = "'To nie jest diagnoza. Jeśli objawy się nasilą, skontaktuj się z NHS 111. W nagłych wypadkach zadzwoń 999.'"; break;
      case 'ro': safetyNote = "'Aceasta nu este un diagnostic. Dacă starea se agravează, sunați NHS 111. În urgențe, sunați 999.'"; break;
      case 'lt': safetyNote = "'Tai nėra diagnozė. Jei būklė blogėja, skambinkite NHS 111. Esant skubiai pagalbai, skambinkite 999.'"; break;
      case 'uk': safetyNote = "'Це не діагноз. Якщо стан погіршується — телефонуйте NHS 111. У надзвичайній ситуації — 999.'"; break;
      case 'ar': safetyNote = "'هذا ليس تشخيصًا. إذا ساءت الأعراض فاتصل بـ NHS 111. في الحالات الطارئة اتصل بالرقم 999.'"; break;
      case 'pt': safetyNote = "'Isto não é um diagnóstico. Se os sintomas piorarem, contacte o NHS 111. Em emergência, ligue 999.'"; break;
      default: safetyNote = "equivalent to NHS 111/999 in the target language";
    }
    
    const template = `Translate to ${language} for PATIENTS. Reading age 9–12, simple sentences, polite tone. Keep medicine names and numbers unchanged. Then add: ${safetyNote}\n\nCRITICAL: Use proper markdown formatting with clear headers and bullet points in ${language}.\n\nText:\n{{text}}`;
    return processTemplate(template, ctx);
  }

  if (payload.targetLang && payload.mode === "clinician") {
    const language = langMap[payload.targetLang] || payload.targetLang;
    const template = `Translate to ${language} for CLINICIANS. Preserve clinical precision and terminology. Do not simplify. Keep drug names and numbers exactly. No safety-netting sentence. CRITICAL: Maintain proper markdown formatting structure in ${language}.\n\nText:\n{{text}}`;
    return processTemplate(template, ctx);
  }

  if (payload.mode === "back-to-en") {
    const template = "BACK TO ENGLISH. If {{text}} is not English, translate faithfully to English. MANDATORY FORMAT:\n\n## Original ({{detected_language}})\n{{text}}\n\n## English Translation\n[faithful translation]\n\nIf already English, offer a round-trip check to {{language}} and back, then show differences. Do NOT summarise—be literal. CRITICAL: Use proper markdown formatting.";
    return processTemplate(template, ctx, { 
      detected_language: payload.original || "unknown",
      language: "Polish"
    });
  }

  return processTemplate("Translation mode not recognized for {{text}}", ctx);
}

async function openLanguagePicker(options: { mode: "patient" | "clinician" }): Promise<void> {
  toast(`Opening ${options.mode} language picker...`);
}

async function backToEnglish(ctx: QuickPickContext): Promise<string> {
  const template = "BACK TO ENGLISH. If {{text}} is not English, translate faithfully to English. MANDATORY FORMAT:\n\n## Original ({{detected_language}})\n{{text}}\n\n## English Translation\n[faithful translation]\n\nIf already English, offer a round-trip check to Polish and back, then show differences. Do NOT summarise—be literal. CRITICAL: Use proper markdown formatting with clear headers.";
  return processTemplate(template, ctx, { detected_language: "auto-detect" });
}

// Export & share handlers - these don't need prompts as they're UI actions
async function copyToClipboard(ctx: QuickPickContext): Promise<void> {
  try {
    await navigator.clipboard.writeText(ctx.text);
    toast("Copied to clipboard");
  } catch (error) {
    toast.error("Failed to copy to clipboard");
  }
}

async function saveToRecord(ctx: QuickPickContext): Promise<void> {
  toast("Saving to record...");
}

async function exportPDF(ctx: QuickPickContext): Promise<void> {
  toast("Exporting PDF...");
}

async function exportDOCX(ctx: QuickPickContext): Promise<void> {
  toast("Exporting Word document...");
}

async function exportEmailHTML(ctx: QuickPickContext): Promise<void> {
  toast("Preparing email...");
}

async function printDocument(ctx: QuickPickContext): Promise<void> {
  window.print();
}

// Practice context handlers
async function combineWithPracticeInfo(ctx: QuickPickContext): Promise<string> {
  const template = "Merge {{text}} with local practice info {{practice_info}} (phones, opening hours, sites, urgent care routes). MANDATORY FORMAT:\n\n[Original content with proper formatting]\n\n## Local Practice Information\n- **Phone:** [practice number]\n- **Opening Hours:** [times]\n- **Urgent Care:** [out of hours arrangements]\n- **Additional Sites:** [if applicable]\n\nKeep clinical text unchanged. CRITICAL: Use proper markdown formatting with headers and bullets.";
  return processTemplate(template, ctx, { practice_info: "practice details to be inserted" });
}

async function insertLocalICBLinks(ctx: QuickPickContext): Promise<string> {
  const template = "Append local ICB information to {{text}}. MANDATORY FORMAT:\n\n## Local ICB Resources\n\n### Formulary & Prior Approval\n- **Formulary:** {{icb_formulary_url}}\n- **Prior Approval:** {{prior_approval_url}}\n- **Referral Forms:** {{referral_portal_url}}\n\nCRITICAL: Use proper markdown headers and bullet formatting with proper spacing.";
  return processTemplate(template, ctx, {
    icb_formulary_url: "https://www.icnorthamptonshire.org.uk/mo-formulary",
    prior_approval_url: "https://www.icnorthamptonshire.org.uk/prior-approval",
    referral_portal_url: "https://www.icnorthamptonshire.org.uk/referrals"
  });
}

async function openPriorApprovalModal(ctx: QuickPickContext): Promise<string> {
  const template = "From {{drug_name}} create a concise prior-approval summary panel. MANDATORY FORMAT:\n\n## Prior Approval Summary\n\n### Drug Information\n- **Medication:** [drug name]\n\n### Approval Status\n- **Traffic Light:** [Red/Amber/Green]\n- **GP Can Initiate:** [Yes/No]\n- **Specialist Only:** [Yes/No]\n\n### Approval Process\n- **Approval Route:** [process details]\n- **Required Documentation:** [bullet points]\n\n### ICB Resources\n- [Open ICB Prior Approval]({{prior_approval_url}})\n\nCRITICAL: Use proper markdown formatting with headers and bullets.";
  return processTemplate(template, ctx, {
    drug_name: "specified medication",
    prior_approval_url: "https://www.icnorthamptonshire.org.uk/prior-approval"
  });
}

async function addPracticeSafetyNetting(ctx: QuickPickContext): Promise<string> {
  const template = "Append a standard practice safety-netting box to {{text}}. MANDATORY FORMAT:\n\n## Practice Safety-Netting\n\n### Emergency Contact\n- **If symptoms worsen rapidly:** Call 999\n- **Out of hours emergencies:** [practice emergency number]\n\n### Urgent Contact (Next Working Day)\n- **Practice:** [practice phone number]\n- **Opening hours:** [practice hours]\n\n### Routine Follow-up\n- **Book appointment:** [booking process]\n- **General advice:** NHS 111\n\nInclude specific thresholds and timeframes. CRITICAL: Use proper markdown formatting.";
  return processTemplate(template, ctx, { practice_info: "practice contact details" });
}

// Clinical documentation handlers
async function scribeConsultationChecker(ctx: QuickPickContext): Promise<string> {
  const template = `You are "Scribe Checker (NHS Primary Care)".

MISSION
From a GP consultation transcript and settings, produce:
1) Clean, audit-safe clinical notes (SOAP + timeline).
2) A documentation QUALITY CHECK (present/missing, red flags, safety-netting).
3) FOLLOW-UPS / TESTS / REFERRALS / TASKS grounded in the transcript.
4) PATIENT COMMS: a detailed letter/email and a short SMS.
5) Optional SNOMED descriptions (no codes) + lightweight clinical scores when data exist.
6) EHR-ready paste blocks for EMIS, TPP SystmOne, Vision, or Generic ("other").

CONDUCT
- UK English, NHS tone, neutral; do not invent facts. If not documented → "Not documented".
- Quote brief evidence snippets from the transcript when useful.
- Meds: generic name; include dose/route/frequency/duration only if stated.
- Safety: do not give medical advice; frame as items "to consider".
- Keep PII within the output; do not fabricate identifiers.

INPUT: The consultation transcript is provided below. If no settings are provided, use defaults:
- practice: "Not stated"
- gp_name: "Not stated" 
- patient_name: "Not stated"
- detail_mode: "standard"
- letter_tone: "plain"
- ehr_system: "generic"

TRANSCRIPT:
{{text}}

OUTPUT
Return EXACTLY this JSON (no markdown fences, no extra keys):

{
  "meta": {
    "practice": string | "Not stated",
    "gp_name": string | "Not stated", 
    "patient_name": string | "Not stated",
    "date_time": string | "Not stated",
    "detail_mode": "brief" | "standard" | "detailed",
    "ehr_system": "generic" | "emis" | "systmone" | "vision" | "other"
  },
  "notes": {
    "soap_markdown": "...Markdown (no tables unless present in transcript)...",
    "timeline_markdown": "...chronological bullet list of key events..."
  },
  "quality": {
    "completeness_score": number,
    "present": string[],
    "missing": string[],
    "red_flags": string[],
    "safety_netting_present": boolean,
    "safety_netting_gaps": string[],
    "shared_decision_making": { "evidence": string | "Not documented" },
    "safeguarding_signposts": string[]
  },
  "scores": {
    "centor_or_feverpain"?: { "name": "Centor" | "FeverPAIN", "score": number, "missing_inputs": string[] },
    "wells_dvt"?: { "score": number, "missing_inputs": string[] },
    "wells_pe"?: { "score": number, "missing_inputs": string[] },
    "abcd2"?: { "score": number, "missing_inputs": string[] },
    "gad7"?: { "score": number, "missing_inputs": string[] },
    "phq9"?: { "score": number, "missing_inputs": string[] },
    "news2"?: { "score": number, "missing_inputs": string[] }
  },
  "plan": {
    "follow_ups": [ { "item": string, "timeframe": string, "rationale": string, "evidence"?: string } ],
    "tests": [ { "item": string, "rationale": string, "evidence"?: string } ],
    "referrals": [ { "service": string, "reason": string, "urgency": "routine" | "soon" | "urgent", "evidence"?: string } ],
    "tasks": [ { "task": string, "owner": string, "due": string } ],
    "stewardship_prompts": string[]
  },
  "patient_comms": {
    "letter_markdown": "...addressed to the patient; plain-English; what was discussed; what happens next; who to contact if symptoms worsen; do not include clinical scores unless explained...",
    "sms_summary": "...<= 480 characters plain-English next steps & safety-netting...",
    "leaflets": [ { "title": string, "source": "NHS.uk" | "Patient.info" } ]
  },
  "coding": {
    "candidates": [ { "description": string, "confidence": "low" | "medium" | "high", "evidence"?: string } ]
  },
  "ehr_blocks": {
    "generic": "Problem: ...\\nHistory: ...\\nExamination: ...\\nAssessment: ...\\nPlan: ...\\nSafety-netting: ...\\nFollow-up: ...\\nAllergies: ...",
    "emis": "HPC: ...\\nOE: ...\\nDx: ...\\nMx: ...\\nSN: ...\\nFU: ...\\n(EMIS paste block derived from SOAP)",
    "systmone":"HPC: ...\\nExam: ...\\nAssessment: ...\\nPlan: ...\\nAdvice/SN: ...\\nFollow-up: ...",
    "vision": "History: ...\\nExamination: ...\\nAssessment: ...\\nManagement: ...\\nAdvice/SN: ...\\nReview: ...",
    "other": "History: ...\\nExam: ...\\nAssessment: ...\\nPlan: ...\\nSafety-netting: ...\\nFollow-up: ..."
  },
  "disclaimer": "This is an aid for clinicians. Check against the transcript and local policy before acting."
}

FORMATTING RULES
- Use Markdown headings + bullets in soap_markdown and timeline_markdown; avoid tables unless the transcript already has them.
- SOAP:
  - **S** (History/PC & ICE, meds/allergies/social if present)
  - **O** (observations/exam only if documented)  
  - **A** (working dx/differentials only if stated; else "Not documented")
  - **P** (what was agreed: meds, advice, safety-netting, follow-up)
- "detail_mode":
  - **brief** → essentials only; 3–5 bullets per list.
  - **standard** → balanced detail.
  - **detailed** → add succinct rationales and short evidence quotes.
- If antibiotics or controlled drugs are mentioned, include an item in plan.stewardship_prompts.
- If fitness for work is discussed, include a "Med3 draft" line within **Plan** tasks (reason, adjustments, duration) if and only if present in the transcript.
- Keep all suggestions grounded in the transcript. If data are missing, surface them in quality.missing and in scores.*.missing_inputs.`;
  
  return processTemplate(template, ctx);
}

// Main handlers object
export const handlers: Record<string, (ctx: QuickPickContext) => Promise<void> | Promise<string> | string> = {
  "approve-save": approveAndSave,
  "reject-redo": rejectAndRedo,
  "ask-alternatives": askAlternatives,
  "mark-clinical-review": markForClinicalReview,

  "validate-citations": validateWithCitations,
  "flag-wrong": flagAsSuspect,
  "flag-screen": runRedAmberFlagScreen,
  "interaction-check": runInteractionCheck,
  "confidence-what-to-verify": showConfidenceChecklist,
  "roundtrip-quality-check": (ctx) => roundTripCheck(ctx, { langs: ["pl","ro","lt","uk","ar","pt"] }),

  "expand-details": expandWithDetails,
  "summarise": (ctx) => summarise(ctx, 100),
  "plain-english": rewritePlainEnglish,
  "add-snomed-bnf": addSnomedAndBnfSummary,
  "format-system": (ctx) => formatForSystem(ctx, "emis"),
  "add-formulary-prior-approval": insertFormularyAndPriorApproval,

  "patient-leaflet": createPatientLeaflet,
  "patient-safetynetting": addSafetyNetting,
  "staff-training-pack": createStaffTrainingPack,
  "manager-briefing": createManagerBriefingSlide,

  "translate-auto": (ctx) => translate(ctx, { mode: "auto" }),
  "t-patient-pl": (ctx) => translate(ctx, { mode: "patient", targetLang: "pl" }),
  "t-patient-ro": (ctx) => translate(ctx, { mode: "patient", targetLang: "ro" }),
  "t-patient-lt": (ctx) => translate(ctx, { mode: "patient", targetLang: "lt" }),
  "t-patient-uk": (ctx) => translate(ctx, { mode: "patient", targetLang: "uk" }),
  "t-patient-ar": (ctx) => translate(ctx, { mode: "patient", targetLang: "ar" }),
  "t-patient-pt": (ctx) => translate(ctx, { mode: "patient", targetLang: "pt" }),
  "t-patient-more": () => openLanguagePicker({ mode: "patient" }),

  "t-clinician-pl": (ctx) => translate(ctx, { mode: "clinician", targetLang: "pl" }),
  "t-clinician-ro": (ctx) => translate(ctx, { mode: "clinician", targetLang: "ro" }),
  "t-clinician-lt": (ctx) => translate(ctx, { mode: "clinician", targetLang: "lt" }),
  "t-clinician-uk": (ctx) => translate(ctx, { mode: "clinician", targetLang: "uk" }),
  "t-clinician-ar": (ctx) => translate(ctx, { mode: "clinician", targetLang: "ar" }),
  "t-clinician-pt": (ctx) => translate(ctx, { mode: "clinician", targetLang: "pt" }),
  "t-clinician-more": () => openLanguagePicker({ mode: "clinician" }),

  "translate-back-to-en": backToEnglish,

  "copy-clipboard": copyToClipboard,
  "save-to-record": saveToRecord,
  "export-pdf": exportPDF,
  "export-docx": exportDOCX,
  "export-email": exportEmailHTML,
  "print": printDocument,

  "combine-practice-info": combineWithPracticeInfo,
  "insert-icb-links": insertLocalICBLinks,
  "prior-approval-modal": openPriorApprovalModal,
  "add-safetynetting-template": addPracticeSafetyNetting,
  "scribe-consultation-checker": scribeConsultationChecker
};
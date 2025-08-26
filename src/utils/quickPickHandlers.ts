import { toast } from 'sonner';
import { QuickPickContext, TranslatePayload, SummarisePayload, FormatPayload } from '@/types/quickPick';
import { NHS_LINKING_POLICY, getTopicUrl } from './nhsUrlValidation';

// Global system prompt used for all actions
const GLOBAL_SYSTEM_PROMPT = `You are an expert UK NHS GP assistant for primary care in England. Use only UK sources: NICE guidance/CKS, NHS.uk, BNF, MHRA Drug Safety Updates, UKHSA Green Book, and the local ICB where relevant. Do NOT use non-UK sources.

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
  const template = "Take {{text}}. Final tidy only: fix minor grammar/formatting; keep meaning identical. Output the polished version in markdown. No extra commentary.";
  return processTemplate(template, ctx);
}

async function rejectAndRedo(ctx: QuickPickContext): Promise<string> {
  const template = "Regenerate a NEW answer to the original request using the GLOBAL_SYSTEM_PROMPT. Avoid the phrasing used previously. Provide a concise version first, then an expanded version. End with 'Key risks/unknowns'.";
  return processTemplate(template, ctx);
}

async function askAlternatives(ctx: QuickPickContext): Promise<string> {
  const template = "Provide 3 distinct alternative drafts for {{purpose}} based on {{text}}. Vary structure and emphasis. Output as: Option 1, Option 2, Option 3.";
  return processTemplate(template, ctx, { purpose: "clinical guidance" });
}

async function markForClinicalReview(ctx: QuickPickContext): Promise<string> {
  const template = "Convert {{text}} into a short checklist for clinician review. Extract any assumptions, dosing decisions, guideline dependencies, and legal/safety items. Output sections: 'Items to verify', 'Missing info to obtain', 'Escalation triggers', 'Suggested reviewer/role'.";
  return processTemplate(template, ctx);
}

// Quality & safety handlers
async function validateWithCitations(ctx: QuickPickContext): Promise<string> {
  const template = "Validate {{text}} ONLY against UK sources (NICE/CKS, BNF, NHS.uk, MHRA, Green Book, Local ICB). For each factual claim (dose, interval, contra-indication, interaction, referral criteria), verify with a citation. Output:\n1) Verdict: PASS / PARTIAL / FAIL\n2) Issues found (bullets)\n3) Corrected statements (if needed)\n4) Citations with links (NICE/BNF/MHRA/ICB only)\nDo not invent links. If a claim isn't in UK sources, say 'Not found in UK sources'.";
  return processTemplate(template, ctx);
}

async function flagAsSuspect(ctx: QuickPickContext): Promise<string> {
  const template = "Audit {{text}} for likely errors/omissions vs UK primary care standards. Output: 'Potential Issues' (bullets with brief rationale and UK source where applicable), 'Impact' (low/medium/high), 'Fixes' (one-line corrections).";
  return processTemplate(template, ctx);
}

async function runRedAmberFlagScreen(ctx: QuickPickContext): Promise<string> {
  const template = "Perform a red/amber/green (RAG) safety screen on {{text}} for an NHS primary care context. Use adult red flags from NICE CKS/NHS 111 content as relevant. Output sections: 'RED – urgent same-day/999', 'AMBER – urgent GP/UTC', 'GREEN – routine/self-care'. Include brief reason for each flag and recommended action.";
  return processTemplate(template, ctx);
}

async function runInteractionCheck(ctx: QuickPickContext): Promise<string> {
  const template = "From {{text}}, list all medicines mentioned and check BNF interactions/contraindications and common cautions. Output table: Drug | Interaction/Caution | Severity (minor/moderate/major) | Action (avoid/monitor/adjust) | UK Source.";
  return processTemplate(template, ctx);
}

async function showConfidenceChecklist(ctx: QuickPickContext): Promise<string> {
  const template = "Estimate a 0–1 confidence score for {{text}}. List the 5 most important verification points a GP should double-check in UK sources. If confidence <0.7, add 'What would raise confidence'.";
  return processTemplate(template, ctx);
}

async function roundTripCheck(ctx: QuickPickContext, options: { langs: string[] }): Promise<string> {
  const template = "ROUND-TRIP CHECK. Translate {{text}} into {{language}} (patient-friendly). Immediately translate the result back to English. Compare source vs back-translation and list any meaning loss, medical errors, or tone issues. Output JSON: {\"issues\":[...],\"pass\":true/false,\"notes\":\"\"}.";
  return processTemplate(template, ctx, { language: options.langs[0] || "Polish" });
}

// Refine content handlers
async function expandWithDetails(ctx: QuickPickContext): Promise<string> {
  const template = "make more detailed (at least 50%) and give more relevant details and breakdown and examples if appropriate\n\n{{text}}";
  return processTemplate(template, ctx);
}

async function summarise(ctx: QuickPickContext, maxWords: number = 100): Promise<string> {
  const template = "Summarise {{text}} to a maximum of {{max_words}} words, preserving key decisions, red flags, and actions. Output in 5–8 bullet points.";
  return processTemplate(template, ctx, { max_words: maxWords.toString() });
}

async function rewritePlainEnglish(ctx: QuickPickContext): Promise<string> {
  const template = "Rewrite {{text}} for the general public (reading age 9–12). Remove jargon, explain terms briefly, keep a calm supportive tone. Preserve any URLs and appointment instructions.";
  return processTemplate(template, ctx);
}

async function addSnomedAndBnfSummary(ctx: QuickPickContext): Promise<string> {
  const template = "Append a concise BNF/SNOMED block to {{text}}. Structure:\n- Indication(s)\n- Adult dosing range & titration\n- Renal/hepatic adjustments\n- Major interactions (BNF)\n- Contraindications\n- Common adverse effects\n- Monitoring\n- SNOMED concepts (top 3–6; show code & term)\nEnsure UK alignment; if unknown, write 'Check local policy'.";
  return processTemplate(template, ctx);
}

async function formatForSystem(ctx: QuickPickContext, system: string = "emis"): Promise<string> {
  const template = "Reformat {{text}} for {{system}}. \nFor EMIS: headings (HPI, Exam, Impression, Plan), short lines, medication lines as 'Drug – dose – route – frequency – duration'. \nFor SystmOne: GP shorthand (e.g., '2/7', 'O/E', 'Mx', 'Sx'), compact bulleting, and 'Dx:'/'Rx:'/'FU:' tags. No extra commentary—output only the formatted note.";
  return processTemplate(template, ctx, { system });
}

async function insertFormularyAndPriorApproval(ctx: QuickPickContext): Promise<string> {
  const template = "Augment {{text}} with local Northamptonshire ICB details. Add a brief 'Local Medicines' panel:\n- Traffic-light status (if known)\n- GP can initiate? (Yes/No)\n- Prior approval required? (Yes/No)\n- Links: Formulary {{icb_formulary_url}}, Prior Approval {{prior_approval_url}}\nIf data unknown, show placeholders 'Check local ICB'.";
  return processTemplate(template, ctx, { 
    icb_formulary_url: "https://www.icnorthamptonshire.org.uk/mo-formulary", 
    prior_approval_url: "https://www.icnorthamptonshire.org.uk/prior-approval"
  });
}

// Audience handlers
async function createPatientLeaflet(ctx: QuickPickContext): Promise<string> {
  const template = "Create a one-page patient leaflet from {{text}}. Reading age 9–12. Sections: 'What this is', 'How to use/take', 'What to look out for', 'When to get help', 'Where to read more'. Include short safety-netting: 'Call 999 for …, use NHS 111 for …'. Add official links only (NHS.uk/NICE).";
  return processTemplate(template, ctx);
}

async function addSafetyNetting(ctx: QuickPickContext): Promise<string> {
  const template = "Append a 'Safety-netting' box to {{text}}: clear thresholds, timescales, and actions. Example structure: 'If you develop … call 999', 'If symptoms worsen or don't improve in X days, contact GP/UTC', 'For general advice use NHS 111'.";
  return processTemplate(template, ctx);
}

async function createStaffTrainingPack(ctx: QuickPickContext): Promise<string> {
  const template = "Turn {{text}} into a concise staff training/SOP outline. Sections: 'Purpose', 'Scope', 'Step-by-step', 'Red flags & escalation', 'Documentation/recording', 'Governance & data protection', 'References (NICE/BNF)'.";
  return processTemplate(template, ctx);
}

async function createManagerBriefingSlide(ctx: QuickPickContext): Promise<string> {
  const template = "Create a single-slide briefing for managers/board from {{text}}: 'Headline', 'Why it matters', 'Benefits/risks', 'What's needed (people/process/tech)', 'Decision/next step'. Limit to ~120 words.";
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
    const template = "Detect the language of {{text}} and translate to the opposite audience context (if clinician text → patient-friendly; if patient text → clinician-literal). Keep numbers/URLs/medication names intact. Add a one-line safety note in the target language.";
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
    
    const template = `Translate to ${language} for PATIENTS. Reading age 9–12, simple sentences, polite tone. Keep medicine names and numbers unchanged. Then add: ${safetyNote}\n\nText:\n{{text}}`;
    return processTemplate(template, ctx);
  }

  if (payload.targetLang && payload.mode === "clinician") {
    const language = langMap[payload.targetLang] || payload.targetLang;
    const template = `Translate to ${language} for CLINICIANS. Preserve clinical precision and terminology. Do not simplify. Keep drug names and numbers exactly. No safety-netting sentence.\n\nText:\n{{text}}`;
    return processTemplate(template, ctx);
  }

  if (payload.mode === "back-to-en") {
    const template = "BACK TO ENGLISH. If {{text}} is not English, translate faithfully to English. Output side-by-side blocks: 'Original ({{detected_language}})' and 'English'. If already English, offer a round-trip check to {{language}} and back, then show differences. Do NOT summarise—be literal.";
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
  const template = "BACK TO ENGLISH. If {{text}} is not English, translate faithfully to English. Output side-by-side blocks: 'Original ({{detected_language}})' and 'English'. If already English, offer a round-trip check to Polish and back, then show differences. Do NOT summarise—be literal.";
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
  const template = "Merge {{text}} with local practice info {{practice_info}} (phones, opening hours, sites, urgent care routes). Insert a small 'Local info' panel. Keep clinical text unchanged.";
  return processTemplate(template, ctx, { practice_info: "practice details to be inserted" });
}

async function insertLocalICBLinks(ctx: QuickPickContext): Promise<string> {
  const template = "Append a 'Local ICB' panel with links relevant to the topic, using these placeholders if unknown: Formulary {{icb_formulary_url}}, Prior Approval {{prior_approval_url}}, Referral forms {{referral_portal_url}}.";
  return processTemplate(template, ctx, {
    icb_formulary_url: "https://www.icnorthamptonshire.org.uk/mo-formulary",
    prior_approval_url: "https://www.icnorthamptonshire.org.uk/prior-approval",
    referral_portal_url: "https://www.icnorthamptonshire.org.uk/referrals"
  });
}

async function openPriorApprovalModal(ctx: QuickPickContext): Promise<string> {
  const template = "From {{drug_name}} create a concise prior-approval summary panel: 'Indication(s)', 'Traffic-light', 'GP can initiate', 'Specialist only', 'Approval route', 'Required documentation', plus a button 'Open ICB Prior Approval' linking to {{prior_approval_url}}.";
  return processTemplate(template, ctx, {
    drug_name: "specified medication",
    prior_approval_url: "https://www.icnorthamptonshire.org.uk/prior-approval"
  });
}

async function addPracticeSafetyNetting(ctx: QuickPickContext): Promise<string> {
  const template = "Append a standard practice safety-netting box mapped to {{practice_info}} contact routes. Include thresholds, timeframes, and call-to-action language aligned with NHS 111/999 wording.";
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
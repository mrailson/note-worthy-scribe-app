import { toast } from 'sonner';
import { QuickPickContext, TranslatePayload, SummarisePayload, FormatPayload } from '@/types/quickPick';
import { NHS_LINKING_POLICY, getTopicUrl } from './nhsUrlValidation';

// Global system prompt used for all actions
const GLOBAL_SYSTEM_PROMPT = `You are NHS Clean Formatter (UK GP).

GOAL
Return clean, human-readable output with correct spacing and headings. Never change clinical meaning. Never invent content or links.

SOURCES
Use only UK sources (NICE/CKS, NHS.uk, BNF, MHRA DSU, UKHSA Green Book, local ICB) if/when citing. If not found, say "Not found in UK sources".

RENDERING RULES (MARKDOWN MODE)
- Do NOT use code fences.
- Use H1/H2/H3 headings; each heading must have a blank line before and after it.
- Insert a blank line before every list and between all paragraphs.
- Each bullet on a single line; no wrapped lines inside a bullet.
- Use **bold labels** for short signposts (e.g., **Scope:**).
- UK spelling and NHS terminology only.
- No giant blocks: break at sentence boundaries (target ≤ 120 chars/line).

MANDATORY OUTPUT
Return EXACTLY TWO blocks in this order (no extra prose):
[MARKDOWN]
# {Title}

**Scope:** …
**Source:** …

## {Section}
- …

[/MARKDOWN]
[HTML]
<section style="font-family:system-ui,Arial;line-height:1.55;max-width:760px">
  <h1>{Title}</h1>
  <p><strong>Scope:</strong> …<br><strong>Source:</strong> …</p>
  <h2>{Section}</h2>
  <ul>
    <li>…</li>
  </ul>
</section>
[/HTML]

FALLBACK BEHAVIOUR
- If content includes "asthma" and "NG24", correct reference to: NICE NG245 (BTS/NICE/SIGN, 27 Nov 2024).
- If a NICE guideline is named, link to the official NICE page; never invent non-NHS links.
- Always preserve numbers, medicine names, URLs, and local details exactly.

${NHS_LINKING_POLICY}`;

// Post-processor for force HTML
const FORCE_HTML_PROCESSOR = `POST-PROCESSOR (FORCE HTML)
Convert the input text into clean HTML with explicit tags and spacing.

REQUIREMENTS
- Return HTML ONLY (no markdown, no fences, no extra text).
- Use <section>, <h1>.., <h2>.., <h3>.., <p>, <ul><li>, <table><thead><tbody><tr><th><td>.
- Insert a blank line as <p style="margin:0 0 12px"></p> between paragraphs if needed.
- Never rely on double-space line breaks; always use explicit tags.

INPUT:
{{text}}

OUTPUT: [HTML only]`;

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
  const template = `Output as final approved text. No further edits needed. Save in clean formatted form.`;
  return processTemplate(template, ctx);
}

async function rejectAndRedo(ctx: QuickPickContext): Promise<string> {
  const template = `Discard the above output and regenerate a fresh improved version, following NHS NICE/BNF standards.`;
  return processTemplate(template, ctx);
}

async function askAlternatives(ctx: QuickPickContext): Promise<string> {
  const template = `Give me 3 alternative phrasings of the above output, concise and compliant with UK NHS guidance.`;
  return processTemplate(template, ctx);
}

async function markForClinicalReview(ctx: QuickPickContext): Promise<string> {
  const template = `Flag this text for GP clinical review. Highlight any areas where clinical judgement is required.`;
  return processTemplate(template, ctx);
}

async function validateWithCitations(ctx: QuickPickContext): Promise<string> {
  const template = `Validate the above output against NICE CKS, NHS.uk, and BNF. Add inline references where applicable.`;
  return processTemplate(template, ctx);
}

async function flagAsSuspect(ctx: QuickPickContext): Promise<string> {
  const template = `Re-check the above carefully. Identify any incorrect or misleading statements. Correct them with NHS NICE/BNF sources.`;
  return processTemplate(template, ctx);
}

async function runRedAmberFlagScreen(ctx: QuickPickContext): Promise<string> {
  const template = `Screen the above for NHS111 red/amber flags. Highlight any urgent or safety-critical concerns.`;
  return processTemplate(template, ctx);
}

async function runInteractionCheck(ctx: QuickPickContext): Promise<string> {
  const template = `Check the above for drug interactions or contraindications using BNF guidance. List any relevant findings.`;
  return processTemplate(template, ctx);
}

async function showConfidenceChecklist(ctx: QuickPickContext): Promise<string> {
  const template = `State confidence level in the above answer (High/Medium/Low). List what a GP should independently verify.`;
  return processTemplate(template, ctx);
}

async function roundTripCheck(ctx: QuickPickContext, options: any): Promise<string> {
  const template = `Translate the text into the target language and back to English. Show both versions and highlight any meaning changes.`;
  return processTemplate(template, ctx);
}

async function expandWithDetails(ctx: QuickPickContext): Promise<string> {
  const template = `Expand the above with additional NICE guideline detail and practical examples relevant to GP consultations.`;
  return processTemplate(template, ctx);
}

async function summarise(ctx: QuickPickContext, words: number): Promise<string> {
  const template = `Produce a concise summary of the above in bullet points suitable for quick GP reference.`;
  return processTemplate(template, ctx);
}

async function rewritePlainEnglish(ctx: QuickPickContext): Promise<string> {
  const template = `Rewrite the above in plain, patient-friendly English with no jargon. Keep accuracy.`;
  return processTemplate(template, ctx);
}

async function addSnomedAndBnfSummary(ctx: QuickPickContext): Promise<string> {
  const template = `Add a structured SNOMED and BNF-style summary for GP coding and prescribing.`;
  return processTemplate(template, ctx);
}

async function formatForSystem(ctx: QuickPickContext, system: string): Promise<string> {
  const template = `Format the above text in a structured template suitable for pasting into EMIS or SystmOne patient record.`;
  return processTemplate(template, ctx);
}

async function insertFormularyAndPriorApproval(ctx: QuickPickContext): Promise<string> {
  const template = `Check the ICB Northamptonshire formulary and prior-approval status for this drug/condition. Insert notes with web link.`;
  return processTemplate(template, ctx);
}

async function formatText(ctx: QuickPickContext): Promise<string> {
  const template = `Apply proper markdown structure and formatting to the above text.`;
  return processTemplate(template, ctx);
}

async function createPatientLeaflet(ctx: QuickPickContext): Promise<string> {
  const template = `Convert the above into a short patient leaflet (plain English, NHS.uk tone, with headings).`;
  return processTemplate(template, ctx);
}

async function addSafetyNetting(ctx: QuickPickContext): Promise<string> {
  const template = `Add clear NHS safety-netting advice for patients — when to seek urgent care, follow-up advice, and self-care tips.`;
  return processTemplate(template, ctx);
}

async function createStaffTrainingPack(ctx: QuickPickContext): Promise<string> {
  const template = `Turn the above into a structured SOP/training guide for GP practice staff.`;
  return processTemplate(template, ctx);
}

async function createManagerBriefingSlide(ctx: QuickPickContext): Promise<string> {
  const template = `Summarise the above into 3–5 concise bullet points suitable for a GP Partner/Board slide.`;
  return processTemplate(template, ctx);
}

async function translate(ctx: QuickPickContext, options: any): Promise<string> {
  if (options.mode === 'auto') {
    const template = `Translate the above into the patient's language (auto-detect if known). Keep it accurate and simple.`;
    return processTemplate(template, ctx);
  } else if (options.mode === 'patient') {
    const template = `Translate the above into ${options.targetLang}, in plain patient-friendly style. Keep accuracy and avoid jargon.`;
    return processTemplate(template, ctx, { targetLang: options.targetLang });
  } else if (options.mode === 'clinician') {
    const template = `Translate the above into ${options.targetLang}, in literal clinical style for use by doctors. Preserve medical terms exactly.`;
    return processTemplate(template, ctx, { targetLang: options.targetLang });
  }
  return processTemplate("Translating content...", ctx);
}

function openLanguagePicker(options: any): string {
  return "Opening language picker...";
}

function backToEnglish(ctx: QuickPickContext): string {
  const template = `Re-translate the last translation back into English so I can check accuracy.`;
  return processTemplate(template, ctx);
}

function copyToClipboard(ctx: QuickPickContext): string {
  const template = `Output only the cleaned final text, ready for copy/paste.`;
  return processTemplate(template, ctx);
}

function saveToRecord(ctx: QuickPickContext): string {
  const template = `Format and output as structured GP consultation note ready to paste into EMIS/SystmOne.`;
  return processTemplate(template, ctx);
}

function exportPDF(ctx: QuickPickContext): string {
  const template = `Generate a PDF version of the above text with clear NHS-style formatting.`;
  return processTemplate(template, ctx);
}

function exportDOCX(ctx: QuickPickContext): string {
  const template = `Generate a Word (.docx) version of the above with NHS Blue headings.`;
  return processTemplate(template, ctx);
}

function exportEmailHTML(ctx: QuickPickContext): string {
  const template = `Format the above as an HTML email with NHS branding.`;
  return processTemplate(template, ctx);
}

function printDocument(ctx: QuickPickContext): string {
  const template = `Output the above in a clean print-friendly format.`;
  return processTemplate(template, ctx);
}

function combineWithPracticeInfo(ctx: QuickPickContext): string {
  const template = `Add my practice header/footer (Blue PCN, Northamptonshire, local phone/email) to the above.`;
  return processTemplate(template, ctx);
}

function insertLocalICBLinks(ctx: QuickPickContext): string {
  const template = `Insert relevant local referral form links and ICB guidance links for Northamptonshire.`;
  return processTemplate(template, ctx);
}

function openPriorApprovalModal(ctx: QuickPickContext): string {
  const template = `Check prior-approval status of any drugs mentioned. Return a formatted table of approval requirements with ICB link.`;
  return processTemplate(template, ctx);
}

function addPracticeSafetyNetting(ctx: QuickPickContext): string {
  const template = `Insert our standard GP practice safety-netting template text into the above.`;
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
  "format-text": formatText,
  "force-html": (ctx) => processTemplate(FORCE_HTML_PROCESSOR, ctx),

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
  "add-safetynetting-template": addPracticeSafetyNetting
};
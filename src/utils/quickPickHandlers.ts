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
  const template = `Approve and save this content.`;
  return processTemplate(template, ctx);
}

async function rejectAndRedo(ctx: QuickPickContext): Promise<string> {
  const template = `Please regenerate a new answer to the original request.`;
  return processTemplate(template, ctx);
}

async function askAlternatives(ctx: QuickPickContext): Promise<string> {
  const template = `Please provide 3 alternative approaches.`;
  return processTemplate(template, ctx);
}

// Simple placeholder functions for other handlers
async function markForClinicalReview(ctx: QuickPickContext): Promise<string> {
  return "Marked for clinical review.";
}

async function validateWithCitations(ctx: QuickPickContext): Promise<string> {
  return "Please validate with citations.";
}

async function flagAsSuspect(ctx: QuickPickContext): Promise<string> {
  return "This has been flagged for review.";
}

async function runRedAmberFlagScreen(ctx: QuickPickContext): Promise<string> {
  return "Running safety flag screen...";
}

async function runInteractionCheck(ctx: QuickPickContext): Promise<string> {
  return "Checking for interactions...";
}

async function showConfidenceChecklist(ctx: QuickPickContext): Promise<string> {
  return "Confidence checklist displayed.";
}

async function roundTripCheck(ctx: QuickPickContext, options: any): Promise<string> {
  return "Running round-trip check...";
}

async function expandWithDetails(ctx: QuickPickContext): Promise<string> {
  return "Please expand with more details.";
}

async function summarise(ctx: QuickPickContext, words: number): Promise<string> {
  return "Please summarise this content.";
}

async function rewritePlainEnglish(ctx: QuickPickContext): Promise<string> {
  return "Please rewrite in plain English.";
}

async function addSnomedAndBnfSummary(ctx: QuickPickContext): Promise<string> {
  return "Please add SNOMED/BNF summary.";
}

async function formatForSystem(ctx: QuickPickContext, system: string): Promise<string> {
  return `Please format for ${system}.`;
}

async function insertFormularyAndPriorApproval(ctx: QuickPickContext): Promise<string> {
  return "Adding formulary and prior approval information.";
}

async function formatText(ctx: QuickPickContext): Promise<string> {
  return "Formatting text...";
}

async function createPatientLeaflet(ctx: QuickPickContext): Promise<string> {
  return "Creating patient leaflet.";
}

async function addSafetyNetting(ctx: QuickPickContext): Promise<string> {
  return "Adding safety netting.";
}

async function createStaffTrainingPack(ctx: QuickPickContext): Promise<string> {
  return "Creating staff training pack.";
}

async function createManagerBriefingSlide(ctx: QuickPickContext): Promise<string> {
  return "Creating manager briefing slide.";
}

async function translate(ctx: QuickPickContext, options: any): Promise<string> {
  return "Translating content...";
}

function openLanguagePicker(options: any): string {
  return "Opening language picker...";
}

function backToEnglish(ctx: QuickPickContext): string {
  return "Converting back to English...";
}

function copyToClipboard(ctx: QuickPickContext): string {
  return "Copied to clipboard.";
}

function saveToRecord(ctx: QuickPickContext): string {
  return "Saved to record.";
}

function exportPDF(ctx: QuickPickContext): string {
  return "Exporting PDF...";
}

function exportDOCX(ctx: QuickPickContext): string {
  return "Exporting DOCX...";
}

function exportEmailHTML(ctx: QuickPickContext): string {
  return "Exporting as email HTML...";
}

function printDocument(ctx: QuickPickContext): string {
  return "Printing document...";
}

function combineWithPracticeInfo(ctx: QuickPickContext): string {
  return "Combining with practice information...";
}

function insertLocalICBLinks(ctx: QuickPickContext): string {
  return "Inserting local ICB links...";
}

function openPriorApprovalModal(ctx: QuickPickContext): string {
  return "Opening prior approval modal...";
}

function addPracticeSafetyNetting(ctx: QuickPickContext): string {
  return "Adding practice safety netting template...";
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
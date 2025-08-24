import { toast } from 'sonner';
import { QuickPickContext, TranslatePayload, SummarisePayload, FormatPayload } from '@/types/quickPick';

// Act on reply handlers
async function approveAndSave(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement approve and save functionality
  toast("Content approved and saved");
}

async function rejectAndRedo(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement reject and redo functionality
  toast("Content rejected, preparing redo...");
}

async function askAlternatives(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement ask for alternatives functionality
  toast("Requesting 3 alternatives...");
}

async function markForClinicalReview(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement mark for clinical review functionality
  toast("Marked for clinical review");
}

// Quality & safety handlers
async function validateWithCitations(options: { standard: string }): Promise<void> {
  // TODO: Implement citation validation
  toast("Validating with citations...");
}

async function flagAsSuspect(ctx: QuickPickContext): Promise<void> {
  // This maps to the existing "Check this as I think it's wrong" functionality
  const correctionPrompt = `You are an NHS UK primary-care assistant acting in "Challenge & Verify" mode.

GOAL
Audit the previous answer against CURRENT, TRUSTED UK sources. Prove the conclusion with quotes and verifiable links. If wrong or incomplete, replace it with a corrected answer.

INPUTS (provided by the app)
- original_prompt: {{original_prompt}}
- previous_answer: {{previous_answer}}
- now_utc: {{now_utc}}
- (optional) pre_fetched_docs: array of {url, title, last_updated_text, body_text}
- (optional) topic_hint: {{topic_hint}}

SOURCE POLICY (ALLOW-LIST ONLY)
Primary clinical sources (in order of preference):
1) england.nhs.uk (NHS England: service policy, vaccination programmes, DES/specifications, letters/'long-read')
2) nice.org.uk (NICE guidelines, NG/CG/IPG; pathways)
3) bnf.nice.org.uk (BNF monographs)
4) gov.uk:
   - MHRA (safety alerts; SmPC/PIL links)
   - DHSC/UKHSA (press releases, epidemiology, immunisation policy)
5) nhs.uk (patient-facing info; secondary corroboration)
6) Green Book (Immunisation against infectious disease) via gov.uk

NEVER use blogs, media articles, social sites, or commercial pages. If necessary sources are missing, STOP with an error (see "INSUFFICIENT EVIDENCE").

ROUTING HINTS (pick the primary)
- Vaccination eligibility/programme timing → NHS England "long-read" or programme letter (england.nhs.uk). Use Green Book only for referenced clinical criteria (e.g., immunosuppression tables).
- Medicines (indications, dosing, cautions) → BNF first; MHRA SmPC for product specifics/contraindications.
- Clinical management guidance → NICE guideline (NG/CG); add UKHSA where relevant (ID).
- Contracting/ARRS/DES → NHS England specifications/letters on england.nhs.uk.

RECENCY RULES
- Vaccination programmes, DES/policy, safety alerts: must reflect the latest page revision or letter. Extract and display the "last updated/published" text from the page. If older than 12 months AND you find a newer official source, prefer the newer one.
- Medicines: BNF current edition (live site). If BNF conflicts with older PDFs, prefer BNF.
- If "last updated" not shown, state "not stated" and proceed, but cross-check with at least one corroborator on the allow-list.

METHOD
1) Identify topic and choose a PRIMARY source from the allow-list (see "Routing hints").
2) Fetch/read that page (or use pre_fetched_docs). If fetch fails → output "INSUFFICIENT EVIDENCE" (see template).
3) Extract EXACT passages that answer the question (e.g., eligibility bullets, programme dates, dosing lines).
4) Fetch 1–2 SECONDARY corroborators from the allow-list. If they disagree, prefer PRIMARY and note the discrepancy.
5) Compare previous_answer to the extracted evidence. List precise differences (wrong cohort, wrong age, missing group, wrong dose/date, etc.).
6) If any part is wrong/outdated/unsupported, produce a corrected answer that adheres strictly to the evidence. Do not invent content.
7) Provide a proof pack: verbatim quotes in blockquotes + working links. Links must go to the exact document (and page/section if possible).
8) If evidence is incomplete/unavailable, do NOT answer; return "INSUFFICIENT EVIDENCE" with the missing sources you need.

STYLE
- UK GP tone: clear, factual, concise.
- Quote minimally but exactly for the key lines.
- No generic disclaimers; show concrete evidence and dates.
- Use British English.

OUTPUT FORMAT (STRICT)
Verification Panel:
- Topic checked: <one line>
- Primary source: <title> — <url>
- Secondary source(s): <title> — <url> (0–2 items)
- Last updated (primary): <date or "not stated">
- Checked now (Europe/London): <auto-convert from now_utc>

Evidence (verbatim quotes):
> <Exact line(s) from the primary source that determine the answer. Keep to the relevant bullets/sentences.>
> <If helpful, add 1–2 short quotes from secondary sources.>

Comparison with previous answer:
- Verdict: Correct / Partially correct / Incorrect
- Differences found:
  • <difference 1>
  • <difference 2>

Revised answer (only if needed):
<Complete replacement content that matches the evidence exactly>

Sources used:
- <Primary source title> — <url>
- <Secondary source title> — <url> (only if used)

INSUFFICIENT EVIDENCE (use this template when required sources cannot be fetched/are missing):
Verification Panel (partial) + 
"Unable to verify because the required official sources were not available:
- <list exact missing URLs/doc types needed>
Please fetch these and retry. No corrections made."`;
  
  // This will be handled by the calling component's onQuickResponse
  return correctionPrompt as any;
}

async function runRedAmberFlagScreen(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement red/amber flag screening
  toast("Running red/amber flag screen...");
}

async function runInteractionCheck(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement interaction check
  toast("Checking interactions and contraindications...");
}

async function showConfidenceChecklist(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement confidence checklist
  toast("Showing confidence checklist...");
}

async function roundTripCheck(options: { langs: string[] }): Promise<void> {
  // TODO: Implement round-trip translation check
  toast("Running round-trip translation check...");
}

// Refine content handlers
async function expandWithDetails(ctx: QuickPickContext): Promise<void> {
  return "Prompt: Expand with more details and examples" as any;
}

async function openSummariseDialog(): Promise<void> {
  // TODO: Implement summarise dialog
  toast("Opening summarise options...");
}

async function rewritePlainEnglish(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement plain English rewrite
  return "Prompt: Rewrite this in plain English that patients can easily understand" as any;
}

async function addSnomedAndBnfSummary(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement SNOMED/BNF summary
  toast("Adding SNOMED/BNF summary...");
}

async function openFormatDialog(): Promise<void> {
  // TODO: Implement format dialog for EMIS/SystmOne
  toast("Opening format options...");
}

async function insertFormularyAndPriorApproval(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement formulary and prior approval notes
  toast("Adding formulary and prior approval information...");
}

// Audience handlers
async function openLeafletDialog(): Promise<void> {
  return "Prompt: Expand and create as a patient leaflet" as any;
}

async function addSafetyNetting(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement safety netting
  toast("Adding safety-netting information...");
}

async function createStaffTrainingPack(ctx: QuickPickContext): Promise<void> {
  return "Prompt: Create as a detailed training document for our staff, covering off any areas that are expected to be known" as any;
}

async function createManagerBriefingSlide(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement manager briefing slide
  toast("Creating manager briefing slide...");
}

// Translation handlers
async function translate(ctx: QuickPickContext, payload: TranslatePayload): Promise<void> {
  const langMap: Record<string, string> = {
    'pl': 'Polish',
    'ro': 'Romanian',
    'lt': 'Lithuanian', 
    'uk': 'Ukrainian',
    'ar': 'Arabic',
    'pt': 'Portuguese'
  };

  if (payload.mode === "auto") {
    return "Prompt: Translate this content automatically into the most appropriate language for this patient while maintaining medical accuracy and cultural appropriateness" as any;
  }

  if (payload.targetLang && payload.mode === "patient") {
    const language = langMap[payload.targetLang] || payload.targetLang;
    return `Prompt: Translate this content into ${language} in a patient-friendly manner while maintaining medical accuracy and cultural appropriateness` as any;
  }

  if (payload.targetLang && payload.mode === "clinician") {
    const language = langMap[payload.targetLang] || payload.targetLang;
    return `Prompt: Translate this content into ${language} using precise clinical terminology while maintaining medical accuracy` as any;
  }

  return "Translation not implemented" as any;
}

async function openLanguagePicker(options: { mode: "patient" | "clinician" }): Promise<void> {
  // TODO: Implement language picker dialog
  toast(`Opening ${options.mode} language picker...`);
}

async function backToEnglish(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement back to English functionality
  toast("Translating back to English...");
}

// Export & share handlers
async function copyToClipboard(ctx: QuickPickContext): Promise<void> {
  try {
    await navigator.clipboard.writeText(ctx.text);
    toast("Copied to clipboard");
  } catch (error) {
    toast.error("Failed to copy to clipboard");
  }
}

async function saveToRecord(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement save to record functionality
  toast("Saving to record...");
}

async function exportPDF(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement PDF export (this will call existing functionality)
  toast("Exporting PDF...");
}

async function exportDOCX(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement DOCX export (this will call existing functionality)  
  toast("Exporting Word document...");
}

async function exportEmailHTML(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement email export (this will call existing functionality)
  toast("Preparing email...");
}

async function printDocument(ctx: QuickPickContext): Promise<void> {
  // This will be handled by the existing print functionality
  return "Print" as any;
}

// Practice context handlers
async function combineWithPracticeInfo(ctx: QuickPickContext): Promise<void> {
  return "Prompt: Combine with my practice information" as any;
}

async function insertLocalICBLinks(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement ICB links insertion
  toast("Inserting local ICB links...");
}

async function openPriorApprovalModal(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement prior approval modal
  toast("Opening prior approval modal...");
}

async function addPracticeSafetyNetting(ctx: QuickPickContext): Promise<void> {
  // TODO: Implement practice safety netting template
  toast("Adding practice safety-netting template...");
}

// Main handlers object
export const handlers: Record<string, (ctx: QuickPickContext) => Promise<void> | Promise<string> | string> = {
  "approve-save": approveAndSave,
  "reject-redo": rejectAndRedo,
  "ask-alternatives": askAlternatives,
  "mark-clinical-review": markForClinicalReview,

  "validate-citations": () => validateWithCitations({ standard: "UK_NICE_BNF" }),
  "flag-wrong": flagAsSuspect,
  "flag-screen": runRedAmberFlagScreen,
  "interaction-check": runInteractionCheck,
  "confidence-what-to-verify": showConfidenceChecklist,
  "roundtrip-quality-check": () => roundTripCheck({ langs: ["pl","ro","lt","uk","ar","pt"] }),

  "expand-details": expandWithDetails,
  "summarise": () => openSummariseDialog(),
  "plain-english": rewritePlainEnglish,
  "add-snomed-bnf": addSnomedAndBnfSummary,
  "format-system": () => openFormatDialog(),
  "add-formulary-prior-approval": insertFormularyAndPriorApproval,

  "patient-leaflet": () => openLeafletDialog(),
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

  "translate-back-to-en": (ctx) => backToEnglish(ctx),

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
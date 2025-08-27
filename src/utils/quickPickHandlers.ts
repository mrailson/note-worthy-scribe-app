import { toast } from 'sonner';
import { QuickPickContext, TranslatePayload, SummarisePayload, FormatPayload } from '@/types/quickPick';
import { NHS_LINKING_POLICY, getTopicUrl } from './nhsUrlValidation';
import { supabase } from '@/integrations/supabase/client';

// Enhanced system prompt with formatting requirements
const GLOBAL_SYSTEM_PROMPT = `You are an NHS AI assistant. Provide clean, accurate responses using UK NHS sources only (NICE/CKS, NHS.uk, BNF). Use proper UK spelling and NHS terminology.

CRITICAL FORMATTING REQUIREMENTS:
- ALWAYS preserve markdown formatting with proper line breaks
- Use clear paragraph spacing with blank lines between sections
- Maintain proper header structure (### for main headers, #### for sub-headers)
- Keep lists properly formatted with bullet points or numbers
- Ensure text is readable with appropriate spacing and structure
- Never return responses as single continuous blocks of text`;

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

// Formatting post-processor to ensure proper structure
function ensureProperFormatting(text: string): string {
  if (!text) return text;
  
  // Add line breaks after headers if missing
  text = text.replace(/(#{1,6}\s+[^\n]+)(?!\n\n)/g, '$1\n\n');
  
  // Add spacing between paragraphs if missing
  text = text.replace(/([^\n])\n([^#\n-*+])/g, '$1\n\n$2');
  
  // Ensure list items have proper spacing
  text = text.replace(/([^\n])\n([*+-])/g, '$1\n\n$2');
  
  // Clean up excessive spacing
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

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
  return `Output as final approved text. No further edits needed. Save in clean formatted form.`;
}

async function rejectAndRedo(ctx: QuickPickContext): Promise<string> {
  return `Discard the above output and regenerate a fresh improved version, following NHS NICE/BNF standards.`;
}

async function askAlternatives(ctx: QuickPickContext): Promise<string> {
  return `Give me 3 alternative phrasings of the above output, concise and compliant with UK NHS guidance.`;
}

async function markForClinicalReview(ctx: QuickPickContext): Promise<string> {
  return `Flag this text for GP clinical review. Highlight any areas where clinical judgement is required.`;
}

async function validateWithCitations(ctx: QuickPickContext): Promise<string> {
  return `Validate the above output against NICE CKS, NHS.uk, and BNF. Add inline references where applicable.`;
}

async function flagAsSuspect(ctx: QuickPickContext): Promise<string> {
  return `Re-check the above carefully. Identify any incorrect or misleading statements. Correct them with NHS NICE/BNF sources.`;
}

async function runRedAmberFlagScreen(ctx: QuickPickContext): Promise<string> {
  return `Screen the above for NHS111 red/amber flags. Highlight any urgent or safety-critical concerns.`;
}

async function runInteractionCheck(ctx: QuickPickContext): Promise<string> {
  return `Check the above for drug interactions or contraindications using BNF guidance. List any relevant findings.`;
}

async function showConfidenceChecklist(ctx: QuickPickContext): Promise<string> {
  return `State confidence level in the above answer (High/Medium/Low). List what a GP should independently verify.`;
}

async function roundTripCheck(ctx: QuickPickContext, options: any): Promise<string> {
  return `Translate the text into the target language and back to English. Show both versions and highlight any meaning changes.`;
}

async function expandWithDetails(ctx: QuickPickContext): Promise<string> {
  return `Expand the above with additional NICE guideline detail and practical examples relevant to GP consultations.

FORMATTING REQUIREMENTS:
- Use clear headers (### for main sections, #### for subsections)
- Separate paragraphs with blank lines
- Use bullet points for lists
- Ensure proper spacing and readability
- Maintain structured, well-formatted output`;
}

async function summarise(ctx: QuickPickContext, words: number): Promise<string> {
  return `Produce a concise summary of the above in bullet points suitable for quick GP reference.

FORMATTING REQUIREMENTS:
- Use clear bullet points (•) or numbered lists
- Separate main points with proper spacing
- Use bold text for key terms (**important**)
- Ensure each point is on a new line with proper spacing`;
}

async function rewritePlainEnglish(ctx: QuickPickContext): Promise<string> {
  return `Rewrite the above in plain, patient-friendly English with no jargon. Keep accuracy.

FORMATTING REQUIREMENTS:
- Use clear paragraphs separated by blank lines
- Use simple headings (### for main topics)
- Break up long text into digestible sections
- Maintain proper spacing and structure`;
}

async function addSnomedAndBnfSummary(ctx: QuickPickContext): Promise<string> {
  return `Add a structured SNOMED and BNF-style summary for GP coding and prescribing.`;
}

async function formatForSystem(ctx: QuickPickContext, system: string): Promise<string> {
  return `Format the above text in a structured template suitable for pasting into EMIS or SystmOne patient record.`;
}

async function insertFormularyAndPriorApproval(ctx: QuickPickContext): Promise<string> {
  return `Check the ICB Northamptonshire formulary and prior-approval status for this drug/condition. Insert notes with web link.`;
}

async function formatText(ctx: QuickPickContext): Promise<string> {
  return `Apply proper markdown structure and formatting to the above text.`;
}

async function createPatientLeaflet(ctx: QuickPickContext): Promise<string> {
  return `Convert the above into a short patient leaflet (plain English, NHS.uk tone, with headings).

FORMATTING REQUIREMENTS:
- Use clear main heading (### Patient Information)
- Organize into well-spaced sections with #### subheadings
- Use bullet points for key information
- Separate sections with blank lines for readability`;
}

async function addSafetyNetting(ctx: QuickPickContext): Promise<string> {
  return `Add clear NHS safety-netting advice for patients — when to seek urgent care, follow-up advice, and self-care tips.

FORMATTING REQUIREMENTS:
- Use clear warning headings (#### When to Seek Urgent Care)
- Separate urgent vs routine advice clearly
- Use bullet points for action items
- Include proper spacing between sections`;
}

async function createStaffTrainingPack(ctx: QuickPickContext): Promise<string> {
  return `Turn the above into a structured SOP/training guide for GP practice staff.`;
}

async function createManagerBriefingSlide(ctx: QuickPickContext): Promise<string> {
  return `Summarise the above into 3–5 concise bullet points suitable for a GP Partner/Board slide.`;
}

async function translate(ctx: QuickPickContext, options: any): Promise<string> {
  // Always return prompts for AI to handle translation
  const languageNames = {
    'pl': 'Polish',
    'ur': 'Urdu', 
    'ar': 'Arabic',
    'bn': 'Bengali',
    'ro': 'Romanian',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'tr': 'Turkish',
    'fr': 'French',
    'zh': 'Chinese (Mandarin)'
  };
  
  const languageName = languageNames[options.targetLang] || options.targetLang;
  
  if (options.mode === 'auto') {
    return `Translate the above text into the patient's preferred language (auto-detect if known). Keep it accurate and simple. IMPORTANT: Preserve all markdown formatting (headers ###, bold **text**, lists, etc.) exactly as they appear in the original.`;
  }
  
  return `Translate the above text into ${languageName} for a patient consultation. Keep it accurate and patient-friendly. IMPORTANT: Preserve all markdown formatting (headers ###, bold **text**, lists, etc.) exactly as they appear in the original.`;
}

function openLanguagePicker(options: any): string {
  return "Opening language picker...";
}

function backToEnglish(ctx: QuickPickContext): string {
  return `Re-translate the last translation back into English so I can check accuracy.`;
}

function copyToClipboard(ctx: QuickPickContext): string {
  return `Output only the cleaned final text, ready for copy/paste.`;
}

function saveToRecord(ctx: QuickPickContext): string {
  return `Format and output as structured GP consultation note ready to paste into EMIS/SystmOne.`;
}

function exportPDF(ctx: QuickPickContext): string {
  return `Generate a PDF version of the above text with clear NHS-style formatting.`;
}

function exportDOCX(ctx: QuickPickContext): string {
  return `Generate a Word (.docx) version of the above with NHS Blue headings.`;
}

function exportEmailHTML(ctx: QuickPickContext): string {
  return `Format the above as an HTML email with NHS branding.`;
}

function printDocument(ctx: QuickPickContext): string {
  return `Output the above in a clean print-friendly format.`;
}

async function combineWithPracticeInfo(ctx: QuickPickContext): Promise<string> {
  try {
    // Fetch user's practice information using a simpler query structure
    const { data: practiceData, error } = await supabase
      .from('user_roles')
      .select(`
        practice_id,
        gp_practices (
          name,
          phone,
          email
        )
      `)
      .eq('user_id', ctx.userId)
      .single();

    if (error || !practiceData?.gp_practices) {
      console.error('Error fetching practice info:', error);
      return `Add my practice header/footer (practice information) to the above.`;
    }

    const practice = practiceData.gp_practices;
    const practiceName = practice.name || 'Your Practice';
    const practicePhone = practice.phone || '[Practice Phone]';
    const practiceEmail = practice.email || '[Practice Email]';

    return `Add my practice header/footer (${practiceName}, Phone: ${practicePhone}, Email: ${practiceEmail}) to the above.`;
  } catch (error) {
    console.error('Error in combineWithPracticeInfo:', error);
    return `Add my practice header/footer (practice information) to the above.`;
  }
}

function insertLocalICBLinks(ctx: QuickPickContext): string {
  return `Insert relevant local referral form links and ICB guidance links for Northamptonshire.`;
}

function openPriorApprovalModal(ctx: QuickPickContext): string {
  return `Check prior-approval status of any drugs mentioned. Return a formatted table of approval requirements with ICB link.`;
}

function addPracticeSafetyNetting(ctx: QuickPickContext): string {
  return `Insert our standard GP practice safety-netting template text into the above.`;
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

  // Translation handlers for specific languages
  "translate-polish": (ctx) => translate(ctx, { targetLang: 'pl', mode: 'patient' }),
  "translate-urdu": (ctx) => translate(ctx, { targetLang: 'ur', mode: 'patient' }),
  "translate-arabic": (ctx) => translate(ctx, { targetLang: 'ar', mode: 'patient' }),
  "translate-bengali": (ctx) => translate(ctx, { targetLang: 'bn', mode: 'patient' }),
  "translate-romanian": (ctx) => translate(ctx, { targetLang: 'ro', mode: 'patient' }),
  "translate-spanish": (ctx) => translate(ctx, { targetLang: 'es', mode: 'patient' }),
  "translate-portuguese": (ctx) => translate(ctx, { targetLang: 'pt', mode: 'patient' }),
  "translate-turkish": (ctx) => translate(ctx, { targetLang: 'tr', mode: 'patient' }),
  "translate-french": (ctx) => translate(ctx, { targetLang: 'fr', mode: 'patient' }),
  "translate-chinese": (ctx) => translate(ctx, { targetLang: 'zh', mode: 'patient' })
};
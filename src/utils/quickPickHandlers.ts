import { toast } from 'sonner';
import { QuickPickContext, TranslatePayload, SummarisePayload, FormatPayload } from '@/types/quickPick';
import { NHS_LINKING_POLICY, getTopicUrl } from './nhsUrlValidation';
import { supabase } from '@/integrations/supabase/client';
import { applyTextFormatting } from './textFormatting';

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

async function createPatientLetter(ctx: QuickPickContext): Promise<string> {
  return `Convert the above into a formal patient letter format with proper NHS letter structure, including:

FORMATTING REQUIREMENTS:
- Use clear formal letter heading (#### [Practice Name] Letter)
- Include proper date and patient address placeholders
- Use formal but compassionate tone appropriate for patients
- Structure with clear paragraphs and professional spacing
- Include closing salutation and signature block
- Maintain proper letter formatting throughout`;
}

async function createPatientEmail(ctx: QuickPickContext): Promise<string> {
  return `Convert the above into a patient-friendly email format with clear subject line, professional but warm tone, and proper email structure.`;
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
    'zh': 'Chinese (Mandarin)',
    'hi': 'Hindi',
    'gu': 'Gujarati',
    'pa': 'Punjabi',
    'it': 'Italian',
    'de': 'German',
    'ru': 'Russian',
    'lt': 'Lithuanian',
    'lv': 'Latvian',
    'bg': 'Bulgarian',
    'hu': 'Hungarian',
    'cs': 'Czech',
    'sk': 'Slovak',
    'uk': 'Ukrainian',
    'so': 'Somali',
    'ti': 'Tigrinya',
    'am': 'Amharic',
    'ta': 'Tamil',
    'te': 'Telugu',
    'ml': 'Malayalam',
    'fa': 'Farsi/Persian'
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



async function improveLayoutScreen(ctx: QuickPickContext): Promise<string> {
  return "Improve the layout and formatting of the above content for better screen readability. Use clear headings, bullet points, proper spacing, and organize information in a logical flow that's easy to scan and read on screen.";
}

async function improveLayoutEmail(ctx: QuickPickContext): Promise<string> {
  return "Reformat the above content with proper email layout including clear subject line suggestion, professional email structure with proper spacing, short paragraphs optimized for email reading, and appropriate email formatting.";
}

async function improveLayoutLeaflet(ctx: QuickPickContext): Promise<string> {
  return "Convert the above into a patient-friendly leaflet format with clear headings, bullet points, easy-to-scan sections, visual hierarchy, and layout suitable for printing as a patient information leaflet.";
}

async function improveLayoutLetter(ctx: QuickPickContext): Promise<string> {
  return "Format the above content as a formal letter with proper letter heading, date, address placeholder, clear paragraphs with appropriate spacing, formal structure, and proper closing signature block.";
}

// AI Enhancement handlers
async function aiMakeProfessional(ctx: QuickPickContext): Promise<string> {
  return `Transform the above content into highly professional, formal business language suitable for executive meetings and official records. Use formal tone, proper business terminology, and structured presentation.`;
}

async function aiMakeConcise(ctx: QuickPickContext): Promise<string> {
  return `Make the above content more concise and to-the-point while retaining all critical information, decisions, and action items. Remove redundancy and focus on key points.`;
}

async function aiAddActionItems(ctx: QuickPickContext): Promise<string> {
  return `Analyze the above content and clearly extract and organize all action items, decisions, follow-up tasks, and responsible parties. Present them in a structured format with clear headings.`;
}

async function aiNHSFormat(ctx: QuickPickContext): Promise<string> {
  return `Format the above content according to NHS governance and documentation standards. Include proper clinical and administrative structure, compliance requirements, and professional NHS terminology.`;
}

async function aiBoardReady(ctx: QuickPickContext): Promise<string> {
  return `Transform the above content into board-ready format with executive summary, key decisions highlighted, strategic implications noted, and professional presentation suitable for board meetings.`;
}

async function aiCustomPrompt(ctx: QuickPickContext): Promise<string> {
  return `Please provide a custom AI enhancement request for the above content. You can specify exactly how you want the content modified, enhanced, or transformed.`;
}

// Quick formatting handlers
async function formatBoldTitles(ctx: QuickPickContext): Promise<string> {
  return `Apply bold formatting (**bold text**) to all titles, headers, and important section names in the above content to improve visual hierarchy.`;
}

async function formatItalicEmphasis(ctx: QuickPickContext): Promise<string> {
  return `Apply italic formatting (*italic text*) to add emphasis to important notes, decisions, and key points in the above content.`;
}

async function formatBulletPoints(ctx: QuickPickContext): Promise<string> {
  return `Convert appropriate content in the above to bullet points (• bullets) to improve readability and organization, especially for lists, action items, and key points.`;
}

async function formatNumberedList(ctx: QuickPickContext): Promise<string> {
  return `Convert appropriate content in the above to numbered lists (1. 2. 3.) to show sequence, priority, or process steps clearly.`;
}

async function formatHeaders(ctx: QuickPickContext): Promise<string> {
  return `Add proper markdown headers (### for main sections, #### for subsections) to the above content to improve structure and navigation.`;
}

async function formatTable(ctx: QuickPickContext): Promise<string> {
  return `Convert appropriate data in the above content into table format using markdown tables (| Column 1 | Column 2 |) where it would improve clarity and organization.`;
}

async function formatCleanSpacing(ctx: QuickPickContext): Promise<string> {
  return `Clean up the spacing, formatting, and structure of the above content. Remove excessive whitespace, ensure consistent paragraph breaks, and improve overall presentation.`;
}

async function formatRemoveFormatting(ctx: QuickPickContext): Promise<string> {
  return `Remove all markdown formatting from the above content and present it as clean plain text while maintaining readability and structure.`;
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
  "patient-letter": createPatientLetter,
  "patient-email": createPatientEmail,
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
  "translate-chinese": (ctx) => translate(ctx, { targetLang: 'zh', mode: 'patient' }),

  // Additional languages
  "translate-hindi": (ctx) => translate(ctx, { targetLang: 'hi', mode: 'patient' }),
  "translate-gujarati": (ctx) => translate(ctx, { targetLang: 'gu', mode: 'patient' }),
  "translate-punjabi": (ctx) => translate(ctx, { targetLang: 'pa', mode: 'patient' }),
  "translate-italian": (ctx) => translate(ctx, { targetLang: 'it', mode: 'patient' }),
  "translate-german": (ctx) => translate(ctx, { targetLang: 'de', mode: 'patient' }),
  "translate-russian": (ctx) => translate(ctx, { targetLang: 'ru', mode: 'patient' }),
  "translate-lithuanian": (ctx) => translate(ctx, { targetLang: 'lt', mode: 'patient' }),
  "translate-latvian": (ctx) => translate(ctx, { targetLang: 'lv', mode: 'patient' }),
  "translate-bulgarian": (ctx) => translate(ctx, { targetLang: 'bg', mode: 'patient' }),
  "translate-hungarian": (ctx) => translate(ctx, { targetLang: 'hu', mode: 'patient' }),
  "translate-czech": (ctx) => translate(ctx, { targetLang: 'cs', mode: 'patient' }),
  "translate-slovak": (ctx) => translate(ctx, { targetLang: 'sk', mode: 'patient' }),
  "translate-ukrainian": (ctx) => translate(ctx, { targetLang: 'uk', mode: 'patient' }),
  "translate-somali": (ctx) => translate(ctx, { targetLang: 'so', mode: 'patient' }),
  "translate-tigrinya": (ctx) => translate(ctx, { targetLang: 'ti', mode: 'patient' }),
  "translate-amharic": (ctx) => translate(ctx, { targetLang: 'am', mode: 'patient' }),
  "translate-tamil": (ctx) => translate(ctx, { targetLang: 'ta', mode: 'patient' }),
  "translate-telugu": (ctx) => translate(ctx, { targetLang: 'te', mode: 'patient' }),
  "translate-malayalam": (ctx) => translate(ctx, { targetLang: 'ml', mode: 'patient' }),
  "translate-farsi": (ctx) => translate(ctx, { targetLang: 'fa', mode: 'patient' }),

  // Round-trip translation check
  "roundtrip-quality-check": (ctx) => roundTripCheck(ctx, { langs: ["pl","ro","lt","uk","ar","pt"] }),

  // Improve formatting handlers
  "improve-layout-screen": improveLayoutScreen,
  "improve-layout-email": improveLayoutEmail,
  "improve-layout-leaflet": improveLayoutLeaflet,
  "improve-layout-letter": improveLayoutLetter,

  // AI Enhancement handlers
  "ai-make-professional": aiMakeProfessional,
  "ai-make-concise": aiMakeConcise,
  "ai-add-action-items": aiAddActionItems,
  "ai-nhs-format": aiNHSFormat,
  "ai-board-ready": aiBoardReady,
  "ai-custom-prompt": aiCustomPrompt,

  // Quick formatting handlers
  "format-bold-titles": formatBoldTitles,
  "format-italic-emphasis": formatItalicEmphasis,
  "format-bullet-points": formatBulletPoints,
  "format-numbered-list": formatNumberedList,
  "format-headers": formatHeaders,
  "format-table": formatTable,
  "format-clean-spacing": formatCleanSpacing,
  "format-remove-formatting": formatRemoveFormatting,
  
  // Global Standardization handlers
  "standardize-dates": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'standardize-dates'),
  "format-numbers": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'format-numbers'),
  "standardize-names": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'standardize-names'),
  "format-timestamps": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'format-timestamps'),
  "clean-punctuation": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'clean-punctuation'),
  "standardize-abbreviations": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'standardize-abbreviations'),
  "standardize-all": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'standardize-all'),
  
  // Professional Cleanup handlers
  "remove-filler-words": async (ctx: QuickPickContext) => applyTextFormatting(ctx.text, 'remove-filler-words'),
  
  // Image Service handlers
  "qr-code-generator": async (): Promise<void> => {
    // Dispatch custom event to open QR Code Generator Modal
    window.dispatchEvent(new CustomEvent('openQRCodeGenerator'));
  },
};
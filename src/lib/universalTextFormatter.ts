/**
 * Universal Text Formatter - Pre-processes text content for consistent formatting
 * across all AI models and content types, with special focus on clinical/medical content
 */

export interface TextFormatterOptions {
  contentType?: 'general' | 'clinical' | 'meeting-notes' | 'drug-info';
  preserveOriginalStructure?: boolean;
  enhanceReadability?: boolean;
  addSmartBreaks?: boolean;
}

export interface ClinicalSection {
  type: string;
  title: string;
  content: string;
  priority: number;
}

// Clinical section patterns for better medical content detection
const CLINICAL_PATTERNS = {
  dosing: /(?:^|\n)(?:[-•]?\s*)?(?:dosing|dose|posology|administration)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  contraindications: /(?:^|\n)(?:[-•]?\s*)?(?:contraindications?|contraindicated)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  interactions: /(?:^|\n)(?:[-•]?\s*)?(?:interactions?|drug interactions?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  sideEffects: /(?:^|\n)(?:[-•]?\s*)?(?:side effects?|adverse effects?|adverse reactions?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  warnings: /(?:^|\n)(?:[-•]?\s*)?(?:warnings?|cautions?|precautions?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  indications: /(?:^|\n)(?:[-•]?\s*)?(?:indications?|uses?|indicated for)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis
};

// Meeting sections for better meeting notes formatting
const MEETING_PATTERNS = {
  attendees: /(?:^|\n)(?:[-•]?\s*)?(?:attendees?|present|participants?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  agenda: /(?:^|\n)(?:[-•]?\s*)?(?:agenda|items?|topics?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  decisions: /(?:^|\n)(?:[-•]?\s*)?(?:decisions?|resolutions?|agreed)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  actions: /(?:^|\n)(?:[-•]?\s*)?(?:action items?|actions?|tasks?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis,
  nextSteps: /(?:^|\n)(?:[-•]?\s*)?(?:next steps?|follow[- ]?up|future actions?)[:.]?\s*(.*?)(?=\n\n|\n(?:[A-Z][^:]*:)|$)/gis
};

/**
 * Detects and extracts clinical sections from text
 */
export function extractClinicalSections(text: string): ClinicalSection[] {
  const sections: ClinicalSection[] = [];
  
  Object.entries(CLINICAL_PATTERNS).forEach(([type, pattern], index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const titleMatch = match.match(/^(?:[-•]?\s*)?([^:]+)[:.]?\s*/);
        const title = titleMatch ? titleMatch[1].trim() : type;
        const content = match.replace(/^(?:[-•]?\s*)?[^:]*[:.]?\s*/, '').trim();
        
        if (content.length > 10) { // Only include substantial content
          sections.push({
            type,
            title: title.charAt(0).toUpperCase() + title.slice(1),
            content,
            priority: index
          });
        }
      });
    }
  });
  
  return sections.sort((a, b) => a.priority - b.priority);
}

/**
 * Adds intelligent line breaks based on content analysis
 */
export function addSmartLineBreaks(text: string, options: TextFormatterOptions = {}): string {
  const { contentType = 'general' } = options;
  
  let processedText = text;
  
  // Fix sentences that run together without proper breaks
  processedText = processedText
    // Add breaks after periods followed by capital letters (sentence boundaries)
    .replace(/\.\s*([A-Z][^.]*)/g, '.\n\n$1')
    
    // Add breaks before clinical section headers
    .replace(/([^:\n])\s*((?:Dosing|Contraindications|Interactions|Side Effects|Warnings|Indications)[:.]\s*)/g, '$1\n\n### $2')
    
    // Add breaks before meeting section headers
    .replace(/([^:\n])\s*((?:Attendees|Agenda|Decisions|Actions|Action Items|Next Steps)[:.]\s*)/g, '$1\n\n### $2')
    
    // Break up long paragraphs (over 300 chars without line breaks)
    .replace(/([^.\n]{300,}?)([.!?])\s*([A-Z])/g, '$1$2\n\n$3')
    
    // Ensure bullet points are on new lines
    .replace(/([^-\n])\s*(-\s+[^-])/g, '$1\n$2')
    
    // Clean up excessive line breaks
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\n{2,}$/g, '\n\n');
  
  return processedText.trim();
}

/**
 * Enhances readability by improving text structure and flow
 */
export function enhanceReadability(text: string, options: TextFormatterOptions = {}): string {
  const { contentType = 'general' } = options;
  
  let enhanced = text;
  
  // Improve list formatting
  enhanced = enhanced
    // Convert various bullet point styles to consistent format
    .replace(/^[\s]*[•·*]\s+/gm, '- ')
    .replace(/^[\s]*[\d]+\.\s+/gm, (match, offset) => {
      const num = match.match(/\d+/)?.[0] || '1';
      return `${num}. `;
    })
    
    // Improve spacing around headers
    .replace(/^(#{1,6})\s*(.+?)$/gm, '\n$1 $2\n')
    
    // Ensure proper spacing around important clinical terms
    .replace(/\b(IMPORTANT|WARNING|CAUTION|NOTE):\s*/gi, '\n\n**$1:**\n')
    
    // Improve table-like content formatting
    .replace(/^([^|\n]+)\s*\|\s*([^|\n]+)$/gm, '| $1 | $2 |')
    
    // Clean up multiple spaces
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n');
  
  return enhanced.trim();
}

/**
 * Fixes common formatting issues from different AI models
 */
export function fixCommonIssues(text: string): string {
  return text
    // Fix inline headers that should be on new lines
    .replace(/([^#\n])(#{1,6}\s+)/g, '$1\n$2')
    
    // Fix missing spaces after punctuation
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    
    // Fix missing line breaks before bullet points
    .replace(/([^-\n])(-\s+)/g, '$1\n$2')
    
    // Fix clumped clinical sections
    .replace(/([^:\n])\s*((?:Dosing|Dose|Administration|Contraindications|Interactions|Side Effects|Warnings|Indications):\s*)/gi, '$1\n\n**$2**\n')
    
    // Fix table formatting issues
    .replace(/\|([^|]+)\|([^|]+)\|/g, '| $1 | $2 |')
    
    // Clean up extra whitespace
    .replace(/\n\s+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Main universal text formatter function
 */
export function formatUniversalText(text: string, options: TextFormatterOptions = {}): string {
  if (!text?.trim()) return '';
  
  const {
    contentType = 'general',
    preserveOriginalStructure = false,
    enhanceReadability: shouldEnhanceReadability = true,
    addSmartBreaks = true
  } = options;
  
  let processedText = text;
  
  // Step 1: Fix common issues first
  processedText = fixCommonIssues(processedText);
  
  // Step 2: Add smart line breaks if requested
  if (addSmartBreaks && !preserveOriginalStructure) {
    processedText = addSmartLineBreaks(processedText, options);
  }
  
  // Step 3: Enhance readability
  if (shouldEnhanceReadability) {
    processedText = enhanceReadability(processedText, options);
  }
  
  // Step 4: Content-type specific processing
  switch (contentType) {
    case 'clinical':
    case 'drug-info':
      // Extract and better format clinical sections
      const clinicalSections = extractClinicalSections(processedText);
      if (clinicalSections.length > 0) {
        // Restructure text with properly formatted sections
        let structuredText = processedText;
        clinicalSections.forEach(section => {
          const sectionRegex = new RegExp(`(${section.title}:?\\s*${section.content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          structuredText = structuredText.replace(sectionRegex, `\n### ${section.title}\n\n${section.content}\n`);
        });
        processedText = structuredText;
      }
      break;
      
    case 'meeting-notes':
      // Specific formatting for meeting notes
      processedText = processedText
        .replace(/^(MEETING\s+(?:MINUTES|NOTES))/gmi, '# $1')
        .replace(/^(DATE|TIME|VENUE|CHAIR|ATTENDEES|AGENDA|DECISIONS|ACTIONS?):/gmi, '\n## $1:\n')
        .replace(/^(Action\s+Items?):/gmi, '\n## Action Items:\n');
      break;
  }
  
  // Final cleanup
  return processedText
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Quick format detection to suggest best formatting options
 */
export function detectContentType(text: string): TextFormatterOptions['contentType'] {
  const lowerText = text.toLowerCase();
  
  // Check for clinical/medical content
  if (lowerText.match(/\b(dosing|dose|contraindications|side effects|drug|medication|patient|clinical|mg|ml)\b/)) {
    return 'clinical';
  }
  
  // Check for meeting content
  if (lowerText.match(/\b(meeting|minutes|attendees|agenda|decisions|action items|chair|venue)\b/)) {
    return 'meeting-notes';
  }
  
  return 'general';
}
/**
 * Medical Text Processor for GP Dictation
 * Corrects common transcription errors and standardises medical terminology
 * Uses British English spelling throughout
 */

// Pattern corrections for medical transcription
const medicalCorrections: Array<{ pattern: RegExp; replacement: string }> = [
  // Remove duplicate word-number BP readings (words followed by numeric BP)
  // e.g., "one hundred and thirty six over seventy four Her blood pressure was 136/74" → "blood pressure was 136/74"
  { pattern: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|and)[\w\s-]*?\s+over\s+[\w\s-]*?(?=\s*(?:her|his|the|my|patient|blood|bp)\s)/gi, replacement: '' },
  
  // Clean up any remaining word-number duplicates before numeric BP
  { pattern: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|and)[\w\s-]*?\s+over\s+[\w\s-]*?(?=\s*\d{2,3}\/\d{2,3})/gi, replacement: '' },

  // Blood pressure patterns: "125M74" → "125/74"
  { pattern: /(\d{2,3})M(\d{2,3})/g, replacement: '$1/$2' },
  { pattern: /(\d{2,3}) M (\d{2,3})/g, replacement: '$1/$2' },
  { pattern: /(\d{2,3})m(\d{2,3})/g, replacement: '$1/$2' },
  { pattern: /(\d{2,3}) m (\d{2,3})/g, replacement: '$1/$2' },
  
  // "over" in blood pressure context - keep as spoken for readability
  // Only convert when it's clearly BP format (2-3 digit numbers)
  { pattern: /(\d{2,3})\s+over\s+(\d{2,3})/gi, replacement: '$1/$2' },
  
  // Common spacing issues with slashes
  { pattern: /(\d{2,3})\s*\/\s*(\d{2,3})/g, replacement: '$1/$2' },
  
  // Unit standardisation (preserve case-insensitive matching, output standard form)
  { pattern: /\b(\d+)\s*mg\b/gi, replacement: '$1mg' },
  { pattern: /\b(\d+)\s*mcg\b/gi, replacement: '$1mcg' },
  { pattern: /\b(\d+)\s*ml\b/gi, replacement: '$1ml' },
  { pattern: /\b(\d+)\s*mmol\b/gi, replacement: '$1mmol' },
  { pattern: /\b(\d+)\s*mmHg\b/gi, replacement: '$1mmHg' },
  { pattern: /\b(\d+)\s*kg\b/gi, replacement: '$1kg' },
  { pattern: /\b(\d+)\s*cm\b/gi, replacement: '$1cm' },
  { pattern: /\b(\d+)\s*bpm\b/gi, replacement: '$1bpm' },
  
  // Spelled out units to abbreviations
  { pattern: /\b(\d+)\s*milligrams?\b/gi, replacement: '$1mg' },
  { pattern: /\b(\d+)\s*micrograms?\b/gi, replacement: '$1mcg' },
  { pattern: /\b(\d+)\s*millilitres?\b/gi, replacement: '$1ml' },
  { pattern: /\b(\d+)\s*milliliters?\b/gi, replacement: '$1ml' },
  { pattern: /\b(\d+)\s*kilograms?\b/gi, replacement: '$1kg' },
  { pattern: /\b(\d+)\s*centimetres?\b/gi, replacement: '$1cm' },
  { pattern: /\b(\d+)\s*centimeters?\b/gi, replacement: '$1cm' },
  
  // Medical abbreviation standardisation
  { pattern: /\bb\.?p\.?\s*(?:is|of|at)?\s*(\d)/gi, replacement: 'BP $1' },
  { pattern: /\bh\.?r\.?\s*(?:is|of|at)?\s*(\d)/gi, replacement: 'HR $1' },
  { pattern: /\bsp\s*o\s*2\b/gi, replacement: 'SpO2' },
  { pattern: /\bspo2\b/gi, replacement: 'SpO2' },
  { pattern: /\bb\.?m\.?i\.?\b/gi, replacement: 'BMI' },
  { pattern: /\be\.?c\.?g\.?\b/gi, replacement: 'ECG' },
  { pattern: /\bg\.?p\.?\b/gi, replacement: 'GP' },
  { pattern: /\bn\.?h\.?s\.?\b/gi, replacement: 'NHS' },
  
  // British spelling corrections (American → British)
  { pattern: /\borganization\b/gi, replacement: 'organisation' },
  { pattern: /\borganizations\b/gi, replacement: 'organisations' },
  { pattern: /\borganize\b/gi, replacement: 'organise' },
  { pattern: /\borganized\b/gi, replacement: 'organised' },
  { pattern: /\borganizing\b/gi, replacement: 'organising' },
  { pattern: /\bspecialize\b/gi, replacement: 'specialise' },
  { pattern: /\bspecialized\b/gi, replacement: 'specialised' },
  { pattern: /\bspecializing\b/gi, replacement: 'specialising' },
  { pattern: /\brecognize\b/gi, replacement: 'recognise' },
  { pattern: /\brecognized\b/gi, replacement: 'recognised' },
  { pattern: /\brecognizing\b/gi, replacement: 'recognising' },
  { pattern: /\banalyze\b/gi, replacement: 'analyse' },
  { pattern: /\banalyzed\b/gi, replacement: 'analysed' },
  { pattern: /\banalyzing\b/gi, replacement: 'analysing' },
  { pattern: /\bhemoglobin\b/gi, replacement: 'haemoglobin' },
  { pattern: /\bhemorrhage\b/gi, replacement: 'haemorrhage' },
  { pattern: /\banemia\b/gi, replacement: 'anaemia' },
  { pattern: /\banemic\b/gi, replacement: 'anaemic' },
  { pattern: /\bpediatric\b/gi, replacement: 'paediatric' },
  { pattern: /\bpediatrics\b/gi, replacement: 'paediatrics' },
  { pattern: /\bgynecology\b/gi, replacement: 'gynaecology' },
  { pattern: /\bgynecological\b/gi, replacement: 'gynaecological' },
  { pattern: /\bestrogen\b/gi, replacement: 'oestrogen' },
  { pattern: /\bedema\b/gi, replacement: 'oedema' },
  { pattern: /\besophagus\b/gi, replacement: 'oesophagus' },
  { pattern: /\besophageal\b/gi, replacement: 'oesophageal' },
  { pattern: /\bfetus\b/gi, replacement: 'foetus' },
  { pattern: /\bfetal\b/gi, replacement: 'foetal' },
  { pattern: /\bdiarrhea\b/gi, replacement: 'diarrhoea' },
  { pattern: /\bcenter\b/gi, replacement: 'centre' },
  { pattern: /\bcenters\b/gi, replacement: 'centres' },
  { pattern: /\bfiber\b/gi, replacement: 'fibre' },
  { pattern: /\bfibers\b/gi, replacement: 'fibres' },
  { pattern: /\blabor\b/gi, replacement: 'labour' },
  { pattern: /\btumor\b/gi, replacement: 'tumour' },
  { pattern: /\btumors\b/gi, replacement: 'tumours' },
  { pattern: /\bcolor\b/gi, replacement: 'colour' },
  { pattern: /\bcolored\b/gi, replacement: 'coloured' },
  { pattern: /\bfavor\b/gi, replacement: 'favour' },
  { pattern: /\bfavorable\b/gi, replacement: 'favourable' },
  
  // Common transcription fixes
  { pattern: /\bpercent\b/gi, replacement: '%' },
  { pattern: /\bper cent\b/gi, replacement: '%' },
  
  // Temperature with degrees
  { pattern: /(\d+(?:\.\d+)?)\s*degrees?\s*(?:celsius|centigrade|c)\b/gi, replacement: '$1°C' },
  { pattern: /(\d+(?:\.\d+)?)\s*°\s*c\b/gi, replacement: '$1°C' },
  
  // Clean up extra whitespace that may result from removals
  { pattern: /\s{2,}/g, replacement: ' ' },
];

/**
 * Process transcribed text to correct common medical transcription errors
 * and standardise to British English medical terminology
 */
export function processMedicalText(text: string): string {
  if (!text) return text;
  
  let processed = text;
  
  for (const { pattern, replacement } of medicalCorrections) {
    processed = processed.replace(pattern, replacement);
  }
  
  return processed;
}

/**
 * Check if text contains potential medical content
 * Useful for conditional processing
 */
export function containsMedicalContent(text: string): boolean {
  const medicalIndicators = [
    /\d{2,3}\s*(?:over|\/|m)\s*\d{2,3}/i, // Blood pressure
    /\b(?:mg|mcg|ml|mmol|bpm)\b/i, // Units
    /\b(?:bp|hr|spo2|bmi|ecg)\b/i, // Abbreviations
    /\b(?:patient|diagnosis|symptoms?|examination|treatment)\b/i, // Clinical terms
    /\b(?:paracetamol|ibuprofen|amoxicillin|metformin|omeprazole)\b/i, // Common drugs
  ];
  
  return medicalIndicators.some(pattern => pattern.test(text));
}

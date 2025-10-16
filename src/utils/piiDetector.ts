/**
 * PII Detection and Management Utility
 */

export interface PIIMatch {
  type: 'name' | 'nhs_number' | 'dob' | 'postcode' | 'phone' | 'email' | 'address';
  value: string;
  start: number;
  end: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface PIIDetectionResult {
  matches: PIIMatch[];
  text: string;
}

/**
 * NHS number pattern: 10 digits with specific format
 */
const NHS_NUMBER_PATTERN = /\b\d{3}\s?\d{3}\s?\d{4}\b/g;

/**
 * UK postcode patterns
 */
const POSTCODE_PATTERN = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi;

/**
 * Phone number patterns (UK)
 */
const PHONE_PATTERN = /\b(?:(?:\+44\s?|0)(?:\d\s?){9,10})\b/g;

/**
 * Email pattern
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Date patterns that might be DOB
 */
const DOB_PATTERN = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2,4}[/-]\d{1,2}[/-]\d{1,2})\b/g;

/**
 * Common UK name patterns (simple heuristic)
 */
const NAME_INDICATORS = [
  'Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Professor', 'patient', 'patient\'s',
  'called', 'named', 'regarding', 'about'
];

/**
 * Detect PII in text
 */
export function detectPII(text: string, options: {
  detectNames?: boolean;
  detectNHSNumbers?: boolean;
  detectDOB?: boolean;
  detectPostcodes?: boolean;
  detectPhones?: boolean;
  detectEmails?: boolean;
} = {}): PIIDetectionResult {
  const {
    detectNames = true,
    detectNHSNumbers = true,
    detectDOB = true,
    detectPostcodes = true,
    detectPhones = true,
    detectEmails = true
  } = options;

  const matches: PIIMatch[] = [];

  // Detect NHS numbers
  if (detectNHSNumbers) {
    let match;
    const regex = new RegExp(NHS_NUMBER_PATTERN);
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: 'nhs_number',
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 'high'
      });
    }
  }

  // Detect postcodes
  if (detectPostcodes) {
    let match;
    const regex = new RegExp(POSTCODE_PATTERN);
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: 'postcode',
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 'high'
      });
    }
  }

  // Detect phone numbers
  if (detectPhones) {
    let match;
    const regex = new RegExp(PHONE_PATTERN);
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: 'phone',
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 'high'
      });
    }
  }

  // Detect emails
  if (detectEmails) {
    let match;
    const regex = new RegExp(EMAIL_PATTERN);
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: 'email',
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 'high'
      });
    }
  }

  // Detect dates (potential DOB)
  if (detectDOB) {
    let match;
    const regex = new RegExp(DOB_PATTERN);
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: 'dob',
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 'medium'
      });
    }
  }

  // Detect potential names (simple heuristic - capitalized words after indicators)
  if (detectNames) {
    const words = text.split(/\s+/);
    let currentIndex = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const prevWord = i > 0 ? words[i - 1] : '';
      
      // Check if previous word is a name indicator
      if (NAME_INDICATORS.some(indicator => 
        prevWord.toLowerCase().includes(indicator.toLowerCase())
      )) {
        // Next 1-3 capitalized words might be a name
        const nameWords = [];
        for (let j = i; j < Math.min(i + 3, words.length); j++) {
          if (/^[A-Z][a-z]+$/.test(words[j])) {
            nameWords.push(words[j]);
          } else {
            break;
          }
        }

        if (nameWords.length > 0) {
          const fullName = nameWords.join(' ');
          const nameStart = text.indexOf(fullName, currentIndex);
          if (nameStart !== -1) {
            matches.push({
              type: 'name',
              value: fullName,
              start: nameStart,
              end: nameStart + fullName.length,
              confidence: 'medium'
            });
          }
        }
      }

      currentIndex += word.length + 1;
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  return { matches, text };
}

/**
 * Mask PII in text
 */
export function maskPII(text: string, match: PIIMatch): string {
  const before = text.substring(0, match.start);
  const after = text.substring(match.end);
  
  let masked = '';
  switch (match.type) {
    case 'nhs_number':
      masked = '***-***-****';
      break;
    case 'phone':
      masked = '***********';
      break;
    case 'email':
      masked = '***@***.***';
      break;
    case 'postcode':
      masked = '*** ***';
      break;
    case 'dob':
      masked = '**/**/****';
      break;
    case 'name':
      masked = '[REDACTED]';
      break;
    default:
      masked = '[REDACTED]';
  }

  return before + masked + after;
}

/**
 * Remove PII from text
 */
export function removePII(text: string, match: PIIMatch): string {
  const before = text.substring(0, match.start);
  const after = text.substring(match.end);
  return (before + after).replace(/\s+/g, ' ').trim();
}

/**
 * Highlight PII in text for display (returns array of text segments)
 */
export function highlightPII(text: string, matches: PIIMatch[]): Array<{
  text: string;
  isPII: boolean;
  match?: PIIMatch;
}> {
  if (matches.length === 0) {
    return [{ text, isPII: false }];
  }

  const segments: Array<{ text: string; isPII: boolean; match?: PIIMatch }> = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before PII
    if (match.start > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.start),
        isPII: false
      });
    }

    // Add PII segment
    segments.push({
      text: match.value,
      isPII: true,
      match
    });

    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isPII: false
    });
  }

  return segments;
}

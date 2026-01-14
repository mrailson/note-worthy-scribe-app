/**
 * Letter Parser Utility
 * Parses AI-generated letter content to extract structured sections
 * for professional display and Word document generation.
 */

export interface ParsedLetter {
  isLetter: boolean;
  headerSection: {
    to?: string;
    from?: string;
    toLines?: string[];
    fromLines?: string[];
  };
  date?: string;
  recipient: {
    name?: string;
    title?: string;
    organisation?: string;
    address?: string[];
  };
  subject?: string;
  salutation?: string;
  bodyParagraphs: string[];
  closing?: string;
  signature: {
    name?: string;
    title?: string;
    qualifications?: string;
    organisation?: string;
  };
  rawContent: string;
}

/**
 * Detects if content appears to be a letter format
 */
export const isLetterFormat = (content: string): boolean => {
  if (!content) return false;
  
  const letterIndicators = [
    /^(\*\*)?To:/im,
    /^(\*\*)?From:/im,
    /\bDear\s+(?:Dr|Mr|Mrs|Ms|Miss|Professor|Prof\.|Sir|Madam)/i,
    /\bDear\s+[A-Z][a-z]+/i,
    /yours\s+(?:sincerely|faithfully|truly)/i,
    /kind\s+regards/i,
    /best\s+wishes/i,
    /^Re:\s+/im,
    /^Subject:\s+/im,
  ];
  
  const matchCount = letterIndicators.filter(pattern => pattern.test(content)).length;
  return matchCount >= 2;
};

/**
 * Basic HTML entity decoding (covers named + numeric entities)
 */
const decodeHtmlEntities = (input: string): string => {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      if (!Number.isFinite(code)) return _m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _m;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return _m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _m;
      }
    });
};

/**
 * Strips HTML into readable plain text while preserving paragraph breaks.
 */
export const stripHtmlToText = (input: string): string => {
  if (!input) return '';

  const withBreaks = input
    // Normalise line breaks
    .replace(/\r\n/g, "\n")
    // Paragraph-ish breaks
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    // List items
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    // Drop style/script blocks entirely
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  const decoded = decodeHtmlEntities(withoutTags);

  return decoded
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Cleans markdown formatting from text (and strips any stray HTML)
 */
export const cleanMarkdownText = (text: string): string => {
  if (!text) return '';

  const looksLikeHtml = /<\s*[a-z][\s\S]*>/i.test(text);
  const base = looksLikeHtml ? stripHtmlToText(text) : text;

  return base
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, '$1') // Remove bold+italic
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')       // Remove bold
    .replace(/\*([^*\n]+)\*/g, '$1')              // Remove italic
    .replace(/`([^`]+)`/g, '$1')                    // Remove code
    .replace(/#{1,6}\s+/g, '')                      // Remove heading markers
    .replace(/^[-•]\s+/gm, '')                      // Remove bullet points
    .replace(/^\d+\.\s+/gm, '')                    // Remove numbered list markers
    .replace(/[ \t]+/g, ' ')
    .trim();
};

/**
 * Extracts date from letter content
 */
const extractDate = (content: string): string | undefined => {
  // Match common date formats
  const datePatterns = [
    // "14th January 2026", "14 January 2026"
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    // "14/01/2026", "14-01-2026"
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    // "January 14, 2026"
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  
  return undefined;
};

/**
 * Extracts the salutation from letter content
 */
const extractSalutation = (content: string): string | undefined => {
  const match = content.match(/^(Dear\s+[^,\n]+),?/im);
  return match ? cleanMarkdownText(match[1]) : undefined;
};

/**
 * Extracts the closing from letter content
 */
const extractClosing = (content: string): string | undefined => {
  const closingPatterns = [
    /^(Yours\s+sincerely),?/im,
    /^(Yours\s+faithfully),?/im,
    /^(Kind\s+regards),?/im,
    /^(Best\s+wishes),?/im,
    /^(With\s+best\s+wishes),?/im,
    /^(Many\s+thanks),?/im,
  ];
  
  for (const pattern of closingPatterns) {
    const match = content.match(pattern);
    if (match) return cleanMarkdownText(match[1]);
  }
  
  return undefined;
};

/**
 * Extracts subject line from letter
 */
const extractSubject = (content: string): string | undefined => {
  const patterns = [
    /^(?:\*\*)?Re:\s*(?:\*\*)?(.+?)(?:\*\*)?$/im,
    /^(?:\*\*)?Subject:\s*(?:\*\*)?(.+?)(?:\*\*)?$/im,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return cleanMarkdownText(match[1]);
  }
  
  return undefined;
};

/**
 * Extracts To/From header sections
 */
const extractHeaders = (content: string): ParsedLetter['headerSection'] => {
  const result: ParsedLetter['headerSection'] = {};
  
  // Extract "To:" section
  const toMatch = content.match(/^(?:\*\*)?To:(?:\*\*)?\s*(.+?)(?=\n(?:\*\*)?From:|$|\n\n)/ims);
  if (toMatch) {
    result.to = cleanMarkdownText(toMatch[1].trim());
    result.toLines = toMatch[1].split('\n')
      .map(line => cleanMarkdownText(line.trim()))
      .filter(line => line && !line.match(/^To:$/i));
  }
  
  // Extract "From:" section
  const fromMatch = content.match(/^(?:\*\*)?From:(?:\*\*)?\s*(.+?)(?=\n\n|\nDear|\n(?:\*\*)?Re:|\n(?:\*\*)?Subject:)/ims);
  if (fromMatch) {
    result.from = cleanMarkdownText(fromMatch[1].trim());
    result.fromLines = fromMatch[1].split('\n')
      .map(line => cleanMarkdownText(line.trim()))
      .filter(line => line && !line.match(/^From:$/i));
  }
  
  return result;
};

/**
 * Extracts signature block from letter
 */
const extractSignature = (content: string): ParsedLetter['signature'] => {
  const signature: ParsedLetter['signature'] = {};

  const looksLikeName = (line: string) =>
    /^(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Professor|Prof\.?|Miss)\s+/i.test(line) ||
    /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(line);

  const isValediction = (line: string) =>
    /^(?:yours\s+(?:sincerely|faithfully|truly)|kind\s+regards|regards|best\s+wishes|with\s+best\s+wishes|many\s+thanks)$/i.test(
      line.trim().replace(/[,\.]$/, '')
    );

  const isContactLine = (line: string) =>
    /^(?:mob|mobile|tel|telephone|phone|email|fax)\s*:/i.test(line) ||
    /^\+?\d[\d\s()+-]{7,}$/.test(line);

  // Look for content after closing phrase
  const closingIndex = content.search(/yours\s+(?:sincerely|faithfully|truly)|kind\s+regards|best\s+wishes/i);
  if (closingIndex === -1) return signature;

  const afterClosingRaw = content.substring(closingIndex);
  const afterClosingText = stripHtmlToText(afterClosingRaw);

  // Remove the closing line itself from the start
  const withoutClosing = afterClosingText
    .replace(/^(?:yours\s+(?:sincerely|faithfully|truly)|kind\s+regards|best\s+wishes)\s*,?\s*/i, '')
    .trim();

  const lines = withoutClosing
    .split(/\n+/)
    .map(l => cleanMarkdownText(l.trim()))
    .map(l => l.replace(/^•\s*/, '').trim())
    .filter(Boolean)
    .filter(l => !isValediction(l))
    .filter(l => !isContactLine(l));

  if (!lines.length) return signature;

  const nameLine = lines.find(looksLikeName) ?? lines[0];
  signature.name = nameLine;

  const remaining = lines.filter(l => l !== nameLine);

  // Qualifications
  const qualLine = remaining.find(l => l.match(/(?:MB|ChB|MRCGP|FRCGP|MRCP|FRCP|MD|PhD|BSc|MSc)/i));
  if (qualLine) signature.qualifications = qualLine;

  // Title / role
  const titleLine = remaining.find(l =>
    l !== qualLine &&
    l.match(/^(?:GP|General\s+Practitioner|Doctor|Consultant|Partner|Locum|Salaried|Registrar)/i)
  );
  if (titleLine) signature.title = titleLine;

  // Organisation
  const orgLine = remaining.find(l =>
    l !== qualLine &&
    l !== titleLine &&
    (l.match(/(?:surgery|practice|medical|health|centre|center|clinic)/i) || /^[A-Z]/.test(l))
  );
  if (orgLine) signature.organisation = orgLine;

  return signature;
};

/**
 * Extracts body paragraphs from letter content
 */
const extractBodyParagraphs = (content: string): string[] => {
  // Find the body section (between salutation and closing)
  const salutationMatch = content.match(/Dear\s+[^,\n]+,?\s*\n/i);
  const closingMatch = content.match(/\n\s*(?:Yours\s+(?:sincerely|faithfully)|Kind\s+regards|Best\s+wishes)/i);
  
  let body = content;
  
  if (salutationMatch) {
    const startIndex = content.indexOf(salutationMatch[0]) + salutationMatch[0].length;
    body = content.substring(startIndex);
  }
  
  if (closingMatch) {
    const endIndex = body.indexOf(closingMatch[0]);
    if (endIndex !== -1) {
      body = body.substring(0, endIndex);
    }
  }
  
  // Split into paragraphs and clean
  const paragraphs = body
    .split(/\n\n+/)
    .map(p => cleanMarkdownText(p.trim()))
    .filter(p => {
      if (!p) return false;
      // Filter out header lines that might be in body
      if (p.match(/^(?:To|From|Re|Subject):/i)) return false;
      // Filter out date-only paragraphs
      if (p.match(/^\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i)) return false;
      return true;
    });
  
  return paragraphs;
};

/**
 * Parses letter content into structured sections
 */
export const parseLetter = (content: string): ParsedLetter => {
  if (!content) {
    return {
      isLetter: false,
      headerSection: {},
      recipient: {},
      bodyParagraphs: [],
      signature: {},
      rawContent: ''
    };
  }
  
  const isLetter = isLetterFormat(content);
  
  return {
    isLetter,
    headerSection: extractHeaders(content),
    date: extractDate(content),
    recipient: {
      // Auto-detect recipient from To: section or salutation
      name: extractSalutation(content)?.replace(/^Dear\s+/i, ''),
    },
    subject: extractSubject(content),
    salutation: extractSalutation(content),
    bodyParagraphs: extractBodyParagraphs(content),
    closing: extractClosing(content),
    signature: extractSignature(content),
    rawContent: content
  };
};

/**
 * Converts parsed letter back to formatted text for display
 */
export const formatLetterForDisplay = (parsed: ParsedLetter): string => {
  const parts: string[] = [];
  
  if (parsed.headerSection.to) {
    parts.push(`To: ${parsed.headerSection.to}`);
  }
  
  if (parsed.headerSection.from) {
    parts.push(`From: ${parsed.headerSection.from}`);
  }
  
  if (parsed.date) {
    parts.push('');
    parts.push(parsed.date);
  }
  
  if (parsed.subject) {
    parts.push('');
    parts.push(`Re: ${parsed.subject}`);
  }
  
  if (parsed.salutation) {
    parts.push('');
    parts.push(`${parsed.salutation},`);
  }
  
  if (parsed.bodyParagraphs.length > 0) {
    parts.push('');
    parts.push(...parsed.bodyParagraphs.map(p => p + '\n'));
  }
  
  if (parsed.closing) {
    parts.push('');
    parts.push(`${parsed.closing},`);
  }
  
  if (parsed.signature.name) {
    parts.push('');
    parts.push(parsed.signature.name);
    if (parsed.signature.qualifications) {
      parts.push(parsed.signature.qualifications);
    }
    if (parsed.signature.title) {
      parts.push(parsed.signature.title);
    }
    if (parsed.signature.organisation) {
      parts.push(parsed.signature.organisation);
    }
  }
  
  return parts.join('\n');
};

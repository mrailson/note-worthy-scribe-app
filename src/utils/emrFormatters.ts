import { format } from 'date-fns';

interface SoapNote {
  S: string;
  O: string;
  A: string;
  P: string;
}

interface HeidiNote {
  consultationHeader: string;
  history: string;
  examination: string;
  impression: string;
  plan: string;
}

/**
 * Format SOAP notes for EMIS Web
 * Uses structured format with clear section headers and proper spacing
 */
export const formatForEMIS = (
  soapNote: SoapNote,
  section?: keyof SoapNote,
  consultationType?: string
): string => {
  const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
  
  // If copying a single section
  if (section) {
    const sectionHeaders = {
      S: 'HISTORY',
      O: 'EXAMINATION',
      A: 'COMMENT',
      P: 'PLAN'
    };
    return `${sectionHeaders[section]}\n${soapNote[section]}`;
  }
  
  // Full SOAP note for EMIS
  const consultationLabel = consultationType ? ` - ${consultationType}` : '';
  return `Consultation${consultationLabel} - ${timestamp}

HISTORY
${soapNote.S}

EXAMINATION
${soapNote.O}

COMMENT
${soapNote.A}

PLAN
${soapNote.P}`;
};

/**
 * Format Heidi notes for EMIS Web
 */
export const formatHeidiForEMIS = (
  heidiNote: HeidiNote,
  section?: keyof HeidiNote
): string => {
  const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
  
  // If copying a single section
  if (section) {
    const sectionHeaders: Record<keyof HeidiNote, string> = {
      consultationHeader: 'CONSULTATION',
      history: 'HISTORY',
      examination: 'EXAMINATION',
      impression: 'IMPRESSION',
      plan: 'PLAN'
    };
    return heidiNote[section] ? `${sectionHeaders[section]}\n${heidiNote[section]}` : '';
  }
  
  // Full Heidi note for EMIS
  const parts: string[] = [];
  
  if (heidiNote.consultationHeader) {
    parts.push(`${heidiNote.consultationHeader} - ${timestamp}`);
  } else {
    parts.push(`Consultation - ${timestamp}`);
  }
  
  if (heidiNote.history) {
    parts.push(`\nHISTORY\n${heidiNote.history}`);
  }
  
  if (heidiNote.examination) {
    parts.push(`\nEXAMINATION\n${heidiNote.examination}`);
  }
  
  if (heidiNote.impression) {
    parts.push(`\nIMPRESSION\n${heidiNote.impression}`);
  }
  
  if (heidiNote.plan) {
    parts.push(`\nPLAN\n${heidiNote.plan}`);
  }
  
  return parts.join('\n');
};

/**
 * Format SOAP notes for SystmOne/TPP
 * Uses compact format with semicolon separators
 */
export const formatForSystmOne = (
  soapNote: SoapNote,
  section?: keyof SoapNote,
  consultationType?: string
): string => {
  const timestamp = format(new Date(), 'dd-MMM-yyyy HH:mm');
  
  // If copying a single section
  if (section) {
    const content = soapNote[section].replace(/\n+/g, ' ').trim();
    return `${section}: ${content}`;
  }
  
  // Full SOAP note for SystmOne - compact format
  const S = soapNote.S.replace(/\n+/g, ' ').trim();
  const O = soapNote.O.replace(/\n+/g, ' ').trim();
  const A = soapNote.A.replace(/\n+/g, ' ').trim();
  const P = soapNote.P.replace(/\n+/g, ' ').trim();
  
  const consultationLabel = consultationType ? `${consultationType} - ` : '';
  return `${consultationLabel}${timestamp}

S: ${S}; O: ${O}; A: ${A}; P: ${P}`;
};

/**
 * Format Heidi notes for SystmOne/TPP
 * Uses compact format
 */
export const formatHeidiForSystmOne = (
  heidiNote: HeidiNote,
  section?: keyof HeidiNote
): string => {
  const timestamp = format(new Date(), 'dd-MMM-yyyy HH:mm');
  
  // If copying a single section
  if (section) {
    const content = (heidiNote[section] || '').replace(/\n+/g, ' ').trim();
    return content;
  }
  
  // Full Heidi note for SystmOne - compact format
  const parts: string[] = [];
  
  if (heidiNote.consultationHeader) {
    parts.push(`${heidiNote.consultationHeader} - ${timestamp}`);
  } else {
    parts.push(timestamp);
  }
  
  const history = (heidiNote.history || '').replace(/\n+/g, ' ').trim();
  const examination = (heidiNote.examination || '').replace(/\n+/g, ' ').trim();
  const impression = (heidiNote.impression || '').replace(/\n+/g, ' ').trim();
  const plan = (heidiNote.plan || '').replace(/\n+/g, ' ').trim();
  
  const clinicalParts: string[] = [];
  if (history) clinicalParts.push(`Hx: ${history}`);
  if (examination) clinicalParts.push(`Ex: ${examination}`);
  if (impression) clinicalParts.push(`Imp: ${impression}`);
  if (plan) clinicalParts.push(`Plan: ${plan}`);
  
  if (clinicalParts.length > 0) {
    parts.push(clinicalParts.join('; '));
  }
  
  return parts.join('\n');
};

/**
 * Format SOAP notes based on EMR system selection
 */
export const formatSoapNote = (
  emrFormat: 'emis' | 'systmone',
  soapNote: SoapNote,
  section?: keyof SoapNote,
  consultationType?: string
): string => {
  if (emrFormat === 'emis') {
    return formatForEMIS(soapNote, section, consultationType);
  } else {
    return formatForSystmOne(soapNote, section, consultationType);
  }
};

/**
 * Format Heidi notes based on EMR system selection
 */
export const formatHeidiNote = (
  emrFormat: 'emis' | 'systmone',
  heidiNote: HeidiNote,
  section?: keyof HeidiNote
): string => {
  if (emrFormat === 'emis') {
    return formatHeidiForEMIS(heidiNote, section);
  } else {
    return formatHeidiForSystmOne(heidiNote, section);
  }
};

import { format } from 'date-fns';

interface SoapNote {
  S: string;
  O: string;
  A: string;
  P: string;
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

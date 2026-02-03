/**
 * Shared utility functions for extracting patient demographics from clinical systems
 * (EMIS, SystmOne, Vision) - reused patterns from useScribeAppointments.ts
 */

import { parse, isValid, format } from 'date-fns';

export interface PatientDemographics {
  patient_name?: string;
  patient_dob?: string;
  patient_nhs_number?: string;
  patient_contact_phone?: string;
  patient_contact_email?: string;
  patient_address?: string;
}

/**
 * Extract NHS Number from text (10 digits, possibly with spaces)
 * Formats: 123 456 7890, 1234567890, NHS: 123 456 7890
 */
export function extractNHSNumber(text: string): string | null {
  // Try NHS: prefix first
  const nhsMatch = text.match(/NHS[:\s]*(\d[\d\s]{8,11}\d)/i);
  if (nhsMatch) {
    return nhsMatch[1].replace(/\s/g, '');
  }
  
  // Try standalone 10-digit pattern
  const standaloneMatch = text.match(/\b(\d{3}\s?\d{3}\s?\d{4})\b/);
  if (standaloneMatch) {
    const cleaned = standaloneMatch[1].replace(/\s/g, '');
    // Make sure it's exactly 10 digits
    if (cleaned.length === 10) {
      return cleaned;
    }
  }
  
  return null;
}

/**
 * Extract Date of Birth from text
 * Formats: DD Mon YYYY, DD/MM/YYYY, DD-MM-YYYY
 */
export function extractDateOfBirth(text: string): string | null {
  // Try DD Mon YYYY format (01 Jan 1990)
  const dobMonthMatch = text.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})\b/i);
  if (dobMonthMatch) {
    try {
      const parsedDate = parse(dobMonthMatch[1], 'd MMM yyyy', new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    } catch (e) {
      // Try full month name
      try {
        const parsedDate = parse(dobMonthMatch[1], 'd MMMM yyyy', new Date());
        if (isValid(parsedDate)) {
          return format(parsedDate, 'yyyy-MM-dd');
        }
      } catch (e2) {
        // Ignore
      }
    }
  }
  
  // Try DD/MM/YYYY format
  const dobSlashMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (dobSlashMatch) {
    try {
      const parsedDate = parse(dobSlashMatch[1], 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Try DD-MM-YYYY format
  const dobDashMatch = text.match(/\b(\d{1,2}-\d{1,2}-\d{4})\b/);
  if (dobDashMatch) {
    try {
      const parsedDate = parse(dobDashMatch[1], 'dd-MM-yyyy', new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return null;
}

/**
 * Extract patient name with title from text
 * Formats: Mr John Smith, Mrs. Jane Doe, Dr Smith
 */
export function extractPatientName(text: string): string | null {
  // Try to match title + name patterns
  const nameMatch = text.match(/((?:Mr|Mrs|Miss|Ms|Dr|Master)\.?\s+[\w\s'-]+?)(?:\s+NHS|$|\d{2}\s+\w{3}\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|,|\n)/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    // Filter out obviously wrong matches
    if (name.length > 3 && name.length < 100) {
      return name;
    }
  }
  
  // Try Name: or Patient: prefix
  const prefixMatch = text.match(/(?:Name|Patient)[:\s]+([A-Za-z\s'-]+?)(?:,|\n|DOB|NHS|Address|Phone)/i);
  if (prefixMatch) {
    const name = prefixMatch[1].trim();
    if (name.length > 3 && name.length < 100) {
      return name;
    }
  }
  
  return null;
}

/**
 * Extract phone number from text
 * Formats: 07xxx, 01234 567890, +44xxx
 */
export function extractPhoneNumber(text: string): string | null {
  // Mobile number (07xxx)
  const mobileMatch = text.match(/\b(07\d{3}\s?\d{3}\s?\d{3})\b/);
  if (mobileMatch) {
    return mobileMatch[1].replace(/\s/g, '');
  }
  
  // Landline with area code
  const landlineMatch = text.match(/\b(0\d{3,4}\s?\d{3}\s?\d{3,4})\b/);
  if (landlineMatch) {
    return landlineMatch[1].replace(/\s/g, '');
  }
  
  // +44 format
  const intlMatch = text.match(/(\+44\s?\d{3,4}\s?\d{3}\s?\d{3,4})/);
  if (intlMatch) {
    return intlMatch[1].replace(/\s/g, '');
  }
  
  return null;
}

/**
 * Extract email address from text
 */
export function extractEmail(text: string): string | null {
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }
  return null;
}

/**
 * Extract address and postcode from text
 */
export function extractAddress(text: string): { address: string | null; postcode: string | null } {
  // Extract UK postcode
  const postcodeMatch = text.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i);
  const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : null;
  
  // Try to get address from Address: prefix
  const addressPrefixMatch = text.match(/Address[:\s]+([^\n]+?)(?:\n|$)/i);
  if (addressPrefixMatch) {
    let address = addressPrefixMatch[1].trim();
    // Clean up the address
    address = address
      .replace(/\b(0\d{3,4}\s?\d{3}\s?\d{3,4})\b/g, '') // Remove phone numbers
      .replace(/NHS[:\s]*\d[\d\s]{8,11}\d/gi, '') // Remove NHS numbers
      .trim();
    if (address) {
      return { address, postcode };
    }
  }
  
  // If we have a postcode, try to extract text before it as address
  if (postcode) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toUpperCase().includes(postcode)) {
        const beforePostcode = line.split(new RegExp(postcode.replace(/\s/g, '\\s*'), 'i'))[0];
        if (beforePostcode && beforePostcode.length > 10) {
          let address = beforePostcode
            .replace(/\b(0\d{3,4}\s?\d{3}\s?\d{3,4})\b/g, '')
            .replace(/NHS[:\s]*\d[\d\s]{8,11}\d/gi, '')
            .replace(/\d{1,2}\s+\w{3}\s+\d{4}/gi, '')
            .trim();
          if (address) {
            return { address: address + ' ' + postcode, postcode };
          }
        }
      }
    }
  }
  
  return { address: null, postcode };
}

/**
 * Parse all patient demographics from text
 * Combines all extraction functions
 */
export function parsePatientDemographics(text: string): PatientDemographics {
  const nhsNumber = extractNHSNumber(text);
  const dob = extractDateOfBirth(text);
  const name = extractPatientName(text);
  const phone = extractPhoneNumber(text);
  const email = extractEmail(text);
  const { address } = extractAddress(text);
  
  return {
    patient_name: name || undefined,
    patient_dob: dob || undefined,
    patient_nhs_number: nhsNumber || undefined,
    patient_contact_phone: phone || undefined,
    patient_contact_email: email || undefined,
    patient_address: address || undefined
  };
}

/**
 * Format NHS number for display (with spaces)
 */
export function formatNHSNumber(nhsNumber: string): string {
  const cleaned = nhsNumber.replace(/\s/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return nhsNumber;
}

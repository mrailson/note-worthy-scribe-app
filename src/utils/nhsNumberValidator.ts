/**
 * NHS Number Validator
 * Validates UK NHS numbers using the Modulus 11 checksum algorithm
 */

export interface NHSValidationResult {
  valid: boolean;
  error?: string;
  formatted?: string;
}

export function validateNHSNumber(nhs: string | null | undefined): NHSValidationResult {
  // Remove all whitespace and hyphens
  const cleaned = (nhs ?? '').replace(/[\s-]/g, '');
  
  // Check length
  if (cleaned.length === 0) {
    return { valid: false, error: 'NHS number is required' };
  }
  
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'NHS number must contain only digits' };
  }
  
  if (cleaned.length !== 10) {
    return { valid: false, error: 'NHS number must be 10 digits' };
  }
  
  // Modulus 11 checksum validation
  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i], 10) * weights[i];
  }
  
  const remainder = sum % 11;
  const checkDigit = 11 - remainder;
  
  // Check digit of 11 becomes 0, check digit of 10 is invalid
  if (checkDigit === 10) {
    return { valid: false, error: 'Invalid NHS number checksum' };
  }
  
  const expectedCheckDigit = checkDigit === 11 ? 0 : checkDigit;
  const actualCheckDigit = parseInt(cleaned[9], 10);
  
  if (expectedCheckDigit !== actualCheckDigit) {
    return { valid: false, error: 'Invalid NHS number checksum' };
  }
  
  // Format as XXX XXX XXXX
  const formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  
  return { valid: true, formatted };
}

export function formatNHSNumber(nhs: string | null | undefined): string {
  const cleaned = (nhs ?? '').replace(/[\s-]/g, '');
  if (cleaned.length !== 10) return nhs ?? '';
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
}

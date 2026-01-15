/**
 * NHS-compliant patient data masking utilities
 * Implements PID (Patient Identifiable Data) protection as per NHS guidelines
 */

export interface PatientDataMaskingOptions {
  showFullData?: boolean;
  roleLevel?: 'complaints_handler' | 'system_admin' | 'standard';
}

/**
 * Masks patient name according to NHS guidelines
 */
export function maskPatientName(name: string, options: PatientDataMaskingOptions = {}): string {
  if (options.showFullData && (options.roleLevel === 'complaints_handler' || options.roleLevel === 'system_admin')) {
    return name;
  }
  
  if (!name || name.trim().length === 0) return 'N/A';
  
  const nameParts = name.trim().split(' ');
  if (nameParts.length === 1) {
    // Single name: show first letter + ***
    return nameParts[0].charAt(0).toUpperCase() + '***';
  }
  
  // Multiple names: show first name initial + last name with masking
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  const maskedFirstName = firstName.charAt(0).toUpperCase() + '***';
  const maskedLastName = lastName.length > 1 
    ? lastName.charAt(0).toUpperCase() + '*'.repeat(lastName.length - 1)
    : lastName.toUpperCase();
  
  return `${maskedFirstName} ${maskedLastName}`;
}

/**
 * Masks date of birth - shows only year or age range
 */
export function maskDateOfBirth(dob: string | null, options: PatientDataMaskingOptions = {}): string {
  if (options.showFullData && (options.roleLevel === 'complaints_handler' || options.roleLevel === 'system_admin')) {
    return dob || 'N/A';
  }
  
  if (!dob) return 'N/A';
  
  try {
    // Handle DD/MM/YYYY format (UK format) which new Date() doesn't parse correctly
    let birthDate: Date;
    const ukDateMatch = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ukDateMatch) {
      const [, day, month, year] = ukDateMatch;
      birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      birthDate = new Date(dob);
    }
    
    // Check if the date is valid
    if (isNaN(birthDate.getTime())) {
      return 'N/A';
    }
    
    const currentDate = new Date();
    const age = currentDate.getFullYear() - birthDate.getFullYear();
    
    // Adjust age if birthday hasn't occurred yet this year
    const monthDiff = currentDate.getMonth() - birthDate.getMonth();
    const dayDiff = currentDate.getDate() - birthDate.getDate();
    const adjustedAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age;
    
    // Show age range instead of exact DOB
    const ageRange = Math.floor(adjustedAge / 10) * 10;
    return `${ageRange}-${ageRange + 9} years`;
  } catch {
    return 'N/A';
  }
}

/**
 * Masks phone number
 */
export function maskPhoneNumber(phone: string | null, options: PatientDataMaskingOptions = {}): string {
  if (options.showFullData && (options.roleLevel === 'complaints_handler' || options.roleLevel === 'system_admin')) {
    return phone || 'N/A';
  }
  
  if (!phone || phone.trim().length === 0) return 'N/A';
  
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 6) return '***';
  
  // Show first 2-3 digits and last 3 digits
  const start = cleanPhone.substring(0, 2);
  const end = cleanPhone.substring(cleanPhone.length - 3);
  const middle = '*'.repeat(cleanPhone.length - 5);
  
  return `${start}${middle}${end}`;
}

/**
 * Masks email address
 */
export function maskEmailAddress(email: string | null, options: PatientDataMaskingOptions = {}): string {
  if (options.showFullData && (options.roleLevel === 'complaints_handler' || options.roleLevel === 'system_admin')) {
    return email || 'N/A';
  }
  
  if (!email || email.trim().length === 0) return 'N/A';
  
  const emailParts = email.split('@');
  if (emailParts.length !== 2) return '***@***.***';
  
  const [localPart, domain] = emailParts;
  const domainParts = domain.split('.');
  
  const maskedLocal = localPart.length > 1 
    ? localPart.charAt(0) + '*'.repeat(Math.min(localPart.length - 1, 3))
    : '*';
    
  const maskedDomain = domainParts.length > 1
    ? domainParts[0].charAt(0) + '*'.repeat(Math.min(domainParts[0].length - 1, 2)) + '.' + domainParts[domainParts.length - 1]
    : '***.***';
  
  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Masks postal address - shows only postcode area
 */
export function maskAddress(address: string | null, options: PatientDataMaskingOptions = {}): string {
  if (options.showFullData && (options.roleLevel === 'complaints_handler' || options.roleLevel === 'system_admin')) {
    return address || 'N/A';
  }
  
  if (!address || address.trim().length === 0) return 'N/A';
  
  // Extract postcode pattern (UK format)
  const postcodeRegex = /([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})/i;
  const match = address.match(postcodeRegex);
  
  if (match) {
    const postcodeArea = match[1]; // First part of postcode
    return `${postcodeArea} area`;
  }
  
  // If no postcode found, show generic location
  return '[Address area masked]';
}

/**
 * Checks if user has permission to view full patient data
 */
export function canViewFullPatientData(userRole: string | null): boolean {
  return userRole === 'complaints_handler' || userRole === 'system_admin';
}

/**
 * Gets appropriate role level for masking options
 */
export function getUserRoleLevel(userRole: string | null): PatientDataMaskingOptions['roleLevel'] {
  switch (userRole) {
    case 'system_admin':
      return 'system_admin';
    case 'complaints_handler':
      return 'complaints_handler';
    default:
      return 'standard';
  }
}

/**
 * Comprehensive patient data masking for display
 */
export interface MaskedPatientData {
  name: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
}

export function maskPatientData(
  patient: {
    patient_name: string;
    patient_dob: string | null;
    patient_contact_phone: string | null;
    patient_contact_email: string | null;
    patient_address: string | null;
  },
  options: PatientDataMaskingOptions = {}
): MaskedPatientData {
  return {
    name: maskPatientName(patient.patient_name, options),
    dob: maskDateOfBirth(patient.patient_dob, options),
    phone: maskPhoneNumber(patient.patient_contact_phone, options),
    email: maskEmailAddress(patient.patient_contact_email, options),
    address: maskAddress(patient.patient_address, options)
  };
}

/**
 * Logs access to sensitive patient data
 */
export function logPatientDataAccess(
  complaintId: string, 
  accessType: 'view' | 'full_view' | 'export',
  patientName: string,
  userId: string
): void {
  // Log to console for now - this should integrate with audit system
  console.log('[PID ACCESS LOG]', {
    timestamp: new Date().toISOString(),
    complaintId,
    accessType,
    patientName: maskPatientName(patientName), // Never log full name in access logs
    userId,
    userAgent: navigator.userAgent.substring(0, 100)
  });
}
/**
 * Generates standardised Lloyd George Record filenames
 * Format: Lloyd_George_Record_XX_of_YY_LastName_FirstName_NHSNumber_DOB_ScanDate.pdf
 */

export interface LGFilenameParams {
  patientName: string | null | undefined;
  nhsNumber: string | null | undefined;
  dob: string | null | undefined;
  scanDate: string | null | undefined;
  partNumber?: number;
  totalParts?: number;
}

/**
 * Formats a date string as DD_MMM_YYYY for filenames
 */
export const formatDateForFilename = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day}_${month}_${year}`;
  } catch {
    return 'Unknown';
  }
};

/**
 * Parses patient name into last name and first name components
 */
const parsePatientName = (fullName: string | null | undefined): { lastName: string; firstName: string } => {
  if (!fullName || fullName.trim() === '') {
    return { lastName: 'Unknown', firstName: 'Unknown' };
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: 'Unknown' };
  }
  
  // Assume last word is surname, everything else is first name(s)
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join('_');
  
  return { 
    lastName: sanitiseForFilename(lastName), 
    firstName: sanitiseForFilename(firstName) 
  };
};

/**
 * Sanitises a string for use in filenames (removes/replaces invalid characters)
 */
const sanitiseForFilename = (str: string): string => {
  return str
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .replace(/_+/g, '_')           // Collapse multiple underscores
    .trim();
};

/**
 * Generates the standardised Lloyd George Record filename
 * Format: Lloyd_George_Record_XX_of_YY_LastName_FirstName_NHSNumber_DOB_ScanDate.pdf
 */
export const generateLGFilename = (params: LGFilenameParams): string => {
  const { patientName, nhsNumber, dob, scanDate, partNumber = 1, totalParts = 1 } = params;
  
  const { lastName, firstName } = parsePatientName(patientName);
  const cleanNhs = (nhsNumber || 'Unknown').replace(/\s/g, '');
  const dobFormatted = formatDateForFilename(dob);
  const scanDateFormatted = formatDateForFilename(scanDate);
  
  // Format part numbers with leading zeros (01, 02, etc.)
  const partNumStr = String(partNumber).padStart(2, '0');
  const totalPartsStr = String(totalParts).padStart(2, '0');
  
  return `Lloyd_George_Record_${partNumStr}_of_${totalPartsStr}_${lastName}_${firstName}_${cleanNhs}_${dobFormatted}_${scanDateFormatted}.pdf`;
};

/**
 * Generates filename for other LG Capture output files (JSON, CSV)
 */
export const generateLGBaseFilename = (params: Omit<LGFilenameParams, 'partNumber' | 'totalParts'>): string => {
  const { patientName, nhsNumber, dob, scanDate } = params;
  
  const { lastName, firstName } = parsePatientName(patientName);
  const cleanNhs = (nhsNumber || 'Unknown').replace(/\s/g, '');
  const dobFormatted = formatDateForFilename(dob);
  const scanDateFormatted = formatDateForFilename(scanDate);
  
  return `Lloyd_George_${lastName}_${firstName}_${cleanNhs}_${dobFormatted}_${scanDateFormatted}`;
};

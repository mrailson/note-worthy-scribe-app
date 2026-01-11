// Complaint source labels and helper functions

export const COMPLAINT_SOURCES = [
  { value: 'patient', label: 'Patient' },
  { value: 'nhs_resolution', label: 'NHS Resolution' },
  { value: 'icb', label: 'Integrated Care Board (ICB)' },
  { value: 'cqc', label: 'Care Quality Commission (CQC)' },
  { value: 'ombudsman', label: 'Parliamentary & Health Service Ombudsman' },
  { value: 'mp', label: 'Member of Parliament' },
  { value: 'solicitor', label: 'Solicitor/Legal Representative' },
  { value: 'other', label: 'Other' },
] as const;

export type ComplaintSource = typeof COMPLAINT_SOURCES[number]['value'];

export function getComplaintSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Patient';
  const found = COMPLAINT_SOURCES.find(s => s.value === source);
  return found?.label || 'Patient';
}

export function getAcknowledgementRecipientLabel(source: string | null | undefined): string {
  switch (source) {
    case 'nhs_resolution':
      return 'NHS Resolution';
    case 'icb':
      return 'ICB';
    case 'cqc':
      return 'CQC';
    case 'ombudsman':
      return 'Ombudsman';
    case 'mp':
      return 'MP';
    case 'solicitor':
      return 'Solicitor';
    case 'other':
      return 'Complainant';
    case 'patient':
    default:
      return 'Patient';
  }
}

export function isInstitutionalSource(source: string | null | undefined): boolean {
  return source !== 'patient' && source !== null && source !== undefined;
}

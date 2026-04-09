/**
 * Generate a brief summary of evidence uploaded for a staff line.
 * Falls back to a simple text summary if the edge function is unavailable.
 */
export function generateEvidenceSummaryFallback(
  staffName: string,
  staffRole: string,
  staffCategory: 'buyback' | 'new_sda',
  evidenceFiles: { file_name: string; evidence_type: string; file_size: number | null }[],
): string {
  if (evidenceFiles.length === 0) return '';

  const typeLabels: Record<string, string> = {
    sda_rota: 'SDA rota',
    ltc_rota: 'LTC rota',
    payslip: 'payslip',
    contract_variation: 'contract',
    employment_agreement: 'employment agreement',
    professional_registration: 'professional registration',
    other_supporting: 'other evidence',
  };

  const types = [...new Set(evidenceFiles.map(f => typeLabels[f.evidence_type] || f.evidence_type.replace(/_/g, ' ')))];
  return `${evidenceFiles.length} file${evidenceFiles.length !== 1 ? 's' : ''} uploaded: ${types.join(', ')}`;
}

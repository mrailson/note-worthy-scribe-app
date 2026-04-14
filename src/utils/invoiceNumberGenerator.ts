import { supabase } from '@/integrations/supabase/client';
import { getOdsCode } from '@/data/nresPractices';

/**
 * Generate the next invoice number for a claim.
 * Format: {ODS_CODE}-{YYYYMM}-{SEQ}
 * e.g. 07902-202604-001
 *
 * ODS code: stripped of K/U prefix
 * YYYYMM: year + month of the claim period
 * SEQ: 3-digit sequential number starting at 001
 */
export async function generateInvoiceNumber(
  neighbourhoodPrefix: string, // kept for compatibility but no longer used in output
  practiceKey: string,
  claimMonth: string,
): Promise<string> {
  const d = new Date(claimMonth);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const yyyymm = `${year}${String(month).padStart(2, '0')}`;

  const rawOds = getOdsCode(practiceKey);
  const ods = (rawOds && rawOds !== '—' && rawOds !== '')
    ? rawOds.replace(/^[KU]/i, '')
    : 'UNKNOWN';

  const prefix = `${ods}-${yyyymm}`;

  const { data } = await supabase
    .from('nres_buyback_claims')
    .select('invoice_number')
    .like('invoice_number', `${prefix}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0 && data[0].invoice_number) {
    const parts = data[0].invoice_number.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

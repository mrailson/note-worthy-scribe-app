import { supabase } from '@/integrations/supabase/client';
import { getOdsCode } from '@/data/nresPractices';

/**
 * Generate the next invoice number for a claim.
 * Format: [YY]-[ODS_NO_K]-[MM]-[SEQ]
 * e.g. 26-83049-04-001
 */

/**
 * Generate the next invoice number for a claim.
 * Format: NRES-[FY]-[MM]-[ODS]-[SEQ]
 * e.g. NRES-2627-04-K83049-001
 */
export async function generateInvoiceNumber(
  neighbourhoodPrefix: string, // kept for compatibility but no longer used in output
  practiceKey: string,
  claimMonth: string,
): Promise<string> {
  const d = new Date(claimMonth);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fy = String(fyStart).slice(2);

  const mm = String(month).padStart(2, '0');

  const rawOds = getOdsCode(practiceKey);
  const ods = (rawOds && rawOds !== '—' && rawOds !== '')
    ? rawOds.replace(/^K/i, '')
    : 'UNKNOWN';

  const prefix = `${fy}-${ods}-${mm}`;

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

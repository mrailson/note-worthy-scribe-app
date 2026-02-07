import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts the number from a compliance item string like "(3) Some text" → 3
 * Returns 999 for items without a number prefix (sorts them to the end).
 */
export function extractComplianceNumber(complianceItem: string): number {
  const match = complianceItem?.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 999;
}

/**
 * Sorts compliance checks by their numbered prefix (1–15).
 * Falls back to created_at then id for stable ordering.
 */
export function sortComplianceChecks<T extends { compliance_item: string; created_at?: string | null; id: string }>(
  checks: T[]
): T[] {
  return [...checks].sort((a, b) => {
    const numA = extractComplianceNumber(a.compliance_item);
    const numB = extractComplianceNumber(b.compliance_item);
    if (numA !== numB) return numA - numB;
    // Stable tie-breaker
    const da = a.created_at || '';
    const db = b.created_at || '';
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });
}

/**
 * Client-side deduplication safety net.
 * Keeps only the first occurrence of each compliance_item (after sorting by best record).
 */
export function deduplicateComplianceChecks<T extends { compliance_item: string; is_compliant: boolean; created_at?: string | null; id: string }>(
  checks: T[]
): T[] {
  const seen = new Map<string, T>();
  // Sort so compliant + newest comes first
  const sorted = [...checks].sort((a, b) => {
    const aComp = a.is_compliant ? 1 : 0;
    const bComp = b.is_compliant ? 1 : 0;
    if (bComp !== aComp) return bComp - aComp;
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
  for (const check of sorted) {
    const key = check.compliance_item.trim();
    if (!seen.has(key)) {
      seen.set(key, check);
    }
  }
  return sortComplianceChecks(Array.from(seen.values()));
}

/**
 * Removes duplicate compliance checks and keeps only the numbered ones (1-15).
 * Now mostly a fallback — the DB unique constraint prevents future duplicates.
 */
export async function cleanupDuplicateComplianceChecks(complaintId: string) {
  try {
    const { data: allChecks, error: fetchError } = await supabase
      .from('complaint_compliance_checks')
      .select('*')
      .eq('complaint_id', complaintId);

    if (fetchError) throw fetchError;

    if (!allChecks || allChecks.length === 0) {
      return { success: true, message: 'No checks found' };
    }

    console.log(`Found ${allChecks.length} compliance checks`);

    // If all checks are in old unnumbered format, reinitialise to new numbered format
    const allUnnumbered = allChecks.every(check => !/^\(\d+\)/.test(check.compliance_item || ''));
    if (allUnnumbered) {
      const { error: deleteError } = await supabase
        .from('complaint_compliance_checks')
        .delete()
        .eq('complaint_id', complaintId);
      if (deleteError) throw deleteError;

      const { error: initError } = await supabase
        .rpc('initialize_complaint_compliance', { p_complaint_id: complaintId });
      if (initError) throw initError;

      return {
        success: true,
        message: 'Reinitialised compliance checks with numbered format (15 items)',
        deleted: allChecks.length,
        remaining: 15
      };
    }

    // Group by item text and remove exact-duplicate items, keeping the best record
    const groups = allChecks.reduce((acc: Record<string, any[]>, check: any) => {
      const key = (check.compliance_item || '').trim();
      acc[key] = acc[key] || [];
      acc[key].push(check);
      return acc;
    }, {});

    const duplicateGroups = Object.entries(groups).filter(([, arr]) => (arr as any[]).length > 1);

    if (duplicateGroups.length > 0) {
      const idsToDelete: string[] = [];

      duplicateGroups.forEach(([, arr]) => {
        const sorted = (arr as any[]).sort((a, b) => {
          const aComp = a.is_compliant ? 1 : 0;
          const bComp = b.is_compliant ? 1 : 0;
          if (bComp !== aComp) return bComp - aComp;
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });
        sorted.slice(1).forEach((c: any) => idsToDelete.push(c.id));
      });

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('complaint_compliance_checks')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) throw deleteError;

        return {
          success: true,
          message: `Removed ${idsToDelete.length} duplicate checks. ${Object.keys(groups).length} unique checks remain.`,
          deleted: idsToDelete.length,
          remaining: Object.keys(groups).length
        };
      }
    }

    return {
      success: true,
      message: `No duplicates found. Total unique checks: ${Object.keys(groups).length}`,
      deleted: 0,
      remaining: Object.keys(groups).length
    };
  } catch (error) {
    console.error('Error cleaning up compliance checks:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

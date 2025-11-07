import { supabase } from '@/integrations/supabase/client';

/**
 * Removes duplicate compliance checks and keeps only the numbered ones (1-15)
 * This fixes the issue where both old and new migration functions created entries
 */
export async function cleanupDuplicateComplianceChecks(complaintId: string) {
  try {
    // Fetch all checks for this complaint
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
        // keep first, delete the rest
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

    return {
      success: true,
      message: `No duplicates found. Total checks: ${allChecks.length}`,
      deleted: 0,
      remaining: allChecks.length
    };

  } catch (error) {
    console.error('Error cleaning up compliance checks:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

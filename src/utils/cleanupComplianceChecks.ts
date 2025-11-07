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

    // Separate numbered checks (with pattern like "(1) ", "(2) ", etc.) from unnumbered
    const numberedChecks = allChecks.filter(check => 
      /^\(\d+\)/.test(check.compliance_item)
    );
    
    const unnumberedChecks = allChecks.filter(check => 
      !/^\(\d+\)/.test(check.compliance_item)
    );

    console.log(`Numbered checks: ${numberedChecks.length}, Unnumbered checks: ${unnumberedChecks.length}`);

    // If we have both numbered and unnumbered (duplicates), delete the unnumbered ones
    if (numberedChecks.length > 0 && unnumberedChecks.length > 0) {
      const idsToDelete = unnumberedChecks.map(check => check.id);
      
      const { error: deleteError } = await supabase
        .from('complaint_compliance_checks')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;

      return {
        success: true,
        message: `Removed ${unnumberedChecks.length} duplicate checks. ${numberedChecks.length} checks remain.`,
        deleted: unnumberedChecks.length,
        remaining: numberedChecks.length
      };
    }

    // If we only have unnumbered checks (old format), we should reinitialize
    if (numberedChecks.length === 0 && unnumberedChecks.length > 0) {
      // Delete all old checks
      const { error: deleteError } = await supabase
        .from('complaint_compliance_checks')
        .delete()
        .eq('complaint_id', complaintId);

      if (deleteError) throw deleteError;

      // Reinitialize with new numbered format
      const { error: initError } = await supabase
        .rpc('initialize_complaint_compliance', { p_complaint_id: complaintId });

      if (initError) throw initError;

      return {
        success: true,
        message: 'Reinitialized compliance checks with numbered format (15 items)',
        deleted: unnumberedChecks.length,
        remaining: 15
      };
    }

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

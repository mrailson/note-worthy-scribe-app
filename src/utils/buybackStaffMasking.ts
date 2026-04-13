/**
 * Buy-back staff name masking utility
 * Ensures staff names are only visible to the claim owner and authorised approvers.
 */

import { maskPatientName } from '@/utils/patientDataMasking';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';

/** Authorised approver email addresses */
export const BUYBACK_APPROVER_EMAILS = [
  'm.green28@nhs.net',         // Maureen Green (admin)
  'malcolm.railson@nhs.net',   // Malcolm Railson
  'mark.gray1@nhs.net',        // Dr Mark Gray (SNO)
  'amanda.palin2@nhs.net',      // Amanda Palin
  'carolyn.abbisogni@nhs.net'  // Carolyn Abbisogni
] as const;

/**
 * Checks whether the current user is an authorised buy-back approver.
 */
export function isBuybackApprover(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const lower = userEmail.toLowerCase();
  return BUYBACK_APPROVER_EMAILS.includes(lower as any) ||
         NRES_ADMIN_EMAILS.includes(lower);
}

/**
 * Checks whether the current user can see full (unmasked) staff names for a claim.
 *
 * Full names are shown when the user is:
 * 1. The practice user who submitted the claim (owner), OR
 * 2. An authorised approver / NRES admin, OR
 * 3. Any admin or PML role holder (isAdminOverride)
 */
export function canViewStaffName(
  currentUserId: string | null | undefined,
  claimOwnerUserId: string | null | undefined,
  currentUserEmail: string | null | undefined,
  isAdminOverride?: boolean
): boolean {
  if (!currentUserId) return false;
  if (isAdminOverride) return true;
  if (currentUserId === claimOwnerUserId) return true;
  return isBuybackApprover(currentUserEmail);
}

/**
 * Returns the staff name — either full or masked — based on the viewer's permissions.
 */
export function maskStaffName(
  name: string,
  currentUserId: string | null | undefined,
  claimOwnerUserId: string | null | undefined,
  currentUserEmail: string | null | undefined,
  isAdminOverride?: boolean
): string {
  if (canViewStaffName(currentUserId, claimOwnerUserId, currentUserEmail, isAdminOverride)) {
    return name;
  }
  return maskPatientName(name);
}

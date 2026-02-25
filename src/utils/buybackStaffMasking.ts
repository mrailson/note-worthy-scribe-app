/**
 * Buy-back staff name masking utility
 * Ensures staff names are only visible to the claim owner and authorised approvers.
 */

import { maskPatientName } from '@/utils/patientDataMasking';

/** Authorised approver email addresses */
export const BUYBACK_APPROVER_EMAILS = [
  'm.green28@nhs.net',        // Malcolm Railson
  'mark.gray1@nhs.net',       // Dr Mark Gray (SNO)
  'amanda.taylor75@nhs.net',  // Amanda Taylor
  'carolyn.abbisogni@nhs.net' // Carolyn Abbisogni
] as const;

/**
 * Checks whether the current user is an authorised buy-back approver.
 */
export function isBuybackApprover(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return BUYBACK_APPROVER_EMAILS.includes(userEmail.toLowerCase() as any);
}

/**
 * Checks whether the current user can see full (unmasked) staff names for a claim.
 *
 * Full names are shown when the user is:
 * 1. The practice user who submitted the claim (owner), OR
 * 2. An authorised approver
 */
export function canViewStaffName(
  currentUserId: string | null | undefined,
  claimOwnerUserId: string | null | undefined,
  currentUserEmail: string | null | undefined
): boolean {
  if (!currentUserId) return false;
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
  currentUserEmail: string | null | undefined
): string {
  if (canViewStaffName(currentUserId, claimOwnerUserId, currentUserEmail)) {
    return name;
  }
  return maskPatientName(name);
}

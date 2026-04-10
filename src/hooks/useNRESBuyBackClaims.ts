import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { sendBuyBackEmail, type BuyBackEmailData } from '@/utils/buybackEmailService';
import { generateInvoiceNumber } from '@/utils/invoiceNumberGenerator';
import { generateInvoicePdf } from '@/utils/invoicePdfGenerator';
import { NRES_PRACTICE_CONTACTS, getPracticeName } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { BuyBackStaffMember } from './useNRESBuyBackStaff';

export interface BuyBackClaim {
  id: string;
  user_id: string;
  practice_id: string | null;
  practice_key: string | null;
  claim_month: string;
  staff_details: any[];
  calculated_amount: number;
  claimed_amount: number;
  declaration_confirmed: boolean;
  status: 'draft' | 'submitted' | 'verified' | 'approved' | 'queried' | 'invoiced' | 'paid' | 'rejected';
  submitted_at: string | null;
  submitted_by_email: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_by_email: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verified_notes: string | null;
  // Invoice fields
  invoice_number: string | null;
  invoice_pdf_path: string | null;
  invoice_generated_at: string | null;
  gl_summary: any | null;
  // Query fields
  queried_at: string | null;
  queried_by: string | null;
  query_notes: string | null;
  // Payment fields
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
}

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return NRES_ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * ICB-approved annual cost basis (including on-costs).
 * Defaults used when no rate settings are provided.
 */
const DEFAULT_GP_SESSION_ANNUAL = 11000 * 1.2938;
const DEFAULT_WTE_ANNUAL        = 60000 * 1.2938;

export interface RateParams {
  onCostMultiplier: number;
  getRoleAnnualRate?: (roleLabel: string) => number | undefined;
  employerNiPct?: number;
  employerPensionPct?: number;
}

/** Calculate the maximum monthly claim amount for a staff member */
export function calculateStaffMonthlyAmount(
  staff: BuyBackStaffMember | { allocation_type: string; allocation_value: number; staff_role?: string },
  claimMonth?: string,
  startDate?: string | null,
  rateParams?: RateParams,
): number {
  let fullMonthly: number;

  if (rateParams?.getRoleAnnualRate && staff.staff_role) {
    // Dynamic rates from settings
    const roleRate = rateParams.getRoleAnnualRate(staff.staff_role);
    if (roleRate !== undefined) {
      const annualWithOnCosts = roleRate * rateParams.onCostMultiplier;
      if (staff.allocation_type === 'sessions') {
        fullMonthly = (staff.allocation_value * annualWithOnCosts) / 12;
      } else if (staff.allocation_type === 'hours') {
        fullMonthly = ((staff.allocation_value / 37.5) * annualWithOnCosts) / 12;
      } else {
        fullMonthly = (staff.allocation_value * annualWithOnCosts) / 12;
      }
    } else {
      // Fallback for unknown roles
      fullMonthly = calculateFallback(staff);
    }
  } else {
    fullMonthly = calculateFallback(staff);
  }

  // Pro-rata if start_date falls within the claim month
  if (claimMonth && startDate) {
    const claimStart = new Date(claimMonth);
    const claimYear = claimStart.getFullYear();
    const claimMonthNum = claimStart.getMonth();
    const staffStart = new Date(startDate);

    // Only pro-rata if staff starts in this specific month
    if (staffStart.getFullYear() === claimYear && staffStart.getMonth() === claimMonthNum) {
      const daysInMonth = new Date(claimYear, claimMonthNum + 1, 0).getDate();
      const startDay = staffStart.getDate(); // e.g. 15th
      const workingDays = daysInMonth - startDay + 1; // days from start to end of month inclusive
      fullMonthly = fullMonthly * (workingDays / daysInMonth);
    }
    // If staff starts after the claim month, no claim allowed
    if (staffStart > new Date(claimYear, claimMonthNum + 1, 0)) {
      return 0;
    }
  }

  return fullMonthly;
}

function calculateFallback(staff: { allocation_type: string; allocation_value: number }): number {
  if (staff.allocation_type === 'sessions') {
    return (staff.allocation_value * DEFAULT_GP_SESSION_ANNUAL) / 12;
  } else if (staff.allocation_type === 'hours') {
    return ((staff.allocation_value / 37.5) * DEFAULT_WTE_ANNUAL) / 12;
  }
  return (staff.allocation_value * DEFAULT_WTE_ANNUAL) / 12;
}

export interface BuyBackClaimsEmailConfig {
  emailTestingMode: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
}

export function useNRESBuyBackClaims(emailConfig?: BuyBackClaimsEmailConfig) {
  const { user } = useAuth();
  const [claims, setClaims] = useState<BuyBackClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);
  const [hasElevatedAccess, setHasElevatedAccess] = useState(false);

  const admin = isAdmin(user?.email) || hasElevatedAccess;

  // Check nres_system_roles for PML Director / PML Finance / Super Admin / Management Lead
  useEffect(() => {
    if (!user?.email) return;
    const checkSystemRole = async () => {
      try {
        const { data } = await supabase
          .from('nres_system_roles')
          .select('role')
          .eq('user_email', user.email!.toLowerCase())
          .eq('is_active', true);
        if (data && data.length > 0) {
          setHasElevatedAccess(true);
        }
      } catch {
        // ignore — fall back to NRES_ADMIN_EMAILS
      }
    };
    if (!isAdmin(user.email)) {
      checkSystemRole();
    } else {
      setHasElevatedAccess(true);
    }
  }, [user?.email]);

  const fetchClaims = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    try {
      setLoading(true);
      let query = supabase
        .from('nres_buyback_claims')
        .select('*')
        .order('claim_month', { ascending: false });

      // Users with a system role OR in NRES_ADMIN_EMAILS see all claims
      if (!isAdmin(user.email) && !hasElevatedAccess) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClaims((data || []) as BuyBackClaim[]);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching buyback claims:', error);
      toast.error('Failed to load buy-back claims');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, hasElevatedAccess]);

  useEffect(() => {
    if (user?.id) fetchClaims();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id]);

  // Re-fetch when elevated access is detected (initial fetch may have been user-scoped)
  useEffect(() => {
    if (hasElevatedAccess && user?.id) {
      hasFetchedRef.current = false;
      fetchClaims(true);
    }
  }, [hasElevatedAccess]);

  const createClaim = async (
    claimMonth: string,
    staffMembers: BuyBackStaffMember[],
    claimedAmount: number,
    calculatedAmount: number,
    practiceKey?: string | null,
    rateParams?: RateParams,
  ) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      const staffSnapshot = staffMembers.map(s => {
        const maxAmount = calculateStaffMonthlyAmount(s, claimMonth, s.start_date, rateParams);
        return {
          staff_name: s.staff_name,
          staff_role: s.staff_role,
          staff_category: s.staff_category,
          allocation_type: s.allocation_type,
          allocation_value: s.allocation_value,
          hourly_rate: s.hourly_rate,
          start_date: s.start_date,
          practice_key: s.practice_key,
          claimed_amount: maxAmount,
          gl_category: s.staff_role === 'GP' ? 'GP' : 'Other Clinical',
        };
      });

      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .insert({
          user_id: user.id,
          claim_month: claimMonth,
          staff_details: staffSnapshot,
          calculated_amount: calculatedAmount,
          claimed_amount: claimedAmount,
          practice_key: practiceKey || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      setClaims(prev => [data as BuyBackClaim, ...prev]);
      toast.success('Claim created');
      return data;
    } catch (error) {
      console.error('Error creating buyback claim:', error);
      toast.error('Failed to create claim');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitClaim = async (id: string) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      if (!claim?.declaration_confirmed) {
        toast.error('You must confirm the declaration before submitting');
        return;
      }

      let query = supabase
        .from('nres_buyback_claims')
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by_email: user.email || null })
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim submitted for approval');

      // Send emails (non-blocking)
      if (emailConfig && claim.practice_key) {
        const staffDetails = claim.staff_details as any[] || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: user.email || '',
          submitterName: emailConfig.currentUserName,
        };
        sendBuyBackEmail('claim_submitted', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
        sendBuyBackEmail('submission_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim');
    } finally {
      setSaving(false);
    }
  };

  const updateClaimAmount = async (id: string, amount: number) => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('nres_buyback_claims')
        .update({ claimed_amount: amount })
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating claim amount:', error);
    }
  };

  /** Update a single staff member's claimed amount within the claim's staff_details JSON */
  const updateStaffClaimedAmount = async (claimId: string, staffIndex: number, newAmount: number) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;

      const updatedDetails = [...(claim.staff_details as any[])];
      updatedDetails[staffIndex] = { ...updatedDetails[staffIndex], claimed_amount: newAmount };

      const totalClaimed = updatedDetails.reduce((sum, s) => sum + (s.claimed_amount ?? calculateStaffMonthlyAmount(s as any)), 0);

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails, claimed_amount: totalClaimed })
        .eq('id', claimId);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating staff claimed amount:', error);
    }
  };

  /** Remove a single staff member from a claim's staff_details, recalculating totals */
  const removeStaffFromClaim = async (claimId: string, staffIndex: number) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;

      const updatedDetails = (claim.staff_details as any[]).filter((_, i) => i !== staffIndex);
      
      // If no staff left, delete the whole claim
      if (updatedDetails.length === 0) {
        await deleteClaim(claimId);
        return;
      }

      const totalCalc = updatedDetails.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s as any), 0);
      const totalClaimed = updatedDetails.reduce((sum, s) => sum + (s.claimed_amount ?? calculateStaffMonthlyAmount(s as any)), 0);

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails, calculated_amount: totalCalc, claimed_amount: totalClaimed })
        .eq('id', claimId);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error removing staff from claim:', error);
      toast.error('Failed to remove staff line');
    }
  };

  /** Update notes for a staff line within a claim */
  const updateStaffNotes = async (claimId: string, staffIndex: number, notes: string) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;

      const updatedDetails = [...(claim.staff_details as any[])];
      updatedDetails[staffIndex] = { ...updatedDetails[staffIndex], notes };

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails })
        .eq('id', claimId);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating staff notes:', error);
    }
  };

  /** Update a staff line's editable fields within a claim, enforcing rate cap */
  const updateStaffLine = async (
    claimId: string,
    staffIndex: number,
    updates: {
      allocation_type?: string;
      allocation_value?: number;
      start_date?: string | null;
      claimed_amount?: number;
      notes?: string;
      acknowledged_rules?: string[];
    },
    rateParams?: RateParams,
  ) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;
      if (claim.status !== 'draft' && claim.status !== 'queried') {
        toast.error('Can only edit draft or queried claims');
        return;
      }

      const updatedDetails = [...(claim.staff_details as any[])];
      const currentLine = { ...updatedDetails[staffIndex] };

      if (updates.allocation_type !== undefined) currentLine.allocation_type = updates.allocation_type;
      if (updates.allocation_value !== undefined) currentLine.allocation_value = updates.allocation_value;
      if (updates.start_date !== undefined) currentLine.start_date = updates.start_date;
      if (updates.notes !== undefined) currentLine.notes = updates.notes;
      if (updates.acknowledged_rules !== undefined) currentLine.acknowledged_rules = updates.acknowledged_rules;

      // Recalculate maximum
      const maxAmount = calculateStaffMonthlyAmount(
        {
          allocation_type: currentLine.allocation_type,
          allocation_value: currentLine.allocation_value,
          staff_role: currentLine.staff_role,
        },
        claim.claim_month,
        currentLine.start_date,
        rateParams,
      );

      // Enforce cap
      if (updates.claimed_amount !== undefined) {
        currentLine.claimed_amount = Math.min(updates.claimed_amount, maxAmount);
      } else if (currentLine.claimed_amount > maxAmount) {
        currentLine.claimed_amount = maxAmount;
      }
      currentLine.max_claimable = maxAmount;

      updatedDetails[staffIndex] = currentLine;

      const newCalculated = updatedDetails.reduce((sum, s) => {
        return sum + calculateStaffMonthlyAmount(
          { allocation_type: s.allocation_type, allocation_value: s.allocation_value, staff_role: s.staff_role },
          claim.claim_month, s.start_date, rateParams
        );
      }, 0);
      const newClaimed = updatedDetails.reduce((sum, s) => sum + (s.claimed_amount ?? 0), 0);

      // Optimistic update
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, staff_details: updatedDetails, calculated_amount: newCalculated, claimed_amount: newClaimed } : c));

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails, calculated_amount: newCalculated, claimed_amount: newClaimed })
        .eq('id', claimId);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      console.error('Error updating staff line:', error);
      toast.error('Failed to update');
    }
  };

  const confirmDeclaration = async (id: string, confirmed: boolean) => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('nres_buyback_claims')
        .update({ declaration_confirmed: confirmed })
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating declaration:', error);
    }
  };

  const deleteClaim = async (id: string) => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('nres_buyback_claims')
        .delete()
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      if (error) throw error;
      setClaims(prev => prev.filter(c => c.id !== id));
      
    } catch (error) {
      console.error('Error deleting claim:', error);
      toast.error('Failed to delete claim');
    }
  };

  const approveClaim = async (id: string, notes?: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
          approved_by_email: user.email || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim approved — generating invoice...');

      // Calculate GL summary
      const staffDetails = (claim?.staff_details as any[]) || [];
      const gpTotal = staffDetails
        .filter(s => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical')) === 'GP')
        .reduce((sum, s) => sum + (s.claimed_amount || 0), 0);
      const otherTotal = staffDetails
        .filter(s => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical')) !== 'GP')
        .reduce((sum, s) => sum + (s.claimed_amount || 0), 0);

      // Generate invoice number and PDF
      try {
        const invoiceNum = await generateInvoiceNumber('NRES', claim?.practice_key || '', claim?.claim_month || '');
        const approvedClaim = { ...(claim || data), status: 'approved' as const } as BuyBackClaim;
        const pdfDoc = generateInvoicePdf({
          claim: approvedClaim,
          invoiceNumber: invoiceNum,
          neighbourhoodName: 'NRES',
        });
        const pdfBlob = pdfDoc.output('blob');

        // Upload to Supabase Storage
        const pdfPath = `invoices/${invoiceNum}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('nres-claim-evidence')
          .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          console.error('Failed to upload invoice PDF:', uploadError);
        }

        // Update claim with invoice details → status becomes 'invoiced'
        const { data: invoicedData } = await supabase
          .from('nres_buyback_claims')
          .update({
            status: 'invoiced',
            invoice_number: invoiceNum,
            invoice_pdf_path: pdfPath,
            invoice_generated_at: new Date().toISOString(),
            gl_summary: { gp_total: gpTotal, other_clinical_total: otherTotal },
          })
          .eq('id', id)
          .select()
          .single();

        if (invoicedData) {
          setClaims(prev => prev.map(c => c.id === id ? (invoicedData as BuyBackClaim) : c));
          toast.success(`Invoice ${invoiceNum} generated`);

          // Email invoice PDF to Practice Manager (non-blocking)
          const practiceKey = claim?.practice_key as NRESPracticeKey | undefined;
          const pmContact = practiceKey ? NRES_PRACTICE_CONTACTS[practiceKey] : null;
          if (pmContact?.email) {
            const practiceName = getPracticeName(practiceKey);
            const claimDate = new Date(claim?.claim_month || '');
            const claimMonthLabel = claimDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

            // Convert PDF blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
              };
            });
            reader.readAsDataURL(pdfBlob);
            const pdfBase64 = await base64Promise;

            supabase.functions.invoke('send-meeting-email-resend', {
              body: {
                to_email: pmContact.email,
                subject: `Invoice ${invoiceNum} — ${practiceName} NRES Buy-Back Claim (${claimMonthLabel})`,
                html_content: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #003087; padding: 16px 24px;">
                      <h1 style="color: #ffffff; font-size: 18px; margin: 0;">NRES Buy-Back Invoice</h1>
                    </div>
                    <div style="padding: 24px;">
                      <p>Dear ${pmContact.practiceManager},</p>
                      <p>Please find attached invoice <strong>${invoiceNum}</strong> for the NRES Neighbourhood Access Service buy-back claim for <strong>${practiceName}</strong> covering <strong>${claimMonthLabel}</strong>.</p>
                      <p>Payment terms: <strong>30 days</strong> from the date of this invoice.</p>
                      <p>Invoice payable to: <strong>PML (Principal Medical Limited)</strong>, 3 Barberry Place, Bicester, Oxfordshire, OX26 3HA.</p>
                      <p>If you have any queries regarding this invoice, please contact your Neighbourhood Manager.</p>
                      <p style="margin-top: 24px; color: #666; font-size: 12px;">This is an automated message from Notewell AI — NRES SDA Programme.</p>
                    </div>
                  </div>
                `,
                from_name: 'NRES Buy-Back Claims',
                cc_emails: ['amanda.palin2@nhs.net'],
                extra_attachments: [{
                  content: pdfBase64,
                  filename: `Invoice_${invoiceNum}.pdf`,
                  type: 'application/pdf',
                }],
              },
            }).then(() => {
              toast.success(`Invoice emailed to ${pmContact.practiceManager}`);
            }).catch((emailErr) => {
              console.error('Failed to email invoice to PM:', emailErr);
              toast.error('Invoice generated but email to Practice Manager failed');
            });
          }
        }
      } catch (invoiceError) {
        console.error('Invoice generation failed (claim still approved):', invoiceError);
        toast.error('Claim approved but invoice generation failed — can be retried');
      }

      // Send emails (non-blocking)
      if (emailConfig && claim?.practice_key) {
        const emailStaff = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: emailStaff.length,
          staffCategories: emailStaff.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: emailStaff.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_approved', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
        sendBuyBackEmail('approval_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error approving claim:', error);
      toast.error('Failed to approve claim');
    } finally {
      setSaving(false);
    }
  };

  const rejectClaim = async (id: string, notes: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          approved_by_email: user.email || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim rejected permanently — a new claim must be created');

      // Send emails (non-blocking)
      if (emailConfig && claim?.practice_key) {
        const staffDetails = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_rejected', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
        sendBuyBackEmail('rejection_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Failed to reject claim');
    } finally {
      setSaving(false);
    }
  };

  /** Verify a Buy-Back claim (Submitted → Verified) */
  const verifyClaim = async (id: string, notes?: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'verified',
          verified_by: user.email || null,
          verified_at: new Date().toISOString(),
          verified_notes: notes || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim verified — forwarded to SNO for final approval');

      // Send email to SNO (non-blocking)
      const claim = claims.find(c => c.id === id);
      if (emailConfig && claim?.practice_key) {
        const staffDetails = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_submitted', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error verifying claim:', error);
      toast.error('Failed to verify claim');
    } finally {
      setSaving(false);
    }
  };

  /** Query a claim (Verified → Queried) — returns to editable status */
  const queryClaim = async (id: string, notes: string) => {
    if (!user?.id || !admin) return;
    if (!notes.trim()) {
      toast.error('Please provide query notes explaining what needs attention');
      return;
    }
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'queried',
          queried_by: user.email || null,
          queried_at: new Date().toISOString(),
          query_notes: notes,
          declaration_confirmed: false,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim queried — returned to practice for amendment');

      const claim = claims.find(c => c.id === id);
      if (emailConfig && claim?.practice_key) {
        const staffDetails = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_rejected', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error querying claim:', error);
      toast.error('Failed to query claim');
    } finally {
      setSaving(false);
    }
  };

  /** Mark a claim as paid (Invoiced → Paid) */
  const markPaid = async (id: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: user.email || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim marked as paid');
    } catch (error) {
      console.error('Error marking claim as paid:', error);
      toast.error('Failed to mark as paid');
    } finally {
      setSaving(false);
    }
  };

  return {
    claims,
    loading,
    saving,
    admin,
    createClaim,
    submitClaim,
    verifyClaim,
    queryClaim,
    approveClaim,
    rejectClaim,
    markPaid,
    updateClaimAmount,
    updateStaffClaimedAmount,
    removeStaffFromClaim,
    updateStaffNotes,
    updateStaffLine,
    confirmDeclaration,
    deleteClaim,
    refetch: () => fetchClaims(true),
  };
}

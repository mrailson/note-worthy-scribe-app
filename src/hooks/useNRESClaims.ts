import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESSystemRoles } from '@/hooks/useNRESSystemRoles';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────

export type ClaimStatus = 'draft' | 'submitted' | 'verified' | 'approved' | 'invoice_created' | 'scheduled' | 'paid' | 'queried';

export type ClaimsRole = 'super_admin' | 'practice' | 'verifier' | 'approver' | 'finance';

export interface ClaimLine {
  id: string;
  claim_ref: string | null;
  practice_id: string;
  claim_month: string;
  staff_member: string;
  category: string;
  role: string;
  gl_code: string | null;
  allocation: string | null;
  start_date: string | null;
  max_rate: number | null;
  claimed_amount: number | null;
  status: ClaimStatus;
  declared_by: string | null;
  declared_at: string | null;
  declaration_text: string | null;
  on_behalf_of: string | null;
  query_note: string | null;
  queried_by: string | null;
  queried_at: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  invoice_created_by: string | null;
  invoice_created_at: string | null;
  scheduled_by: string | null;
  scheduled_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimEvidence {
  id: string;
  claim_line_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
}

export interface ClaimAuditEntry {
  id: string;
  claim_line_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  on_behalf_of: string | null;
  notes: string | null;
  created_at: string;
}

export interface Practice {
  id: string;
  name: string;
  practice_code: string;
}

// ── Status config ────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; bg: string; step: number }> = {
  draft:           { label: 'Draft',           color: '#64748b', bg: '#f1f5f9', step: 0 },
  submitted:       { label: 'Submitted',       color: '#2563eb', bg: '#dbeafe', step: 1 },
  verified:        { label: 'Verified',        color: '#7c3aed', bg: '#ede9fe', step: 2 },
  approved:        { label: 'Approved',        color: '#059669', bg: '#d1fae5', step: 3 },
  invoice_created: { label: 'Invoice Created', color: '#d97706', bg: '#fef3c7', step: 4 },
  scheduled:       { label: 'Scheduled',       color: '#0891b2', bg: '#cffafe', step: 5 },
  paid:            { label: 'Paid',            color: '#16a34a', bg: '#bbf7d0', step: 6 },
  queried:         { label: 'Queried',         color: '#dc2626', bg: '#fee2e2', step: -1 },
};

export const PIPELINE: ClaimStatus[] = ['draft', 'submitted', 'verified', 'approved', 'invoice_created', 'scheduled', 'paid'];

export const CATEGORIES = ['Management', 'GP Locum', 'Clinical', 'Admin', 'ARRS'];
export const STAFF_ROLES = ['NRES Management', 'GP Locum', 'ACP', 'ANP', 'Care Coordinator', 'SPLW', 'Admin Support'];
export const GL_CODES = ['GL001', 'GL002', 'GL003', 'GL004', 'GL005'];

// ── Hook ─────────────────────────────────────────────────────────────────

export function useNRESClaims() {
  const { user } = useAuth();
  const { isSuperAdmin, isManagementLead, isPMLDirector, isPMLFinance } = useNRESSystemRoles();

  const [claims, setClaims] = useState<ClaimLine[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [evidence, setEvidence] = useState<Record<string, ClaimEvidence[]>>({});
  const [auditLog, setAuditLog] = useState<Record<string, ClaimAuditEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const userEmail = user?.email?.toLowerCase() || '';

  // Determine the user's effective claims role
  const claimsRole: ClaimsRole = useMemo(() => {
    if (isSuperAdmin) return 'super_admin';
    if (isManagementLead) return 'verifier';
    if (isPMLDirector) return 'approver';
    if (isPMLFinance) return 'finance';
    return 'practice';
  }, [isSuperAdmin, isManagementLead, isPMLDirector, isPMLFinance]);

  // Fetch practices
  const fetchPractices = useCallback(async () => {
    const { data, error } = await supabase
      .from('gp_practices')
      .select('id, name, practice_code')
      .order('name');
    if (!error && data) setPractices(data as Practice[]);
  }, []);

  // Fetch claims
  const fetchClaims = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('claim_lines')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClaims((data || []) as ClaimLine[]);
    } catch (err) {
      console.error('Error fetching claims:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch evidence for a specific claim
  const fetchEvidence = useCallback(async (claimLineId: string) => {
    const { data, error } = await (supabase as any)
      .from('claim_evidence')
      .select('*')
      .eq('claim_line_id', claimLineId);
    if (!error && data) {
      setEvidence(prev => ({ ...prev, [claimLineId]: data as ClaimEvidence[] }));
    }
  }, []);

  // Fetch audit log for a specific claim
  const fetchAuditLog = useCallback(async (claimLineId: string) => {
    const { data, error } = await (supabase as any)
      .from('claim_audit_log')
      .select('*')
      .eq('claim_line_id', claimLineId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setAuditLog(prev => ({ ...prev, [claimLineId]: data as ClaimAuditEntry[] }));
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchPractices();
      fetchClaims();
    }
  }, [user?.id, fetchPractices, fetchClaims]);

  // Create a draft claim line
  const createClaimLine = useCallback(async (entry: {
    practice_id: string;
    claim_month: string;
    staff_member: string;
    category: string;
    role: string;
    gl_code?: string;
    allocation?: string;
    max_rate?: number;
    claimed_amount?: number;
    on_behalf_of?: string;
  }) => {
    try {
      setSaving(true);
      const { data, error } = await (supabase as any)
        .from('claim_lines')
        .insert({
          ...entry,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => [data as ClaimLine, ...prev]);
      toast.success('Claim line added');
      return data as ClaimLine;
    } catch (err) {
      console.error('Error creating claim:', err);
      toast.error('Failed to create claim line');
    } finally {
      setSaving(false);
    }
  }, []);

  // Declare & submit a draft claim
  const declareAndSubmit = useCallback(async (claimId: string, onBehalfOf?: string) => {
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from('claim_lines')
        .update({
          status: 'submitted',
          declared_by: userEmail,
          declared_at: now,
          submitted_by: userEmail,
          submitted_at: now,
          on_behalf_of: onBehalfOf || null,
        })
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;

      // Audit log
      await (supabase as any).from('claim_audit_log').insert({
        claim_line_id: claimId,
        action: 'declared_and_submitted',
        from_status: 'draft',
        to_status: 'submitted',
        performed_by: userEmail,
        performed_by_name: user?.user_metadata?.full_name || userEmail,
        performed_by_role: claimsRole,
        on_behalf_of: onBehalfOf || null,
      });

      setClaims(prev => prev.map(c => c.id === claimId ? (data as ClaimLine) : c));
      toast.success('Claim declared & submitted');
    } catch (err) {
      console.error('Error submitting claim:', err);
      toast.error('Failed to submit claim');
    } finally {
      setSaving(false);
    }
  }, [userEmail, user, claimsRole]);

  // Advance status (generic)
  const advanceStatus = useCallback(async (claimId: string, fromStatus: ClaimStatus, toStatus: ClaimStatus) => {
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const statusField = `${toStatus}_by`;
      const statusAtField = `${toStatus}_at`;

      const updateData: Record<string, any> = { status: toStatus };

      // Set the appropriate tracking fields
      if (['submitted', 'verified', 'approved', 'invoice_created', 'scheduled', 'paid'].includes(toStatus)) {
        updateData[statusField] = userEmail;
        updateData[statusAtField] = now;
      }

      const { data, error } = await (supabase as any)
        .from('claim_lines')
        .update(updateData)
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;

      // Audit log
      await (supabase as any).from('claim_audit_log').insert({
        claim_line_id: claimId,
        action: `status_changed_to_${toStatus}`,
        from_status: fromStatus,
        to_status: toStatus,
        performed_by: userEmail,
        performed_by_name: user?.user_metadata?.full_name || userEmail,
        performed_by_role: claimsRole,
      });

      setClaims(prev => prev.map(c => c.id === claimId ? (data as ClaimLine) : c));
      toast.success(`Claim ${STATUS_CONFIG[toStatus].label.toLowerCase()}`);
    } catch (err) {
      console.error('Error advancing status:', err);
      toast.error('Failed to update claim status');
    } finally {
      setSaving(false);
    }
  }, [userEmail, user, claimsRole]);

  // Raise a query
  const raiseQuery = useCallback(async (claimId: string, note: string) => {
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const claim = claims.find(c => c.id === claimId);

      const { data, error } = await (supabase as any)
        .from('claim_lines')
        .update({
          status: 'queried',
          query_note: note,
          queried_by: userEmail,
          queried_at: now,
        })
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;

      await (supabase as any).from('claim_audit_log').insert({
        claim_line_id: claimId,
        action: 'queried',
        from_status: claim?.status || 'unknown',
        to_status: 'queried',
        performed_by: userEmail,
        performed_by_name: user?.user_metadata?.full_name || userEmail,
        performed_by_role: claimsRole,
        notes: note,
      });

      setClaims(prev => prev.map(c => c.id === claimId ? (data as ClaimLine) : c));
      toast.success('Query raised');
    } catch (err) {
      console.error('Error raising query:', err);
      toast.error('Failed to raise query');
    } finally {
      setSaving(false);
    }
  }, [userEmail, user, claimsRole, claims]);

  // Re-submit a queried claim
  const resubmitQueried = useCallback(async (claimId: string) => {
    try {
      setSaving(true);
      const now = new Date().toISOString();

      const { data, error } = await (supabase as any)
        .from('claim_lines')
        .update({
          status: 'submitted',
          submitted_at: now,
          submitted_by: userEmail,
          query_note: null,
          queried_by: null,
          queried_at: null,
        })
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;

      await (supabase as any).from('claim_audit_log').insert({
        claim_line_id: claimId,
        action: 'resubmitted',
        from_status: 'queried',
        to_status: 'submitted',
        performed_by: userEmail,
        performed_by_name: user?.user_metadata?.full_name || userEmail,
        performed_by_role: claimsRole,
      });

      setClaims(prev => prev.map(c => c.id === claimId ? (data as ClaimLine) : c));
      toast.success('Claim re-submitted');
    } catch (err) {
      console.error('Error re-submitting:', err);
      toast.error('Failed to re-submit');
    } finally {
      setSaving(false);
    }
  }, [userEmail, user, claimsRole]);

  // Delete a draft claim
  const deleteClaim = useCallback(async (claimId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('claim_lines')
        .delete()
        .eq('id', claimId);
      if (error) throw error;
      setClaims(prev => prev.filter(c => c.id !== claimId));
      toast.success('Claim line removed');
    } catch (err) {
      console.error('Error deleting claim:', err);
      toast.error('Failed to remove claim');
    }
  }, []);

  // Upload evidence
  const uploadEvidence = useCallback(async (claimLineId: string, file: File) => {
    try {
      const claim = claims.find(c => c.id === claimLineId);
      const path = `${claim?.practice_id}/${claim?.claim_ref || claimLineId}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('claim-evidence')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data, error } = await (supabase as any)
        .from('claim_evidence')
        .insert({
          claim_line_id: claimLineId,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          uploaded_by: userEmail,
        })
        .select()
        .single();
      if (error) throw error;

      setEvidence(prev => ({
        ...prev,
        [claimLineId]: [...(prev[claimLineId] || []), data as ClaimEvidence],
      }));
      toast.success('Evidence uploaded');
    } catch (err) {
      console.error('Error uploading evidence:', err);
      toast.error('Failed to upload evidence');
    }
  }, [claims, userEmail]);

  // Get what action the current role can take on a claim
  const getAction = useCallback((claim: ClaimLine): { from: ClaimStatus; to: ClaimStatus; label: string; icon: string } | null => {
    if (claimsRole === 'super_admin') {
      if (claim.status === 'queried') return { from: 'queried', to: 'submitted', label: 'Re-submit', icon: '🔄' };
      const idx = PIPELINE.indexOf(claim.status);
      if (idx >= 0 && idx < PIPELINE.length - 1) {
        const next = PIPELINE[idx + 1];
        const labels: Record<string, string> = { submitted: 'Verify', verified: 'Approve', approved: 'Create Invoice', invoice_created: 'Schedule Payment', scheduled: 'Mark Paid' };
        const icons: Record<string, string> = { submitted: '✅', verified: '👍', approved: '📄', invoice_created: '📅', scheduled: '💰' };
        return { from: claim.status, to: next, label: labels[next] || next, icon: icons[next] || '→' };
      }
      return null;
    }
    if (claimsRole === 'finance') {
      const acts = [
        { from: 'approved' as ClaimStatus, to: 'invoice_created' as ClaimStatus, label: 'Create Invoice', icon: '📄' },
        { from: 'invoice_created' as ClaimStatus, to: 'scheduled' as ClaimStatus, label: 'Schedule Payment', icon: '📅' },
        { from: 'scheduled' as ClaimStatus, to: 'paid' as ClaimStatus, label: 'Mark Paid', icon: '💰' },
      ];
      return acts.find(a => a.from === claim.status) || null;
    }
    if (claimsRole === 'verifier' && claim.status === 'submitted') return { from: 'submitted', to: 'verified', label: 'Verify', icon: '✅' };
    if (claimsRole === 'approver' && claim.status === 'verified') return { from: 'verified', to: 'approved', label: 'Approve', icon: '👍' };
    return null;
  }, [claimsRole]);

  // Can current role query this claim?
  const canQuery = useCallback((claim: ClaimLine): boolean => {
    if (claimsRole === 'super_admin') return !['draft', 'paid', 'queried'].includes(claim.status);
    if (claimsRole === 'verifier' && claim.status === 'submitted') return true;
    if (claimsRole === 'approver' && claim.status === 'verified') return true;
    if (claimsRole === 'finance' && ['approved', 'invoice_created'].includes(claim.status)) return true;
    return false;
  }, [claimsRole]);

  return {
    claims,
    practices,
    evidence,
    auditLog,
    loading,
    saving,
    claimsRole,
    userEmail,
    createClaimLine,
    declareAndSubmit,
    advanceStatus,
    raiseQuery,
    resubmitQueried,
    deleteClaim,
    uploadEvidence,
    fetchEvidence,
    fetchAuditLog,
    getAction,
    canQuery,
    refetch: fetchClaims,
  };
}

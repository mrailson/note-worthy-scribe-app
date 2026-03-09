import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  FileText, Download, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Calendar, User, Mail, Shield,
} from 'lucide-react';
import { format } from 'date-fns';

interface SignatoryData {
  id: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  status: string;
  signed_at: string | null;
  signed_name: string | null;
  signed_role: string | null;
  signed_organisation: string | null;
  decline_comment: string | null;
  viewed_at: string | null;
}

interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  original_filename: string;
  file_size_bytes: number | null;
  deadline: string | null;
  status: string;
  message: string | null;
  created_at: string;
  sender_name: string | null;
  sender_email: string | null;
}

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA', dsa: 'DSA', mou: 'MOU', policy: 'Policy',
  contract: 'Contract', privacy_notice: 'Privacy Notice', other: 'Other',
};

const PublicApproval = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signatory, setSignatory] = useState<SignatoryData | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [confirmRead, setConfirmRead] = useState(false);
  const [confirmLegal, setConfirmLegal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'declined' | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineComment, setDeclineComment] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('process-approval', {
        body: { action: 'get', token },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setSignatory(data.signatory);
      setDocument(data.document);
      setFullName(data.signatory.name || '');
      setRole(data.signatory.role || '');
      setOrganisation(data.signatory.organisation || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load approval request');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!fullName.trim() || !role.trim() || !organisation.trim() || !confirmRead || !confirmLegal) return;
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('process-approval', {
        body: {
          action: 'approve', token,
          signed_name: fullName.trim(),
          signed_role: role.trim(),
          signed_organisation: organisation.trim(),
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSubmitted('approved');
      setSubmittedAt(data.signed_at);
    } catch (err: any) {
      setError(err.message || 'Failed to submit approval');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!fullName.trim() || !role.trim() || !organisation.trim() || !confirmRead || !confirmLegal) return;
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('process-approval', {
        body: {
          action: 'decline', token,
          signed_name: fullName.trim(),
          signed_role: role.trim(),
          signed_organisation: organisation.trim(),
          decline_comment: declineComment.trim() || null,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSubmitted('declined');
      setSubmittedAt(data.signed_at);
    } catch (err: any) {
      setError(err.message || 'Failed to submit decline');
    } finally {
      setSubmitting(false);
    }
  };

  const formValid = fullName.trim() && role.trim() && organisation.trim() && confirmRead && confirmLegal;

  // ─── Loading (skeleton) ───────────────────────────────────────
  if (loading) {
    return (
      <PageShell>
        <Card className="p-5 sm:p-8 space-y-5">
          <div className="animate-pulse space-y-4">
            <div className="h-7 bg-muted rounded w-2/3 mx-auto" />
            <div className="h-16 bg-muted/60 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded" />
            </div>
            <div className="h-10 bg-muted rounded" />
          </div>
        </Card>
        <Card className="p-5 sm:p-8 space-y-5">
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="flex gap-3">
              <div className="h-11 bg-muted rounded flex-1" />
              <div className="h-11 bg-muted rounded w-28" />
            </div>
          </div>
        </Card>
      </PageShell>
    );
  }

  // ─── Error / Not found ───────────────────────────────────────
  if (error || !signatory || !document) {
    return (
      <PageShell>
        <Card className="p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Unable to Load</h2>
          <p className="text-sm text-muted-foreground">{error || 'Invalid or expired approval link.'}</p>
          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact the document sender.
          </p>
        </Card>
      </PageShell>
    );
  }

  // ─── Already actioned ───────────────────────────────────────
  const isInactive = document.status === 'revoked' || document.status === 'expired';
  const alreadyActioned = signatory.status === 'approved' || signatory.status === 'declined';

  if (isInactive && !alreadyActioned) {
    return (
      <PageShell>
        <Card className="p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-[hsl(var(--warning))] mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Request No Longer Active</h2>
          <p className="text-sm text-muted-foreground">
            This approval request has been {document.status}. No further action is required.
          </p>
          {document.sender_email && (
            <p className="text-xs text-muted-foreground">
              Contact <span className="font-medium">{document.sender_name || document.sender_email}</span> if you have questions.
            </p>
          )}
        </Card>
      </PageShell>
    );
  }

  if (alreadyActioned && !submitted) {
    return (
      <PageShell>
        <Card className="p-8 text-center space-y-4">
          {signatory.status === 'approved' ? (
            <CheckCircle2 className="h-12 w-12 text-[hsl(var(--approval-approved))] mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {signatory.status === 'approved'
              ? `You already approved this document on ${signatory.signed_at ? format(new Date(signatory.signed_at), 'dd MMMM yyyy \'at\' HH:mm') : 'a previous date'}.`
              : `You declined this document on ${signatory.signed_at ? format(new Date(signatory.signed_at), 'dd MMMM yyyy \'at\' HH:mm') : 'a previous date'}.`}
          </h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Document:</strong> {document.title}</p>
            <p><strong>Name:</strong> {signatory.signed_name || signatory.name}</p>
            {signatory.signed_role && <p><strong>Role:</strong> {signatory.signed_role}</p>}
            {signatory.signed_organisation && <p><strong>Organisation:</strong> {signatory.signed_organisation}</p>}
            {signatory.status === 'declined' && signatory.decline_comment && (
              <p><strong>Comment:</strong> {signatory.decline_comment}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">You can close this page.</p>
        </Card>
      </PageShell>
    );
  }

  // ─── Post-submit confirmation ────────────────────────────────
  if (submitted) {
    return (
      <PageShell>
        <Card className="p-8 text-center space-y-4">
          {submitted === 'approved' ? (
            <CheckCircle2 className="h-12 w-12 text-[hsl(142,71%,45%)] mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-[hsl(25,95%,53%)] mx-auto" />
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {submitted === 'approved' ? 'Thank you. Your approval has been recorded.' : 'Your response has been recorded.'}
          </h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Document:</strong> {document.title}</p>
            <p><strong>Name:</strong> {fullName}</p>
            {submittedAt && (
              <p><strong>Timestamp:</strong> {format(new Date(submittedAt), 'dd MMMM yyyy \'at\' HH:mm')}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A confirmation email has been sent to <span className="font-medium">{signatory.email}</span>.
          </p>
          <p className="text-xs text-muted-foreground">You can close this page.</p>
        </Card>
      </PageShell>
    );
  }

  // ─── Main approval form ─────────────────────────────────────
  return (
    <PageShell>
      {/* Document info */}
      <Card className="p-5 sm:p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Document Approval Request</h1>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-muted/60 rounded-lg">
            <FileText className="h-8 w-8 text-primary flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-base sm:text-lg">{document.title}</p>
              <p className="text-xs text-muted-foreground">
                Category: {categoryLabels[document.category] || document.category}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 flex-shrink-0" />
              <span>From: <span className="text-foreground font-medium">{document.sender_name || 'Unknown'}</span></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Sent: <span className="text-foreground">{format(new Date(document.created_at), 'dd MMMM yyyy')}</span></span>
            </div>
            {document.deadline && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>Deadline: <span className="text-foreground font-medium">{format(new Date(document.deadline), 'dd MMMM yyyy')}</span></span>
              </div>
            )}
          </div>

          {document.message && (
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Message:</p>
              <p className="text-sm text-foreground italic">"{document.message}"</p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open(document.file_url, '_blank')}
          >
            <Download className="h-4 w-4" />
            Download Document ({document.original_filename})
            {document.file_size_bytes && (
              <span className="text-xs text-muted-foreground">
                — {(document.file_size_bytes / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </Button>
        </div>
      </Card>

      {/* Approval form */}
      <Card className="p-5 sm:p-8 space-y-5">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground">Confirm Your Details</h2>
          <p className="text-sm text-muted-foreground">
            To approve this document, confirm your details and click Approve below.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm font-medium">Role *</Label>
            <Input value={role} onChange={e => setRole(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm font-medium">Organisation *</Label>
            <Input value={organisation} onChange={e => setOrganisation(e.target.value)} className="mt-1.5" />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm-read"
                checked={confirmRead}
                onCheckedChange={v => setConfirmRead(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="confirm-read" className="text-sm text-foreground cursor-pointer leading-relaxed">
                I confirm I have read the attached document and approve its contents
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm-legal"
                checked={confirmLegal}
                onCheckedChange={v => setConfirmLegal(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="confirm-legal" className="text-sm text-foreground cursor-pointer leading-relaxed">
                I understand this constitutes an electronic signature in accordance with UK law (Electronic Communications Act 2000)
              </Label>
            </div>
          </div>
        </div>

        {/* Decline textarea */}
        {showDecline && (
          <div className="space-y-2 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <Label className="text-sm font-medium text-foreground">Reason for declining (optional)</Label>
            <Textarea
              value={declineComment}
              onChange={e => setDeclineComment(e.target.value)}
              placeholder="Please provide a reason for declining this document…"
              rows={3}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={handleApprove}
            disabled={!formValid || submitting}
            className="flex-1 gap-2"
          >
            {submitting && !showDecline ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve Document
          </Button>
          {!showDecline ? (
            <Button
              variant="outline"
              onClick={() => setShowDecline(true)}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4" /> Decline
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={!formValid || submitting}
              className="flex-1 gap-2"
            >
              {submitting && showDecline ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirm Decline
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <Shield className="h-3 w-3" />
          <span>Your IP address and browser details will be recorded for audit purposes.</span>
        </div>
      </Card>
    </PageShell>
  );
};

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[hsl(240,10%,96%)]">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/oak-lane-logo.png" alt="Notewell" className="h-10 sm:h-12" />
        </div>
        {children}
        <p className="text-center text-xs text-muted-foreground">
          Powered by Notewell Document Approval Service
        </p>
      </div>
    </div>
  );
}

export default PublicApproval;

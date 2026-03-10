import { useState, useEffect, useRef, useCallback } from 'react';
import notewellLogo from '@/assets/notewell-logo.png';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  FileText, Eye, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Calendar, User, Mail, Shield, ZoomIn, ZoomOut, ArrowDown, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

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

/* ─── Inline PDF Viewer ─────────────────────────────────────── */
function InlinePDFViewer({ fileUrl }: { fileUrl: string }) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error('Failed to fetch document');
        const arrayBuffer = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err: any) {
        if (!cancelled) setPdfError(err.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Render pages
  useEffect(() => {
    if (!pdfDoc) return;
    const scale = zoom / 100;
    const renderAll = async () => {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: scale * 1.5 });
        const canvas = canvasRefs.current.get(i);
        if (!canvas) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      }
    };
    renderAll();
  }, [pdfDoc, zoom]);

  // IntersectionObserver for current page
  useEffect(() => {
    if (!totalPages || !scrollRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pg = Number(entry.target.getAttribute('data-page'));
            if (pg) setCurrentPage(pg);
          }
        }
      },
      { root: scrollRef.current, threshold: 0.5 }
    );
    pageRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [totalPages, pdfDoc]);

  const scrollToPage = (pg: number) => {
    const el = pageRefs.current.get(pg);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (pdfLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh] bg-muted/30 rounded-lg border border-border">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading document…</p>
        </div>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className="flex items-center justify-center h-[40vh] bg-muted/30 rounded-lg border border-border">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{pdfError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-muted/60 border border-border rounded-t-lg flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span className="font-medium">Page {currentPage} of {totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            disabled={zoom <= 50}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="hidden sm:flex items-center w-24">
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={50}
              max={200}
              step={10}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground w-10 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            disabled={zoom >= 200}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const el = document.getElementById('approval-form');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Go to Signature
        </Button>
      </div>

      {/* Page navigation pills */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/40 border-x border-border overflow-x-auto">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
            <button
              key={pg}
              onClick={() => scrollToPage(pg)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                pg === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {pg}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable PDF area */}
      <div
        ref={scrollRef}
        className="h-[65vh] overflow-y-auto bg-muted/30 border-x border-b border-border rounded-b-lg"
      >
        <div className="flex flex-col items-center gap-6 py-6 px-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              data-page={pageNum}
              ref={el => { pageRefs.current.set(pageNum, el); }}
              className="bg-white shadow-lg rounded border border-border/50"
              style={{ maxWidth: '100%' }}
            >
              <canvas
                ref={el => { canvasRefs.current.set(pageNum, el); }}
                className="block max-w-full h-auto"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────── */
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
  const [confirmApproval, setConfirmApproval] = useState(false);
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
    if (!fullName.trim() || !role.trim() || !organisation.trim() || !confirmApproval) return;
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
    if (!fullName.trim() || !role.trim() || !organisation.trim() || !confirmApproval) return;
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
            <div className="h-[40vh] bg-muted/40 rounded-lg" />
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
          <button
            onClick={() => window.close()}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Close this page
          </button>
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
            <CheckCircle2 className="h-12 w-12 text-[hsl(var(--approval-approved))] mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-[hsl(var(--warning))] mx-auto" />
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
          <button
            onClick={() => window.close()}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Close this page
          </button>
        </Card>
      </PageShell>
    );
  }

  // ─── Main approval form with inline PDF viewer ──────────────
  return (
    <PageShell wide>
      {/* Compact header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{document.title}</h1>
            <p className="text-xs text-muted-foreground">
              {categoryLabels[document.category] || document.category} · From {document.sender_name || 'Unknown'} · {format(new Date(document.created_at), 'dd MMM yyyy')}
              {document.deadline && ` · Due ${format(new Date(document.deadline), 'dd MMM yyyy')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Message if any */}
      {document.message && (
        <div className="p-3 bg-muted/40 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-0.5">Message from sender:</p>
          <p className="text-sm text-foreground italic">"{document.message}"</p>
        </div>
      )}

      {/* Inline PDF Viewer */}
      <InlinePDFViewer fileUrl={document.file_url} />

      {/* Approval form */}
      <Card className="p-5 sm:p-8 space-y-5" id="approval-form">
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

function PageShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <div className={`${wide ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-4 py-6 sm:py-10 space-y-5`}>
        {/* Logo */}
        <div className="flex justify-center">
          <img src={notewellLogo} alt="Notewell" className="h-10 sm:h-12" />
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

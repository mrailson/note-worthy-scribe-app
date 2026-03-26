import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CheckCircle2, Clock, XCircle, Ban, Loader2, Download, 
  Shield, Send, Copy, Lock, Plus, User, Mail, Building2, Calendar,
  Eye, PenLine, Bell, FileSignature, Award, Trash2, ArrowLeft,
  ZoomIn, ZoomOut, Archive,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
import { Header } from '@/components/Header';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDocumentApproval, ApprovalDocument, ApprovalSignatory } from '@/hooks/useDocumentApproval';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateSignedPdf, generateCertificatePdf, SignatoryInfo, SignaturePlacement, AuditLogEntry } from '@/utils/generateSignedPdf';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';
import { useEffect as useEffectAlias } from 'react';

// ─── Constants ─────────────────────────────────────────────────────
const BRAND_GREEN = '#1B6B4A';
const DARK_GREEN = '#145237';
const GOLD = '#D4A843';
const LIGHT_GREEN_BG = '#E8F5EE';
const LIGHT_GOLD_BG = '#FEF9EC';
const PAGE_BG = '#FAFAF8';
const CARD_BORDER = '#E8E6E1';
const MUTED_TEXT = '#6B6960';
const LIGHT_TEXT = '#9C9889';

const GOOGLE_FONTS_URL = `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&family=Dancing+Script:wght@600&family=Caveat:wght@600&family=Great+Vibes&family=Sacramento&family=Satisfy&display=swap`;

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA', dsa: 'DSA', mou: 'MOU', policy: 'Policy',
  contract: 'Contract', privacy_notice: 'Privacy Notice',
  governance: 'Governance', other: 'Governance',
};

const downloadFromStorage = async (fileUrl: string): Promise<Blob> => {
  const storagePath = fileUrl.split('/approval-documents/')[1];
  if (storagePath) {
    const { data, error } = await supabase.storage.from('approval-documents').download(storagePath);
    if (error || !data) throw error || new Error('Download failed');
    return data;
  }
  const res = await fetch(fileUrl);
  return res.blob();
};

// ─── Types ─────────────────────────────────────────────────────
type TabId = 'overview' | 'signatories' | 'certificate' | 'audit';

interface Props {
  document: ApprovalDocument;
  onBack: () => void;
}

// ─── QR Code ───────────────────────────────────────────────────
function QRCodeCanvas({ url, size = 80 }: { url: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size, margin: 1,
        color: { dark: DARK_GREEN, light: '#ffffff' },
      });
    }
  }, [url, size]);
  return <canvas ref={canvasRef} />;
}

// ─── Inline PDF Preview ────────────────────────────────────────
function InlinePdfPreview({ fileUrl }: { fileUrl: string }) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await downloadFromStorage(fileUrl);
        const arrayBuffer = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fileUrl]);

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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, background: PAGE_BG, borderRadius: 8 }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 className="h-7 w-7 animate-spin mx-auto" style={{ color: BRAND_GREEN }} />
          <p style={{ fontSize: 13, color: MUTED_TEXT, marginTop: 8 }}>Loading document…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, background: PAGE_BG, borderRadius: 8 }}>
        <div style={{ textAlign: 'center' }}>
          <FileText className="h-7 w-7 mx-auto" style={{ color: LIGHT_TEXT }} />
          <p style={{ fontSize: 13, color: MUTED_TEXT, marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 12px', background: '#F0EFEC', borderRadius: '8px 8px 0 0', borderBottom: `1px solid ${CARD_BORDER}`,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED_TEXT }}>
          <FileText size={14} />
          <span style={{ fontWeight: 500 }}>Page {currentPage} of {totalPages}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(50, z - 10))} disabled={zoom <= 50}>
            <ZoomOut size={14} />
          </Button>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: MUTED_TEXT, width: 36, textAlign: 'center' }}>{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(200, z + 10))} disabled={zoom >= 200}>
            <ZoomIn size={14} />
          </Button>
        </div>
      </div>

      {/* Page pills */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
          background: '#F5F4F1', borderLeft: `1px solid ${CARD_BORDER}`, borderRight: `1px solid ${CARD_BORDER}`,
          overflowX: 'auto',
        }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
            <button
              key={pg}
              onClick={() => scrollToPage(pg)}
              style={{
                padding: '2px 8px', fontSize: 11, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: pg === currentPage ? BRAND_GREEN : 'transparent',
                color: pg === currentPage ? '#fff' : MUTED_TEXT,
                fontWeight: pg === currentPage ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {pg}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable PDF area */}
      <div
        ref={scrollRef}
        style={{
          height: '55vh', overflowY: 'auto', background: '#E8E6E1',
          borderRadius: '0 0 8px 8px', border: `1px solid ${CARD_BORDER}`, borderTop: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 12px' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              data-page={pageNum}
              ref={el => { pageRefs.current.set(pageNum, el); }}
              style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 4, maxWidth: '100%' }}
            >
              <canvas
                ref={el => { canvasRefs.current.set(pageNum, el); }}
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export function ApprovalDocumentDetail({ document: doc, onBack }: Props) {
  const { fetchSignatories, fetchAuditLog, revokeDocument, closeDocument, deleteDocument } = useDocumentApproval();
  const [signatories, setSignatories] = useState<ApprovalSignatory[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const signedFileUrl = (doc as any).signed_file_url as string | null;
  const signaturePlacement = (doc as any).signature_placement as SignaturePlacement | null;
  const [localSignedUrl, setLocalSignedUrl] = useState<string | null>(signedFileUrl);
  const autoGenTriggered = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [sigs, log] = await Promise.all([
          fetchSignatories(doc.id),
          fetchAuditLog(doc.id),
        ]);
        if (!cancelled) { setSignatories(sigs); setAuditLog(log); }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [doc.id, fetchSignatories, fetchAuditLog]);

  const approvedCount = signatories.filter(s => s.status === 'approved').length;
  const totalCount = signatories.length;
  const progress = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  const allApproved = totalCount > 0 && approvedCount === totalCount;
  const isCompleted = doc.status === 'completed';
  const certificateId = `NW-CERT-${new Date(doc.created_at).getFullYear()}-${doc.id.substring(0, 5).toUpperCase()}`;
  const verificationUrl = `https://gpnotewell.co.uk/verify/${certificateId}`;
  const categoryLabel = categoryLabels[doc.category] || doc.category || 'Governance';

  // ─── Core signed PDF generation (shared by auto-gen and manual download) ──
  const generateSignedPdfCore = async (): Promise<Blob> => {
    const fileName = doc.original_filename?.toLowerCase() || '';
    const isPdf = fileName.endsWith('.pdf') || doc.file_url?.toLowerCase().includes('.pdf');
    let pdfBytes: ArrayBuffer;
    if (!isPdf) {
      const { PDFDocument } = await import('pdf-lib');
      const blankDoc = await PDFDocument.create();
      pdfBytes = (await blankDoc.save()).buffer as ArrayBuffer;
    } else {
      const blob = await downloadFromStorage(doc.file_url);
      pdfBytes = await blob.arrayBuffer();
    }
    const certId = certificateId;
    const sigInfos: SignatoryInfo[] = signatories.map(s => ({
      id: s.id, name: s.name, email: s.email, role: s.role, organisation: s.organisation,
      signed_at: s.signed_at, signed_name: s.signed_name, signed_role: s.signed_role,
      signed_organisation: s.signed_organisation,
      signed_ip: (s as any).signed_ip || null,
      signatory_title: s.signatory_title || null,
    }));
    const auditLogEntries: AuditLogEntry[] = auditLog.map((e: any) => ({
      action: e.action, actor_name: e.actor_name, actor_email: e.actor_email,
      created_at: e.created_at, ip_address: e.ip_address,
    }));
    const placement: SignaturePlacement = !isPdf ? { method: 'append' } : (signaturePlacement || { method: 'append' });
    const signedPdfBytes = await generateSignedPdf({
      originalPdfBytes: pdfBytes, title: doc.title, originalFilename: doc.original_filename,
      certificateId: certId, fileHash: doc.file_hash, signatories: sigInfos, placement,
      auditLog: auditLogEntries, completedAt: (doc as any).completed_at,
    });
    const signedBlob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const storagePath = `signed/${doc.id}-signed-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage.from('approval-documents').upload(storagePath, signedBlob);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('approval-documents').getPublicUrl(storagePath);
    await supabase.from('approval_documents').update({ signed_file_url: publicUrl } as any).eq('id', doc.id);
    await supabase.from('approval_audit_log').insert({
      document_id: doc.id, action: 'signed_document_generated', actor_name: 'System',
      metadata: { certificate_id: certId, method: placement.method } as any,
    });
    setLocalSignedUrl(publicUrl);
    return signedBlob;
  };

  // ─── Handlers ────────────────────────────────────────────────
  const handleGenerateSignedPdf = async () => {
    setGenerating(true);
    try {
      const signedBlob = await generateSignedPdfCore();
      toast.success('Signed document generated');
      const downloadUrl = URL.createObjectURL(signedBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${doc.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}-signed.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (err) {
      console.error('Failed to generate signed PDF:', err);
      toast.error('Failed to generate signed document');
    } finally { setGenerating(false); }
  };

  // Auto-generate signed PDF for completed documents on first load
  useEffect(() => {
    if (isCompleted && !localSignedUrl && !loading && signatories.length > 0 && !generating && !autoGenTriggered.current) {
      autoGenTriggered.current = true;
      setGenerating(true);
      generateSignedPdfCore()
        .then(() => { /* preview updates via setLocalSignedUrl inside core */ })
        .catch(err => console.error('Auto-generation failed:', err))
        .finally(() => setGenerating(false));
    }
  }, [isCompleted, localSignedUrl, loading, signatories.length, generating]);



  const handleDownloadSignedPdf = async () => {
    // Always regenerate the signed PDF to ensure latest rendering logic is used
    await handleGenerateSignedPdf();
  };

  const handleDownloadPartialPdf = async () => {
    setGenerating(true);
    try {
      const fileName = doc.original_filename?.toLowerCase() || '';
      const isPdf = fileName.endsWith('.pdf') || doc.file_url?.toLowerCase().includes('.pdf');
      let pdfBytes: ArrayBuffer;
      if (!isPdf) {
        const { PDFDocument } = await import('pdf-lib');
        const blankDoc = await PDFDocument.create();
        pdfBytes = (await blankDoc.save()).buffer as ArrayBuffer;
      } else {
        const blob = await downloadFromStorage(doc.file_url);
        pdfBytes = await blob.arrayBuffer();
      }
      const sigInfos: SignatoryInfo[] = signatories.map(s => ({
        id: s.id, name: s.name, email: s.email, role: s.role, organisation: s.organisation,
        signed_at: s.signed_at, signed_name: s.signed_name, signed_role: s.signed_role,
        signed_organisation: s.signed_organisation,
        signed_ip: (s as any).signed_ip || null,
        signatory_title: s.signatory_title || null,
      }));
      const auditLogEntries: AuditLogEntry[] = auditLog.map((e: any) => ({
        action: e.action, actor_name: e.actor_name, actor_email: e.actor_email,
        created_at: e.created_at, ip_address: e.ip_address,
      }));
      const placement: SignaturePlacement = !isPdf ? { method: 'append' } : (signaturePlacement || { method: 'append' });
      const signedPdfBytes = await generateSignedPdf({
        originalPdfBytes: pdfBytes, title: doc.title, originalFilename: doc.original_filename,
        certificateId, fileHash: doc.file_hash, signatories: sigInfos, placement,
        auditLog: auditLogEntries, completedAt: null,
      });
      const partialBlob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(partialBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${doc.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}-partial-signatures.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success(`Downloaded with ${approvedCount} of ${totalCount} signature${approvedCount !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Failed to generate partial PDF:', err);
      toast.error('Failed to generate document with partial signatures');
    } finally { setGenerating(false); }
  };

  const handleSendCompletedDocument = async () => {
    setSending(true);
    try {
      let currentSignedUrl = signedFileUrl;
      if (!currentSignedUrl) {
        await handleGenerateSignedPdf();
        const { data: updatedDoc } = await supabase.from('approval_documents').select('signed_file_url').eq('id', doc.id).single();
        currentSignedUrl = (updatedDoc as any)?.signed_file_url;
      }
      if (!currentSignedUrl) { toast.error('Could not generate signed PDF'); return; }
      const { error } = await supabase.functions.invoke('send-approval-email', {
        body: { type: 'send_completed', document_id: doc.id, signed_file_url: currentSignedUrl },
      });
      if (error) throw error;
      toast.success('Completed document sent to all parties');
    } catch (err) {
      console.error('Failed to send:', err);
      toast.error('Failed to send completed document');
    } finally { setSending(false); }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    toast.success('Link copied to clipboard');
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try { await revokeDocument(doc.id); onBack(); } finally { setRevoking(false); }
  };

  const handleClose = async () => {
    setClosing(true);
    try { await closeDocument(doc.id); onBack(); } finally { setClosing(false); }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'signatories', label: 'Signatories' },
    { id: 'certificate', label: 'Certificate' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={GOOGLE_FONTS_URL} rel="stylesheet" />

      <div style={{ background: PAGE_BG, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        {/* ── Standard Notewell Header ─────────────────────────── */}
        <Header />

        {/* ── Content Container ───────────────────────────────── */}
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px' }}>
          {/* Back to list */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Document Approvals
          </Button>
          {/* Document Header */}
          <div style={{
            background: '#ffffff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
            padding: '24px', marginBottom: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <FileText size={28} color={BRAND_GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{
                  fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#1a1a1a',
                  margin: 0, lineHeight: 1.3,
                }}>
                  {doc.title}
                </h1>
              </div>
            </div>

            {/* Metadata row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: LIGHT_GREEN_BG, color: BRAND_GREEN, fontSize: 12, fontWeight: 600,
                borderRadius: 20, padding: '4px 12px',
              }}>
                <CheckCircle2 size={13} />
                {doc.status === 'completed' ? 'Signed' : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#F3F2EF', color: MUTED_TEXT, fontSize: 12, fontWeight: 500,
                borderRadius: 20, padding: '4px 12px',
              }}>
                {categoryLabel}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: MUTED_TEXT, fontSize: 12 }}>
                <Calendar size={13} />
                {format(new Date(doc.created_at), 'dd MMM yyyy')}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: LIGHT_TEXT,
                background: '#F3F2EF', borderRadius: 6, padding: '3px 8px',
              }}>
                {certificateId}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{
              borderTop: `1px solid ${CARD_BORDER}`, marginTop: 20, paddingTop: 16,
              display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            }}>
              {isCompleted && allApproved && (
                <>
                  <Button
                    size="sm"
                    className="gap-2"
                    style={{ background: BRAND_GREEN, color: '#fff' }}
                    onClick={handleDownloadSignedPdf}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download Signed PDF
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-2"
                    onClick={handleSendCompletedDocument} disabled={sending || generating}
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {sending ? 'Sending…' : 'Send Completed Document'}
                  </Button>
                </>
              )}
              {(doc.status === 'pending' || doc.status === 'closed') && (
                <Button
                  variant="outline" size="sm" className="gap-2"
                  onClick={handleDownloadPartialPdf}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {approvedCount > 0 ? 'Download with Signatures So Far' : 'Download Document'}
                </Button>
              )}
              {doc.status === 'pending' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-amber-600 border-amber-300">
                      {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                      Close
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Close this document?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Chase reminders will stop. You can still download the document with any signatures collected so far.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClose} disabled={closing}>
                        {closing ? 'Closing…' : 'Close Document'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {doc.status === 'pending' && (
                <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30" onClick={handleRevoke} disabled={revoking}>
                  {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  Revoke
                </Button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyLink}>
                  <Copy className="h-3.5 w-3.5" /> Copy Link
                </Button>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{
              display: 'flex', borderTop: `1px solid ${CARD_BORDER}`, marginTop: 16,
              marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24,
            }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '14px 20px', border: 'none', background: 'transparent',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    color: activeTab === tab.id ? BRAND_GREEN : LIGHT_TEXT,
                    borderBottom: activeTab === tab.id ? `2px solid ${BRAND_GREEN}` : '2px solid transparent',
                    transition: 'all 0.2s',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ marginTop: 20 }}>
            {loading ? (
              <Card border style={{ padding: 40, textAlign: 'center' }}>
                <Loader2 className="h-6 w-6 animate-spin mx-auto" style={{ color: BRAND_GREEN }} />
                <p style={{ color: MUTED_TEXT, fontSize: 13, marginTop: 12 }}>Loading…</p>
              </Card>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <OverviewTab
                    doc={doc}
                    signatories={signatories}
                    approvedCount={approvedCount}
                    totalCount={totalCount}
                    progress={progress}
                    signaturePlacement={signaturePlacement}
                    certificateId={certificateId}
                    generating={generating}
                    localSignedUrl={localSignedUrl}
                  />
                )}
                {activeTab === 'signatories' && (
                  <SignatoriesTab signatories={signatories} />
                )}
                {activeTab === 'certificate' && (
                  <CertificateTab
                    doc={doc}
                    signatories={signatories}
                    certificateId={certificateId}
                    allApproved={allApproved}
                    approvedCount={approvedCount}
                    verificationUrl={verificationUrl}
                    auditLog={auditLog}
                  />
                )}
                {activeTab === 'audit' && (
                  <AuditTrailTab auditLog={auditLog} signatories={signatories} doc={doc} />
                )}
              </>
            )}
          </div>

          {/* Delete action - only visible on audit tab */}
          {activeTab === 'audit' && (
          <div style={{ marginTop: 24 }}>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={deleting} size="sm">
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete Document
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{doc.title}" and all associated signatories, audit records and stored files. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      setDeleting(true);
                      try { await deleteDocument(doc.id); onBack(); }
                      catch (err) { console.error(err); toast.error('Failed to delete'); setDeleting(false); }
                    }}
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────
function Card({ children, border, style }: { children: React.ReactNode; border?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
      padding: 24, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: LIGHT_TEXT,
      textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function MetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }} className="detail-meta-grid">
      <style>{`@media (max-width: 640px) { .detail-meta-grid { grid-template-columns: 1fr !important; } }`}</style>
      {children}
    </div>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: LIGHT_TEXT, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: '#1a1a1a',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────
function OverviewTab({
  doc, signatories, approvedCount, totalCount, progress, signaturePlacement, certificateId, generating, localSignedUrl,
}: {
  doc: ApprovalDocument;
  signatories: ApprovalSignatory[];
  approvedCount: number;
  totalCount: number;
  progress: number;
  signaturePlacement: SignaturePlacement | null;
  certificateId: string;
  generating: boolean;
  localSignedUrl: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Approval Progress */}
      <Card>
        <SectionLabel>APPROVAL PROGRESS</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            {approvedCount} of {totalCount} approved
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: BRAND_GREEN }}>{progress}%</span>
        </div>
        <div style={{ height: 8, background: '#F3F2EF', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 8,
            background: `linear-gradient(90deg, ${BRAND_GREEN}, ${GOLD})`,
            width: `${progress}%`, transition: 'width 0.5s ease',
          }} />
        </div>
      </Card>

      {/* Document Preview - Inline PDF Viewer (show signed version if available) */}
      <Card>
        <SectionLabel>DOCUMENT PREVIEW</SectionLabel>
        {generating && !localSignedUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, color: MUTED_TEXT }}>
            <Loader2 className="animate-spin" size={20} />
            <span style={{ fontSize: 14 }}>Generating signed document…</span>
          </div>
        ) : (
          <InlinePdfPreview fileUrl={localSignedUrl || doc.file_url} />
        )}
      </Card>

      {/* Document Notes */}
      {(doc.message || doc.description) && (
        <Card>
          <SectionLabel>DOCUMENT NOTES</SectionLabel>
          <div style={{
            background: LIGHT_GOLD_BG, borderRadius: 8, padding: '14px 18px',
            fontSize: 13, color: MUTED_TEXT, fontStyle: 'italic', lineHeight: 1.6,
          }}>
            {doc.message || doc.description}
          </div>
        </Card>
      )}

      {/* Document Details */}
      <Card>
        <SectionLabel>DOCUMENT DETAILS</SectionLabel>
        <MetaGrid>
          <MetaItem label="Filename" value={doc.original_filename} />
          <MetaItem label="Signature Method" value={
            signaturePlacement?.method === 'stamp'
              ? `Stamp (page ${signaturePlacement.page})`
              : 'Append page'
          } />
          <MetaItem label="Category" value={categoryLabels[doc.category] || doc.category || 'Governance'} />
          <MetaItem label="Reference" value={certificateId} mono />
        </MetaGrid>
        <div style={{ marginTop: 16 }}>
          <HashBox hash={doc.file_hash} />
        </div>
      </Card>
    </div>
  );
}

function HashBox({ hash }: { hash: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    toast.success('Hash copied');
  };
  return (
    <div style={{
      background: '#F3F2EF', borderRadius: 8, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Lock size={14} color={LIGHT_TEXT} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED_TEXT,
        flex: 1, wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        SHA-256: {hash}
      </span>
      <button
        onClick={handleCopy}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: LIGHT_TEXT }}
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

// ─── Signatories Tab ───────────────────────────────────────────
function SignatoriesTab({ signatories }: { signatories: ApprovalSignatory[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {signatories.map(sig => {
        const isSigned = sig.status === 'approved';
        const displayName = sig.signed_name || sig.name;
        const displayRole = sig.signed_role || sig.role || '';
        const displayOrg = sig.signed_organisation || sig.organisation || '';

        return (
          <Card key={sig.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{
                  fontFamily: "'DM Serif Display', serif", fontSize: 20, color: '#1a1a1a',
                  margin: 0, lineHeight: 1.3,
                }}>
                  {displayName}
                </h3>
                {(displayRole || displayOrg) && (
                  <p style={{ fontSize: 13, color: MUTED_TEXT, margin: '4px 0 0' }}>
                    {displayRole}{displayRole && displayOrg ? ' · ' : ''}{displayOrg}
                  </p>
                )}
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: isSigned ? LIGHT_GREEN_BG : '#FEF3C7',
                color: isSigned ? BRAND_GREEN : '#92400E',
                fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '4px 12px',
              }}>
                {isSigned ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                {isSigned ? 'Signed' : 'Pending'}
              </span>
            </div>

            <MetaGrid>
              <MetaItem label="Email" value={sig.email} mono />
              <MetaItem label="Organisation" value={displayOrg || '—'} />
              {sig.signed_at && (
                <MetaItem label="Signed At" value={format(new Date(sig.signed_at), "dd MMM yyyy 'at' HH:mm")} mono />
              )}
              {(sig as any).signed_ip && (
                <MetaItem label="IP Address" value={(sig as any).signed_ip} mono />
              )}
            </MetaGrid>

            {sig.decline_comment && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                <strong>Decline reason:</strong> {sig.decline_comment}
              </div>
            )}
          </Card>
        );
      })}

      {/* Add signatory placeholder */}
      <div style={{
        border: `2px dashed ${CARD_BORDER}`, borderRadius: 12, padding: '28px 24px',
        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <Plus size={24} color={LIGHT_TEXT} />
        <span style={{ fontSize: 13, color: LIGHT_TEXT }}>
          Add Signatory (for multi-signer workflows)
        </span>
      </div>
    </div>
  );
}

// ─── Certificate Tab ───────────────────────────────────────────
function CertificateTab({
  doc, signatories, certificateId, allApproved, approvedCount, verificationUrl, auditLog,
}: {
  doc: ApprovalDocument;
  signatories: ApprovalSignatory[];
  certificateId: string;
  allApproved: boolean;
  approvedCount: number;
  verificationUrl: string;
  auditLog: any[];
}) {
  const categoryLabel = categoryLabels[doc.category] || doc.category || 'Governance';
  const [downloading, setDownloading] = useState(false);

  const handleDownloadCertificate = async () => {
    setDownloading(true);
    try {
      const sigInfos: SignatoryInfo[] = signatories.map(s => ({
        id: s.id, name: s.name, email: s.email, role: s.role, organisation: s.organisation,
        signed_at: s.signed_at, signed_name: s.signed_name, signed_role: s.signed_role,
        signed_organisation: s.signed_organisation,
        signed_ip: (s as any).signed_ip || null,
        signatory_title: s.signatory_title || null,
      }));
      const auditLogEntries: AuditLogEntry[] = auditLog.map(a => ({
        action: a.action, actor_name: a.actor_name || 'System',
        actor_email: a.actor_email || null,
        created_at: a.created_at, ip_address: a.metadata?.ip_address || null,
      }));
      const pdfBytes = await generateCertificatePdf({
        title: doc.title, originalFilename: doc.original_filename,
        certificateId, fileHash: doc.file_hash, signatories: sigInfos,
        auditLog: auditLogEntries, completedAt: (doc as any).completed_at,
      });
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificate-${certificateId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to generate certificate PDF:', err);
      toast.error('Failed to generate certificate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Download button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadCertificate} disabled={downloading}>
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download Certificate as PDF
        </Button>
      </div>
      {/* Green gradient header */}
      <div style={{
        background: `linear-gradient(135deg, ${DARK_GREEN} 0%, ${BRAND_GREEN} 100%)`,
        borderRadius: 12, padding: '24px 28px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: `linear-gradient(90deg, transparent, rgba(212,168,67,0.08))`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#ffffff' }}>
              Notewell
            </span>
            <div style={{
              fontSize: 11, fontWeight: 600, color: GOLD, textTransform: 'uppercase',
              letterSpacing: '1.5px', marginTop: 6,
            }}>
              ELECTRONIC SIGNATURE CERTIFICATE
            </div>
          </div>
          {allApproved && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(22,163,74,0.15)', borderRadius: 20, padding: '5px 14px',
              fontSize: 11, fontWeight: 600, color: '#16a34a',
            }}>
              <CheckCircle2 size={14} /> COMPLETE
            </span>
          )}
        </div>
      </div>

      {/* Document Details */}
      <Card>
        <SectionLabel>DOCUMENT DETAILS</SectionLabel>
        <MetaGrid>
          <MetaItem label="Document" value={doc.original_filename} />
          <MetaItem label="Reference" value={certificateId} mono />
        </MetaGrid>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
            background: allApproved ? '#16a34a' : '#f59e0b',
          }} />
          <span style={{
            fontSize: 13, fontWeight: 500,
            background: allApproved ? LIGHT_GREEN_BG : '#FEF3C7',
            color: allApproved ? BRAND_GREEN : '#92400E',
            borderRadius: 20, padding: '3px 10px',
          }}>
            {allApproved ? 'All parties signed' : `Awaiting ${signatories.length - approvedCount} signature${signatories.length - approvedCount !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <HashBox hash={doc.file_hash} />
        </div>
      </Card>

      {/* Signatories */}
      <Card>
        <SectionLabel>SIGNATORIES ({approvedCount} OF {signatories.length})</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {signatories.map(sig => {
            const isSigned = sig.status === 'approved';
            const displayName = sig.signed_name || sig.name;
            const displayRole = sig.signed_role || sig.role || '';
            const displayOrg = sig.signed_organisation || sig.organisation || '';
            const displayTitle = sig.signatory_title || '';
            const font = (sig as any).signature_font || 'Dancing Script';

            return (
              <div key={sig.id} style={{
                background: isSigned ? '#F0FDF4' : '#ffffff',
                border: `1px solid ${isSigned ? '#BBF7D0' : CARD_BORDER}`,
                borderRadius: 8, padding: '18px 22px', position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', top: 14, right: 16,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600,
                  color: isSigned ? BRAND_GREEN : '#92400e',
                  background: isSigned ? LIGHT_GREEN_BG : '#FEF3C7',
                  borderRadius: 20, padding: '3px 10px',
                }}>
                  {isSigned ? '✓ SIGNED' : '⏳ PENDING'}
                </span>
                <div style={{
                  fontFamily: `'${font}', cursive`, fontSize: 28,
                  color: DARK_GREEN, marginBottom: 12, lineHeight: 1.2,
                }}>
                  {displayName}
                </div>
                <MetaGrid>
                  <MetaItem label="Name" value={`${displayTitle ? displayTitle + ' ' : ''}${displayName}`} />
                  <MetaItem label="Role" value={displayRole || '—'} />
                  <MetaItem label="Email" value={sig.email} mono />
                  <MetaItem label="Organisation" value={displayOrg || '—'} />
                </MetaGrid>
                {isSigned && sig.signed_at && (
                  <div style={{
                    borderTop: '1px dashed #D1D5DB', paddingTop: 10, marginTop: 10,
                    display: 'flex', flexWrap: 'wrap', gap: '4px 20px',
                    fontSize: 12, color: MUTED_TEXT,
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                      {format(new Date(sig.signed_at), "dd MMM yyyy 'at' HH:mm:ss 'UTC'")}
                    </span>
                    {(sig as any).signed_ip && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: LIGHT_TEXT }}>
                        IP: {(sig as any).signed_ip}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Verification */}
      <Card>
        <SectionLabel>VERIFICATION</SectionLabel>
        <div style={{
          background: '#F3F2EF', borderRadius: 8, padding: '20px 24px',
          display: 'flex', gap: 24, alignItems: 'center',
        }} className="cert-verification-box">
          <style>{`@media (max-width: 640px) { .cert-verification-box { flex-direction: column !important; text-align: center !important; } }`}</style>
          <div style={{ flexShrink: 0 }}>
            <QRCodeCanvas url={verificationUrl} size={80} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.6, margin: '0 0 10px' }}>
              Scan the QR code or visit the URL below to independently verify the authenticity
              and integrity of this signed document.
            </p>
            <div style={{
              background: '#ffffff', border: `1px solid ${CARD_BORDER}`, borderRadius: 6,
              padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, color: BRAND_GREEN, wordBreak: 'break-all',
            }}>
              {verificationUrl}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, color: LIGHT_TEXT, lineHeight: 1.7, margin: '0 0 8px' }}>
            <strong style={{ color: MUTED_TEXT }}>Legal Basis:</strong> This electronic signature certificate
            is issued in accordance with the Electronic Communications Act 2000 and UK eIDAS regulations.
          </p>
          <p style={{ fontSize: 11, color: LIGHT_TEXT, lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: MUTED_TEXT }}>Integrity:</strong> The SHA-256 hash above was computed
            at the time of signing. Any modification to the original document after signing will produce
            a different hash value, indicating the document has been altered.
          </p>
        </div>
      </Card>

      {/* Footer */}
      <p style={{ fontSize: 10, color: LIGHT_TEXT, textAlign: 'center', margin: '8px 0 0' }}>
        Notewell · Powered by PCN Services Ltd · MHRA Class I Registered Medical Device
      </p>
    </div>
  );
}

// ─── Audit Trail Tab ───────────────────────────────────────────
function AuditTrailTab({
  auditLog, signatories, doc,
}: {
  auditLog: any[];
  signatories: ApprovalSignatory[];
  doc: ApprovalDocument;
}) {
  const eventConfig: Record<string, { label: string; dotColor: string }> = {
    created: { label: 'Document created', dotColor: LIGHT_TEXT },
    sent: { label: 'Approval request sent', dotColor: GOLD },
    viewed: { label: 'Document viewed', dotColor: '#94A3B8' },
    approved: { label: 'Document approved & signed', dotColor: BRAND_GREEN },
    declined: { label: 'Document declined', dotColor: '#DC2626' },
    revoked: { label: 'Approval revoked', dotColor: '#DC2626' },
    reminder_sent: { label: 'Reminder sent', dotColor: GOLD },
    signed_document_generated: { label: 'Signed PDF generated', dotColor: BRAND_GREEN },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <SectionLabel>CHRONOLOGICAL EVENT LOG</SectionLabel>
        <div style={{ position: 'relative', paddingLeft: 36 }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 11, top: 12, bottom: 12,
            width: 2, background: CARD_BORDER,
          }} />

          {auditLog.map((event, i) => {
            const cfg = eventConfig[event.action] || { label: event.action.replace(/_/g, ' '), dotColor: LIGHT_TEXT };
            return (
              <div key={event.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                marginBottom: i < auditLog.length - 1 ? 20 : 0,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: -36, top: 4,
                  width: 12, height: 12, borderRadius: '50%',
                  background: cfg.dotColor, border: '2px solid #ffffff',
                  boxShadow: `0 0 0 2px ${CARD_BORDER}`,
                  zIndex: 1,
                }} />
                <div style={{ flex: 1, paddingTop: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                    {cfg.label}
                  </div>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
                    marginTop: 4, fontSize: 12, color: LIGHT_TEXT,
                  }}>
                    {event.actor_name && <span>{event.actor_name}</span>}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                      {format(new Date(event.created_at), "dd MMM yyyy 'at' HH:mm")}
                    </span>
                    {event.ip_address && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                        IP: {event.ip_address}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Download History */}
      <Card>
        <SectionLabel>DOWNLOAD HISTORY</SectionLabel>
        <p style={{ fontSize: 13, color: LIGHT_TEXT, fontStyle: 'italic', margin: 0 }}>
          No downloads recorded yet.
        </p>
      </Card>
    </div>
  );
}

export default ApprovalDocumentDetail;

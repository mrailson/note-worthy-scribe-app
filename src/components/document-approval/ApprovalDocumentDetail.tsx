import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, CheckCircle2, Clock, XCircle, Ban, ExternalLink, Loader2, Download, FileSignature, Award, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDocumentApproval, ApprovalDocument, ApprovalSignatory } from '@/hooks/useDocumentApproval';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateSignedPdf, SignatoryInfo, SignaturePlacement } from '@/utils/generateSignedPdf';
import { supabase } from '@/integrations/supabase/client';

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

interface Props {
  document: ApprovalDocument;
  onBack: () => void;
}

const signatoryStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-[hsl(var(--approval-completed-bg))] text-[hsl(var(--approval-approved))]', icon: <CheckCircle2 className="h-3 w-3" /> },
  declined: { label: 'Declined', color: 'bg-destructive/10 text-destructive', icon: <XCircle className="h-3 w-3" /> },
  expired: { label: 'Expired', color: 'bg-muted text-muted-foreground', icon: <Ban className="h-3 w-3" /> },
};

export function ApprovalDocumentDetail({ document: doc, onBack }: Props) {
  const { fetchSignatories, fetchAuditLog, revokeDocument, deleteDocument } = useDocumentApproval();
  const [signatories, setSignatories] = useState<ApprovalSignatory[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Access the raw doc data including new columns
  const signedFileUrl = (doc as any).signed_file_url as string | null;
  const signaturePlacement = (doc as any).signature_placement as SignaturePlacement | null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [sigs, log] = await Promise.all([
          fetchSignatories(doc.id),
          fetchAuditLog(doc.id),
        ]);
        if (!cancelled) {
          setSignatories(sigs);
          setAuditLog(log);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [doc.id, fetchSignatories, fetchAuditLog]);

  const approvedCount = signatories.filter(s => s.status === 'approved').length;
  const totalCount = signatories.length;
  const progress = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  const allApproved = totalCount > 0 && approvedCount === totalCount;
  const isCompleted = doc.status === 'completed';

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeDocument(doc.id);
      onBack();
    } finally {
      setRevoking(false);
    }
  };

  const handleGenerateSignedPdf = async () => {
    setGenerating(true);
    try {
      // Check if original file is a PDF
      const fileName = doc.original_filename?.toLowerCase() || '';
      const isPdf = fileName.endsWith('.pdf') || doc.file_url?.toLowerCase().includes('.pdf');

      let pdfBytes: ArrayBuffer;

      if (!isPdf) {
        // For non-PDF files (DOCX, etc.), create a standalone signature page
        // since we cannot embed signatures into non-PDF formats
        const { PDFDocument } = await import('pdf-lib');
        const blankDoc = await PDFDocument.create();
        pdfBytes = (await blankDoc.save()).buffer as ArrayBuffer;
      } else {
        // Fetch original PDF via Supabase SDK to bypass browser blocking
        const blob = await downloadFromStorage(doc.file_url);
        pdfBytes = await blob.arrayBuffer();
      }

      // Generate certificate ID
      const certId = `NW-CERT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

      const sigInfos: SignatoryInfo[] = signatories.map(s => ({
        name: s.name,
        email: s.email,
        role: s.role,
        organisation: s.organisation,
        signed_at: s.signed_at,
        signed_name: s.signed_name,
        signed_role: s.signed_role,
        signed_organisation: s.signed_organisation,
      }));

      const placement: SignaturePlacement = !isPdf 
        ? { method: 'append' }  // Force append for non-PDF files
        : (signaturePlacement || { method: 'append' });

      const signedPdfBytes = await generateSignedPdf({
        originalPdfBytes: pdfBytes,
        title: doc.title,
        certificateId: certId,
        fileHash: doc.file_hash,
        signatories: sigInfos,
        placement,
      });

      // Upload to storage
      const signedBlob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const storagePath = `signed/${doc.id}-signed-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('approval-documents')
        .upload(storagePath, signedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('approval-documents')
        .getPublicUrl(storagePath);

      // Update document record
      await supabase
        .from('approval_documents')
        .update({ signed_file_url: publicUrl } as any)
        .eq('id', doc.id);

      // Audit log
      await supabase.from('approval_audit_log').insert({
        document_id: doc.id,
        action: 'signed_document_generated',
        actor_name: 'System',
        metadata: { certificate_id: certId, method: placement.method } as any,
      });

      toast.success('Signed document generated successfully');
      // Download via blob URL to avoid browser/ad-blocker restrictions
      const downloadUrl = URL.createObjectURL(signedBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${doc.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}-signed.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (err) {
      console.error('Failed to generate signed PDF:', err);
      toast.error('Failed to generate signed document');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">
              {doc.original_filename}
              {/\.docx?$/i.test(doc.original_filename || '') && (
                <span className="text-primary ml-1">(converted to PDF)</span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
            try {
              const blob = await downloadFromStorage(doc.file_url);
              const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
              window.open(url, '_blank');
            } catch { toast.error('Failed to open PDF'); }
          }}>
            <ExternalLink className="h-3 w-3" /> View PDF
          </Button>
        </div>

        {/* Progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {approvedCount} of {totalCount} approved
            </span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <div className="flex gap-1">
            {signatories.map(sig => (
              <div
                key={sig.id}
                className="h-2 rounded-full transition-all"
                style={{
                  flex: 1,
                  backgroundColor: sig.status === 'approved'
                    ? 'hsl(var(--approval-approved))'
                    : sig.status === 'declined'
                      ? 'hsl(var(--destructive))'
                      : sig.viewed_at
                        ? 'hsl(var(--approval-viewed))'
                        : 'hsl(var(--approval-not-viewed) / 0.25)',
                }}
                title={`${sig.name}: ${sig.status}`}
              />
            ))}
          </div>
        </Card>

        {/* Signed Document Section */}
        {isCompleted && allApproved && (
          <Card className="p-5 border-[hsl(var(--approval-completed-border))] bg-[hsl(var(--approval-completed-bg))]">
            <div className="flex items-start gap-3">
              <FileSignature className="h-6 w-6 text-[hsl(var(--approval-approved))] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Signed Document</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  All {totalCount} signator{totalCount !== 1 ? 'ies' : 'y'} approved this document.
                  {signedFileUrl ? ' A signed version has been generated.' : ' Generate a signed version with embedded signature page.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {signedFileUrl ? (
                    <>
                      <Button size="sm" className="gap-2" onClick={async () => {
                        try {
                          const blob = await downloadFromStorage(signedFileUrl);
                          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                          const a = document.createElement('a'); a.href = url; a.download = `signed-${doc.original_filename || 'document.pdf'}`;
                          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                        } catch { toast.error('Failed to download signed PDF'); }
                      }}>
                        <Download className="h-3.5 w-3.5" /> Download Signed PDF
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                        try {
                          const blob = await downloadFromStorage(doc.file_url);
                          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                          const a = document.createElement('a'); a.href = url; a.download = doc.original_filename || 'document.pdf';
                          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                        } catch { toast.error('Failed to download document'); }
                      }}>
                        <Download className="h-3.5 w-3.5" /> Download PDF (unsigned)
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="gap-2" onClick={handleGenerateSignedPdf} disabled={generating}>
                      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
                      {generating ? 'Generating…' : 'Generate Signed PDF'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                    try {
                      const blob = await downloadFromStorage(doc.file_url);
                      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                      const a = document.createElement('a'); a.href = url; a.download = `audit-certificate-${doc.id}.pdf`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    } catch { toast.error('Failed to download audit certificate'); }
                  }}>
                    <Award className="h-3.5 w-3.5" /> Download Audit Certificate
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Details */}
        <Card className="p-4 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground">Category:</span>{' '}
              <span className="font-medium text-foreground">{doc.category.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <Badge variant="outline" className="text-xs">{doc.status}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              <span className="text-foreground">{format(new Date(doc.created_at), 'dd MMM yyyy, HH:mm')}</span>
            </div>
            {doc.deadline && (
              <div>
                <span className="text-muted-foreground">Deadline:</span>{' '}
                <span className="text-foreground">{format(new Date(doc.deadline), 'dd MMM yyyy')}</span>
              </div>
            )}
            {signaturePlacement && (
              <div>
                <span className="text-muted-foreground">Signature method:</span>{' '}
                <span className="text-foreground capitalize">{signaturePlacement.method === 'stamp' ? `Stamp (page ${signaturePlacement.page})` : 'Append page'}</span>
              </div>
            )}
          </div>
          {doc.description && <p className="text-muted-foreground pt-2 border-t border-border">{doc.description}</p>}
          <p className="text-xs text-muted-foreground">SHA-256: <code className="font-mono text-xs">{doc.file_hash}</code></p>
        </Card>

        {/* Signatories */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Signatories</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4">
                  <div className="animate-pulse space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-5 bg-muted rounded w-16" />
                    </div>
                    <div className="h-3 bg-muted rounded w-48" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {signatories.map(sig => {
                const cfg = signatoryStatusConfig[sig.status] || signatoryStatusConfig.pending;
                return (
                  <Card key={sig.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{sig.name}</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{sig.email}</p>
                        {sig.role && <p className="text-xs text-muted-foreground">{sig.role}{sig.organisation ? ` · ${sig.organisation}` : ''}</p>}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {sig.signed_at && <p>Signed: {format(new Date(sig.signed_at), 'dd MMM yyyy, HH:mm')}</p>}
                        {sig.viewed_at && !sig.signed_at && <p>Viewed: {format(new Date(sig.viewed_at), 'dd MMM yyyy, HH:mm')}</p>}
                        {sig.status === 'pending' && sig.reminder_count > 0 && (
                          <p>Reminders sent: {sig.reminder_count}</p>
                        )}
                      </div>
                    </div>
                    {sig.signed_name && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                        Signed as: <span className="font-medium">{sig.signed_name}</span>
                        {sig.signed_role && ` · ${sig.signed_role}`}
                      </p>
                    )}
                    {sig.decline_comment && (
                      <p className="text-xs text-destructive mt-2 pt-2 border-t border-border">
                        Decline reason: {sig.decline_comment}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit Log */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Audit Trail</h2>
          <Card className="divide-y divide-border">
            {auditLog.map((entry: any) => (
              <div key={entry.id} className="p-3 text-sm flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-foreground capitalize">{entry.action.replace(/_/g, ' ')}</span>
                  {entry.actor_name && <span className="text-muted-foreground"> by {entry.actor_name}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
            ))}
            {auditLog.length === 0 && !loading && (
              <div className="p-4 text-center text-sm text-muted-foreground">No audit entries yet</div>
            )}
          </Card>
        </div>

        {/* Actions */}
        {doc.status === 'pending' && (
          <Card className="p-4 flex gap-3">
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking} className="gap-2">
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Revoke Approval Request
            </Button>
          </Card>
        )}

        {/* Delete Document */}
        <Card className="p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                    try {
                      await deleteDocument(doc.id);
                      onBack();
                    } catch (err) {
                      console.error(err);
                      toast.error('Failed to delete document');
                      setDeleting(false);
                    }
                  }}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
    </div>
  );
}

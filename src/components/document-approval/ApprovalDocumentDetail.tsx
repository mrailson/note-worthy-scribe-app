import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, CheckCircle2, Clock, XCircle, Ban, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { useDocumentApproval, ApprovalDocument, ApprovalSignatory } from '@/hooks/useDocumentApproval';
import { format } from 'date-fns';

interface Props {
  document: ApprovalDocument;
  onBack: () => void;
}

const signatoryStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle2 className="h-3 w-3" /> },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: <XCircle className="h-3 w-3" /> },
  expired: { label: 'Expired', color: 'bg-muted text-muted-foreground', icon: <Ban className="h-3 w-3" /> },
};

export function ApprovalDocumentDetail({ document: doc, onBack }: Props) {
  const { fetchSignatories, fetchAuditLog, revokeDocument } = useDocumentApproval();
  const [signatories, setSignatories] = useState<ApprovalSignatory[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

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

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeDocument(doc.id);
      onBack();
    } finally {
      setRevoking(false);
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
            <p className="text-sm text-muted-foreground">{doc.original_filename}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(doc.file_url, '_blank')}>
            <ExternalLink className="h-3 w-3" /> View Document
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
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </Card>

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
          </div>
          {doc.description && <p className="text-muted-foreground pt-2 border-t border-border">{doc.description}</p>}
          <p className="text-xs text-muted-foreground">SHA-256: <code className="font-mono text-xs">{doc.file_hash}</code></p>
        </Card>

        {/* Signatories */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Signatories</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                  <span className="font-medium text-foreground capitalize">{entry.action}</span>
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
          <Card className="p-4">
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking} className="gap-2">
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Revoke Approval Request
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

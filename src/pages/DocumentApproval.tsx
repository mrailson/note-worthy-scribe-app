import { useState, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileCheck, Clock, CheckCircle2, XCircle, Ban, ArrowLeft, Loader2, AlertTriangle, FileText, Eye, Mail, MoreHorizontal, Download, Send, History } from 'lucide-react';
import { useDocumentApproval, ApprovalDocumentWithSignatories, ApprovalSignatory } from '@/hooks/useDocumentApproval';
import { CreateApprovalFlow } from '@/components/document-approval/CreateApprovalFlow';
import { ApprovalDocumentDetail } from '@/components/document-approval/ApprovalDocumentDetail';
import { ApprovalHistory } from '@/components/document-approval/ApprovalHistory';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA', dsa: 'DSA', mou: 'MOU', policy: 'Policy',
  contract: 'Contract', privacy_notice: 'Privacy Notice', other: 'Other',
};

type FilterType = 'all' | 'awaiting' | 'completed' | 'expired';
type SortType = 'recent' | 'deadline' | 'overdue';
type TabType = 'active' | 'history';

function isOverdue(doc: ApprovalDocumentWithSignatories): boolean {
  if (doc.status !== 'pending' || !doc.deadline) return false;
  return new Date(doc.deadline) < new Date();
}

function daysOverdue(doc: ApprovalDocumentWithSignatories): number {
  if (!doc.deadline) return 0;
  return Math.max(0, differenceInDays(new Date(), new Date(doc.deadline)));
}

function getSignatoryContext(sig: ApprovalSignatory, doc: ApprovalDocumentWithSignatories): { text: string; severity: 'normal' | 'amber' | 'red' } {
  if (sig.status === 'approved') return { text: '', severity: 'normal' };
  if (sig.status === 'declined') return { text: 'declined', severity: 'red' };

  const daysSinceSent = differenceInDays(new Date(), new Date(sig.created_at));

  if (sig.reminder_count > 0) {
    const lastReminder = sig.last_reminder_at
      ? formatDistanceToNow(new Date(sig.last_reminder_at), { addSuffix: true })
      : '';
    return {
      text: `reminded ×${sig.reminder_count}${lastReminder ? ` — last ${lastReminder}` : ''}`,
      severity: 'red',
    };
  }
  if (sig.viewed_at) {
    const daysSinceView = differenceInDays(new Date(), new Date(sig.viewed_at));
    return {
      text: `viewed ${format(new Date(sig.viewed_at), 'dd MMM')} — not yet signed`,
      severity: daysSinceView >= 2 ? 'amber' : 'normal',
    };
  }
  if (daysSinceSent === 0) return { text: 'sent today', severity: 'normal' };
  return {
    text: `sent ${daysSinceSent}d ago — no response`,
    severity: daysSinceSent >= 3 ? 'amber' : 'normal',
  };
}

export default function DocumentApproval() {
  const navigate = useNavigate();
  const { documents, loading, chaseSignatory, chaseAllPending, chaseAllOverdue } = useDocumentApproval();
  const [chasingDocId, setChasingDocId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ApprovalDocumentWithSignatories | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [activeTab, setActiveTab] = useState<TabType>('active');

  // Compute counts
  const counts = useMemo(() => {
    const total = documents.length;
    const awaiting = documents.filter(d => d.status === 'pending' || d.status === 'draft').length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const overdue = documents.filter(d => isOverdue(d)).length;
    return { total, awaiting, completed, overdue };
  }, [documents]);

  // Needs attention data
  const needsAttention = useMemo(() => {
    const overdueDocuments = documents.filter(d => isOverdue(d));
    
    // All pending signatories with no response across all docs
    const noResponseSignatories: { sig: ApprovalSignatory; doc: ApprovalDocumentWithSignatories; daysSince: number }[] = [];
    const declinedSignatories: { sig: ApprovalSignatory; doc: ApprovalDocumentWithSignatories }[] = [];

    for (const doc of documents) {
      if (doc.status !== 'pending') continue;
      for (const sig of doc.signatories) {
        if (sig.status === 'pending') {
          const daysSince = differenceInDays(new Date(), new Date(sig.created_at));
          noResponseSignatories.push({ sig, doc, daysSince });
        }
        if (sig.status === 'declined') {
          declinedSignatories.push({ sig, doc });
        }
      }
    }

    noResponseSignatories.sort((a, b) => b.daysSince - a.daysSince);

    return { overdueDocuments, noResponseSignatories, declinedSignatories };
  }, [documents]);

  // Filtered & sorted
  const filteredDocs = useMemo(() => {
    let list = [...documents];

    switch (filter) {
      case 'awaiting':
        list = list.filter(d => d.status === 'pending' || d.status === 'draft');
        break;
      case 'completed':
        list = list.filter(d => d.status === 'completed');
        break;
      case 'expired':
        list = list.filter(d => d.status === 'expired' || d.status === 'revoked');
        break;
    }

    switch (sort) {
      case 'deadline':
        list.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
        break;
      case 'overdue':
        list.sort((a, b) => daysOverdue(b) - daysOverdue(a));
        break;
      default:
        // already sorted by created_at desc from API
        break;
    }

    return list;
  }, [documents, filter, sort]);

  if (showCreate) {
    return <CreateApprovalFlow onBack={() => setShowCreate(false)} />;
  }

  if (selectedDoc) {
    return <ApprovalDocumentDetail document={selectedDoc} onBack={() => setSelectedDoc(null)} />;
  }

  const filterPills: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'awaiting', label: 'Awaiting Signatures' },
    { key: 'completed', label: 'Completed' },
    { key: 'expired', label: 'Expired / Revoked' },
  ];

  return (
    <>
      <Helmet>
        <title>Document Approvals | Notewell</title>
        <meta name="description" content="Send documents for electronic approval and track who has signed." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="h-6 w-6 text-primary" />
                  Document Approvals
                </h1>
                <p className="text-sm text-muted-foreground">
                  Send documents for electronic approval and track signatures
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Approval Request
            </Button>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-none border-b-2 text-sm px-4 ${activeTab === 'active' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('active')}
            >
              <FileCheck className="h-4 w-4 mr-1.5" />
              Active
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-none border-b-2 text-sm px-4 ${activeTab === 'history' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('history')}
            >
              <History className="h-4 w-4 mr-1.5" />
              History
            </Button>
          </div>

          {activeTab === 'history' ? (
            <ApprovalHistory documents={documents} onSelectDoc={setSelectedDoc} />
          ) : (
            <>
              {/* Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {filterPills.map(pill => (
                  <Button
                    key={pill.key}
                    variant={filter === pill.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(pill.key)}
                    className="text-xs"
                  >
                    {pill.label}
                  </Button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sort:</span>
                  {([
                    { key: 'recent' as SortType, label: 'Recent' },
                    { key: 'deadline' as SortType, label: 'Deadline' },
                    { key: 'overdue' as SortType, label: 'Overdue' },
                  ]).map(s => (
                    <Button
                      key={s.key}
                      variant={sort === s.key ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSort(s.key)}
                      className="text-xs"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card
                  className="p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setFilter('all')}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="h-5 w-5 text-primary" />
                    <p className="text-2xl font-bold text-foreground">{counts.total}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Total Documents</p>
                </Card>
                <Card
                  className="p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setFilter('awaiting')}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="h-5 w-5 text-[hsl(var(--warning))]" />
                    <p className="text-2xl font-bold text-foreground">{counts.awaiting}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Awaiting</p>
                </Card>
                <Card
                  className="p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setFilter('completed')}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle2 className="h-5 w-5 text-[hsl(var(--approval-approved))]" />
                    <p className="text-2xl font-bold text-foreground">{counts.completed}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </Card>
                <Card
                  className={`p-4 text-center cursor-pointer transition-colors ${
                    counts.overdue > 0 
                      ? 'border-destructive/50 bg-destructive/5 hover:border-destructive' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => { setFilter('awaiting'); setSort('overdue'); }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <AlertTriangle className={`h-5 w-5 ${counts.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <p className={`text-2xl font-bold ${counts.overdue > 0 ? 'text-destructive' : 'text-foreground'}`}>{counts.overdue}</p>
                  </div>
                  <p className={`text-xs ${counts.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>Overdue</p>
                </Card>
              </div>

              {/* Main Content + Sidebar */}
              <div className="flex gap-6">
                {/* Document List */}
                <div className="flex-1 min-w-0 space-y-3">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <Card key={i} className="p-5">
                          <div className="animate-pulse space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-4 w-4 bg-muted rounded" />
                              <div className="h-5 bg-muted rounded w-1/3" />
                              <div className="h-5 bg-muted rounded w-16" />
                            </div>
                            <div className="h-3 bg-muted rounded w-2/3" />
                            <div className="h-2 bg-muted rounded-full w-full" />
                            <div className="flex gap-3">
                              {[1, 2, 3, 4].map(j => (
                                <div key={j} className="h-3 bg-muted rounded w-20" />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <div className="h-8 bg-muted rounded w-24" />
                              <div className="h-8 bg-muted rounded w-28" />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : filteredDocs.length === 0 ? (
                    <Card className="p-12 text-center">
                      <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center">
                        <FileCheck className="h-12 w-12 text-primary/40" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {filter === 'all' ? 'No approval requests yet' : 'No documents match this filter'}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                        {filter === 'all'
                          ? 'Upload a document and send it for electronic approval. Track who has signed at a glance.'
                          : 'Try adjusting your filters to find what you\'re looking for.'}
                      </p>
                      {filter === 'all' && (
                        <Button onClick={() => setShowCreate(true)} size="lg" className="gap-2">
                          <Plus className="h-5 w-5" />
                          Create Your First Approval Request
                        </Button>
                      )}
                    </Card>
                  ) : (
                    filteredDocs.map(doc => (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        onSelect={() => setSelectedDoc(doc)}
                        onChasePending={async () => {
                          setChasingDocId(doc.id);
                          try {
                            const result = await chaseAllPending(doc.id);
                            const sentCount = result?.results?.filter((r: any) => r.status === 'sent').length || 0;
                            toast.success(`Reminders sent to ${sentCount} ${sentCount === 1 ? 'person' : 'people'}`);
                          } catch (err) {
                            toast.error('Failed to send reminders');
                          } finally {
                            setChasingDocId(null);
                          }
                        }}
                        isChasing={chasingDocId === doc.id}
                      />
                    ))
                  )}
                </div>

                {/* Right Sidebar - Needs Attention */}
                <div className="hidden lg:block w-80 flex-shrink-0">
                  <NeedsAttentionPanel
                    needsAttention={needsAttention}
                    onSelectDoc={(doc) => setSelectedDoc(doc)}
                    onChaseAllOverdue={async () => {
                      const overdueIds = needsAttention.overdueDocuments.map(d => d.id);
                      setChasingDocId('all-overdue');
                      try {
                        await chaseAllOverdue(overdueIds);
                        toast.success(`Reminders sent for ${overdueIds.length} overdue ${overdueIds.length === 1 ? 'document' : 'documents'}`);
                      } catch {
                        toast.error('Failed to send some reminders');
                      } finally {
                        setChasingDocId(null);
                      }
                    }}
                    isChasing={chasingDocId === 'all-overdue'}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Document Card ──────────────────────────────────────────────────────

function DocumentCard({ doc, onSelect, onChasePending, isChasing }: {
  doc: ApprovalDocumentWithSignatories;
  onSelect: () => void;
  onChasePending: () => void;
  isChasing: boolean;
}) {
  const sigs = doc.signatories;
  const approvedCount = sigs.filter(s => s.status === 'approved').length;
  const totalCount = sigs.length;
  const overdue = isOverdue(doc);
  const overdueDays = daysOverdue(doc);
  const isCompleted = doc.status === 'completed';
  const pendingCount = sigs.filter(s => s.status === 'pending' || (s.status !== 'approved' && s.status !== 'declined')).length;

  return (
    <Card className={`p-5 cursor-pointer hover:border-primary/50 transition-colors ${
      overdue ? 'border-destructive/40' : ''
    }`} onClick={onSelect}>
      {/* Title Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-foreground">{doc.title}</h3>
            {isCompleted && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </Badge>
            )}
            {overdue && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> {overdueDays}d overdue
              </Badge>
            )}
            {doc.status === 'pending' && !overdue && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1">
                <Clock className="h-3 w-3" /> Awaiting
              </Badge>
            )}
            {doc.status === 'draft' && (
              <Badge variant="secondary" className="text-xs">Draft</Badge>
            )}
            {(doc.status === 'revoked' || doc.status === 'expired') && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Ban className="h-3 w-3" /> {doc.status === 'revoked' ? 'Revoked' : 'Expired'}
              </Badge>
            )}
          </div>
          {doc.description && (
            <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Category: {categoryLabels[doc.category] || doc.category}
            {' │ '}Sent: {format(new Date(doc.created_at), 'dd MMM yyyy')}
            {doc.deadline && <>{' │ '}Deadline: {format(new Date(doc.deadline), 'dd MMM yyyy')}</>}
            {isCompleted && doc.completed_at && <>{' │ '}Completed: {format(new Date(doc.completed_at), 'dd MMM yyyy')}</>}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground">{approvedCount}/{totalCount} approved</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            {sigs.map((sig) => (
              <div
                key={sig.id}
                className={`h-full transition-all ${
                  sig.status === 'approved'
                    ? 'bg-green-500'
                    : sig.status === 'declined'
                      ? 'bg-destructive'
                      : sig.viewed_at
                        ? 'bg-amber-400'
                        : 'bg-muted-foreground/20'
                }`}
                style={{ width: `${100 / totalCount}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Signatories */}
      {sigs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {sigs.map(sig => {
            const ctx = getSignatoryContext(sig, doc);
            const isPending = sig.status === 'pending';
            return (
              <span key={sig.id} className={`text-xs flex items-center gap-1 ${
                ctx.severity === 'red' ? 'text-destructive font-medium'
                  : ctx.severity === 'amber' ? 'text-amber-600 dark:text-amber-400'
                  : isPending && overdue ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }`}>
                {sig.status === 'approved' ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : sig.status === 'declined' ? (
                  <XCircle className="h-3 w-3 text-destructive" />
                ) : sig.viewed_at ? (
                  <Eye className="h-3 w-3 text-amber-500" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {sig.name}
                {ctx.text && <span className="opacity-70">({ctx.text})</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={onSelect}>
          <Eye className="h-3 w-3" /> View Details
        </Button>
        {doc.status === 'pending' && pendingCount > 0 && (
          <Button
            variant={overdue ? 'destructive' : 'outline'}
            size="sm"
            className="text-xs gap-1"
            disabled={isChasing}
            onClick={onChasePending}
          >
            {isChasing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Mail className="h-3 w-3" />
            )}
            Chase Pending ({pendingCount})
          </Button>
        )}
        {isCompleted && (
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <Download className="h-3 w-3" /> Audit Certificate
          </Button>
        )}
      </div>
    </Card>
  );
}
// ─── Needs Attention Sidebar ────────────────────────────────────────────

interface NeedsAttentionProps {
  needsAttention: {
    overdueDocuments: ApprovalDocumentWithSignatories[];
    noResponseSignatories: { sig: ApprovalSignatory; doc: ApprovalDocumentWithSignatories; daysSince: number }[];
    declinedSignatories: { sig: ApprovalSignatory; doc: ApprovalDocumentWithSignatories }[];
  };
  onSelectDoc: (doc: ApprovalDocumentWithSignatories) => void;
  onChaseAllOverdue: () => void;
  isChasing: boolean;
}

function NeedsAttentionPanel({ needsAttention, onSelectDoc, onChaseAllOverdue, isChasing }: NeedsAttentionProps) {
  const { overdueDocuments, noResponseSignatories, declinedSignatories } = needsAttention;
  const hasAnything = overdueDocuments.length > 0 || noResponseSignatories.length > 0 || declinedSignatories.length > 0;

  return (
    <Card className="p-4 sticky top-6">
      <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Needs Attention
      </h2>

      {!hasAnything ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          All clear — no outstanding items
        </p>
      ) : (
        <div className="space-y-4">
          {/* Overdue */}
          <div>
            <h3 className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">
              Overdue ({overdueDocuments.length})
            </h3>
            {overdueDocuments.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <div className="space-y-2">
                {overdueDocuments.map(doc => {
                  const pending = doc.signatories.filter(s => s.status === 'pending').length;
                  return (
                    <div
                      key={doc.id}
                      className="p-2 bg-destructive/5 border border-destructive/20 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors"
                      onClick={() => onSelectDoc(doc)}
                    >
                      <p className="text-xs font-medium text-foreground truncate">
                        <Ban className="h-3 w-3 inline text-destructive mr-1" />
                        {doc.title}
                      </p>
                      <p className="text-xs text-destructive">
                        {pending} unsigned, {daysOverdue(doc)}d overdue
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* No Response */}
          <div>
            <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
              No Response ({noResponseSignatories.length})
            </h3>
            {noResponseSignatories.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <div className="space-y-1.5">
                {noResponseSignatories.slice(0, 8).map(({ sig, doc, daysSince }) => (
                  <div
                    key={sig.id}
                    className="p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => onSelectDoc(doc)}
                  >
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-500" />
                      {sig.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.title} ({daysSince}d)
                    </p>
                  </div>
                ))}
                {noResponseSignatories.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center">+{noResponseSignatories.length - 8} more</p>
                )}
              </div>
            )}
          </div>

          {/* Declined */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Recently Declined ({declinedSignatories.length})
            </h3>
            {declinedSignatories.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <div className="space-y-1.5">
                {declinedSignatories.map(({ sig, doc }) => (
                  <div
                    key={sig.id}
                    className="p-2 bg-destructive/5 rounded cursor-pointer hover:bg-destructive/10 transition-colors"
                    onClick={() => onSelectDoc(doc)}
                  >
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      {sig.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{doc.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chase All Overdue */}
          {(overdueDocuments.length > 0 || noResponseSignatories.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1 mt-2"
              disabled={isChasing}
              onClick={onChaseAllOverdue}
            >
              {isChasing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              Chase All Overdue
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

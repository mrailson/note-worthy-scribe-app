import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileCheck, Clock, CheckCircle2, XCircle, Ban, ArrowLeft, Loader2 } from 'lucide-react';
import { useDocumentApproval, ApprovalDocument } from '@/hooks/useDocumentApproval';
import { CreateApprovalFlow } from '@/components/document-approval/CreateApprovalFlow';
import { ApprovalDocumentDetail } from '@/components/document-approval/ApprovalDocumentDetail';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA',
  dsa: 'DSA',
  mou: 'MOU',
  policy: 'Policy',
  contract: 'Contract',
  privacy_notice: 'Privacy Notice',
  other: 'Other',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  pending: { label: 'Pending', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  completed: { label: 'Completed', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
  revoked: { label: 'Revoked', variant: 'destructive', icon: <Ban className="h-3 w-3" /> },
  expired: { label: 'Expired', variant: 'secondary', icon: <XCircle className="h-3 w-3" /> },
};

export default function DocumentApproval() {
  const navigate = useNavigate();
  const { documents, loading, contacts } = useDocumentApproval();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ApprovalDocument | null>(null);

  if (showCreate) {
    return <CreateApprovalFlow onBack={() => setShowCreate(false)} />;
  }

  if (selectedDoc) {
    return <ApprovalDocumentDetail document={selectedDoc} onBack={() => { setSelectedDoc(null); }} />;
  }

  return (
    <>
      <Helmet>
        <title>Document Approval | Notewell</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="h-6 w-6 text-primary" />
                  Document Approval
                </h1>
                <p className="text-sm text-muted-foreground">
                  Send documents for electronic approval and track signatures
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Approval
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['draft', 'pending', 'completed', 'revoked'] as const).map(status => {
              const count = documents.filter(d => d.status === status).length;
              const cfg = statusConfig[status];
              return (
                <Card key={status} className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {cfg.icon} {cfg.label}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Document List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : documents.length === 0 ? (
            <Card className="p-12 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No approval documents yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a document and send it to people for electronic approval.
              </p>
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Approval
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => {
                const cfg = statusConfig[doc.status] || statusConfig.draft;
                return (
                  <Card
                    key={doc.id}
                    className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{doc.title}</h3>
                          <Badge variant={cfg.variant} className="text-xs gap-1">
                            {cfg.icon} {cfg.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {categoryLabels[doc.category] || doc.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{doc.original_filename}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {format(new Date(doc.created_at), 'dd MMM yyyy, HH:mm')}
                          {doc.deadline && ` · Deadline: ${format(new Date(doc.deadline), 'dd MMM yyyy')}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

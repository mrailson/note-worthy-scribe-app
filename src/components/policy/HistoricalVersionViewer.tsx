import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PolicyVersion } from '@/hooks/usePolicyVersions';
import { PolicyDocumentPreview } from '@/components/policy/PolicyDocumentPreview';

interface HistoricalVersionViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: PolicyVersion | null;
  currentVersion: string;
  onDownload: (version: PolicyVersion) => void;
  practiceLogoUrl?: string | null;
  practiceDetails?: {
    practice_name?: string;
    address?: string;
    postcode?: string;
    practice_manager_name?: string;
    lead_gp_name?: string;
  } | null;
}

export const HistoricalVersionViewer = ({
  open,
  onOpenChange,
  version,
  currentVersion,
  onDownload,
  practiceLogoUrl,
  practiceDetails,
}: HistoricalVersionViewerProps) => {
  if (!version) return null;

  const isSuperseded = version.status === 'superseded';
  const content = (version.content as any)?.policy_content || '';
  const versionMeta = (version.content as any)?.metadata || {};

  const metadata = {
    title: versionMeta.title || 'Policy Document',
    version: version.version_number,
    effective_date: versionMeta.effective_date || format(parseISO(version.created_at), 'dd/MM/yyyy'),
    review_date: version.next_review_date
      ? format(parseISO(version.next_review_date), 'dd/MM/yyyy')
      : versionMeta.review_date || '',
    references: versionMeta.references || [],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Superseded banner */}
        {isSuperseded && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Viewing Version {version.version_number} — Superseded on{' '}
              {version.superseded_at ? format(parseISO(version.superseded_at), 'dd/MM/yyyy') : '—'}.
              Current version is v{currentVersion}
            </span>
          </div>
        )}

        {/* Version info bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30">
          <Badge variant="secondary">v{version.version_number}</Badge>
          <span className="text-sm text-muted-foreground">
            Created {format(parseISO(version.created_at), 'dd/MM/yyyy HH:mm')}
            {version.created_by && ` by ${version.created_by}`}
          </span>
        </div>

        {/* Policy content — uses existing PolicyDocumentPreview */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <PolicyDocumentPreview
            content={content}
            metadata={metadata}
            practiceDetails={practiceDetails ? {
              practice_name: practiceDetails.practice_name,
              address: practiceDetails.address,
              postcode: practiceDetails.postcode,
              practice_manager_name: practiceDetails.practice_manager_name,
              lead_gp_name: practiceDetails.lead_gp_name,
            } : undefined}
            practiceLogoUrl={practiceLogoUrl}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onDownload(version)}>
            <Download className="h-4 w-4 mr-2" />
            Download Word
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

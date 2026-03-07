import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PolicyVersion } from '@/hooks/usePolicyVersions';
import ReactMarkdown from 'react-markdown';

interface HistoricalVersionViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: PolicyVersion | null;
  currentVersion: string;
  onDownload: (version: PolicyVersion) => void;
}

export const HistoricalVersionViewer = ({
  open,
  onOpenChange,
  version,
  currentVersion,
  onDownload,
}: HistoricalVersionViewerProps) => {
  if (!version) return null;

  const isSuperseded = version.status === 'superseded';
  const content = (version.content as any)?.policy_content || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Superseded banner */}
        {isSuperseded && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm -mx-8 -mt-5 sm:-mx-10 mb-2 px-8 sm:px-10">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Viewing Version {version.version_number} — Superseded on{' '}
              {version.superseded_at ? format(parseISO(version.superseded_at), 'dd/MM/yyyy') : '—'}.
              Current version is v{currentVersion}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary">v{version.version_number}</Badge>
          <span className="text-sm text-muted-foreground">
            Created {format(parseISO(version.created_at), 'dd/MM/yyyy HH:mm')}
            {version.created_by && ` by ${version.created_by}`}
          </span>
        </div>

        {/* Policy content */}
        <div className="flex-1 overflow-y-auto prose prose-sm dark:prose-invert max-w-none px-1">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onDownload(version)}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

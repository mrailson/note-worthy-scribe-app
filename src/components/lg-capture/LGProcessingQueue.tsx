import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ListOrdered, Upload, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { format } from 'date-fns';

export function LGProcessingQueue() {
  const { activeUploads, queue } = useLGUploadQueue();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm');
  };

  if (queue.length === 0 && activeUploads === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ListOrdered className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No items in queue</p>
          <p className="text-muted-foreground text-sm mt-1">
            Files will appear here when being processed
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <Card key={item.patientId}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">
                  {item.fileName || `Patient ${item.patientId.slice(0, 8)}...`}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
                  {item.fileSize && item.images.length > 0 && <span>•</span>}
                  <span>{item.images.length} pages</span>
                  <span>•</span>
                  <span>Queued at {formatTime(item.queuedAt)}</span>
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-2">
                    <Progress value={item.uploadProgress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploading... {item.uploadProgress}%
                    </p>
                  </div>
                )}
                {item.error && (
                  <p className="text-xs text-destructive mt-1">{item.error}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {item.status === 'uploading' ? (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    <Upload className="h-3 w-3 mr-1 animate-pulse" />
                    Uploading
                  </Badge>
                ) : item.status === 'queued' ? (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Queued
                  </Badge>
                ) : item.status === 'processing' ? (
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                    <Clock className="h-3 w-3 mr-1 animate-spin" />
                    Processing
                  </Badge>
                ) : item.status === 'complete' ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                ) : item.status === 'failed' ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

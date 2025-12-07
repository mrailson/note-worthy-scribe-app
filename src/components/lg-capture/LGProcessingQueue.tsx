import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ListOrdered, Upload, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';

export function LGProcessingQueue() {
  const { activeUploads, queue } = useLGUploadQueue();

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
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  Patient ID: {item.patientId.slice(0, 8)}...
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.images.length} pages
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {item.status === 'uploading' ? (
                  <>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                      <Upload className="h-3 w-3 mr-1 animate-pulse" />
                      Uploading
                    </Badge>
                    <Progress value={item.uploadProgress} className="w-24 h-1.5" />
                  </>
                ) : item.status === 'queued' ? (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Queued
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

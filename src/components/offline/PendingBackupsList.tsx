import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Trash2, Download, Wifi, WifiOff, Upload, CloudOff, CheckCircle2 } from 'lucide-react';
import { useBackupSync } from '@/hooks/useBackupSync';
import { showShadcnToast } from '@/utils/toastWrapper';
import { uploadBackupSegments } from '@/utils/backupUploader';
import { updateSession } from '@/utils/offlineAudioStore';

export const PendingBackupsList: React.FC = () => {
  const {
    isProcessing,
    progress,
    currentSegment,
    totalSegments,
    pendingSessions,
    refreshPendingSessions,
    processSession,
    deleteBackupSession,
  } = useBackupSync();

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  useEffect(() => {
    refreshPendingSessions();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshPendingSessions]);

  if (pendingSessions.length === 0) return null;

  const handleProcess = async (sessionId: string) => {
    try {
      const transcript = await processSession(sessionId);
      showShadcnToast({
        title: 'Backup Processed',
        description: `Transcript recovered: ${transcript?.split(/\s+/).length || 0} words`,
        section: 'meeting_manager',
      });
    } catch (error) {
      showShadcnToast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
        section: 'meeting_manager',
      });
    }
  };

  const handleDelete = async (sessionId: string) => {
    await deleteBackupSession(sessionId);
    showShadcnToast({
      title: 'Backup Deleted',
      description: 'The local backup has been removed',
      section: 'meeting_manager',
    });
  };

  const handleManualUpload = async (session: { id: string; userId?: string; meetingId?: string }) => {
    if (!session.userId) {
      showShadcnToast({
        title: 'Upload Failed',
        description: 'No user ID associated with this backup',
        variant: 'destructive',
        section: 'meeting_manager',
      });
      return;
    }
    try {
      await uploadBackupSegments(
        session.id,
        session.userId,
        session.meetingId || session.id,
        'manual_upload',
      );
      await updateSession(session.id, { status: 'pending' });
      await refreshPendingSessions();
      showShadcnToast({
        title: 'Backup Uploaded',
        description: 'Audio backup has been uploaded to the server',
        section: 'meeting_manager',
      });
    } catch (err) {
      showShadcnToast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
        section: 'meeting_manager',
      });
    }
  };

  const handleExportTranscript = (transcript: string) => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Saved Backups</h2>
        <Badge variant={isOnline ? 'secondary' : 'destructive'} className="gap-1">
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </Badge>
      </div>

      <div className="space-y-3">
        {pendingSessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {formatDate(session.createdAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(session.duration)} · {session.segmentCount} segment{session.segmentCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={session.status === 'error' ? 'destructive' : 'outline'}>
                  {session.status === 'pending_upload' ? 'upload pending' : session.status}
                </Badge>
                {session.remoteFilePaths && session.remoteFilePaths.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Uploaded
                  </Badge>
                )}
              </div>
            </div>

            {session.errorMessage && (
              <p className="text-xs text-destructive">{session.errorMessage}</p>
            )}

            {isProcessing && session.status === 'processing' && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Processing segment {currentSegment} of {totalSegments}…
                </p>
              </div>
            )}

            {session.transcript && (
              <div className="space-y-2">
                <p className="text-sm text-foreground line-clamp-3">{session.transcript}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportTranscript(session.transcript!)}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {session.status === 'pending_upload' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleManualUpload(session)}
                  disabled={!isOnline || isProcessing}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload
                </Button>
              )}
              {session.status !== 'processing' && session.status !== 'pending_upload' && !session.transcript && (
                <Button
                  size="sm"
                  onClick={() => handleProcess(session.id)}
                  disabled={!isOnline || isProcessing}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Process Now
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(session.id)}
                disabled={isProcessing && session.status === 'processing'}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface BackupInfo {
  fileSize: number;
  durationSeconds: number;
  createdAt: string;
  backupReason: string;
  fileType: string;
}

interface BackupBadgeProps {
  meetingId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const BackupBadge: React.FC<BackupBadgeProps> = ({ meetingId }) => {
  const [backup, setBackup] = useState<BackupInfo | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    const fetchBackup = async () => {
      const { data, error } = await supabase
        .from('meeting_audio_backups')
        .select('file_size, duration_seconds, created_at, backup_reason, file_path')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const filePath = data[0].file_path || '';
        const ext = filePath.split('.').pop()?.toLowerCase() || 'webm';
        setBackup({
          fileSize: data[0].file_size || 0,
          durationSeconds: data[0].duration_seconds || 0,
          createdAt: data[0].created_at,
          backupReason: data[0].backup_reason || 'backup',
          fileType: ext.toUpperCase(),
        });
      }
    };

    fetchBackup();
  }, [meetingId]);

  if (!backup) return null;

  const mins = Math.floor(backup.durationSeconds / 60);
  const secs = backup.durationSeconds % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="gap-1 cursor-default text-xs">
          <Shield className="h-3 w-3" />
          Backup · {formatBytes(backup.fileSize)} · {durationStr}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs space-y-1">
        <p className="font-medium">Audio backup available</p>
        <p>Size: {formatBytes(backup.fileSize)}</p>
        <p>Duration: {durationStr}</p>
        <p>Format: {backup.fileType}</p>
      </TooltipContent>
    </Tooltip>
  );
};

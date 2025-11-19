import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AudioBackup {
  id: string;
  meeting_id: string;
  user_id: string;
  file_path: string;
  file_size: number;
  duration_seconds: number;
  transcription_quality_score: number;
  word_count: number;
  expected_word_count: number;
  backup_reason: string;
  is_reprocessed: boolean;
  reprocessed_at: string | null;
  created_at: string;
}

export const AudioBackupManager = () => {
  const { user } = useAuth();
  const [backups, setBackups] = useState<AudioBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [deletingOld, setDeletingOld] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetchAudioBackups();
    fetchAutoDeleteSetting();
  }, []);

  const fetchAudioBackups = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_audio_backups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBackups(data || []);
    } catch (error) {
      console.error('Error fetching audio backups:', error);
      toast.error('Failed to load audio backups');
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoDeleteSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user?.id)
        .eq('setting_key', 'auto_delete_audio_on_meeting_end')
        .maybeSingle();

      if (error) throw error;
      
      setAutoDeleteEnabled(data?.setting_value as boolean || false);
    } catch (error) {
      console.error('Error fetching auto-delete setting:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const reprocessAudio = async (backupId: string) => {
    setReprocessing(backupId);
    try {
      const { data, error } = await supabase.functions.invoke('reprocess-audio-backup', {
        body: { backupId }
      });

      if (error) throw error;

      toast.success('Audio reprocessed successfully');
      await fetchAudioBackups(); // Refresh the list
    } catch (error) {
      console.error('Error reprocessing audio:', error);
      toast.error('Failed to reprocess audio');
    } finally {
      setReprocessing(null);
    }
  };

  const deleteOldAudioBackups = async () => {
    if (!confirm('Are you sure you want to delete all audio backups older than 24 hours? This action cannot be undone.')) {
      return;
    }

    const currentCount = backups.length;
    setDeletingOld(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-old-audio-backups');

      if (error) throw error;

      // Force refresh the list to ensure UI updates
      setBackups([]);
      await fetchAudioBackups();
      
      const deletedCount = data.deleted_count || 0;
      if (deletedCount > 0) {
        toast.success(`Successfully deleted ${deletedCount} old audio backup${deletedCount > 1 ? 's' : ''} and removed from display`);
      } else {
        toast.info('No audio backups older than 24 hours found');
      }
    } catch (error) {
      console.error('Error deleting old audio backups:', error);
      toast.error('Failed to delete old audio backups');
    } finally {
      setDeletingOld(false);
    }
  };

  const deleteAllAudio = async () => {
    setDeletingAll(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-all-audio-backups');

      if (error) throw error;

      // Force refresh the list
      setBackups([]);
      await fetchAudioBackups();
      
      const deletedCount = data.deleted_count || 0;
      toast.success(`Successfully deleted ${deletedCount} audio backup${deletedCount !== 1 ? 's' : ''}`);
      setShowDeleteAllDialog(false);
    } catch (error) {
      console.error('Error deleting all audio backups:', error);
      toast.error('Failed to delete all audio backups');
    } finally {
      setDeletingAll(false);
    }
  };

  const toggleAutoDelete = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user?.id!,
          setting_key: 'auto_delete_audio_on_meeting_end',
          setting_value: checked,
        }, {
          onConflict: 'user_id,setting_key'
        });

      if (error) throw error;

      setAutoDeleteEnabled(checked);
      toast.success(`Auto-delete ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating auto-delete setting:', error);
      toast.error('Failed to update setting');
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityBadge = (score: number) => {
    if (score >= 0.8) return <Badge variant="default" className="bg-green-500">Good</Badge>;
    if (score >= 0.6) return <Badge variant="secondary">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Audio Backup Manager</h2>
          <p className="text-muted-foreground">
            Manage audio backups for meetings with transcription quality issues.
            Only super administrators can access this feature.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteOldAudioBackups}
            disabled={deletingOld || loading}
            className="flex items-center gap-2"
          >
            {deletingOld ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete Old Files (24h+)
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteAllDialog(true)}
            disabled={deletingAll || loading || backups.length === 0}
            className="flex items-center gap-2"
          >
            {deletingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete All Audio
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
        <Checkbox
          id="auto-delete"
          checked={autoDeleteEnabled}
          onCheckedChange={toggleAutoDelete}
          disabled={loadingSettings}
        />
        <Label
          htmlFor="auto-delete"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          Automatically delete all audio once meeting has ended
        </Label>
      </div>

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all audio backups from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAllAudio}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete All Audio'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {backups.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No audio backups found. Backups are automatically created when transcription quality is poor.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {backups.map((backup) => (
            <Card key={backup.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Meeting Audio Backup</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(backup.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {getQualityBadge(backup.transcription_quality_score)}
                    {backup.is_reprocessed && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Reprocessed
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Duration:</span>
                    <p>{formatDuration(backup.duration_seconds)}</p>
                  </div>
                  <div>
                    <span className="font-medium">File Size:</span>
                    <p>{formatFileSize(backup.file_size)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Word Count:</span>
                    <p>{backup.word_count} / {backup.expected_word_count}</p>
                  </div>
                  <div>
                    <span className="font-medium">Quality Score:</span>
                    <p>{(backup.transcription_quality_score * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-sm">Backup Reason:</span>
                  <p className="text-sm text-muted-foreground capitalize">
                    {backup.backup_reason.replace('_', ' ')}
                  </p>
                </div>

                {backup.reprocessed_at && (
                  <div>
                    <span className="font-medium text-sm">Reprocessed:</span>
                    <p className="text-sm text-muted-foreground">
                      {new Date(backup.reprocessed_at).toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reprocessAudio(backup.id)}
                    disabled={reprocessing === backup.id}
                  >
                    {reprocessing === backup.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Reprocess Audio
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
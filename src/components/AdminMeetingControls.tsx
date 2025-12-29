import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { Loader2, Clock, AlertCircle, Trash2 } from 'lucide-react';

export const AdminMeetingControls = () => {
  const { isSystemAdmin } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  if (!isSystemAdmin) return null;

  const runAutoCloseCheck = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-close-inactive-meetings');
      
      if (error) {
        console.error('Auto-close check failed:', error);
        showToast.error('Auto-close check failed: ' + error.message, { section: 'system' });
        return;
      }

      setLastResult(data);
      
      if (data?.closed_meetings > 0) {
        showToast.success(`Auto-closed ${data.closed_meetings} inactive meeting${data.closed_meetings > 1 ? 's' : ''}`, { section: 'system' });
      } else {
        showToast.info('No inactive meetings found to close', { section: 'system' });
      }
      
    } catch (error) {
      console.error('Error in auto-close check:', error);
      showToast.error('Error running auto-close check', { section: 'system' });
    } finally {
      setIsRunning(false);
    }
  };

  const runEmptyMeetingCleanup = async (dryRun = false) => {
    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-cleanup-empty-meetings', {
        body: {
          min_age_hours: 6, // Meetings older than 6 hours
          max_word_threshold: 50, // Less than 50 actual words
          dry_run: dryRun
        }
      });
      
      if (error) {
        console.error('Empty meeting cleanup failed:', error);
        showToast.error('Cleanup failed: ' + error.message, { section: 'system' });
        return;
      }

      setCleanupResult(data);
      
      if (dryRun) {
        showToast.info(`Would delete ${data.would_delete_count || 0} empty meetings`, { section: 'system' });
      } else if (data?.deleted_count > 0) {
        showToast.success(`Cleaned up ${data.deleted_count} empty meeting${data.deleted_count > 1 ? 's' : ''}`, { section: 'system' });
      } else {
        showToast.info('No empty meetings found to clean up', { section: 'system' });
      }
      
    } catch (error) {
      console.error('Error in empty meeting cleanup:', error);
      showToast.error('Error running cleanup', { section: 'system' });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Meeting Auto-Close Service
            <Badge variant="secondary">Admin Only</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Automatically closes meetings that have been recording for 5+ minutes without new transcriptions and are not paused.</p>
            <p className="mt-1">This service runs automatically every 5 minutes, but you can trigger it manually here.</p>
          </div>
          
          <Button 
            onClick={runAutoCloseCheck}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Auto-Close Check...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Run Auto-Close Check Now
              </>
            )}
          </Button>

          {lastResult && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                Last Check Results
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Meetings Checked:</span>
                  <span className="ml-2 font-medium">{lastResult.checked_meetings}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Meetings Closed:</span>
                  <span className="ml-2 font-medium">{lastResult.closed_meetings}</span>
                </div>
              </div>
              {lastResult.closed_meeting_ids && lastResult.closed_meeting_ids.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Closed Meeting IDs:</span>
                  <div className="mt-1 font-mono text-xs break-all">
                    {lastResult.closed_meeting_ids.join(', ')}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Last run: {new Date(lastResult.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Empty Meeting Cleanup
            <Badge variant="secondary">Admin Only</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Cleans up orphaned and empty meetings across all users. Deletes meetings older than 6 hours with less than 50 actual words in transcript chunks.</p>
            <p className="mt-1">This checks actual transcript content, not just the word_count field.</p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => runEmptyMeetingCleanup(true)}
              disabled={isCleaningUp}
              variant="outline"
              className="flex-1"
            >
              {isCleaningUp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                'Preview Cleanup'
              )}
            </Button>
            <Button 
              onClick={() => runEmptyMeetingCleanup(false)}
              disabled={isCleaningUp}
              variant="destructive"
              className="flex-1"
            >
              {isCleaningUp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Run Cleanup
                </>
              )}
            </Button>
          </div>

          {cleanupResult && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                {cleanupResult.dry_run ? 'Preview Results' : 'Cleanup Results'}
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Min Age:</span>
                  <span className="ml-2 font-medium">{cleanupResult.criteria?.min_age_hours || 6} hours</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Words:</span>
                  <span className="ml-2 font-medium">{cleanupResult.criteria?.max_word_threshold || 50}</span>
                </div>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">
                  {cleanupResult.dry_run ? 'Would delete:' : 'Deleted:'}
                </span>
                <span className="ml-2 font-medium text-destructive">
                  {cleanupResult.dry_run ? cleanupResult.would_delete_count : cleanupResult.deleted_count} meetings
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Last run: {new Date(cleanupResult.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
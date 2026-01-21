import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Radio, Clock, User, Skull, PoundSterling, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Cost per hour for Whisper API
const WHISPER_COST_PER_HOUR = 0.24;

interface OrphanedMeeting {
  id: string;
  title: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  created_at: string;
  duration_minutes: number;
  total_word_count: number;
  words_last_5_mins: number;
  running_cost: number;
}

export function OrphanedWhisperMonitor() {
  const [orphanedMeetings, setOrphanedMeetings] = useState<OrphanedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [forceStoppingId, setForceStoppingId] = useState<string | null>(null);
  const [confirmKillMeeting, setConfirmKillMeeting] = useState<OrphanedMeeting | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const calculateCost = (durationMins: number): number => {
    return (durationMins / 60) * WHISPER_COST_PER_HOUR;
  };

  const formatCost = (cost: number): string => {
    return `£${cost.toFixed(2)}`;
  };

  const fetchOrphanedMeetings = async () => {
    setLoading(true);
    try {
      // Fetch all live recordings
      const { data: live, error: liveError } = await supabase
        .rpc('get_all_live_recordings');

      if (liveError) throw liveError;

      // Get user info for all meetings
      const userIds = [...new Set((live || []).map((m: any) => m.user_id).filter(Boolean))];
      
      let userMap: Record<string, { email: string; name: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);
        
        if (profiles) {
          profiles.forEach(p => {
            userMap[p.user_id] = { email: p.email || '', name: p.full_name || '' };
          });
        }
      }

      // Filter for orphaned meetings:
      // - Recording for > 20 mins with no words in last 5 mins, OR
      // - Recording for > 60 mins (potentially stuck)
      const now = new Date();
      const orphaned = (live || [])
        .map((m: any) => {
          const durationMins = differenceInMinutes(now, new Date(m.created_at));
          return {
            id: m.id,
            title: m.title || 'Untitled Meeting',
            user_id: m.user_id,
            user_email: userMap[m.user_id]?.email,
            user_name: userMap[m.user_id]?.name,
            created_at: m.created_at,
            duration_minutes: durationMins,
            total_word_count: m.total_word_count || 0,
            words_last_5_mins: m.words_last_5_mins || 0,
            running_cost: calculateCost(durationMins),
          };
        })
        .filter((m: OrphanedMeeting) => {
          // Orphaned = stalled for > 20 mins OR running for > 60 mins
          const isStalled = m.words_last_5_mins === 0 && m.total_word_count > 0 && m.duration_minutes > 20;
          const isLongRunning = m.duration_minutes > 60;
          return isStalled || isLongRunning;
        });

      setOrphanedMeetings(orphaned);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching orphaned meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrphanedMeetings();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrphanedMeetings, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleForceStop = async (meeting: OrphanedMeeting) => {
    setForceStoppingId(meeting.id);
    try {
      const { data, error } = await supabase.functions.invoke('force-stop-meeting', {
        body: { meetingId: meeting.id }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Meeting "${meeting.title}" force stopped successfully`);
        // Remove from list
        setOrphanedMeetings(prev => prev.filter(m => m.id !== meeting.id));
      } else {
        toast.error(data?.error || 'Failed to force stop meeting');
      }
    } catch (error) {
      console.error('Error force stopping meeting:', error);
      toast.error('Failed to force stop meeting');
    } finally {
      setForceStoppingId(null);
      setConfirmKillMeeting(null);
    }
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm dd/MM/yyyy');
  };

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  const totalRunningCost = orphanedMeetings.reduce((sum, m) => sum + m.running_cost, 0);

  return (
    <>
      <Card className={orphanedMeetings.length > 0 ? 'border-amber-500 border-2' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn(
                "h-5 w-5",
                orphanedMeetings.length > 0 ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'
              )} />
              <CardTitle className="text-lg">
                Orphaned Whisper Connections
                {orphanedMeetings.length > 0 && (
                  <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">
                    {orphanedMeetings.length} Detected
                  </Badge>
                )}
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOrphanedMeetings} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Meetings recording for &gt;60 mins or stalled for &gt;20 mins with no activity
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDateTime(lastRefresh.toISOString())}
          </p>
        </CardHeader>
        <CardContent>
          {orphanedMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No orphaned Whisper connections detected
            </p>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm">
                <span className="text-amber-700 dark:text-amber-300">
                  Total running cost for orphaned connections:
                </span>
                <span className="font-bold text-amber-600 flex items-center gap-1">
                  <PoundSterling className="h-4 w-4" />
                  {formatCost(totalRunningCost).replace('£', '')}
                </span>
              </div>

              {/* Meeting list */}
              {orphanedMeetings.map((meeting) => {
                const isStalled = meeting.words_last_5_mins === 0 && meeting.total_word_count > 0;
                return (
                  <div 
                    key={meeting.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        <span className="font-medium">{meeting.user_email || meeting.user_name || 'Unknown user'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {meeting.title}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started {formatTime(meeting.created_at)}
                        </span>
                        <span className="font-medium text-amber-600">
                          Duration: {formatDuration(meeting.duration_minutes)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex flex-col items-end mr-3 text-xs space-y-1">
                      <div className="flex items-center gap-1">
                        <Radio className="h-3 w-3 text-muted-foreground" />
                        <span>{meeting.total_word_count.toLocaleString()} words</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1",
                        isStalled ? "text-red-600" : "text-amber-600"
                      )}>
                        {isStalled ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        <span>+{meeting.words_last_5_mins} last 5 min</span>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-amber-600">
                        <PoundSterling className="h-3 w-3" />
                        <span>{formatCost(meeting.running_cost)}</span>
                      </div>
                    </div>
                    
                    {/* Kill button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmKillMeeting(meeting)}
                      disabled={forceStoppingId === meeting.id}
                    >
                      {forceStoppingId === meeting.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Skull className="h-4 w-4 mr-1" />
                          Kill
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmKillMeeting} onOpenChange={() => setConfirmKillMeeting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-destructive" />
              Force Stop Meeting
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to force stop "{confirmKillMeeting?.title}"?
              <br /><br />
              This will immediately end the recording. The user will be notified that their meeting was stopped.
              <br /><br />
              <span className="font-medium">
                Current running cost: {formatCost(confirmKillMeeting?.running_cost || 0)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmKillMeeting && handleForceStop(confirmKillMeeting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Force Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

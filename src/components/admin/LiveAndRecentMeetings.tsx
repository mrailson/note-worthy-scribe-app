import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Radio, Clock, User, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MeetingInfo {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  duration_minutes?: number;
  total_word_count: number;
  words_last_5_mins: number;
  last_chunk_at?: string;
}

export function LiveAndRecentMeetings() {
  const [liveMeetings, setLiveMeetings] = useState<MeetingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      // Fetch live recordings using admin RPC function
      const { data: live, error: liveError } = await supabase
        .rpc('get_all_live_recordings');

      if (liveError) throw liveError;

      // Get user info for all meetings
      const userIds = [...new Set((live || []).map(m => m.user_id).filter(Boolean))];
      
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

      // Map meetings with user info
      const mapMeeting = (m: any): MeetingInfo => ({
        id: m.id,
        title: m.title || 'Untitled Meeting',
        status: m.status,
        created_at: m.created_at,
        updated_at: m.updated_at,
        duration_minutes: m.duration_minutes,
        user_email: userMap[m.user_id]?.email,
        user_name: userMap[m.user_id]?.name,
        total_word_count: m.total_word_count || 0,
        words_last_5_mins: m.words_last_5_mins || 0,
        last_chunk_at: m.last_chunk_at,
      });

      setLiveMeetings((live || []).map(mapMeeting));
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMeetings, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm dd/MM/yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Live Recordings */}
      <Card className={liveMeetings.length > 0 ? 'border-red-500 border-2' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${liveMeetings.length > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
              <CardTitle className="text-lg">
                Live Recordings
                {liveMeetings.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {liveMeetings.length} Active
                  </Badge>
                )}
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMeetings} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDateTime(lastRefresh.toISOString())}
          </p>
        </CardHeader>
        <CardContent>
          {liveMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No meetings currently being recorded
            </p>
          ) : (
            <div className="space-y-3">
              {liveMeetings.map((meeting) => {
                const isStalled = meeting.words_last_5_mins === 0 && meeting.total_word_count > 0;
                return (
                  <div 
                    key={meeting.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      isStalled 
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
                        : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        <span className="font-medium">{meeting.user_email || meeting.user_name || 'Unknown user'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        Started {formatTime(meeting.created_at)}
                      </div>
                    </div>
                    
                    {/* Word count stats */}
                    <div className="flex flex-col items-end mr-3 text-xs">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{meeting.total_word_count.toLocaleString()} words</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1",
                        isStalled ? "text-amber-600" : "text-green-600"
                      )}>
                        {isStalled ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        <span>+{meeting.words_last_5_mins} last 5 min</span>
                      </div>
                    </div>
                    
                    <Badge 
                      variant={isStalled ? "outline" : "destructive"} 
                      className={cn(
                        isStalled 
                          ? "border-amber-500 text-amber-600" 
                          : "animate-pulse"
                      )}
                    >
                      <Radio className="h-3 w-3 mr-1" />
                      {isStalled ? "Stalled?" : "Recording"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

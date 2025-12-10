import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Radio, CheckCircle, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface MeetingInfo {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  duration_minutes?: number;
}

export function LiveAndRecentMeetings() {
  const [liveMeetings, setLiveMeetings] = useState<MeetingInfo[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<MeetingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      // Get today at 7am
      const today = new Date();
      today.setHours(7, 0, 0, 0);
      const todayAt7am = today.toISOString();

      // Fetch live recordings (status = 'recording')
      const { data: live, error: liveError } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          status,
          created_at,
          updated_at,
          duration_minutes,
          user_id
        `)
        .eq('status', 'recording')
        .order('created_at', { ascending: false });

      if (liveError) throw liveError;

      // Fetch completed meetings since 7am today
      const { data: recent, error: recentError } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          status,
          created_at,
          updated_at,
          duration_minutes,
          user_id
        `)
        .eq('status', 'completed')
        .gte('updated_at', todayAt7am)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (recentError) throw recentError;

      // Get user info for all meetings
      const allMeetings = [...(live || []), ...(recent || [])];
      const userIds = [...new Set(allMeetings.map(m => m.user_id).filter(Boolean))];
      
      let userMap: Record<string, { email: string; name: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        
        if (profiles) {
          profiles.forEach(p => {
            userMap[p.id] = { email: p.email || '', name: p.full_name || '' };
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
      });

      setLiveMeetings((live || []).map(mapMeeting));
      setRecentMeetings((recent || []).map(mapMeeting));
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

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
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
              {liveMeetings.map((meeting) => (
                <div 
                  key={meeting.id} 
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{meeting.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {meeting.user_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {meeting.user_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Started {formatTime(meeting.created_at)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="destructive" className="animate-pulse">
                    <Radio className="h-3 w-3 mr-1" />
                    Recording
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Completed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">
              Completed Today (since 07:00)
              {recentMeetings.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {recentMeetings.length}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No meetings completed today
            </p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map((meeting) => (
                <div 
                  key={meeting.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{meeting.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {meeting.user_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {meeting.user_name}
                        </span>
                      )}
                      {meeting.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(meeting.duration_minutes)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(meeting.updated_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

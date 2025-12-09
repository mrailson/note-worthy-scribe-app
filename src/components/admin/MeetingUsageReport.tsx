import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, Users, Calendar, TrendingUp } from 'lucide-react';
import { MetricCard } from '@/components/nres/MetricCard';

interface UserMeetingStats {
  user_id: string;
  email: string;
  full_name: string | null;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  all_time: number;
  avg_duration_mins: number;
  total_duration_mins: number;
}

interface SystemStats {
  last_24h: number;
  last_7d: number;
  last_30d: number;
  all_time: number;
  total_duration_mins: number;
  avg_duration_mins: number;
  total_words: number;
}

export const MeetingUsageReport = () => {
  const [userStats, setUserStats] = useState<UserMeetingStats[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetingUsageStats();
  }, []);

  const fetchMeetingUsageStats = async () => {
    try {
      setLoading(true);

      // Fetch system-wide stats
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get all completed meetings with user info
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, user_id, created_at, duration_minutes, word_count, status')
        .eq('status', 'completed');

      if (meetingsError) throw meetingsError;

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name');

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Calculate system-wide stats
      const completedMeetings = meetings || [];
      const systemStatsCalc: SystemStats = {
        last_24h: completedMeetings.filter(m => new Date(m.created_at) >= new Date(last24h)).length,
        last_7d: completedMeetings.filter(m => new Date(m.created_at) >= new Date(last7d)).length,
        last_30d: completedMeetings.filter(m => new Date(m.created_at) >= new Date(last30d)).length,
        all_time: completedMeetings.length,
        total_duration_mins: completedMeetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0),
        avg_duration_mins: completedMeetings.length > 0 
          ? Math.round(completedMeetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / completedMeetings.length)
          : 0,
        total_words: completedMeetings.reduce((sum, m) => sum + (m.word_count || 0), 0),
      };

      setSystemStats(systemStatsCalc);

      // Calculate per-user stats
      const userStatsMap = new Map<string, UserMeetingStats>();

      completedMeetings.forEach(meeting => {
        const userId = meeting.user_id;
        const profile = profileMap.get(userId);
        
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            email: profile?.email || 'Unknown',
            full_name: profile?.full_name || null,
            last_24h: 0,
            last_7d: 0,
            last_30d: 0,
            all_time: 0,
            avg_duration_mins: 0,
            total_duration_mins: 0,
          });
        }

        const stats = userStatsMap.get(userId)!;
        const meetingDate = new Date(meeting.created_at);
        const duration = meeting.duration_minutes || 0;

        stats.all_time += 1;
        stats.total_duration_mins += duration;

        if (meetingDate >= new Date(last24h)) stats.last_24h += 1;
        if (meetingDate >= new Date(last7d)) stats.last_7d += 1;
        if (meetingDate >= new Date(last30d)) stats.last_30d += 1;
      });

      // Calculate averages and sort by all_time descending
      const userStatsArray = Array.from(userStatsMap.values())
        .map(stats => ({
          ...stats,
          avg_duration_mins: stats.all_time > 0 
            ? Math.round(stats.total_duration_mins / stats.all_time) 
            : 0,
        }))
        .filter(stats => stats.all_time > 0)
        .sort((a, b) => b.all_time - a.all_time);

      setUserStats(userStatsArray);
    } catch (error) {
      console.error('Error fetching meeting usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Meeting Usage Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Meeting Usage Report
        </CardTitle>
        <CardDescription>
          Completed meetings statistics across all users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Last 24 Hours"
            value={systemStats?.last_24h || 0}
            tooltip="Completed meetings in the last 24 hours"
            icon={<Clock className="h-4 w-4" />}
            variant={systemStats && systemStats.last_24h > 0 ? 'success' : 'default'}
          />
          <MetricCard
            title="Last 7 Days"
            value={systemStats?.last_7d || 0}
            tooltip="Completed meetings in the last 7 days"
            icon={<Calendar className="h-4 w-4" />}
            variant={systemStats && systemStats.last_7d > 5 ? 'success' : 'default'}
          />
          <MetricCard
            title="Last 30 Days"
            value={systemStats?.last_30d || 0}
            tooltip="Completed meetings in the last 30 days"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            title="All Time"
            value={systemStats?.all_time || 0}
            tooltip="Total completed meetings since system launch"
            icon={<Users className="h-4 w-4" />}
          />
        </div>

        {/* System-wide Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total Duration</p>
            <p className="text-lg font-semibold">{formatDuration(systemStats?.total_duration_mins || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Duration</p>
            <p className="text-lg font-semibold">{formatDuration(systemStats?.avg_duration_mins || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Words Transcribed</p>
            <p className="text-lg font-semibold">{formatNumber(systemStats?.total_words || 0)}</p>
          </div>
        </div>

        {/* Per-User Table */}
        <div>
          <h4 className="text-sm font-medium mb-3">Usage by User</h4>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">24h</TableHead>
                  <TableHead className="text-center">7 Days</TableHead>
                  <TableHead className="text-center">30 Days</TableHead>
                  <TableHead className="text-center">All Time</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                  <TableHead className="text-right">Total Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No completed meetings found
                    </TableCell>
                  </TableRow>
                ) : (
                  userStats.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{user.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {user.last_24h > 0 ? (
                          <Badge variant="default" className="bg-green-600">{user.last_24h}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.last_7d > 0 ? (
                          <Badge variant="secondary">{user.last_7d}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.last_30d > 0 ? (
                          <Badge variant="outline">{user.last_30d}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">{user.all_time}</TableCell>
                      <TableCell className="text-right text-sm">{formatDuration(user.avg_duration_mins)}</TableCell>
                      <TableCell className="text-right text-sm">{formatDuration(user.total_duration_mins)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

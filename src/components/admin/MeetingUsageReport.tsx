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
  deleted_meetings_count: number;
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

const MIN_WORDS_FOR_COUNT = 100;

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

      // Use RPC function to bypass RLS and get all users' stats
      const { data, error } = await supabase.rpc('get_meeting_usage_report');

      if (error) {
        console.error('Error fetching meeting usage report:', error);
        return;
      }

      const results = (data || []) as Array<{
        user_id: string;
        email: string;
        full_name: string | null;
        last_24h: number;
        last_7d: number;
        last_30d: number;
        all_time: number;
        avg_duration_mins: number;
        total_duration_mins: number;
        total_words: number;
        deleted_meetings_count: number;
      }>;

      const totalMeetings = results.reduce((sum, r) => sum + (r.all_time || 0), 0);
      const totalDuration = results.reduce((sum, r) => sum + (r.total_duration_mins || 0), 0);

      // Calculate system-wide totals from all users
      const systemStatsCalc: SystemStats = {
        last_24h: results.reduce((sum, r) => sum + (r.last_24h || 0), 0),
        last_7d: results.reduce((sum, r) => sum + (r.last_7d || 0), 0),
        last_30d: results.reduce((sum, r) => sum + (r.last_30d || 0), 0),
        all_time: totalMeetings,
        total_duration_mins: totalDuration,
        avg_duration_mins: totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0,
        total_words: results.reduce((sum, r) => sum + (r.total_words || 0), 0),
      };

      setSystemStats(systemStatsCalc);

      // Map to user stats
      const userStatsArray: UserMeetingStats[] = results.map(r => ({
        user_id: r.user_id,
        email: r.email || 'Unknown',
        full_name: r.full_name,
        last_24h: r.last_24h || 0,
        last_7d: r.last_7d || 0,
        last_30d: r.last_30d || 0,
        all_time: r.all_time || 0,
        avg_duration_mins: r.avg_duration_mins || 0,
        total_duration_mins: r.total_duration_mins || 0,
        deleted_meetings_count: r.deleted_meetings_count || 0,
      }));

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
          Completed meetings (over {MIN_WORDS_FOR_COUNT} words) statistics across all users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Last 24 Hours"
            value={systemStats?.last_24h || 0}
            tooltip={`Completed meetings (over ${MIN_WORDS_FOR_COUNT} words) in the last 24 hours`}
            icon={<Clock className="h-4 w-4" />}
            variant={systemStats && systemStats.last_24h > 0 ? 'success' : 'default'}
          />
          <MetricCard
            title="Last 7 Days"
            value={systemStats?.last_7d || 0}
            tooltip={`Completed meetings (over ${MIN_WORDS_FOR_COUNT} words) in the last 7 days`}
            icon={<Calendar className="h-4 w-4" />}
            variant={systemStats && systemStats.last_7d > 5 ? 'success' : 'default'}
          />
          <MetricCard
            title="Last 30 Days"
            value={systemStats?.last_30d || 0}
            tooltip={`Completed meetings (over ${MIN_WORDS_FOR_COUNT} words) in the last 30 days`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            title="All Time"
            value={systemStats?.all_time || 0}
            tooltip={`Total completed meetings (over ${MIN_WORDS_FOR_COUNT} words) since system launch`}
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
                  <TableHead className="text-center">Deleted</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                  <TableHead className="text-right">Total Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                      <TableCell className="text-center">
                        {user.deleted_meetings_count > 0 ? (
                          <Badge variant="destructive">{user.deleted_meetings_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
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

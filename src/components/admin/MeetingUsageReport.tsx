import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, Users, Calendar, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField = 'user' | 'last_24h' | 'last_7d' | 'last_30d' | 'all_time' | 'deleted' | 'avg_duration' | 'total_time';
type SortDirection = 'asc' | 'desc';

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
  duration_24h: number;
  duration_7d: number;
  duration_30d: number;
  words_24h: number;
  words_7d: number;
  words_30d: number;
}

const MIN_WORDS_FOR_COUNT = 100;

export const MeetingUsageReport = () => {
  const [userStats, setUserStats] = useState<UserMeetingStats[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('all_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={cn("cursor-pointer hover:bg-muted/50 select-none transition-colors", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'desc' 
            ? <ChevronDown className="h-3 w-3" /> 
            : <ChevronUp className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

  const sortedUserStats = useMemo(() => {
    return [...userStats].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;
      
      switch (sortField) {
        case 'user': 
          aVal = a.full_name || a.email; 
          bVal = b.full_name || b.email; 
          break;
        case 'last_24h': aVal = a.last_24h; bVal = b.last_24h; break;
        case 'last_7d': aVal = a.last_7d; bVal = b.last_7d; break;
        case 'last_30d': aVal = a.last_30d; bVal = b.last_30d; break;
        case 'all_time': aVal = a.all_time; bVal = b.all_time; break;
        case 'deleted': aVal = a.deleted_meetings_count; bVal = b.deleted_meetings_count; break;
        case 'avg_duration': aVal = a.avg_duration_mins; bVal = b.avg_duration_mins; break;
        case 'total_time': aVal = a.total_duration_mins; bVal = b.total_duration_mins; break;
      }
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [userStats, sortField, sortDirection]);

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
        duration_24h: number;
        duration_7d: number;
        duration_30d: number;
        words_24h: number;
        words_7d: number;
        words_30d: number;
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
        duration_24h: results.reduce((sum, r) => sum + (r.duration_24h || 0), 0),
        duration_7d: results.reduce((sum, r) => sum + (r.duration_7d || 0), 0),
        duration_30d: results.reduce((sum, r) => sum + (r.duration_30d || 0), 0),
        words_24h: results.reduce((sum, r) => sum + (r.words_24h || 0), 0),
        words_7d: results.reduce((sum, r) => sum + (r.words_7d || 0), 0),
        words_30d: results.reduce((sum, r) => sum + (r.words_30d || 0), 0),
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
        {/* Overview Cards with Meeting Counts, Duration and Words */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Last 24 Hours */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last 24 Hours</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">{systemStats?.last_24h || 0}</span>
              <span className="text-sm text-muted-foreground">meetings</span>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Total time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats?.duration_24h || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats && systemStats.last_24h > 0 ? Math.round((systemStats.duration_24h || 0) / systemStats.last_24h) : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats?.words_24h || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats && systemStats.last_24h > 0 ? Math.round((systemStats.words_24h || 0) / systemStats.last_24h) : 0)}</span>
              </div>
            </div>
          </div>

          {/* Last 7 Days */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last 7 Days</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">{systemStats?.last_7d || 0}</span>
              <span className="text-sm text-muted-foreground">meetings</span>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Total time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats?.duration_7d || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats && systemStats.last_7d > 0 ? Math.round((systemStats.duration_7d || 0) / systemStats.last_7d) : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats?.words_7d || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats && systemStats.last_7d > 0 ? Math.round((systemStats.words_7d || 0) / systemStats.last_7d) : 0)}</span>
              </div>
            </div>
          </div>

          {/* Last 30 Days */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last 30 Days</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{systemStats?.last_30d || 0}</span>
              <span className="text-sm text-muted-foreground">meetings</span>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Total time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats?.duration_30d || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats && systemStats.last_30d > 0 ? Math.round((systemStats.duration_30d || 0) / systemStats.last_30d) : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats?.words_30d || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats && systemStats.last_30d > 0 ? Math.round((systemStats.words_30d || 0) / systemStats.last_30d) : 0)}</span>
              </div>
            </div>
          </div>

          {/* All Time */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">All Time</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{systemStats?.all_time || 0}</span>
              <span className="text-sm text-muted-foreground">meetings</span>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Total time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats?.total_duration_mins || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg time:</span>
                <span className="font-medium text-foreground">{formatDuration(systemStats?.avg_duration_mins || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats?.total_words || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg words:</span>
                <span className="font-medium text-foreground">{formatNumber(systemStats && systemStats.all_time > 0 ? Math.round((systemStats.total_words || 0) / systemStats.all_time) : 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Per-User Table */}
        <div>
          <h4 className="text-sm font-medium mb-3">Usage by User</h4>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="user">User</SortableHeader>
                  <SortableHeader field="last_24h" className="text-center">24h</SortableHeader>
                  <SortableHeader field="last_7d" className="text-center">7 Days</SortableHeader>
                  <SortableHeader field="last_30d" className="text-center">30 Days</SortableHeader>
                  <SortableHeader field="all_time" className="text-center">All Time</SortableHeader>
                  <SortableHeader field="deleted" className="text-center">Deleted</SortableHeader>
                  <SortableHeader field="avg_duration" className="text-right">Avg Duration</SortableHeader>
                  <SortableHeader field="total_time" className="text-right">Total Time</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUserStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No completed meetings found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUserStats.map((user) => (
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

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mic, 
  RefreshCw, 
  Calendar,
  Clock,
  FileText,
  TrendingUp,
  Timer,
  Hash,
  Users
} from 'lucide-react';

interface ScribeStats {
  count: number;
  words: number;
  durationSeconds: number;
}

interface AllStats {
  today: ScribeStats;
  last24Hours: ScribeStats;
  last7Days: ScribeStats;
  allTime: ScribeStats;
}

interface UserStats {
  user_id: string;
  user_name: string;
  user_email: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  lastConsultationAt: string | null;
  totalDurationSeconds: number;
}

const formatDuration = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '0h 0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatAverageDuration = (totalSeconds: number, count: number): string => {
  if (count === 0 || !totalSeconds) return '0m 0s';
  const avgSeconds = totalSeconds / count;
  const mins = Math.floor(avgSeconds / 60);
  const secs = Math.floor(avgSeconds % 60);
  return `${mins}m ${secs}s`;
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function GPScribeStats() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AllStats>({
    today: { count: 0, words: 0, durationSeconds: 0 },
    last24Hours: { count: 0, words: 0, durationSeconds: 0 },
    last7Days: { count: 0, words: 0, durationSeconds: 0 },
    allTime: { count: 0, words: 0, durationSeconds: 0 }
  });
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Use RPC function to get user stats (bypasses RLS for admin view)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_gp_scribe_stats_by_user');

      if (rpcError) throw rpcError;

      // Calculate aggregate stats from RPC data
      const newStats: AllStats = {
        today: { count: 0, words: 0, durationSeconds: 0 },
        last24Hours: { count: 0, words: 0, durationSeconds: 0 },
        last7Days: { count: 0, words: 0, durationSeconds: 0 },
        allTime: { count: 0, words: 0, durationSeconds: 0 }
      };

      const userStatsArray: UserStats[] = [];

      rpcData?.forEach((row: {
        user_id: string;
        email: string;
        full_name: string | null;
        today_count: number;
        this_week_count: number;
        this_month_count: number;
        all_time_count: number;
        last_consultation_at: string | null;
        total_duration_seconds: number;
        total_words: number;
      }) => {
        // Aggregate totals
        newStats.today.count += row.today_count || 0;
        newStats.allTime.count += row.all_time_count || 0;
        newStats.allTime.words += row.total_words || 0;
        newStats.allTime.durationSeconds += row.total_duration_seconds || 0;

        // For last 24 hours and 7 days, we'll use today and this_week as approximations
        // since exact 24h/7d requires individual consultation timestamps
        newStats.last24Hours.count += row.today_count || 0;
        newStats.last7Days.count += row.this_week_count || 0;

        // Build user stats
        userStatsArray.push({
          user_id: row.user_id,
          user_name: row.full_name || 'Unknown',
          user_email: row.email || '',
          today: row.today_count || 0,
          thisWeek: row.this_week_count || 0,
          thisMonth: row.this_month_count || 0,
          allTime: row.all_time_count || 0,
          lastConsultationAt: row.last_consultation_at,
          totalDurationSeconds: row.total_duration_seconds || 0
        });
      });

      // Sort by all-time count descending
      userStatsArray.sort((a, b) => b.allTime - a.allTime);

      setStats(newStats);
      setUserStats(userStatsArray);
    } catch (error) {
      console.error('Error fetching GP Scribe stats:', error);
      toast.error('Failed to fetch GP Scribe statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="h-6 w-6" />
            GP Scribe Statistics
          </h2>
          <p className="text-muted-foreground">
            Consultation session statistics and usage metrics
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchStats}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Time Period Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today.count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">consultations completed</p>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>Avg: {formatAverageDuration(stats.today.durationSeconds, stats.today.count)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Last 24 Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last24Hours.count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">consultations completed</p>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>Avg: {formatAverageDuration(stats.last24Hours.durationSeconds, stats.last24Hours.count)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Last 7 Days */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last7Days.count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">consultations completed</p>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>Avg: {formatAverageDuration(stats.last7Days.durationSeconds, stats.last7Days.count)}</span>
            </div>
          </CardContent>
        </Card>

        {/* All Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.allTime.count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">total consultations</p>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>Avg: {formatAverageDuration(stats.allTime.durationSeconds, stats.allTime.count)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Totals Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Overall Totals
          </CardTitle>
          <CardDescription>
            Cumulative statistics across all completed scribe sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Consultations */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Hash className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Consultations</p>
                <p className="text-2xl font-bold">{stats.allTime.count.toLocaleString()}</p>
              </div>
            </div>

            {/* Total Words */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Words Transcribed</p>
                <p className="text-2xl font-bold">{stats.allTime.words.toLocaleString()}</p>
              </div>
            </div>

            {/* Total Duration */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Duration</p>
                <p className="text-2xl font-bold">{formatDuration(stats.allTime.durationSeconds)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Notewell AI Scribe - Consultations By User
              </CardTitle>
              <CardDescription>
                Individual user statistics for scribe sessions
              </CardDescription>
            </div>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filter by user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {userStats.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.user_name || user.user_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">This Week</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">All Time</TableHead>
                <TableHead className="text-right">Last Consultation</TableHead>
                <TableHead className="text-right">Avg Length</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const filteredUsers = selectedUserId === 'all' 
                  ? userStats 
                  : userStats.filter(u => u.user_id === selectedUserId);
                
                return filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No consultation data available
                  </TableCell>
                </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.user_name}</div>
                        <div className="text-xs text-muted-foreground">{user.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{user.today}</TableCell>
                    <TableCell className="text-right">{user.thisWeek}</TableCell>
                    <TableCell className="text-right">{user.thisMonth}</TableCell>
                    <TableCell className="text-right font-medium">{user.allTime}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatDateTime(user.lastConsultationAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAverageDuration(user.totalDurationSeconds, user.allTime)}
                    </TableCell>
                  </TableRow>
                  ))
                );
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

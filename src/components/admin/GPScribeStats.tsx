import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Get date boundaries
      const now = new Date();
      
      // Today: start of current day (00:00)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      // Last 24 hours
      const last24HoursStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      
      // Last 7 days
      const last7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Week start (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).toISOString();
      
      // Month start
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all completed consultations
      const { data: consultations, error } = await supabase
        .from('gp_consultations')
        .select('id, user_id, word_count, duration_seconds, created_at, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      const profileMap = new Map<string, { name: string; email: string }>();
      profiles?.forEach(p => profileMap.set(p.user_id, { 
        name: p.full_name || 'Unknown', 
        email: p.email || '' 
      }));

      // Calculate stats for each time period
      const newStats: AllStats = {
        today: { count: 0, words: 0, durationSeconds: 0 },
        last24Hours: { count: 0, words: 0, durationSeconds: 0 },
        last7Days: { count: 0, words: 0, durationSeconds: 0 },
        allTime: { count: 0, words: 0, durationSeconds: 0 }
      };

      // User stats map
      const userStatsMap = new Map<string, UserStats>();

      consultations?.forEach(consultation => {
        const consultationDate = new Date(consultation.created_at);
        const words = consultation.word_count || 0;
        const duration = consultation.duration_seconds || 0;
        const userId = consultation.user_id;

        // All time
        newStats.allTime.count += 1;
        newStats.allTime.words += words;
        newStats.allTime.durationSeconds += duration;

        // Today
        if (consultationDate >= new Date(todayStart)) {
          newStats.today.count += 1;
          newStats.today.words += words;
          newStats.today.durationSeconds += duration;
        }

        // Last 24 hours
        if (consultationDate >= new Date(last24HoursStart)) {
          newStats.last24Hours.count += 1;
          newStats.last24Hours.words += words;
          newStats.last24Hours.durationSeconds += duration;
        }

        // Last 7 days
        if (consultationDate >= new Date(last7DaysStart)) {
          newStats.last7Days.count += 1;
          newStats.last7Days.words += words;
          newStats.last7Days.durationSeconds += duration;
        }

        // User stats
        if (userId) {
          if (!userStatsMap.has(userId)) {
            const profile = profileMap.get(userId);
            userStatsMap.set(userId, {
              user_id: userId,
              user_name: profile?.name || 'Unknown',
              user_email: profile?.email || '',
              today: 0,
              thisWeek: 0,
              thisMonth: 0,
              allTime: 0,
              lastConsultationAt: null,
              totalDurationSeconds: 0
            });
          }

          const uStats = userStatsMap.get(userId)!;

          // All time
          uStats.allTime += 1;
          uStats.totalDurationSeconds += duration;

          // Track last consultation (consultations are ordered desc, so first one is latest)
          if (!uStats.lastConsultationAt) {
            uStats.lastConsultationAt = consultation.created_at;
          }

          // Today
          if (consultationDate >= new Date(todayStart)) {
            uStats.today += 1;
          }

          // This week
          if (consultationDate >= new Date(weekStart)) {
            uStats.thisWeek += 1;
          }

          // This month
          if (consultationDate >= new Date(monthStart)) {
            uStats.thisMonth += 1;
          }
        }
      });

      // Convert user stats to array and sort by all-time count
      const userStatsArray = Array.from(userStatsMap.values())
        .sort((a, b) => b.allTime - a.allTime);

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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Consultations by User
          </CardTitle>
          <CardDescription>
            Individual user statistics for scribe sessions
          </CardDescription>
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
              {userStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No consultation data available
                  </TableCell>
                </TableRow>
              ) : (
                userStats.map((user) => (
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
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

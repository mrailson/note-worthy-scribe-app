import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, BarChart3, TrendingUp, TrendingDown, Minus, Clock, FileCheck, Target, Award, FolderDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StatsData {
  // Time-based page counts
  pagesCurrentHour: number;
  pagesLastHour: number;
  pagesToday: number;
  pagesYesterday: number;
  pagesThisWeek: number;
  pagesLastWeek: number;
  pagesThisMonth: number;
  pagesLastMonth: number;
  pagesThisYear: number;
  pagesAllTime: number;

  // Record counts
  recordsToday: number;
  recordsThisWeek: number;
  recordsThisMonth: number;
  recordsValidated: number;
  recordsPending: number;
  recordsArchived: number;

  // Averages
  avgPagesPerRecord: number;
  avgRecordsPerDay: number;
  avgPagesPerDay: number;
  avgHourlyThroughput: number;
  avgProcessingTimeSeconds: number;
  avgValidationTurnaroundHours: number;

  // Personal bests
  bestHourPages: number;
  bestHourDate: string | null;
  bestDayPages: number;
  bestDayDate: string | null;
  longestRecordPages: number;
  longestRecordPatient: string | null;

  // Streaks
  currentStreak: number;
  longestStreak: number;
}

interface PatientRecord {
  id: string;
  created_at: string;
  images_count: number | null;
  job_status: string | null;
  patient_name: string | null;
  upload_completed_at: string | null;
  pdf_completed_at: string | null;
  validated_at: string | null;
}

interface ArchivedRecord {
  id: string;
  deleted_at: string;
  pages_scanned: number | null;
  scan_date: string | null;
}

export default function LGCaptureMyStats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchStats();
  }, [user?.id]);

  const fetchStats = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Fetch all patient records for this user
      const { data: patients, error: patientsError } = await supabase
        .from('lg_patients')
        .select('id, created_at, images_count, job_status, patient_name, upload_completed_at, pdf_completed_at, validated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (patientsError) throw patientsError;

      // Fetch archived records
      const { data: archived, error: archivedError } = await supabase
        .from('lg_patients_archive')
        .select('id, deleted_at, pages_scanned, scan_date')
        .eq('scanned_by_user_id', user.id);

      if (archivedError) throw archivedError;

      const patientRecords: PatientRecord[] = patients || [];
      const archivedRecords: ArchivedRecord[] = archived || [];

      // Calculate stats
      const calculatedStats = calculateStats(patientRecords, archivedRecords);
      setStats(calculatedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (patients: PatientRecord[], archived: ArchivedRecord[]): StatsData => {
    const now = new Date();
    const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const lastHourStart = new Date(currentHourStart.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);

    // Combine active and archived for page counts
    const allRecords = [
      ...patients.map(p => ({
        date: new Date(p.created_at),
        pages: p.images_count || 0,
        status: p.job_status,
        name: p.patient_name,
        uploadComplete: p.upload_completed_at ? new Date(p.upload_completed_at) : null,
        pdfComplete: p.pdf_completed_at ? new Date(p.pdf_completed_at) : null,
        validatedAt: p.validated_at ? new Date(p.validated_at) : null,
      })),
      ...archived.map(a => ({
        date: new Date(a.scan_date || a.deleted_at),
        pages: a.pages_scanned || 0,
        status: 'archived',
        name: null as string | null,
        uploadComplete: null,
        pdfComplete: null,
        validatedAt: null,
      }))
    ];

    // Time-based page counts
    const pagesCurrentHour = allRecords.filter(r => r.date >= currentHourStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesLastHour = allRecords.filter(r => r.date >= lastHourStart && r.date < currentHourStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesToday = allRecords.filter(r => r.date >= todayStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesYesterday = allRecords.filter(r => r.date >= yesterdayStart && r.date < todayStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesThisWeek = allRecords.filter(r => r.date >= thisWeekStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesLastWeek = allRecords.filter(r => r.date >= lastWeekStart && r.date < thisWeekStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesThisMonth = allRecords.filter(r => r.date >= thisMonthStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesLastMonth = allRecords.filter(r => r.date >= lastMonthStart && r.date <= lastMonthEnd).reduce((sum, r) => sum + r.pages, 0);
    const pagesThisYear = allRecords.filter(r => r.date >= thisYearStart).reduce((sum, r) => sum + r.pages, 0);
    const pagesAllTime = allRecords.reduce((sum, r) => sum + r.pages, 0);

    // Record counts
    const recordsToday = patients.filter(p => new Date(p.created_at) >= todayStart).length;
    const recordsThisWeek = patients.filter(p => new Date(p.created_at) >= thisWeekStart).length;
    const recordsThisMonth = patients.filter(p => new Date(p.created_at) >= thisMonthStart).length;
    const recordsValidated = patients.filter(p => p.job_status === 'validated' || p.validated_at).length;
    const recordsPending = patients.filter(p => p.job_status === 'complete' && !p.validated_at).length;
    const recordsArchived = archived.length;

    // Averages
    const completedRecords = patients.filter(p => (p.images_count || 0) > 0);
    const avgPagesPerRecord = completedRecords.length > 0
      ? completedRecords.reduce((sum, p) => sum + (p.images_count || 0), 0) / completedRecords.length
      : 0;

    // Calculate days with activity
    const uniqueDays = new Set(allRecords.map(r => r.date.toDateString()));
    const daysWithActivity = uniqueDays.size || 1;
    const avgRecordsPerDay = allRecords.length / daysWithActivity;
    const avgPagesPerDay = pagesAllTime / daysWithActivity;

    // Hourly throughput (pages per active hour today)
    const hoursToday = Math.max(1, now.getHours() + 1);
    const avgHourlyThroughput = pagesToday / hoursToday;

    // Average processing time (upload to pdf complete)
    const recordsWithProcessingTime = patients.filter(p => p.upload_completed_at && p.pdf_completed_at);
    const avgProcessingTimeSeconds = recordsWithProcessingTime.length > 0
      ? recordsWithProcessingTime.reduce((sum, p) => {
          const upload = new Date(p.upload_completed_at!).getTime();
          const complete = new Date(p.pdf_completed_at!).getTime();
          return sum + (complete - upload) / 1000;
        }, 0) / recordsWithProcessingTime.length
      : 0;

    // Average validation turnaround (pdf complete to validated)
    const recordsWithValidation = patients.filter(p => p.pdf_completed_at && p.validated_at);
    const avgValidationTurnaroundHours = recordsWithValidation.length > 0
      ? recordsWithValidation.reduce((sum, p) => {
          const complete = new Date(p.pdf_completed_at!).getTime();
          const validated = new Date(p.validated_at!).getTime();
          return sum + (validated - complete) / (1000 * 60 * 60);
        }, 0) / recordsWithValidation.length
      : 0;

    // Personal bests - best hour
    const hourlyPages: Record<string, number> = {};
    allRecords.forEach(r => {
      const hourKey = `${r.date.toDateString()} ${r.date.getHours()}:00`;
      hourlyPages[hourKey] = (hourlyPages[hourKey] || 0) + r.pages;
    });
    let bestHourPages = 0;
    let bestHourDate: string | null = null;
    Object.entries(hourlyPages).forEach(([hour, pages]) => {
      if (pages > bestHourPages) {
        bestHourPages = pages;
        bestHourDate = hour;
      }
    });

    // Best day
    const dailyPages: Record<string, number> = {};
    allRecords.forEach(r => {
      const dayKey = r.date.toDateString();
      dailyPages[dayKey] = (dailyPages[dayKey] || 0) + r.pages;
    });
    let bestDayPages = 0;
    let bestDayDate: string | null = null;
    Object.entries(dailyPages).forEach(([day, pages]) => {
      if (pages > bestDayPages) {
        bestDayPages = pages;
        bestDayDate = day;
      }
    });

    // Longest record
    let longestRecordPages = 0;
    let longestRecordPatient: string | null = null;
    allRecords.forEach(r => {
      if (r.pages > longestRecordPages) {
        longestRecordPages = r.pages;
        longestRecordPatient = r.name;
      }
    });

    // Streaks (consecutive days with activity)
    const sortedDays = Object.keys(dailyPages).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < sortedDays.length; i++) {
      const currentDay = new Date(sortedDays[i]);
      const nextDay = sortedDays[i + 1] ? new Date(sortedDays[i + 1]) : null;
      
      tempStreak++;
      
      if (nextDay) {
        const diffDays = Math.round((currentDay.getTime() - nextDay.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays !== 1) {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          if (i === 0 || currentStreak === 0) currentStreak = tempStreak;
          tempStreak = 0;
        }
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        if (currentStreak === 0) currentStreak = tempStreak;
      }
    }

    // Check if current streak is still active (includes today or yesterday)
    const todayStr = todayStart.toDateString();
    const yesterdayStr = yesterdayStart.toDateString();
    if (!dailyPages[todayStr] && !dailyPages[yesterdayStr]) {
      currentStreak = 0;
    }

    return {
      pagesCurrentHour,
      pagesLastHour,
      pagesToday,
      pagesYesterday,
      pagesThisWeek,
      pagesLastWeek,
      pagesThisMonth,
      pagesLastMonth,
      pagesThisYear,
      pagesAllTime,
      recordsToday,
      recordsThisWeek,
      recordsThisMonth,
      recordsValidated,
      recordsPending,
      recordsArchived,
      avgPagesPerRecord,
      avgRecordsPerDay,
      avgPagesPerDay,
      avgHourlyThroughput,
      avgProcessingTimeSeconds,
      avgValidationTurnaroundHours,
      bestHourPages,
      bestHourDate,
      bestDayPages,
      bestDayDate,
      longestRecordPages,
      longestRecordPatient,
      currentStreak,
      longestStreak,
    };
  };

  const formatTrend = (current: number, previous: number) => {
    if (current > previous) return { icon: TrendingUp, color: 'text-green-500', text: `↑ ${current - previous}` };
    if (current < previous) return { icon: TrendingDown, color: 'text-red-500', text: `↓ ${previous - current}` };
    return { icon: Minus, color: 'text-muted-foreground', text: '—' };
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatHours = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/lg-capture')}
        >
          <Home className="mr-2 h-4 w-4" />
          Back to LG Capture
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/lg-capture/file-view')}
        >
          <FolderDown className="mr-2 h-4 w-4" />
          File Manager
        </Button>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          My Stats
        </h1>
        <p className="text-muted-foreground">Your LG Capture performance metrics</p>
      </div>

      {stats && (
        <>
          {/* Time-Based Page Counts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Pages Scanned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatTile 
                  label="Current Hour" 
                  value={stats.pagesCurrentHour} 
                  trend={formatTrend(stats.pagesCurrentHour, stats.pagesLastHour)} 
                />
                <StatTile 
                  label="Today" 
                  value={stats.pagesToday} 
                  trend={formatTrend(stats.pagesToday, stats.pagesYesterday)} 
                />
                <StatTile 
                  label="This Week" 
                  value={stats.pagesThisWeek} 
                  trend={formatTrend(stats.pagesThisWeek, stats.pagesLastWeek)} 
                />
                <StatTile 
                  label="This Month" 
                  value={stats.pagesThisMonth} 
                  trend={formatTrend(stats.pagesThisMonth, stats.pagesLastMonth)} 
                />
                <StatTile 
                  label="All Time" 
                  value={stats.pagesAllTime} 
                  highlight
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
                <StatTile label="Last Hour" value={stats.pagesLastHour} small />
                <StatTile label="Yesterday" value={stats.pagesYesterday} small />
                <StatTile label="Last Week" value={stats.pagesLastWeek} small />
                <StatTile label="This Year" value={stats.pagesThisYear} small />
              </div>
            </CardContent>
          </Card>

          {/* Record Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Records Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatTile label="Today" value={stats.recordsToday} suffix="records" />
                <StatTile label="This Week" value={stats.recordsThisWeek} suffix="records" />
                <StatTile label="This Month" value={stats.recordsThisMonth} suffix="records" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
                <StatTile 
                  label="Validated" 
                  value={stats.recordsValidated} 
                  small 
                  badgeColor="bg-green-500/10 text-green-600" 
                />
                <StatTile 
                  label="Pending" 
                  value={stats.recordsPending} 
                  small 
                  badgeColor="bg-amber-500/10 text-amber-600" 
                />
                <StatTile 
                  label="Archived" 
                  value={stats.recordsArchived} 
                  small 
                  badgeColor="bg-muted text-muted-foreground" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Averages & Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Averages & Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatTile 
                  label="Pages per Record" 
                  value={stats.avgPagesPerRecord.toFixed(1)} 
                  suffix="avg" 
                />
                <StatTile 
                  label="Records per Day" 
                  value={stats.avgRecordsPerDay.toFixed(1)} 
                  suffix="avg" 
                />
                <StatTile 
                  label="Pages per Day" 
                  value={stats.avgPagesPerDay.toFixed(0)} 
                  suffix="avg" 
                />
                <StatTile 
                  label="Hourly Throughput" 
                  value={stats.avgHourlyThroughput.toFixed(1)} 
                  suffix="pages/hr today" 
                />
                <StatTile 
                  label="Avg Processing Time" 
                  value={formatDuration(stats.avgProcessingTimeSeconds)} 
                  suffix="per record" 
                />
                <StatTile 
                  label="Validation Turnaround" 
                  value={formatHours(stats.avgValidationTurnaroundHours)} 
                  suffix="avg" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Personal Bests */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Personal Bests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatTile 
                  label="Best Hour" 
                  value={stats.bestHourPages} 
                  suffix="pages" 
                  subtext={stats.bestHourDate || 'N/A'}
                  highlight
                />
                <StatTile 
                  label="Best Day" 
                  value={stats.bestDayPages} 
                  suffix="pages" 
                  subtext={stats.bestDayDate ? new Date(stats.bestDayDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'}
                  highlight
                />
                <StatTile 
                  label="Longest Record" 
                  value={stats.longestRecordPages} 
                  suffix="pages" 
                  subtext={stats.longestRecordPatient || 'N/A'}
                  highlight
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
                <StatTile 
                  label="Current Streak" 
                  value={stats.currentStreak} 
                  suffix="days" 
                  badgeColor={stats.currentStreak > 0 ? "bg-green-500/10 text-green-600" : undefined}
                />
                <StatTile 
                  label="Longest Streak" 
                  value={stats.longestStreak} 
                  suffix="days" 
                  highlight
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number | string;
  suffix?: string;
  subtext?: string;
  trend?: { icon: React.ElementType; color: string; text: string };
  highlight?: boolean;
  small?: boolean;
  badgeColor?: string;
}

function StatTile({ label, value, suffix, subtext, trend, highlight, small, badgeColor }: StatTileProps) {
  const TrendIcon = trend?.icon;
  
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-primary/10 border border-primary/20' : badgeColor || 'bg-muted/50'}`}>
      <p className={`text-muted-foreground ${small ? 'text-xs' : 'text-xs'}`}>{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`font-bold ${small ? 'text-lg' : 'text-2xl'} ${highlight ? 'text-primary' : ''}`}>
          {value}
        </span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {trend && TrendIcon && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${trend.color}`}>
          <TrendIcon className="h-3 w-3" />
          <span>{trend.text}</span>
        </div>
      )}
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{subtext}</p>
      )}
    </div>
  );
}

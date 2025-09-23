import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Bot, 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  PlayCircle,
  BarChart3,
  Calendar,
  FileText
} from 'lucide-react';

interface CleaningJob {
  id: string;
  meeting_id: string;
  original_transcript_length: number;
  cleaned_transcript_length?: number;
  word_count: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_processed: number;
  total_chunks: number;
  processing_start_time?: string;
  processing_end_time?: string;
  processing_duration_ms?: number;
  error_message?: string;
  created_at: string;
}

interface DailyStats {
  date: string;
  total_jobs_processed: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  total_processing_time_ms: number;
  average_processing_time_ms: number;
  total_transcripts_cleaned: number;
  total_words_processed: number;
}

const TranscriptCleaningMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<CleaningJob[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadData = async () => {
    try {
      // Load recent jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('transcript_cleaning_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) {
        console.error('Error loading cleaning jobs:', jobsError);
        toast.error('Failed to load cleaning jobs');
      } else {
        setJobs((jobsData || []).map(job => ({
          ...job,
          processing_status: job.processing_status as 'pending' | 'processing' | 'completed' | 'failed'
        })));
      }

      // Load daily stats for last 30 days
      const { data: statsData, error: statsError } = await supabase
        .from('transcript_cleaning_stats')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      if (statsError) {
        console.error('Error loading cleaning stats:', statsError);
        toast.error('Failed to load cleaning statistics');
      } else {
        setDailyStats(statsData || []);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load monitoring data');
    } finally {
      setIsLoading(false);
    }
  };

  const runBackgroundCleaner = async () => {
    setIsRunning(true);
    toast.info('Starting background transcript cleaner...');

    try {
      const { data, error } = await supabase.functions.invoke('background-transcript-cleaner', {
        body: { batchSize: 10 }
      });

      if (error) {
        throw error;
      }

      const result = data;
      
      if (result.success) {
        toast.success(`Cleaning completed: ${result.completedCount} transcripts processed successfully`);
        
        if (result.failedCount > 0) {
          toast.warning(`${result.failedCount} transcripts failed to process`);
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error running background cleaner:', error);
      toast.error(`Failed to run background cleaner: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayStats = dailyStats.find(s => s.date === new Date().toISOString().split('T')[0]);
  const totalStats = dailyStats.reduce((acc, stats) => ({
    total_jobs_processed: acc.total_jobs_processed + stats.total_jobs_processed,
    total_jobs_completed: acc.total_jobs_completed + stats.total_jobs_completed,
    total_jobs_failed: acc.total_jobs_failed + stats.total_jobs_failed,
    total_words_processed: acc.total_words_processed + stats.total_words_processed,
  }), { total_jobs_processed: 0, total_jobs_completed: 0, total_jobs_failed: 0, total_words_processed: 0 });

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading transcript cleaning data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Background Transcript Cleaner</h2>
            <p className="text-sm text-muted-foreground">
              Automated cleaning service for transcripts over 100 words
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button onClick={runBackgroundCleaner} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Running...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalStats.total_jobs_processed)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Jobs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(todayStats?.total_jobs_processed || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(todayStats?.total_jobs_completed || 0)} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.total_jobs_processed > 0 
                ? Math.round((totalStats.total_jobs_completed / totalStats.total_jobs_processed) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totalStats.total_jobs_failed)} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Words Processed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalStats.total_words_processed)}</div>
            <p className="text-xs text-muted-foreground">Total words cleaned</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Cleaning Jobs
          </CardTitle>
          <CardDescription>
            Latest background transcript cleaning operations (last 50)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No cleaning jobs found. Run the background cleaner to start processing transcripts.
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {job.processing_status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {job.processing_status === 'failed' && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      {job.processing_status === 'processing' && (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                      {job.processing_status === 'pending' && (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      
                      <Badge variant={
                        job.processing_status === 'completed' ? 'default' :
                        job.processing_status === 'failed' ? 'destructive' :
                        job.processing_status === 'processing' ? 'secondary' : 'outline'
                      }>
                        {job.processing_status}
                      </Badge>
                    </div>
                    
                    <div>
                      <div className="font-medium">Meeting {job.meeting_id.slice(0, 8)}...</div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(job.word_count)} words • 
                        {job.original_transcript_length} → {job.cleaned_transcript_length || 'N/A'} chars
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                    {job.processing_duration_ms && (
                      <div className="font-medium">
                        {formatDuration(job.processing_duration_ms)}
                      </div>
                    )}
                    {job.error_message && (
                      <div className="text-red-500 text-xs max-w-xs truncate">
                        {job.error_message}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Statistics */}
      {dailyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Statistics (Last 30 Days)
            </CardTitle>
            <CardDescription>
              Daily breakdown of transcript cleaning operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyStats.map((stats) => (
                <div key={stats.date} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-4">
                    <div className="font-medium">
                      {new Date(stats.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatNumber(stats.total_jobs_processed)} jobs</span>
                      <span>•</span>
                      <span className="text-green-500">
                        {formatNumber(stats.total_jobs_completed)} completed
                      </span>
                      {stats.total_jobs_failed > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-500">
                            {formatNumber(stats.total_jobs_failed)} failed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right text-sm">
                    <div className="font-medium">
                      {formatNumber(stats.total_words_processed)} words
                    </div>
                    <div className="text-muted-foreground">
                      Avg: {formatDuration(stats.average_processing_time_ms)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TranscriptCleaningMonitor;
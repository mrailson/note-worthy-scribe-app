import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChunkStats {
  date: string;
  total_chunks_processed: number;
  realtime_chunks_processed: number;
  background_chunks_processed: number;
  failed_chunks: number;
  average_cleaning_time_ms: number;
  active_meetings_monitored: number;
}

interface ActiveMeeting {
  meeting_id: string;
  meeting_title: string;
  total_chunks_processed: number;
  last_activity_at: string;
  is_active: boolean;
}

interface RecentChunk {
  id: string;
  meeting_id: string;
  cleaning_status: string;
  word_count: number;
  cleaned_at: string;
  cleaning_duration_ms: number;
}

const RealtimeCleaningMonitor: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [activeMeetings, setActiveMeetings] = useState<ActiveMeeting[]>([]);
  const [recentChunks, setRecentChunks] = useState<RecentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringCleaning, setIsTriggeringCleaning] = useState(false);
  
  const loadData = async () => {
    try {
      // Load chunk cleaning stats
      const { data: statsData, error: statsError } = await supabase
        .from('chunk_cleaning_stats')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        console.error('Error loading stats:', statsError);
      } else {
        setStats(statsData);
      }

      // Load active meetings
      const { data: activeMeetingsData, error: meetingsError } = await supabase
        .from('active_meetings_monitor')
        .select(`
          meeting_id,
          total_chunks_processed,
          last_activity_at,
          is_active,
          meetings!inner (
            title
          )
        `)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false })
        .limit(10);

      if (meetingsError) {
        console.error('Error loading active meetings:', meetingsError);
      } else {
        const formattedMeetings = activeMeetingsData?.map(m => ({
          meeting_id: m.meeting_id,
          meeting_title: (m as any).meetings?.title || 'Untitled Meeting',
          total_chunks_processed: m.total_chunks_processed,
          last_activity_at: m.last_activity_at,
          is_active: m.is_active
        })) || [];
        setActiveMeetings(formattedMeetings);
      }

      // Load recent chunks
      const { data: chunksData, error: chunksError } = await supabase
        .from('meeting_transcription_chunks')
        .select('id, meeting_id, cleaning_status, word_count, cleaned_at, cleaning_duration_ms')
        .not('cleaning_status', 'eq', 'pending')
        .order('cleaned_at', { ascending: false })
        .limit(20);

      if (chunksError) {
        console.error('Error loading recent chunks:', chunksError);
      } else {
        setRecentChunks(chunksData || []);
      }

    } catch (error) {
      console.error('Error loading realtime cleaning data:', error);
      toast({
        title: "Error",
        description: "Failed to load realtime cleaning monitor data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerRealtimeCleaning = async () => {
    setIsTriggeringCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('realtime-transcript-cleaner', {
        body: { batchSize: 10 }
      });

      if (error) throw error;

      toast({
        title: "Realtime Cleaning Triggered",
        description: `Processing ${data.processed} chunks. ${data.failed} failed.`
      });

      // Reload data to show updated stats
      await loadData();
    } catch (error) {
      console.error('Error triggering realtime cleaning:', error);
      toast({
        title: "Error",
        description: "Failed to trigger realtime cleaning",
        variant: "destructive"
      });
    } finally {
      setIsTriggeringCleaning(false);
    }
  };

  const triggerBackgroundCleaning = async () => {
    setIsTriggeringCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('background-transcript-cleaner', {
        body: { batchSize: 5, mode: 'hybrid' }
      });

      if (error) throw error;

      toast({
        title: "Background Cleaning Triggered",
        description: `Processed ${data.totalProcessed} items. Consolidated ${data.consolidatedMeetings} meetings.`
      });

      await loadData();
    } catch (error) {
      console.error('Error triggering background cleaning:', error);
      toast({
        title: "Error",
        description: "Failed to trigger background cleaning",
        variant: "destructive"
      });
    } finally {
      setIsTriggeringCleaning(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Set up real-time updates
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge className="bg-warning/10 text-warning border-warning/20"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'pending':
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Realtime Transcript Cleaning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading monitoring data...
          </div>
        </CardContent>
      </Card>
    );
  }

  const successRate = stats ? 
    Math.round(((stats.total_chunks_processed - stats.failed_chunks) / Math.max(stats.total_chunks_processed, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Realtime Transcript Cleaning</h2>
          <p className="text-muted-foreground">Monitor and manage real-time transcript processing</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => loadData()} 
            variant="outline"
            disabled={isTriggeringCleaning}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={triggerRealtimeCleaning} 
            disabled={isTriggeringCleaning}
            className="bg-gradient-primary"
          >
            <Zap className="w-4 h-4 mr-2" />
            Trigger Realtime
          </Button>
          <Button 
            onClick={triggerBackgroundCleaning} 
            variant="secondary" 
            disabled={isTriggeringCleaning}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Trigger Background
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Processed Today</p>
                <p className="text-2xl font-bold">{stats?.total_chunks_processed || 0}</p>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Realtime Processed</p>
                <p className="text-2xl font-bold text-success">{stats?.realtime_chunks_processed || 0}</p>
              </div>
              <Zap className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-success">{successRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                <p className="text-2xl font-bold">{stats?.average_cleaning_time_ms || 0}ms</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate Progress */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Success Rate</CardTitle>
            <CardDescription>
              {stats.total_chunks_processed - stats.failed_chunks} successful out of {stats.total_chunks_processed} total chunks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={successRate} className="w-full" />
          </CardContent>
        </Card>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="active-meetings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active-meetings">Active Meetings ({activeMeetings.length})</TabsTrigger>
          <TabsTrigger value="recent-chunks">Recent Chunks ({recentChunks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active-meetings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Currently Active Meetings</CardTitle>
              <CardDescription>
                Meetings with ongoing transcript processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeMeetings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active meetings with ongoing transcript processing
                </div>
              ) : (
                <div className="space-y-3">
                  {activeMeetings.map(meeting => (
                    <div key={meeting.meeting_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{meeting.meeting_title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {meeting.total_chunks_processed} chunks processed
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">
                          <Activity className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Last activity: {new Date(meeting.last_activity_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent-chunks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Chunk Processing</CardTitle>
              <CardDescription>
                Latest transcript chunks that have been processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentChunks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent chunk processing activity
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChunks.map(chunk => (
                    <div key={chunk.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusBadge(chunk.cleaning_status)}
                        <div>
                          <p className="text-sm font-medium">
                            {chunk.word_count} words
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Chunk ID: {chunk.id.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {chunk.cleaning_duration_ms && (
                          <p className="text-muted-foreground">
                            {chunk.cleaning_duration_ms}ms
                          </p>
                        )}
                        {chunk.cleaned_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(chunk.cleaned_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RealtimeCleaningMonitor;
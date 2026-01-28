import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Clock, Users, Calendar, TrendingUp, ChevronDown, ChevronUp, MessageCircle, Image, Presentation, Activity, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortField = 'user' | 'ai4gp' | 'gp_genie' | 'pm_genie' | 'patient_line' | 'total' | 'messages' | 'last_active';
type SortDirection = 'asc' | 'desc';

interface UserGenieStats {
  user_id: string;
  email: string;
  full_name: string | null;
  ai4gp_count: number;
  gp_genie_count: number;
  pm_genie_count: number;
  patient_line_count: number;
  scribe_count: number;
  meeting_count: number;
  total_chats: number;
  total_messages: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  last_active: string | null;
}

interface SystemStats {
  ai4gp_total: number;
  gp_genie_total: number;
  pm_genie_total: number;
  patient_line_total: number;
  scribe_total: number;
  meeting_total: number;
  total_chats: number;
  total_messages: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
}

interface CrossServiceStats {
  images_total: number;
  images_total_cost: number;
  presentations_total: number;
  presentations_total_cost: number;
  meeting_total_mins: number;
  meeting_total_words: number;
  meeting_total_cost: number;
  scribe_total_seconds: number;
  scribe_total_words: number;
  scribe_total_cost: number;
}

// Cost constants in GBP
const WHISPER_COST_PER_HOUR = 0.24;
const IMAGE_COST_PENCE = 4; // 4p per image
const PRESENTATION_COST_PENCE = 12; // 12p per presentation

const formatDuration = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

const formatDurationFromSeconds = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '0h 0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatCost = (cost: number): string => {
  return `£${cost.toFixed(2)}`;
};

export const GenieUsageReport = () => {
  const [userStats, setUserStats] = useState<UserGenieStats[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [crossServiceStats, setCrossServiceStats] = useState<CrossServiceStats>({ 
    images_total: 0,
    images_total_cost: 0,
    presentations_total: 0,
    presentations_total_cost: 0,
    meeting_total_mins: 0,
    meeting_total_words: 0,
    meeting_total_cost: 0,
    scribe_total_seconds: 0,
    scribe_total_words: 0,
    scribe_total_cost: 0
  });
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('total');
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
        case 'ai4gp': aVal = a.ai4gp_count; bVal = b.ai4gp_count; break;
        case 'gp_genie': aVal = a.gp_genie_count; bVal = b.gp_genie_count; break;
        case 'pm_genie': aVal = a.pm_genie_count; bVal = b.pm_genie_count; break;
        case 'patient_line': aVal = a.patient_line_count; bVal = b.patient_line_count; break;
        case 'total': aVal = a.total_chats; bVal = b.total_chats; break;
        case 'messages': aVal = a.total_messages; bVal = b.total_messages; break;
        case 'last_active': 
          aVal = a.last_active ? new Date(a.last_active).getTime() : 0; 
          bVal = b.last_active ? new Date(b.last_active).getTime() : 0; 
          break;
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
    fetchGenieUsageStats();
    fetchCrossServiceStats();
  }, []);

  const fetchCrossServiceStats = async () => {
    try {
      // Fetch image, presentation, meeting, and scribe totals
      const [imageResult, presentationResult, meetingResult, scribeResult] = await Promise.all([
        supabase.rpc('get_image_usage_report'),
        supabase.rpc('get_presentation_usage_report'),
        supabase.rpc('get_meeting_usage_report'),
        supabase.rpc('get_gp_scribe_stats_by_user')
      ]);

      const imagesTotal = (imageResult.data || []).reduce((sum: number, r: any) => sum + (r.total_images || 0), 0);
      const imagesTotalCost = (imagesTotal * IMAGE_COST_PENCE) / 100; // Convert pence to pounds
      
      const presentationsTotal = (presentationResult.data || []).reduce((sum: number, r: any) => sum + (r.total_presentations || 0), 0);
      const presentationsTotalCost = (presentationsTotal * PRESENTATION_COST_PENCE) / 100; // Convert pence to pounds
      
      // Meeting stats
      const meetingTotalMins = (meetingResult.data || []).reduce((sum: number, r: any) => sum + (r.total_duration_mins || 0), 0);
      const meetingTotalWords = (meetingResult.data || []).reduce((sum: number, r: any) => sum + (r.total_words || 0), 0);
      const meetingTotalCost = (meetingTotalMins / 60) * WHISPER_COST_PER_HOUR;
      
      // Scribe stats
      const scribeTotalSeconds = (scribeResult.data || []).reduce((sum: number, r: any) => sum + (r.total_duration_seconds || 0), 0);
      const scribeTotalWords = (scribeResult.data || []).reduce((sum: number, r: any) => sum + (r.total_words || 0), 0);
      const scribeTotalCost = (scribeTotalSeconds / 3600) * WHISPER_COST_PER_HOUR;

      setCrossServiceStats({
        images_total: imagesTotal,
        images_total_cost: imagesTotalCost,
        presentations_total: presentationsTotal,
        presentations_total_cost: presentationsTotalCost,
        meeting_total_mins: meetingTotalMins,
        meeting_total_words: meetingTotalWords,
        meeting_total_cost: meetingTotalCost,
        scribe_total_seconds: scribeTotalSeconds,
        scribe_total_words: scribeTotalWords,
        scribe_total_cost: scribeTotalCost
      });
    } catch (error) {
      console.error('Error fetching cross-service stats:', error);
    }
  };

  const fetchGenieUsageStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_genie_usage_report');

      if (error) {
        console.error('Error fetching genie usage report:', error);
        return;
      }

      // Map RPC output columns (with out_ prefix) to component interface
      const results: UserGenieStats[] = (data || []).map((row: any) => ({
        user_id: row.out_user_id,
        email: row.out_email,
        full_name: row.out_full_name,
        ai4gp_count: row.out_ai4gp_count || 0,
        gp_genie_count: row.out_gp_genie_count || 0,
        pm_genie_count: row.out_pm_genie_count || 0,
        patient_line_count: row.out_patient_line_count || 0,
        scribe_count: row.out_scribe_count || 0,
        meeting_count: row.out_meeting_count || 0,
        total_chats: row.out_total_chats || 0,
        total_messages: row.out_total_messages || 0,
        last_24h: row.out_last_24h || 0,
        last_7d: row.out_last_7d || 0,
        last_30d: row.out_last_30d || 0,
        last_active: row.out_last_active,
      }));

      // Calculate system-wide totals
      const systemStatsCalc: SystemStats = {
        ai4gp_total: results.reduce((sum, r) => sum + (r.ai4gp_count || 0), 0),
        gp_genie_total: results.reduce((sum, r) => sum + (r.gp_genie_count || 0), 0),
        pm_genie_total: results.reduce((sum, r) => sum + (r.pm_genie_count || 0), 0),
        patient_line_total: results.reduce((sum, r) => sum + (r.patient_line_count || 0), 0),
        scribe_total: results.reduce((sum, r) => sum + (r.scribe_count || 0), 0),
        meeting_total: results.reduce((sum, r) => sum + (r.meeting_count || 0), 0),
        total_chats: results.reduce((sum, r) => sum + (r.total_chats || 0), 0),
        total_messages: results.reduce((sum, r) => sum + (r.total_messages || 0), 0),
        last_24h: results.reduce((sum, r) => sum + (r.last_24h || 0), 0),
        last_7d: results.reduce((sum, r) => sum + (r.last_7d || 0), 0),
        last_30d: results.reduce((sum, r) => sum + (r.last_30d || 0), 0),
      };

      setSystemStats(systemStatsCalc);
      setUserStats(results);
    } catch (error) {
      console.error('Error fetching genie usage stats:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Today</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-600">{systemStats?.last_24h || 0}</span>
            <span className="text-sm text-muted-foreground">chats</span>
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
            <span className="text-sm text-muted-foreground">chats</span>
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
            <span className="text-sm text-muted-foreground">chats</span>
          </div>
        </div>

        {/* All Time */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">All Time</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{systemStats?.total_chats || 0}</span>
            <span className="text-sm text-muted-foreground">chats</span>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            <div className="flex justify-between">
              <span>Total messages:</span>
              <span className="font-medium text-foreground">{systemStats?.total_messages || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* All-Time Service Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All-Time Breakdown by Service</CardTitle>
          <CardDescription>Total usage across all AI-powered services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <Bot className="h-5 w-5 mx-auto mb-1 text-amber-600" />
              <div className="text-2xl font-bold text-amber-600">{systemStats?.ai4gp_total || 0}</div>
              <div className="text-xs text-muted-foreground">Ask AI Chats</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <MessageCircle className="h-5 w-5 mx-auto mb-1 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">{systemStats?.gp_genie_total || 0}</div>
              <div className="text-xs text-muted-foreground">GP Genie Phone</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <Image className="h-5 w-5 mx-auto mb-1 text-pink-600" />
              <div className="text-2xl font-bold text-pink-600">{crossServiceStats.images_total}</div>
              <div className="text-xs text-muted-foreground">Image Studio</div>
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t">
                <div className="text-amber-600">{formatCost(crossServiceStats.images_total_cost)}</div>
              </div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <Presentation className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
              <div className="text-2xl font-bold text-indigo-600">{crossServiceStats.presentations_total}</div>
              <div className="text-xs text-muted-foreground">Presentations</div>
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t">
                <div className="text-amber-600">{formatCost(crossServiceStats.presentations_total_cost)}</div>
              </div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <Activity className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{systemStats?.meeting_total || 0}</div>
              <div className="text-xs text-muted-foreground">Meeting Service</div>
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t space-y-0.5">
                <div>{formatDuration(crossServiceStats.meeting_total_mins)} • {formatNumber(crossServiceStats.meeting_total_words)} words</div>
                <div className="text-amber-600">{formatCost(crossServiceStats.meeting_total_cost)}</div>
              </div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <Mic className="h-5 w-5 mx-auto mb-1 text-teal-600" />
              <div className="text-2xl font-bold text-teal-600">{systemStats?.scribe_total || 0}</div>
              <div className="text-xs text-muted-foreground">GP Scribe</div>
              <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t space-y-0.5">
                <div>{formatDurationFromSeconds(crossServiceStats.scribe_total_seconds)} • {formatNumber(crossServiceStats.scribe_total_words)} words</div>
                <div className="text-amber-600">{formatCost(crossServiceStats.scribe_total_cost)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-User Table */}
      <div>
        <h4 className="text-sm font-medium mb-3">Usage by User</h4>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="user">User</SortableHeader>
                <SortableHeader field="ai4gp" className="text-center">AI4GP</SortableHeader>
                <SortableHeader field="gp_genie" className="text-center">GP Genie</SortableHeader>
                <SortableHeader field="pm_genie" className="text-center">PM Genie</SortableHeader>
                <SortableHeader field="patient_line" className="text-center">Patient Line</SortableHeader>
                <SortableHeader field="total" className="text-center">Total</SortableHeader>
                <SortableHeader field="messages" className="text-center">Messages</SortableHeader>
                <SortableHeader field="last_active" className="text-right">Last Active</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUserStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No Genie chats found
                  </TableCell>
                </TableRow>
              ) : (
                sortedUserStats.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name || 'Unnamed User'}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {user.ai4gp_count > 0 ? (
                        <Badge variant="outline" className="text-amber-600">{user.ai4gp_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.gp_genie_count > 0 ? (
                        <Badge variant="outline" className="text-purple-600">{user.gp_genie_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.pm_genie_count > 0 ? (
                        <Badge variant="outline" className="text-blue-600">{user.pm_genie_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.patient_line_count > 0 ? (
                        <Badge variant="outline" className="text-green-600">{user.patient_line_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{user.total_chats}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">{user.total_messages}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {user.last_active ? (
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(user.last_active), 'dd/MM/yyyy HH:mm')}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';

interface UserMeetingStats {
  user_id: string;
  email: string;
  full_name: string | null;
  meeting_count: number;
  completed_meetings: number;
  recording_meetings: number;
  first_meeting_date: string;
  latest_meeting_date: string;
}

export const MeetingStatsByUser = () => {
  const [stats, setStats] = useState<UserMeetingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMeetings, setTotalMeetings] = useState(0);

  useEffect(() => {
    fetchMeetingStats();
  }, []);

  const fetchMeetingStats = async () => {
    try {
      setLoading(true);
      
      console.log('[MeetingStatsByUser] Starting fetch...');
      
      // Query meetings directly
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('user_id, status, created_at');
      
      if (meetingsError) {
        console.error('[MeetingStatsByUser] Error fetching meetings:', meetingsError);
        return;
      }
      
      console.log(`[MeetingStatsByUser] Fetched ${meetings?.length || 0} meetings`);
      
      if (meetings && meetings.length > 0) {
        // Group by user
        const userStats: Record<string, any> = {};
        meetings.forEach(m => {
          if (!userStats[m.user_id]) {
            userStats[m.user_id] = {
              user_id: m.user_id,
              meeting_count: 0,
              completed_meetings: 0,
              recording_meetings: 0,
              first_meeting_date: m.created_at,
              latest_meeting_date: m.created_at,
              email: '',
              full_name: null
            };
          }
          userStats[m.user_id].meeting_count++;
          if (m.status === 'completed') userStats[m.user_id].completed_meetings++;
          if (m.status === 'recording') userStats[m.user_id].recording_meetings++;
          if (new Date(m.created_at) < new Date(userStats[m.user_id].first_meeting_date)) {
            userStats[m.user_id].first_meeting_date = m.created_at;
          }
          if (new Date(m.created_at) > new Date(userStats[m.user_id].latest_meeting_date)) {
            userStats[m.user_id].latest_meeting_date = m.created_at;
          }
        });

        const uniqueUserIds = Object.keys(userStats);
        console.log(`[MeetingStatsByUser] Found ${uniqueUserIds.length} unique users with meetings`);

        // Fetch user details from profiles table
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', uniqueUserIds);
        
        if (profilesError) {
          console.error('[MeetingStatsByUser] Error fetching profiles:', profilesError);
        }
        
        console.log(`[MeetingStatsByUser] Fetched ${profiles?.length || 0} profiles`);
        
        const enrichedStats: UserMeetingStats[] = Object.values(userStats).map((stat: any) => {
          const profile = profiles?.find((p: any) => p.id === stat.user_id);
          return {
            ...stat,
            email: profile?.email || 'Unknown',
            full_name: profile?.full_name || null
          };
        });

        // Filter to only show users with 1 or more meetings (already implicit, but being explicit)
        const filteredStats = enrichedStats.filter(s => s.meeting_count >= 1);
        
        filteredStats.sort((a, b) => b.meeting_count - a.meeting_count);
        
        console.log(`[MeetingStatsByUser] Final stats for ${filteredStats.length} users:`, filteredStats);
        
        setStats(filteredStats);
        setTotalMeetings(filteredStats.reduce((sum, s) => sum + s.meeting_count, 0));
      } else {
        console.log('[MeetingStatsByUser] No meetings found');
        setStats([]);
        setTotalMeetings(0);
      }
    } catch (error) {
      console.error('[MeetingStatsByUser] Error fetching meeting stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Meetings by User
          </CardTitle>
          <CardDescription>Loading meeting statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Meetings by User
        </CardTitle>
        <CardDescription>
          Total meetings in system: <Badge variant="secondary">{totalMeetings}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No meetings found in the system
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Recording</TableHead>
                  <TableHead>First Meeting</TableHead>
                  <TableHead>Latest Meeting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.user_id}>
                    <TableCell className="font-medium">
                      {stat.full_name || 'Unnamed User'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stat.email}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{stat.meeting_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-green-600">
                        {stat.completed_meetings}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.recording_meetings > 0 ? (
                        <Badge variant="outline" className="text-orange-600">
                          {stat.recording_meetings}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(stat.first_meeting_date), 'dd/MM/yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(stat.latest_meeting_date), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

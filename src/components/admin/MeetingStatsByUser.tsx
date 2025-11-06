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
      
      // Query meetings directly
      const { data: meetings } = await supabase
        .from('meetings')
        .select('user_id, status, created_at');
      
      if (meetings) {
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

        // Fetch user details
        const { data: authData } = await supabase.auth.admin.listUsers();
        
        const enrichedStats: UserMeetingStats[] = Object.values(userStats).map((stat: any) => {
          const user = authData?.users?.find((u: any) => u.id === stat.user_id);
          return {
            ...stat,
            email: user?.email || 'Unknown',
            full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || null
          };
        });

        enrichedStats.sort((a, b) => b.meeting_count - a.meeting_count);
        setStats(enrichedStats);
        setTotalMeetings(enrichedStats.reduce((sum, s) => sum + s.meeting_count, 0));
      }
    } catch (error) {
      console.error('Error fetching meeting stats:', error);
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
                  <TableHead>User</TableHead>
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
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {stat.full_name || 'Unnamed User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stat.email}
                        </span>
                      </div>
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
